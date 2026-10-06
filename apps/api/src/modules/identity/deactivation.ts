import {createHash,randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import type {AccountDeactivationRequest,AccountDeactivationExecutionRequest} from '@conecta/contracts';
import {AuthError,type SessionContext,type SessionService} from './sessions.js';
import {administrationLoginEligible} from './roles.js';
import {createIdentityLifecycleComposition} from '../../composition/identity-lifecycle.js';
import type {LifecycleRequest} from './lifecycle.js';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function id(value:unknown){if(typeof value!=='string'||!uuid.test(value))throw new AuthError('INVALID_REQUEST');return value.toLowerCase();}
function parse(value:unknown,execution:boolean):AccountDeactivationRequest&Partial<AccountDeactivationExecutionRequest>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['confirmation','creditChoice','dependentPersonIds',...(execution?['idempotencyKey','expectedRevision']:[])].includes(k)))throw new AuthError('INVALID_REQUEST');
  const v=value as Record<string,unknown>;
  if(v.confirmation!==true||v.creditChoice!==undefined&&!['keep','leave-family'].includes(v.creditChoice as string)
    ||v.dependentPersonIds!==undefined&&(!Array.isArray(v.dependentPersonIds)||v.dependentPersonIds.length>99))throw new AuthError('INVALID_REQUEST');
  const dependentPersonIds=[...new Set(((v.dependentPersonIds??[]) as unknown[]).map(id))].sort();
  if(execution&&(typeof v.expectedRevision!=='string'||!/^[a-f0-9]{64}$/.test(v.expectedRevision)))throw new AuthError('INVALID_REQUEST');
  return {confirmation:true,dependentPersonIds,creditChoice:v.creditChoice as AccountDeactivationRequest['creditChoice'],
    ...(execution?{idempotencyKey:id(v.idempotencyKey),expectedRevision:v.expectedRevision as string}:{})};
}
interface Account {id:string;person_id:string;status:string;confirmation_status:string;session_version:number}
interface Guardian {id:string;dependent_person_id:string;guardian_account_id:string}
interface Membership {id:string;family_id:string;person_id:string}
interface Scope {personIds:string[];accountIds:string[];dependentIds:string[];familyIds:string[]}
const unique=(values:string[])=>[...new Set(values)].sort();
// Discover first, lock canonically, then discover again. Never acquire a late
// account lock after person/relationship locks when a concurrent join appears.
async function discover(c:PoolClient,actorId:string,targetId:string,chosen:string[]):Promise<Scope>{
  const target=(await c.query<{person_id:string}>('SELECT person_id FROM accounts WHERE id=$1',[targetId])).rows[0];
  const dependentIds=unique([...chosen,...(await c.query<{dependent_person_id:string}>('SELECT dependent_person_id FROM dependent_guardians WHERE guardian_account_id=$1 AND ended_at IS NULL',[targetId])).rows.map(g=>g.dependent_person_id)]);
  const affected=unique([...(target?[target.person_id]:[]),...dependentIds]);
  const familyIds=(await c.query<{family_id:string}>('SELECT DISTINCT family_id FROM family_memberships WHERE person_id=ANY($1::uuid[]) AND ended_at IS NULL',[affected])).rows.map(m=>m.family_id).sort();
  const personIds=unique([...affected,...(await c.query<{person_id:string}>('SELECT person_id FROM family_memberships WHERE family_id=ANY($1::uuid[]) AND ended_at IS NULL',[familyIds])).rows.map(m=>m.person_id)]);
  const accountIds=unique([actorId,targetId,...(await c.query<{id:string}>('SELECT id FROM accounts WHERE person_id=ANY($1::uuid[])',[personIds])).rows.map(a=>a.id),...(await c.query<{guardian_account_id:string}>('SELECT guardian_account_id FROM dependent_guardians WHERE dependent_person_id=ANY($1::uuid[]) AND ended_at IS NULL',[dependentIds])).rows.map(g=>g.guardian_account_id)]);
  const accountPeople=(await c.query<{person_id:string}>('SELECT person_id FROM accounts WHERE id=ANY($1::uuid[])',[accountIds])).rows.map(a=>a.person_id);
  return {personIds:unique([...personIds,...accountPeople]),accountIds,dependentIds,familyIds};
}
export function createDeactivationService(pool:Pool,sessions:SessionService,options:{composition?:ReturnType<typeof createIdentityLifecycleComposition>;now?:()=>Date;environment?:NodeJS.ProcessEnv}={}){
  const composition=options.composition??createIdentityLifecycleComposition(),clock=options.now??(()=>new Date()),environment={...(options.environment??process.env)};
  async function transaction<T>(target:unknown,value:unknown,token:unknown,execution:boolean,work:(c:PoolClient,request:LifecycleRequest,state:{target:Account;context:SessionContext;self:boolean;management:boolean;memberships:Membership[];guardians:Guardian[]},input:ReturnType<typeof parse>)=>Promise<T>):Promise<T>{
    const targetId=id(target),input=parse(value,execution),context=await sessions.resolve(token),c=await pool.connect();
    try{
      await c.query('BEGIN');
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended('identity-active-administration',0))");
      const scope=await discover(c,context.account.id,targetId,input.dependentPersonIds??[]);
      if(scope.personIds.length>1000)throw new AuthError('CONFLICT'); // Internal transaction bound, not a family-size rule.
      const accounts=(await c.query<Account>('SELECT id,person_id,status,confirmation_status,session_version FROM accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[scope.accountIds])).rows;
      const people=(await c.query<{id:string;status:string}>('SELECT id,status FROM people WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[scope.personIds])).rows;
      const roles=(await c.query<{account_id:string;role:string}>('SELECT account_id,role FROM account_roles WHERE account_id=ANY($1::uuid[]) ORDER BY account_id,role FOR UPDATE',[scope.accountIds])).rows;
      const session=(await c.query<{expires_at:Date;authenticated_at:Date}>(`SELECT expires_at,authenticated_at FROM identity_sessions WHERE id=$1 AND account_id=$2 AND session_version=$3 AND revoked_at IS NULL FOR UPDATE`,[context.sessionId,context.account.id,context.sessionVersion])).rows[0];
      const actor=accounts.find(a=>a.id===context.account.id),actorRoles=roles.filter(r=>r.account_id===context.account.id).map(r=>r.role),self=targetId===context.account.id,management=actorRoles.some(r=>['administrator','manager'].includes(r));
      function authorize(){const now=+clock();if(!actor||actor.status!=='active'||!['verified','exempt'].includes(actor.confirmation_status)||actor.session_version!==context.sessionVersion||people.find(p=>p.id===actor.person_id)?.status!=='active'||!session||+session.expires_at<=now)throw new AuthError('UNAUTHENTICATED');if(self&&now-+session.authenticated_at>=600000)throw new AuthError('RECENT_AUTH_REQUIRED');}
      authorize();
      if(self?!actorRoles.includes('customer'):!management)throw new AuthError('FORBIDDEN');
      if(self&&input.creditChoice===undefined||!self&&input.creditChoice==='leave-family')throw new AuthError('INVALID_REQUEST');
      const targetAccount=accounts.find(a=>a.id===targetId);if(!targetAccount)throw new AuthError('NOT_FOUND');
      await c.query('SELECT person_id FROM dependent_profiles WHERE person_id=ANY($1::uuid[]) ORDER BY person_id FOR UPDATE',[scope.dependentIds]);
      const guardians=(await c.query<Guardian>('SELECT id,dependent_person_id,guardian_account_id FROM dependent_guardians WHERE dependent_person_id=ANY($1::uuid[]) AND ended_at IS NULL ORDER BY id FOR UPDATE',[scope.dependentIds])).rows;
      await c.query('SELECT id FROM families WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[scope.familyIds]);
      const memberships=(await c.query<Membership>('SELECT id,family_id,person_id FROM family_memberships WHERE family_id=ANY($1::uuid[]) AND ended_at IS NULL ORDER BY id FOR UPDATE',[scope.familyIds])).rows;
      if(JSON.stringify(await discover(c,context.account.id,targetId,input.dependentPersonIds??[]))!==JSON.stringify(scope))throw new AuthError('CONFLICT');
      const request:LifecycleRequest={actorAccountId:actor!.id,operation:'account-deactivation',personIds:unique([targetAccount.person_id,...input.dependentPersonIds??[]]),identityRevision:createHash('sha256').update(JSON.stringify({targetId,input:{confirmation:true,creditChoice:input.creditChoice??'keep',dependentPersonIds:input.dependentPersonIds}})).digest('hex'),deactivation:{accountId:targetId,creditChoice:input.creditChoice??'keep'}};
      // Matching receipts may replay after target relationships/status changed;
      // guard checks their original intent, while this caller freshly authorizes.
      const completed=execution&&(await c.query('SELECT id FROM identity_lifecycle_operations WHERE actor_account_id=$1 AND idempotency_key=$2',[actor!.id,input.idempotencyKey])).rowCount;
      if(!completed){
        if(!['active','pending'].includes(targetAccount.status)||people.find(p=>p.id===targetAccount.person_id)?.status!=='active')throw new AuthError('CONFLICT');
        for(const childId of scope.dependentIds){
          if(people.find(p=>p.id===childId)?.status!=='active')continue;
          const current=guardians.filter(g=>g.dependent_person_id===childId);
          const own=current.some(g=>g.guardian_account_id===targetId);
          const remaining=current.some(g=>g.guardian_account_id!==targetId&&accounts.some(a=>a.id===g.guardian_account_id&&a.status==='active'&&['verified','exempt'].includes(a.confirmation_status)&&people.some(p=>p.id===a.person_id&&p.status==='active')&&roles.some(r=>r.account_id===a.id&&r.role==='customer')));
          const joint=input.dependentPersonIds?.includes(childId);
          if(joint&&(!own||remaining)||own&&!remaining&&!joint||joint&&(await c.query('SELECT independent_at FROM dependent_profiles WHERE person_id=$1',[childId])).rows[0]?.independent_at)throw new AuthError('CONFLICT');
        }
        if(input.dependentPersonIds?.some(childId=>!guardians.some(g=>g.dependent_person_id===childId&&g.guardian_account_id===targetId)||people.find(p=>p.id===childId)?.status!=='active'))throw new AuthError('CONFLICT');
        if(roles.some(r=>r.account_id===targetId&&['administrator','manager'].includes(r.role))){
          const remaining=(await c.query<{password_hash:string;email:string;development_fixture:string|null}>(`SELECT a.password_hash,a.email,a.development_fixture FROM accounts a JOIN people p ON p.id=a.person_id WHERE a.id<>$1 AND a.status='active' AND p.status='active' AND a.confirmation_status IN ('verified','exempt') AND EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role IN ('administrator','manager'))`,[targetId])).rows;
          let eligible=false;for(const row of remaining)if(await administrationLoginEligible(c,pool,environment,row)){eligible=true;break;}if(!eligible)throw new AuthError('CONFLICT');
        }
      }
      const result=await work(c,request,{target:targetAccount,context,self,management,memberships,guardians},input);
      // Domain lock waits cannot extend authorization or recent authentication.
      authorize();await c.query('COMMIT');return result;
    }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
  }
  return {
    preview(target:unknown,value:unknown,token:unknown){return transaction(target,value,token,false,(c,r)=>composition.preview(c,r));},
    execute(target:unknown,value:unknown,token:unknown){return transaction(target,value,token,true,(c,request,state,input)=>composition.execute(c,{...request,idempotencyKey:input.idempotencyKey!,expectedRevision:input.expectedRevision!},async tx=>{
      const now=clock(),correlationId=randomUUID();
      // Status snapshot trigger captures exact prior guardians before access ends.
      for(const childId of input.dependentPersonIds??[]){await tx.query("UPDATE people SET status='inactive',updated_at=$2 WHERE id=$1",[childId,now]);await tx.query("UPDATE dependent_guardians SET ended_at=clock_timestamp(),end_reason='dependent_deactivated' WHERE dependent_person_id=$1 AND ended_at IS NULL",[childId]);await tx.query(`INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,changes,reason,correlation_id) VALUES ($1,$2,'dependent.deactivated','dependent',$3,$4,'Dependent jointly deactivated with sole guardian',$5)`,[request.actorAccountId,state.management?'staff':'customer',childId,JSON.stringify({before:{personId:childId},after:{personId:childId}}),correlationId]);}
      await tx.query("UPDATE dependent_guardians SET ended_at=clock_timestamp(),end_reason='guardian_deactivated' WHERE guardian_account_id=$1 AND ended_at IS NULL",[state.target.id]);
      const leaving=state.memberships.filter(m=>request.personIds.includes(m.person_id));
      for(const m of leaving){
        await tx.query("UPDATE family_memberships SET ended_at=clock_timestamp(),end_reason='deactivated' WHERE id=$1",[m.id]);
        await tx.query(`INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,changes,reason,correlation_id) VALUES ($1,$2,'family.member_left','family',$3,$4,'Membership ended by account deactivation',$5)`,[request.actorAccountId,state.management?'staff':'customer',m.family_id,JSON.stringify({before:{membershipId:m.id,personId:m.person_id},after:{membershipId:m.id,personId:m.person_id}}),correlationId]);
      }
      for(const familyId of unique(leaving.map(m=>m.family_id))){
        const remaining=state.memberships.filter(m=>m.family_id===familyId&&!request.personIds.includes(m.person_id));
        await tx.query(`UPDATE families SET responsible_membership_id=CASE WHEN responsible_membership_id=ANY($2::uuid[]) THEN NULL ELSE responsible_membership_id END,status=$3,closed_at=CASE WHEN $3='closed' THEN clock_timestamp() ELSE NULL END,version=version+1 WHERE id=$1`,[familyId,leaving.map(m=>m.id),remaining.length?'active':'closed']);
        if(!remaining.length)await tx.query(`INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,changes,reason,correlation_id) VALUES ($1,$2,'family.closed','family',$3,$4,'Last membership ended by deactivation with coordinated disposition',$5)`,[request.actorAccountId,state.management?'staff':'customer',familyId,JSON.stringify({before:{status:'active'},after:{status:'closed'}}),correlationId]);
      }
      await tx.query("UPDATE accounts SET status='inactive',deactivated_at=$2,session_version=session_version+1,updated_at=$2 WHERE id=$1",[state.target.id,now]);await tx.query("UPDATE people SET status='inactive',updated_at=$2 WHERE id=$1",[state.target.person_id,now]);await tx.query('UPDATE identity_sessions SET revoked_at=$2 WHERE account_id=$1 AND revoked_at IS NULL',[state.target.id,now]);
      await tx.query(`INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,changes,reason,correlation_id) VALUES ($1,$2,'account.deactivated','account',$3,$4,$5,$6)`,[request.actorAccountId,state.management?'staff':'customer',state.target.id,JSON.stringify({before:{status:state.target.status},after:{status:'inactive'}}),state.self?'Customer deactivated own account':'Account deactivated by management',correlationId]);
    }));}
  };
}
