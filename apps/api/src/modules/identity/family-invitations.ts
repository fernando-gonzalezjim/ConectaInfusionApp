import {createHash,randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import type {ActionAcceptedResponse,FamilyView,FamilyInvitationPreview} from '@conecta/contracts';
import type {EnabledIdentityConfig} from './config.js';
import {AuthError,type SessionContext,type SessionService} from './sessions.js';
import {ActionError,issueAction,consumeAction,cancelActionDelivery,normalizeActionRecipient,type ActionBinding} from './action-tokens.js';
import {createFamilyInTransaction,joinFamilyInTransaction,type FamilyContext} from './families.js';
import {appendIdentityAudit} from './audit.js';
import {reservePublicAction} from './public-action-limit.js';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function familyId(value:unknown):string {if(typeof value!=='string'||!uuid.test(value))throw new AuthError('INVALID_REQUEST');return value.toLowerCase();}
function body(value:unknown,field:'name'|'email'|'token'):string {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||!Object.hasOwn(value,field))throw new AuthError('INVALID_REQUEST');
  const entry=(value as Record<string,unknown>)[field];if(typeof entry!=='string')throw new AuthError('INVALID_REQUEST');
  if(field==='name'&&(!entry.trim()||entry.trim().length>120||/[\x00-\x1f\x7f]/.test(entry)))throw new AuthError('INVALID_REQUEST');
  if(field==='token'&&(!/^[A-Za-z0-9_-]{43}$/.test(entry)||Buffer.from(entry,'base64url').toString('base64url')!==entry))throw new ActionError('INVALID_ACTION');
  if(field==='email')try{return normalizeActionRecipient(entry);}catch{throw new AuthError('INVALID_REQUEST');}
  return entry.trim();
}
interface Account {id:string;person_id:string;email:string;status:string;confirmation_status:string;session_version:number;development_fixture:string|null}
interface Invitation {id:string;family_id:string;recipient_email:string;issued_by_account_id:string;issued_by_membership_id:string|null;action_token_id:string;version:number;accepted_at:Date|null}
interface Token extends ActionBinding {id:string;created_at:Date;expires_at:Date;consumed_at:Date|null;revoked_at:Date|null}

export function createFamilyInvitationService(pool:Pool,config:EnabledIdentityConfig,sessions:SessionService,options:{now?:()=>Date}={}){
  const clock=options.now??(()=>new Date());
  function now(){const value=clock();if(!Number.isFinite(+value))throw new Error('FAMILY_CLOCK_INVALID');return value;}
  async function transaction<T>(work:(client:PoolClient)=>Promise<T>):Promise<T>{const client=await pool.connect();try{
    await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
  // All participating accounts/people are locked in UUID order before the family,
  // invitation, token or outbox. Roles cannot change underneath authorization.
  async function authorize(client:PoolClient,context:SessionContext,extraIds:string[]=[]){
    const accounts=(await client.query<Account>('SELECT * FROM accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[...new Set([context.account.id,...extraIds])]])).rows;
    const people=(await client.query<{id:string;status:string;preferred_locale:'es-MX'|'en'}>('SELECT id,status,preferred_locale FROM people WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[accounts.map(a=>a.person_id)])).rows;
    const roles=(await client.query<{account_id:string;role:string}>('SELECT account_id,role FROM account_roles WHERE account_id=ANY($1::uuid[]) ORDER BY account_id,role FOR SHARE',[accounts.map(a=>a.id)])).rows;
    const actor=accounts.find(a=>a.id===context.account.id);
    if(!actor||actor.status!=='active'||people.find(p=>p.id===actor.person_id)?.status!=='active'||!['verified','exempt'].includes(actor.confirmation_status)||actor.session_version!==context.sessionVersion)throw new AuthError('UNAUTHENTICATED');
    await checkSession(client,context);
    const ownRoles=roles.filter(r=>r.account_id===actor.id).map(r=>r.role);
    return {actor,accounts,people,roles,customer:ownRoles.includes('customer'),management:ownRoles.includes('administrator')||ownRoles.includes('manager')};
  }
  async function checkSession(client:PoolClient,context:SessionContext){
    const session=(await client.query<{expires_at:Date}>('SELECT expires_at FROM identity_sessions WHERE id=$1 AND account_id=$2 AND session_version=$3 AND revoked_at IS NULL FOR UPDATE',[context.sessionId,context.account.id,context.sessionVersion])).rows[0];
    // Real session time stays authoritative even with a test invitation clock.
    if(!session||+session.expires_at<=Date.now())throw new AuthError('UNAUTHENTICATED');
  }
  function auditContext(context:SessionContext,reason:string):FamilyContext{return {actor:{id:context.account.id,type:context.account.roles.some(r=>r!=='customer')?'staff':'customer'},
    session:{id:context.sessionId,version:context.sessionVersion},reason,correlationId:randomUUID()};}
  async function view(client:PoolClient,id:string,context:SessionContext,acting:Awaited<ReturnType<typeof authorize>>):Promise<FamilyView>{
    const group=(await client.query<FamilyView>(`SELECT id,name,created_by_person_id AS "createdByPersonId",responsible_membership_id AS "responsibleMembershipId",status,version FROM families WHERE id=$1 FOR UPDATE`,[id])).rows[0];
    if(!group)throw new AuthError('NOT_FOUND');
    if(!acting.management&&(!acting.customer||!(await client.query('SELECT 1 FROM family_memberships WHERE family_id=$1 AND person_id=$2 AND ended_at IS NULL',[id,acting.actor.person_id])).rowCount))throw new AuthError('FORBIDDEN');
    await checkSession(client,context);return group;
  }
  async function inspect(client:PoolClient,raw:string,context:SessionContext){
    const hint=(await client.query<{target_id:string;issued_by_account_id:string}>(`SELECT t.target_id,i.issued_by_account_id FROM identity_action_tokens t
      JOIN family_invitations i ON i.id=t.target_id WHERE t.token_hash=$1 AND t.purpose='family_invitation'`,[createHash('sha256').update(raw).digest()])).rows[0];
    if(!hint)throw new ActionError('INVALID_ACTION');
    const acting=await authorize(client,context,[hint.issued_by_account_id]);if(!acting.customer)throw new ActionError('INVALID_ACTION');
    const familyHint=(await client.query<{family_id:string}>('SELECT family_id FROM family_invitations WHERE id=$1',[hint.target_id])).rows[0];
    if(!familyHint)throw new ActionError('INVALID_ACTION');
    const family=(await client.query<FamilyView>(`SELECT id,name,created_by_person_id AS "createdByPersonId",responsible_membership_id AS "responsibleMembershipId",status,version FROM families WHERE id=$1 FOR UPDATE`,[familyHint.family_id])).rows[0];
    const invitation=(await client.query<Invitation>('SELECT * FROM family_invitations WHERE id=$1 FOR UPDATE',[hint.target_id])).rows[0];
    const action=(await client.query<Token>(`SELECT id,purpose,recipient_email AS "recipientEmail",account_id AS "accountId",account_version AS "accountVersion",
      person_id AS "personId",target_id AS "targetId",expected_version AS "expectedVersion",created_at,expires_at,consumed_at,revoked_at
      FROM identity_action_tokens WHERE token_hash=$1 AND purpose='family_invitation' FOR UPDATE`,[createHash('sha256').update(raw).digest()])).rows[0];
    // Sample time only after blocking locks. No stale preflight can extend expiry.
    const time=now();await checkSession(client,context);
    if(!invitation||!action||!family||invitation.issued_by_account_id!==hint.issued_by_account_id||invitation.action_token_id!==action.id
      ||invitation.accepted_at||invitation.version!==action.expectedVersion||action.recipientEmail!==acting.actor.email||invitation.recipient_email!==acting.actor.email
      ||(action.accountId!==null&&(action.accountId!==acting.actor.id||action.accountVersion!==acting.actor.session_version||action.personId!==acting.actor.person_id))
      ||action.created_at>time||action.expires_at<=time||action.consumed_at||action.revoked_at
      ||!(await client.query<{valid:boolean}>('SELECT identity_family_invitation_valid($1,$2,$3) AS valid',[invitation.id,action.id,config.smtp.transport==='mailpit'])).rows[0]?.valid)throw new ActionError('INVALID_ACTION');
    return {invitation,action,family,acting,time};
  }
  return {
    async create(value:unknown,token:unknown):Promise<FamilyView>{const context=await sessions.resolve(token),name=body(value,'name');return transaction(async client=>{
      await authorize(client,context);return createFamilyInTransaction(client,{name,creatorPersonId:context.account.personId},auditContext(context,'Customer created own family'));
    });},
    async current(token:unknown):Promise<{family:FamilyView|null}>{const context=await sessions.resolve(token);return transaction(async client=>{
      const acting=await authorize(client,context);if(!acting.customer)throw new AuthError('FORBIDDEN');
      const membership=(await client.query<{family_id:string}>('SELECT family_id FROM family_memberships WHERE person_id=$1 AND ended_at IS NULL',[acting.actor.person_id])).rows[0];
      return {family:membership?await view(client,membership.family_id,context,acting):null};
    });},
    async get(target:unknown,token:unknown):Promise<FamilyView>{const context=await sessions.resolve(token),id=familyId(target);return transaction(async client=>view(client,id,context,await authorize(client,context)));},
    async forAccount(target:unknown,token:unknown):Promise<{family:FamilyView|null}>{
      const context=await sessions.resolve(token,['administrator','manager']),id=familyId(target);return transaction(async client=>{
        const acting=await authorize(client,context,[id]);if(!acting.management)throw new AuthError('FORBIDDEN');
        const account=acting.accounts.find(a=>a.id===id);if(!account)throw new AuthError('NOT_FOUND');
        const membership=(await client.query<{family_id:string}>('SELECT family_id FROM family_memberships WHERE person_id=$1 AND ended_at IS NULL',[account.person_id])).rows[0];
        await checkSession(client,context);return {family:membership?await view(client,membership.family_id,context,acting):null};
      });
    },
    async invite(target:unknown,value:unknown,token:unknown,ip:string):Promise<ActionAcceptedResponse>{
      const context=await sessions.resolve(token),id=familyId(target),email=body(value,'email');
      await reservePublicAction(pool,config,ip,'registration_ip',now());
      try{return await transaction(async client=>{
        // A missing account is bound to this mailbox, not auto-created. The verified
        // recipient must sign in before accepting. Account locks precede domain locks.
        const recipientId=(await client.query<{id:string}>('SELECT id FROM accounts WHERE email=$1',[email])).rows[0]?.id;
        const acting=await authorize(client,context,recipientId?[recipientId]:[]);const family=await view(client,id,context,acting);
        if(family.status!=='active')throw new AuthError('CONFLICT');
        const membership=(await client.query<{id:string}>('SELECT id FROM family_memberships WHERE family_id=$1 AND person_id=$2 AND ended_at IS NULL',[id,acting.actor.person_id])).rows[0];
        // Same opaque response for ineligible existing recipients and send cooldowns.
        const recipient=acting.accounts.find(a=>a.id===recipientId);
        if(email===acting.actor.email||recipient&&(recipient.email!==email||recipient.status!=='active'||!['verified','exempt'].includes(recipient.confirmation_status)
          ||acting.people.find(p=>p.id===recipient.person_id)?.status!=='active'||!acting.roles.some(r=>r.account_id===recipient.id&&r.role==='customer')
          ||config.smtp.transport!=='mailpit'&&recipient.development_fixture!==null))return {code:'ACCEPTED'};
        if(recipient&&(await client.query('SELECT 1 FROM family_memberships WHERE family_id=$1 AND person_id=$2 AND ended_at IS NULL',[id,recipient.person_id])).rowCount)return {code:'ACCEPTED'};
        let invitation=(await client.query<Invitation>('SELECT * FROM family_invitations WHERE family_id=$1 AND recipient_email=$2 AND accepted_at IS NULL FOR UPDATE',[id,email])).rows[0];
        if(invitation){
          const old=(await client.query<{id:string}>("UPDATE identity_action_tokens SET revoked_at=$2 WHERE target_id=$1 AND purpose='family_invitation' AND consumed_at IS NULL AND revoked_at IS NULL RETURNING id",[invitation.id,now()])).rows;
          await cancelActionDelivery(client,old.map(a=>a.id),now());
          invitation=(await client.query<Invitation>('UPDATE family_invitations SET version=version+1,issued_by_account_id=$2,issued_by_membership_id=$3 WHERE id=$1 RETURNING *',[invitation.id,acting.actor.id,membership?.id??null])).rows[0]!;
        }else invitation=(await client.query<Invitation>('INSERT INTO family_invitations(id,family_id,recipient_email,issued_by_account_id,issued_by_membership_id,created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',[randomUUID(),id,email,acting.actor.id,membership?.id??null,now()])).rows[0]!;
        const issued=await issueAction(client,config,{purpose:'family_invitation',recipientEmail:email,accountId:recipient?.id??null,
          accountVersion:recipient?.session_version??null,personId:recipient?.person_id??null,targetId:invitation.id,expectedVersion:invitation.version},acting.people.find(p=>p.id===recipient?.person_id)?.preferred_locale??context.account.preferredLocale,now());
        await client.query('UPDATE family_invitations SET action_token_id=$2 WHERE id=$1',[invitation.id,issued.id]);await checkSession(client,context);
        await appendIdentityAudit(client,{...auditContext(context,'Family invitation sent; recipient acceptance required'),action:'family.invitation_sent',targetType:'family',targetId:id,
          before:null,after:{invitationId:invitation.id,invitationVersion:invitation.version}});
        return {code:'ACCEPTED'};
      });}catch(error){if(error instanceof ActionError&&error.code==='THROTTLED')return {code:'ACCEPTED'};throw error;}
    },
    async preview(value:unknown,token:unknown):Promise<FamilyInvitationPreview>{const context=await sessions.resolve(token),raw=body(value,'token');return transaction(async client=>{
      const {family,action}=await inspect(client,raw,context);return {family:{id:family.id,name:family.name},expiresAt:action.expires_at.toISOString()};
    });},
    async accept(value:unknown,token:unknown,ip:string):Promise<FamilyView>{const context=await sessions.resolve(token),raw=body(value,'token');
      await reservePublicAction(pool,config,ip,'action_ip',now());return transaction(async client=>{
        const {invitation,action,family,acting,time}=await inspect(client,raw,context);
        return consumeAction(client,raw,action,async sameClient=>{
          const joined=await joinFamilyInTransaction(sameClient,{familyId:family.id,personId:acting.actor.person_id,expectedVersion:family.version,
            acceptance:{invitationId:invitation.id,acceptedByPersonId:acting.actor.person_id,acceptedAt:time}},auditContext(context,'Recipient accepted family invitation'));
          await sameClient.query('UPDATE family_invitations SET accepted_at=$2,accepted_by_person_id=$3 WHERE id=$1',[invitation.id,time,acting.actor.person_id]);
          await checkSession(sameClient,context);return joined;
        },time);
      });
    }
  };
}
