import {createHash,randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import type {ActionAcceptedResponse,IdentityPage,GuardianInviteTarget,GuardianInvitationPreview,GuardianInvitationAccepted} from '@conecta/contracts';
import type {EnabledIdentityConfig} from './config.js';
import {AuthError,type SessionContext,type SessionService} from './sessions.js';
import {ActionError,issueAction,consumeAction,cancelActionDelivery,normalizeActionRecipient,type ActionBinding} from './action-tokens.js';
import {reservePublicAction} from './public-action-limit.js';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function id(value:unknown){if(typeof value!=='string'||!uuid.test(value))throw new AuthError('INVALID_REQUEST');return value.toLowerCase();}
function body(value:unknown,field:'email'|'token'){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||!Object.hasOwn(value,field))throw new AuthError('INVALID_REQUEST');
  const entry=(value as Record<string,unknown>)[field];if(typeof entry!=='string')throw new AuthError('INVALID_REQUEST');
  if(field==='email')try{return normalizeActionRecipient(entry);}catch{throw new AuthError('INVALID_REQUEST');}
  if(!/^[A-Za-z0-9_-]{43}$/.test(entry)||Buffer.from(entry,'base64url').toString('base64url')!==entry)throw new ActionError('INVALID_ACTION');return entry;
}
interface Account {id:string;person_id:string;email:string;status:string;confirmation_status:string;session_version:number;development_fixture:string|null}
interface Invitation {id:string;dependent_person_id:string;recipient_email:string;issued_by_account_id:string;action_token_id:string;version:number;accepted_at:Date|null}
interface Token extends ActionBinding {id:string;created_at:Date;expires_at:Date;consumed_at:Date|null;revoked_at:Date|null}
export function createGuardianInvitationService(pool:Pool,config:EnabledIdentityConfig,sessions:SessionService,options:{now?:()=>Date}={}){
  const clock=options.now??(()=>new Date());function now(){const value=clock();if(!Number.isFinite(+value))throw new Error('GUARDIAN_CLOCK_INVALID');return value;}
  async function transaction<T>(context:SessionContext,work:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const result=await work(client);await checkSession(client,context);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
  async function checkSession(client:PoolClient,context:SessionContext){const row=(await client.query<{expires_at:Date}>('SELECT expires_at FROM identity_sessions WHERE id=$1 AND account_id=$2 AND session_version=$3 AND revoked_at IS NULL FOR UPDATE',[context.sessionId,context.account.id,context.sessionVersion])).rows[0];if(!row||+row.expires_at<=Date.now())throw new AuthError('UNAUTHENTICATED');}
  // Accounts, then all affected people, in UUID order; roles precede dependent,
  // relationship, invitation, token and outbox locks. No authorization preflight commits.
  async function authorize(client:PoolClient,context:SessionContext,extra:string[]=[],dependentId?:string){
    const accounts=(await client.query<Account>('SELECT * FROM accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[...new Set([context.account.id,...extra])]])).rows;
    const people=(await client.query<{id:string;status:string;preferred_locale:'es-MX'|'en'}>('SELECT id,status,preferred_locale FROM people WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[...new Set([...accounts.map(a=>a.person_id),...(dependentId?[dependentId]:[])])]])).rows;
    const roles=(await client.query<{account_id:string;role:string}>('SELECT account_id,role FROM account_roles WHERE account_id=ANY($1::uuid[]) ORDER BY account_id,role FOR SHARE',[accounts.map(a=>a.id)])).rows;
    const actor=accounts.find(a=>a.id===context.account.id);if(!actor||actor.status!=='active'||people.find(p=>p.id===actor.person_id)?.status!=='active'||!['verified','exempt'].includes(actor.confirmation_status)||actor.session_version!==context.sessionVersion)throw new AuthError('UNAUTHENTICATED');await checkSession(client,context);
    const own=roles.filter(r=>r.account_id===actor.id).map(r=>r.role);return {actor,accounts,people,roles,customer:own.includes('customer'),management:own.includes('administrator')||own.includes('manager')};
  }
  async function dependent(client:PoolClient,personId:string){return (await client.query<{id:string;fullName:string;deactivation_sequence:number}>(`SELECT d.person_id AS id,p.full_name AS "fullName",d.deactivation_sequence FROM dependent_profiles d JOIN people p ON p.id=d.person_id WHERE d.person_id=$1 AND d.independent_at IS NULL AND p.status='active' FOR UPDATE OF d`,[personId])).rows[0];}
  async function audit(client:PoolClient,context:SessionContext,action:'dependent.guardian_invited'|'dependent.guardian_accepted',target:string,after:Record<string,string|number>){
    await client.query(`INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,changes,reason,correlation_id) VALUES ($1,$2,$3,'dependent',$4,$5,$6,$7)`,[context.account.id,context.account.roles.some(r=>r!=='customer')?'staff':'customer',action,target,JSON.stringify({before:null,after}),'Guardian invitation or recipient acceptance; no roles or family membership changed',randomUUID()]);
  }
  async function inspect(client:PoolClient,raw:string,context:SessionContext){
    const hash=createHash('sha256').update(raw).digest();const hint=(await client.query<Invitation>(`SELECT i.* FROM identity_action_tokens t JOIN guardian_invitations i ON i.id=t.target_id WHERE t.token_hash=$1 AND t.purpose='guardian_invitation'`,[hash])).rows[0];if(!hint)throw new ActionError('INVALID_ACTION');
    const acting=await authorize(client,context,[hint.issued_by_account_id],hint.dependent_person_id);if(!acting.customer)throw new ActionError('INVALID_ACTION');const profile=await dependent(client,hint.dependent_person_id);
    const invitation=(await client.query<Invitation>('SELECT * FROM guardian_invitations WHERE id=$1 FOR UPDATE',[hint.id])).rows[0];
    const action=(await client.query<Token>(`SELECT id,purpose,recipient_email AS "recipientEmail",account_id AS "accountId",account_version AS "accountVersion",person_id AS "personId",target_id AS "targetId",expected_version AS "expectedVersion",created_at,expires_at,consumed_at,revoked_at FROM identity_action_tokens WHERE token_hash=$1 AND purpose='guardian_invitation' FOR UPDATE`,[hash])).rows[0];const time=now();await checkSession(client,context);
    if(!profile||!invitation||!action||invitation.issued_by_account_id!==hint.issued_by_account_id||invitation.action_token_id!==action.id||invitation.accepted_at||invitation.version!==action.expectedVersion
      ||invitation.recipient_email!==acting.actor.email||action.recipientEmail!==acting.actor.email||(action.accountId!==null&&(action.accountId!==acting.actor.id||action.accountVersion!==acting.actor.session_version||action.personId!==acting.actor.person_id))
      ||action.created_at>time||action.expires_at<=time||action.consumed_at||action.revoked_at||!(await client.query<{valid:boolean}>('SELECT identity_guardian_invitation_valid($1,$2,$3) AS valid',[invitation.id,action.id,config.smtp.transport==='mailpit'])).rows[0]?.valid
      ||(await client.query('SELECT 1 FROM dependent_guardians WHERE dependent_person_id=$1 AND guardian_account_id=$2 AND ended_at IS NULL',[profile.id,acting.actor.id])).rowCount)throw new ActionError('INVALID_ACTION');
    return {profile,invitation,action,acting,time};
  }
  return {
    async invite(target:unknown,value:unknown,token:unknown,ip:string):Promise<ActionAcceptedResponse>{const context=await sessions.resolve(token),personId=id(target),email=body(value,'email');await reservePublicAction(pool,config,ip,'registration_ip',now());
      try{return await transaction(context,async client=>{
        const recipientId=(await client.query<{id:string}>('SELECT id FROM accounts WHERE email=$1',[email])).rows[0]?.id;
        const acting=await authorize(client,context,recipientId?[recipientId]:[],personId),profile=await dependent(client,personId);if(!profile)throw new AuthError('NOT_FOUND');
        const guardian=(await client.query<{id:string}>('SELECT id FROM dependent_guardians WHERE dependent_person_id=$1 AND guardian_account_id=$2 AND ended_at IS NULL FOR SHARE',[personId,acting.actor.id])).rows[0];if(!(guardian&&acting.customer)&&!acting.management)throw new AuthError('NOT_FOUND');
        const recipient=acting.accounts.find(a=>a.id===recipientId);if(email===acting.actor.email||recipient&&(recipient.email!==email||recipient.status!=='active'||!['verified','exempt'].includes(recipient.confirmation_status)||acting.people.find(p=>p.id===recipient.person_id)?.status!=='active'||!acting.roles.some(r=>r.account_id===recipient.id&&r.role==='customer')||config.smtp.transport!=='mailpit'&&recipient.development_fixture!==null))return {code:'ACCEPTED'};
        if(recipient&&(await client.query('SELECT 1 FROM dependent_guardians WHERE dependent_person_id=$1 AND guardian_account_id=$2 AND ended_at IS NULL',[personId,recipient.id])).rowCount)return {code:'ACCEPTED'};
        let invitation=(await client.query<Invitation>('SELECT * FROM guardian_invitations WHERE dependent_person_id=$1 AND recipient_email=$2 AND accepted_at IS NULL FOR UPDATE',[personId,email])).rows[0];
        if(invitation){const old=(await client.query<{id:string}>("UPDATE identity_action_tokens SET revoked_at=$2 WHERE target_id=$1 AND purpose='guardian_invitation' AND consumed_at IS NULL AND revoked_at IS NULL RETURNING id",[invitation.id,now()])).rows;await cancelActionDelivery(client,old.map(r=>r.id),now());invitation=(await client.query<Invitation>('UPDATE guardian_invitations SET version=version+1,issued_by_account_id=$2,issued_by_account_version=$3,issued_by_guardian_id=$4,dependent_deactivation_sequence=$5 WHERE id=$1 RETURNING *',[invitation.id,acting.actor.id,acting.actor.session_version,guardian&&acting.customer?guardian.id:null,profile.deactivation_sequence])).rows[0]!;}
        else invitation=(await client.query<Invitation>('INSERT INTO guardian_invitations(id,dependent_person_id,dependent_deactivation_sequence,recipient_email,issued_by_account_id,issued_by_account_version,issued_by_guardian_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[randomUUID(),personId,profile.deactivation_sequence,email,acting.actor.id,acting.actor.session_version,guardian&&acting.customer?guardian.id:null,now()])).rows[0]!;
        const issued=await issueAction(client,config,{purpose:'guardian_invitation',recipientEmail:email,accountId:recipient?.id??null,accountVersion:recipient?.session_version??null,personId:recipient?.person_id??null,targetId:invitation.id,expectedVersion:invitation.version},acting.people.find(p=>p.id===recipient?.person_id)?.preferred_locale??context.account.preferredLocale,now(),now);await client.query('UPDATE guardian_invitations SET action_token_id=$2 WHERE id=$1',[invitation.id,issued.id]);await audit(client,context,'dependent.guardian_invited',personId,{invitationId:invitation.id,invitationVersion:invitation.version});return {code:'ACCEPTED'};
      });}catch(error){if(error instanceof ActionError&&error.code==='THROTTLED')return {code:'ACCEPTED'};throw error;}
    },
    async preview(value:unknown,token:unknown):Promise<GuardianInvitationPreview>{const context=await sessions.resolve(token),raw=body(value,'token');return transaction(context,async client=>{const {profile,action}=await inspect(client,raw,context);return {dependent:{id:profile.id,fullName:profile.fullName},expiresAt:action.expires_at.toISOString()};});},
    async accept(value:unknown,token:unknown,ip:string):Promise<GuardianInvitationAccepted>{const context=await sessions.resolve(token),raw=body(value,'token');await reservePublicAction(pool,config,ip,'action_ip',now());return transaction(context,async client=>{
      const {profile,invitation,action,acting,time}=await inspect(client,raw,context);
      return consumeAction(client,raw,action,async sameClient=>{
        const relationshipId=randomUUID();await sameClient.query("INSERT INTO dependent_guardians(id,dependent_person_id,guardian_account_id,source,accepted_by_account_id,accepted_invitation_id) VALUES ($1,$2,$3,'accepted_invitation',$3,$4)",[relationshipId,profile.id,acting.actor.id,invitation.id]);await sameClient.query('UPDATE guardian_invitations SET accepted_at=$2,accepted_by_account_id=$3 WHERE id=$1',[invitation.id,time,acting.actor.id]);
        await audit(sameClient,context,'dependent.guardian_accepted',profile.id,{invitationId:invitation.id,invitationVersion:invitation.version,guardianAccountId:acting.actor.id,guardianRelationshipId:relationshipId});if(action.expires_at<=now())throw new ActionError('INVALID_ACTION');return {dependentId:profile.id};
      },time);
    });},
    async assistTargets(target:unknown,value:unknown,token:unknown):Promise<IdentityPage<GuardianInviteTarget>>{
      const context=await sessions.resolve(token,['administrator','manager']),accountId=id(target);if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['limit','cursor'].includes(k)))throw new AuthError('INVALID_REQUEST');const query=value as {limit?:unknown;cursor?:unknown};if(query.limit!==undefined&&(typeof query.limit!=='string'||! /^[1-9][0-9]?$/.test(query.limit)||Number(query.limit)>50))throw new AuthError('INVALID_REQUEST');const limit=query.limit===undefined?25:Number(query.limit),cursor=query.cursor===undefined?null:id(query.cursor);
      return transaction(context,async client=>{const acting=await authorize(client,context,[accountId]);if(!acting.management)throw new AuthError('FORBIDDEN');const owner=acting.accounts.find(a=>a.id===accountId);if(!owner||owner.status!=='active'||!['verified','exempt'].includes(owner.confirmation_status)||acting.people.find(p=>p.id===owner.person_id)?.status!=='active'||!acting.roles.some(r=>r.account_id===accountId&&r.role==='customer'))throw new AuthError('NOT_FOUND');
        const rows=(await client.query<{id:string;fullName:string}>(`SELECT d.person_id AS id,p.full_name AS "fullName" FROM dependent_profiles d JOIN people p ON p.id=d.person_id WHERE d.independent_at IS NULL AND p.status='active' AND EXISTS(SELECT 1 FROM dependent_guardians g WHERE g.dependent_person_id=d.person_id AND g.guardian_account_id=$1 AND g.ended_at IS NULL) AND ($2::uuid IS NULL OR d.person_id>$2) ORDER BY d.person_id LIMIT $3`,[accountId,cursor,limit+1])).rows;return {items:rows.slice(0,limit),nextCursor:rows.length>limit?rows[limit-1]!.id:null};
      });
    }
  };
}
