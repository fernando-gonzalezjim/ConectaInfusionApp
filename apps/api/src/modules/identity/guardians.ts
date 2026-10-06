import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import type {GuardianRemovalTarget,GuardianRemovedResponse,IdentityPage} from '@conecta/contracts';
import {AuthError,type SessionContext,type SessionService} from './sessions.js';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function id(value:unknown){if(typeof value!=='string'||!uuid.test(value))throw new AuthError('INVALID_REQUEST');return value.toLowerCase();}
function object(value:unknown,fields:string[]){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!fields.includes(key)))throw new AuthError('INVALID_REQUEST');return value as Record<string,unknown>;}
interface Account {id:string;person_id:string;status:string;confirmation_status:string;session_version:number}
interface Person {id:string;status:string;full_name:string}
interface Relationship {id:string;guardian_account_id:string}
export function createGuardianService(pool:Pool,sessions:SessionService){
  async function checkSession(client:PoolClient,context:SessionContext){const session=(await client.query<{expires_at:Date}>('SELECT expires_at FROM identity_sessions WHERE id=$1 AND account_id=$2 AND session_version=$3 AND revoked_at IS NULL FOR UPDATE',[context.sessionId,context.account.id,context.sessionVersion])).rows[0];if(!session||+session.expires_at<=Date.now())throw new AuthError('UNAUTHENTICATED');}
  async function transaction<T>(dependentId:string,token:unknown,work:(client:PoolClient,context:SessionContext,state:Awaited<ReturnType<typeof authorize>>)=>Promise<T>){
    const context=await sessions.resolve(token),client=await pool.connect();try{await client.query('BEGIN');const state=await authorize(client,context,dependentId);const result=await work(client,context,state);await checkSession(client,context);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async function authorize(client:PoolClient,context:SessionContext,dependentId:string){
    // Snapshot only supplies lock candidates, never permission. Lock accounts and
    // people in UUID order before profile/relationships, as invitation/role flows do.
    const hints=(await client.query<Relationship>('SELECT id,guardian_account_id FROM dependent_guardians WHERE dependent_person_id=$1 AND ended_at IS NULL',[dependentId])).rows;
    const accountIds=[...new Set([context.account.id,...hints.map(g=>g.guardian_account_id)])];
    const accounts=(await client.query<Account>('SELECT id,person_id,status,confirmation_status,session_version FROM accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[accountIds])).rows;
    const people=(await client.query<Person>('SELECT id,status,full_name FROM people WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[...new Set([dependentId,...accounts.map(a=>a.person_id)])]])).rows;
    const roles=(await client.query<{account_id:string;role:string}>('SELECT account_id,role FROM account_roles WHERE account_id=ANY($1::uuid[]) ORDER BY account_id,role FOR SHARE',[accountIds])).rows;
    const actor=accounts.find(a=>a.id===context.account.id);
    if(!actor||actor.status!=='active'||people.find(p=>p.id===actor.person_id)?.status!=='active'||!['verified','exempt'].includes(actor.confirmation_status)||actor.session_version!==context.sessionVersion)throw new AuthError('UNAUTHENTICATED');await checkSession(client,context);
    const ownRoles=roles.filter(r=>r.account_id===actor.id).map(r=>r.role),management=ownRoles.includes('administrator')||ownRoles.includes('manager');
    const profile=(await client.query('SELECT person_id FROM dependent_profiles WHERE person_id=$1 AND independent_at IS NULL FOR UPDATE',[dependentId])).rows[0];if(!profile||people.find(p=>p.id===dependentId)?.status!=='active')throw new AuthError('NOT_FOUND');
    const guardians=(await client.query<Relationship>('SELECT id,guardian_account_id FROM dependent_guardians WHERE dependent_person_id=$1 AND ended_at IS NULL ORDER BY id FOR UPDATE',[dependentId])).rows;
    // A newly accepted account was not locked. Retry from a new snapshot instead
    // of taking an account lock after the profile and risking cross-flow deadlock.
    if(guardians.some(g=>!accounts.some(a=>a.id===g.guardian_account_id)))throw new AuthError('CONFLICT');
    if(!management&&!(ownRoles.includes('customer')&&guardians.some(g=>g.guardian_account_id===actor.id)))throw new AuthError('NOT_FOUND');
    function eligible(guardian:Relationship){const account=accounts.find(a=>a.id===guardian.guardian_account_id);return !!account&&account.status==='active'&&people.find(p=>p.id===account.person_id)?.status==='active'&&['verified','exempt'].includes(account.confirmation_status)&&roles.some(r=>r.account_id===account.id&&r.role==='customer');}
    return {management,guardians,accounts,people,eligible};
  }
  return {
    async list(target:unknown,value:unknown,token:unknown):Promise<IdentityPage<GuardianRemovalTarget>>{
      const dependentId=id(target),query=object(value,['limit','cursor']);if(query.limit!==undefined&&(typeof query.limit!=='string'||! /^[1-9][0-9]?$/.test(query.limit)||Number(query.limit)>50))throw new AuthError('INVALID_REQUEST');const limit=query.limit===undefined?25:Number(query.limit),cursor=query.cursor===undefined?null:id(query.cursor);
      return transaction(dependentId,token,async(_client,context,state)=>{
        const rows=state.guardians.filter(g=>cursor===null||g.id>cursor),items=rows.slice(0,limit).map(g=>({id:g.id,accountId:g.guardian_account_id,fullName:state.people.find(p=>p.id===state.accounts.find(a=>a.id===g.guardian_account_id)!.person_id)!.full_name,canRemove:state.management||g.guardian_account_id===context.account.id}));
        return {items,nextCursor:rows.length>limit?items.at(-1)!.id:null};
      });
    },
    async remove(target:unknown,relationship:unknown,value:unknown,token:unknown):Promise<GuardianRemovedResponse>{
      const dependentId=id(target),relationshipId=id(relationship);object(value,[]);
      return transaction(dependentId,token,async(client,context,state)=>{
        const guardian=state.guardians.find(g=>g.id===relationshipId);if(!guardian)throw new AuthError('NOT_FOUND');const self=guardian.guardian_account_id===context.account.id;if(!self&&!state.management)throw new AuthError('FORBIDDEN');
        if(!state.guardians.some(g=>g.id!==guardian.id&&state.eligible(g)))throw new AuthError('CONFLICT');
        await client.query("UPDATE dependent_guardians SET ended_at=clock_timestamp(),end_reason=$2 WHERE id=$1",[guardian.id,self?'self_removed':'removed']);
        await client.query(`INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,changes,reason,correlation_id) VALUES ($1,$2,'dependent.guardian_removed','dependent',$3,$4,$5,$6)`,[context.account.id,state.management?'staff':'customer',dependentId,JSON.stringify({before:{guardianAccountId:guardian.guardian_account_id,guardianRelationshipId:guardian.id},after:{guardianAccountId:guardian.guardian_account_id,guardianRelationshipId:guardian.id}}),self?'Guardian ended their own authorization':'Management ended guardian authorization',randomUUID()]);
        return {dependentId,guardianRelationshipId:guardian.id};
      });
    }
  };
}
