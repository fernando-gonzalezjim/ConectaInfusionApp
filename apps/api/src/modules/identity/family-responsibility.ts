import {createHash,randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import type {FamilyView,FamilyInvitationPreview,FamilyResponsibilityState,ActionAcceptedResponse} from '@conecta/contracts';
import type {EnabledIdentityConfig} from './config.js';
import {AuthError,type SessionContext,type SessionService} from './sessions.js';
import {ActionError,issueAction,consumeAction,cancelActionDelivery,normalizeActionRecipient,type ActionBinding} from './action-tokens.js';
import {appendIdentityAudit} from './audit.js';
import {reservePublicAction} from './public-action-limit.js';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function id(value:unknown){if(typeof value!=='string'||!uuid.test(value))throw new AuthError('INVALID_REQUEST');return value.toLowerCase();}
function body(value:unknown,field:'email'|'token'){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||!Object.hasOwn(value,field))throw new AuthError('INVALID_REQUEST');
  const entry=(value as Record<string,unknown>)[field];if(typeof entry!=='string')throw new AuthError('INVALID_REQUEST');
  if(field==='email'){try{return normalizeActionRecipient(entry);}catch{throw new AuthError('INVALID_REQUEST');}}
  if(!/^[A-Za-z0-9_-]{43}$/.test(entry)||Buffer.from(entry,'base64url').toString('base64url')!==entry)throw new ActionError('INVALID_ACTION');return entry;
}
interface Account {id:string;person_id:string;email:string;status:string;confirmation_status:string;session_version:number;development_fixture:string|null}
interface Offer {id:string;family_id:string;action_token_id:string;target_membership_id:string;issued_by_account_id:string;recipient_email:string;status:string}
interface Token extends ActionBinding {id:string;created_at:Date;expires_at:Date;consumed_at:Date|null;revoked_at:Date|null}
export function createFamilyResponsibilityService(pool:Pool,config:EnabledIdentityConfig,sessions:SessionService,options:{now?:()=>Date}={}){
  function now(){const time=(options.now??(()=>new Date()))();if(!Number.isFinite(+time))throw new Error('FAMILY_CLOCK_INVALID');return time;}
  async function transaction<T>(work:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
  async function checkSession(client:PoolClient,context:SessionContext){
    const s=(await client.query<{expires_at:Date}>('SELECT expires_at FROM identity_sessions WHERE id=$1 AND account_id=$2 AND session_version=$3 AND revoked_at IS NULL FOR UPDATE',[context.sessionId,context.account.id,context.sessionVersion])).rows[0];
    if(!s||+s.expires_at<=Date.now())throw new AuthError('UNAUTHENTICATED');
  }
  // Same global order as invitation/lifecycle commands: accounts, people, roles,
  // session, family, offer, recipient send lock, action token, outbox.
  async function authorize(client:PoolClient,context:SessionContext,extra:string[]=[]){
    const accounts=(await client.query<Account>('SELECT * FROM accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[...new Set([context.account.id,...extra])]])).rows;
    const people=(await client.query<{id:string;status:string;preferred_locale:'es-MX'|'en'}>('SELECT id,status,preferred_locale FROM people WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[accounts.map(a=>a.person_id)])).rows;
    const roles=(await client.query<{account_id:string;role:string}>('SELECT account_id,role FROM account_roles WHERE account_id=ANY($1::uuid[]) ORDER BY account_id,role FOR SHARE',[accounts.map(a=>a.id)])).rows;
    const actor=accounts.find(a=>a.id===context.account.id);
    if(!actor||actor.status!=='active'||people.find(p=>p.id===actor.person_id)?.status!=='active'||!['verified','exempt'].includes(actor.confirmation_status)||actor.session_version!==context.sessionVersion)throw new AuthError('UNAUTHENTICATED');
    await checkSession(client,context);const own=roles.filter(r=>r.account_id===actor.id).map(r=>r.role);
    return {actor,accounts,people,roles,management:own.includes('administrator')||own.includes('manager'),customer:own.includes('customer')};
  }
  async function family(client:PoolClient,familyId:string){
    const f=(await client.query<FamilyView>(`SELECT id,name,created_by_person_id AS "createdByPersonId",responsible_membership_id AS "responsibleMembershipId",status,version FROM families WHERE id=$1 FOR UPDATE`,[familyId])).rows[0];
    if(!f)throw new AuthError('NOT_FOUND');return f;
  }
  async function permission(client:PoolClient,f:FamilyView,a:Awaited<ReturnType<typeof authorize>>){
    const member=(await client.query<{id:string}>('SELECT id FROM family_memberships WHERE family_id=$1 AND person_id=$2 AND ended_at IS NULL',[f.id,a.actor.person_id])).rows[0];
    if(!a.management&&(!a.customer||!member))throw new AuthError('FORBIDDEN');
    return a.management||a.customer&&!!member&&member.id===f.responsibleMembershipId;
  }
  function context(s:SessionContext,reason:string){return {actor:{id:s.account.id,type:s.account.roles.some(r=>r!=='customer')?'staff' as const:'customer' as const},reason,correlationId:randomUUID()};}
  async function inspect(client:PoolClient,raw:string,s:SessionContext){
    const hint=(await client.query<{id:string;family_id:string;issued_by_account_id:string}>(`SELECT o.id,o.family_id,o.issued_by_account_id FROM family_successor_offers o JOIN identity_action_tokens t ON t.id=o.action_token_id WHERE t.token_hash=$1 AND t.purpose='family_successor'`,[createHash('sha256').update(raw).digest()])).rows[0];
    if(!hint)throw new ActionError('INVALID_ACTION');const a=await authorize(client,s,[hint.issued_by_account_id]);
    const f=await family(client,hint.family_id),o=(await client.query<Offer>('SELECT * FROM family_successor_offers WHERE id=$1 FOR UPDATE',[hint.id])).rows[0];
    const t=(await client.query<Token>(`SELECT id,purpose,recipient_email AS "recipientEmail",account_id AS "accountId",account_version AS "accountVersion",person_id AS "personId",target_id AS "targetId",expected_version AS "expectedVersion",created_at,expires_at,consumed_at,revoked_at FROM identity_action_tokens WHERE token_hash=$1 AND purpose='family_successor' FOR UPDATE`,[createHash('sha256').update(raw).digest()])).rows[0];
    const time=now();await checkSession(client,s);
    if(!o||!t||!a.customer||o.issued_by_account_id!==hint.issued_by_account_id||o.action_token_id!==t.id||o.recipient_email!==a.actor.email
      ||t.accountId!==a.actor.id||t.personId!==a.actor.person_id||t.accountVersion!==a.actor.session_version||t.recipientEmail!==a.actor.email
      ||t.targetId!==o.id||t.expectedVersion!==0||t.created_at>time||t.expires_at<=time||t.consumed_at||t.revoked_at
      ||!(await client.query<{valid:boolean}>('SELECT identity_family_successor_valid($1,$2,$3) AS valid',[o.id,t.id,config.smtp.transport==='mailpit'])).rows[0]?.valid)throw new ActionError('INVALID_ACTION');
    return {a,f,o,t,time};
  }
  async function respond(value:unknown,token:unknown,ip:string,decision:'accepted'|'declined'):Promise<FamilyView>{
    const s=await sessions.resolve(token),raw=body(value,'token');await reservePublicAction(pool,config,ip,'action_ip',now());
    return transaction(async client=>{const {f,o,t,time}=await inspect(client,raw,s);
      return consumeAction(client,raw,t,async same=>{
        // No membership, credit, booking or guardian mutation occurs here.
        await same.query('UPDATE family_successor_offers SET status=$2,resolved_at=$3 WHERE id=$1',[o.id,decision,time]);
        let result=f;
        if(decision==='accepted'){
          if(f.version>=2147483647)throw new AuthError('CONFLICT');
          await same.query('UPDATE families SET responsible_membership_id=$2,version=version+1 WHERE id=$1',[f.id,o.target_membership_id]);
          result={...f,responsibleMembershipId:o.target_membership_id,version:f.version+1};
        }
        await appendIdentityAudit(same,{...context(s,'Recipient '+decision+' group responsibility'),action:decision==='accepted'?'family.responsibility_accepted':'family.responsibility_declined',targetType:'family',targetId:f.id,
          before:{version:f.version,responsibleMembershipId:f.responsibleMembershipId},after:{version:result.version,responsibleMembershipId:result.responsibleMembershipId,invitationId:o.id}});
        await checkSession(same,s);return result;
      },time);
    });
  }
  return {
    async state(target:unknown,token:unknown):Promise<FamilyResponsibilityState>{const s=await sessions.resolve(token),familyId=id(target);return transaction(async client=>{
      const a=await authorize(client,s),f=await family(client,familyId),canNominate=await permission(client,f,a);await checkSession(client,s);return {canNominate:f.status==='active'&&canNominate};
    });},
    async nominate(target:unknown,value:unknown,token:unknown,ip:string):Promise<ActionAcceptedResponse>{
      const s=await sessions.resolve(token),familyId=id(target),email=body(value,'email');await reservePublicAction(pool,config,ip,'registration_ip',now());
      try{return await transaction(async client=>{
        const recipientId=(await client.query<{id:string}>('SELECT id FROM accounts WHERE email=$1',[email])).rows[0]?.id;
        const a=await authorize(client,s,recipientId?[recipientId]:[]),f=await family(client,familyId);
        if(!await permission(client,f,a))throw new AuthError('FORBIDDEN');if(f.status!=='active')throw new AuthError('CONFLICT');
        const recipient=a.accounts.find(r=>r.id===recipientId);
        const member=recipient?(await client.query<{id:string}>('SELECT id FROM family_memberships WHERE family_id=$1 AND person_id=$2 AND ended_at IS NULL',[f.id,recipient.person_id])).rows[0]:null;
        if(!recipient||!member||member.id===f.responsibleMembershipId||recipient.email!==email||recipient.status!=='active'||!['verified','exempt'].includes(recipient.confirmation_status)
          ||a.people.find(p=>p.id===recipient.person_id)?.status!=='active'||!a.roles.some(r=>r.account_id===recipient.id&&r.role==='customer')
          ||config.smtp.transport!=='mailpit'&&recipient.development_fixture!==null)return {code:'ACCEPTED'};
        const time=now(),old=(await client.query<Offer>("SELECT * FROM family_successor_offers WHERE family_id=$1 AND status='pending' FOR UPDATE",[f.id])).rows;
        if(old.length){
          const revoked=await client.query<{id:string}>('UPDATE identity_action_tokens SET revoked_at=$2 WHERE id=ANY($1::uuid[]) AND consumed_at IS NULL AND revoked_at IS NULL RETURNING id',[old.map(o=>o.action_token_id),time]);
          await cancelActionDelivery(client,revoked.rows.map(t=>t.id),time);
          await client.query("UPDATE family_successor_offers SET status='cancelled',resolved_at=$2 WHERE id=ANY($1::uuid[])",[old.map(o=>o.id),time]);
        }
        const senderMember=(await client.query<{id:string}>('SELECT id FROM family_memberships WHERE family_id=$1 AND person_id=$2 AND ended_at IS NULL',[f.id,a.actor.person_id])).rows[0];
        const offerId=randomUUID();await client.query(`INSERT INTO family_successor_offers(id,family_id,family_version,recipient_email,target_membership_id,issued_by_account_id,issuer_version,issued_by_membership_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[offerId,f.id,f.version,email,member.id,a.actor.id,a.actor.session_version,a.management?null:senderMember?.id,time]);
        const issued=await issueAction(client,config,{purpose:'family_successor',recipientEmail:email,accountId:recipient.id,accountVersion:recipient.session_version,personId:recipient.person_id,targetId:offerId,expectedVersion:0},a.people.find(p=>p.id===recipient.person_id)!.preferred_locale,time);
        await client.query('UPDATE family_successor_offers SET action_token_id=$2 WHERE id=$1',[offerId,issued.id]);await checkSession(client,s);
        await appendIdentityAudit(client,{...context(s,'Group responsibility offered; recipient acceptance required'),action:'family.responsibility_offered',targetType:'family',targetId:f.id,before:null,after:{invitationId:offerId,membershipId:member.id}});
        return {code:'ACCEPTED'};
      });}catch(e){if(e instanceof ActionError&&e.code==='THROTTLED')return {code:'ACCEPTED'};throw e;}
    },
    async preview(value:unknown,token:unknown):Promise<FamilyInvitationPreview>{const s=await sessions.resolve(token),raw=body(value,'token');return transaction(async client=>{const {f,t}=await inspect(client,raw,s);return {family:{id:f.id,name:f.name},expiresAt:t.expires_at.toISOString()};});},
    accept:(value:unknown,token:unknown,ip:string)=>respond(value,token,ip,'accepted'),
    decline:(value:unknown,token:unknown,ip:string)=>respond(value,token,ip,'declined')
  };
}
