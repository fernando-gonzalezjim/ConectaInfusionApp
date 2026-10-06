import {createHash,randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import type {EnabledIdentityConfig} from './config.js';
import {AuthError,type SessionContext,type SessionService} from './sessions.js';
import {ActionError,issueAction,consumeAction,cancelActionDelivery,normalizeActionRecipient,type ActionBinding} from './action-tokens.js';
import {hashPassword} from './passwords.js';
import {reservePublicAction} from './public-action-limit.js';

interface Account {id:string;person_id:string;status:string;confirmation_status:string;session_version:number}
interface Guardian {id:string;guardian_account_id:string}
interface Action extends ActionBinding {id:string;created_at:Date;expires_at:Date;consumed_at:Date|null;revoked_at:Date|null}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function object(value:unknown,fields:string[]){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==[...fields].sort().join(','))throw new AuthError('INVALID_REQUEST');
  return value as Record<string,unknown>;
}
function email(value:unknown){try{if(typeof value!=='string')throw new Error();return normalizeActionRecipient(value);}catch{throw new AuthError('INVALID_REQUEST');}}
export function createDependentTransitionService(pool:Pool,config:EnabledIdentityConfig,sessions:SessionService,options:{now?:()=>Date}={}){
  const now=()=>{const time=options.now?.()??new Date();if(!Number.isFinite(+time))throw new Error('INVALID_TRANSITION_CLOCK');return time;};
  async function transaction<T>(work:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');if(error&&typeof error==='object'&&'code'in error&&error.code==='23505')throw new ActionError('INVALID_ACTION');throw error;}finally{client.release();}}
  async function checkSession(client:PoolClient,context:SessionContext){const row=(await client.query<{expires_at:Date}>('SELECT expires_at FROM identity_sessions WHERE id=$1 AND account_id=$2 AND session_version=$3 AND revoked_at IS NULL FOR UPDATE',[context.sessionId,context.account.id,context.sessionVersion])).rows[0];if(!row||row.expires_at<=new Date())throw new AuthError('UNAUTHENTICATED');}
  async function lock(client:PoolClient,personId:string,issuerId:string,context?:SessionContext){
    // Lock candidates only; all permissions are checked again under these locks.
    const hints=(await client.query<Guardian>('SELECT id,guardian_account_id FROM dependent_guardians WHERE dependent_person_id=$1 AND ended_at IS NULL',[personId])).rows;
    const accountIds=[...new Set([issuerId,...hints.map(g=>g.guardian_account_id)])];
    const accounts=(await client.query<Account>('SELECT * FROM accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[accountIds])).rows;
    const people=(await client.query<{id:string;status:string}>('SELECT id,status FROM people WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[...new Set([personId,...accounts.map(a=>a.person_id)])]])).rows;
    const roles=(await client.query<{account_id:string;role:string}>('SELECT account_id,role FROM account_roles WHERE account_id=ANY($1::uuid[]) ORDER BY account_id,role FOR SHARE',[accountIds])).rows;
    const issuer=accounts.find(a=>a.id===issuerId);
    if(context){if(!issuer||issuer.status!=='active'||issuer.session_version!==context.sessionVersion||people.find(p=>p.id===issuer.person_id)?.status!=='active'||!['verified','exempt'].includes(issuer.confirmation_status))throw new AuthError('UNAUTHENTICATED');await checkSession(client,context);}
    const profile=(await client.query<{version:number;independent_at:Date|null}>('SELECT version,independent_at FROM dependent_profiles WHERE person_id=$1 FOR UPDATE',[personId])).rows[0];
    const guardians=(await client.query<Guardian>('SELECT id,guardian_account_id FROM dependent_guardians WHERE dependent_person_id=$1 AND ended_at IS NULL ORDER BY id FOR UPDATE',[personId])).rows;
    if(guardians.some(g=>!accounts.some(a=>a.id===g.guardian_account_id)))throw new AuthError('CONFLICT');
    const guardian=guardians.find(g=>g.guardian_account_id===issuerId);
    if(!profile||profile.independent_at||people.find(p=>p.id===personId)?.status!=='active'||!guardian||!roles.some(r=>r.account_id===issuerId&&r.role==='customer'))throw context?new AuthError('NOT_FOUND'):new ActionError('INVALID_ACTION');
    return {profile,guardian};
  }
  async function audit(client:PoolClient,actor:string,action:string,personId:string,version:number){
    const reason=action==='dependent.transition_requested'?'Guardian requested independent login; no account or authorization changed':'Recipient confirmed email and password; all guardian authorizations ended';
    await client.query(`INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,changes,reason,correlation_id) VALUES ($1,'customer',$2,'dependent',$3,$4,$5,$6)`,[actor,action,personId,JSON.stringify({before:null,after:{personId,version}}),reason,randomUUID()]);
  }
  return {
    async request(target:unknown,value:unknown,session:unknown,ip:string){
      const context=await sessions.resolve(session),input=object(value,['email']),recipient=email(input.email);
      if(typeof target!=='string'||!uuid.test(target))throw new AuthError('INVALID_REQUEST');const personId=target.toLowerCase();
      await reservePublicAction(pool,config,ip,'registration_ip',now());
      try{return await transaction(async client=>{
        const state=await lock(client,personId,context.account.id,context);
        if(!(await client.query('SELECT 1 FROM accounts WHERE email=$1',[recipient])).rowCount){
          const revoked=(await client.query<{id:string}>("UPDATE identity_action_tokens SET revoked_at=$2 WHERE purpose='dependent_transition' AND person_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL RETURNING id",[personId,now()])).rows;
          await cancelActionDelivery(client,revoked.map(r=>r.id),now());
          await issueAction(client,config,{purpose:'dependent_transition',recipientEmail:recipient,accountId:context.account.id,accountVersion:context.sessionVersion,personId,targetId:state.guardian.id,expectedVersion:state.profile.version},context.account.preferredLocale,now(),now);
          await audit(client,context.account.id,'dependent.transition_requested',personId,state.profile.version);
        }
        await checkSession(client,context);return {code:'ACCEPTED'} as const;
      });}catch(error){if(error instanceof ActionError&&error.code==='THROTTLED')return {code:'ACCEPTED'} as const;throw error;}
    },
    async complete(value:unknown,ip:string){
      const input=object(value,['token','email','password']),recipient=email(input.email),raw=input.token;
      if(typeof raw!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(raw)||Buffer.from(raw,'base64url').toString('base64url')!==raw)throw new ActionError('INVALID_ACTION');
      await reservePublicAction(pool,config,ip,'action_ip',now());
      let hash:string;try{hash=await hashPassword(input.password);}catch(error){if(error instanceof Error&&error.message==='INVALID_PASSWORD')throw new AuthError('INVALID_REQUEST');throw error;}
      return transaction(async client=>{
        const tokenHash=createHash('sha256').update(raw).digest();
        const hint=(await client.query<{account_id:string;person_id:string}>("SELECT account_id,person_id FROM identity_action_tokens WHERE token_hash=$1 AND purpose='dependent_transition'",[tokenHash])).rows[0];
        if(!hint?.account_id||!hint.person_id)throw new ActionError('INVALID_ACTION');
        await lock(client,hint.person_id,hint.account_id);
        const action=(await client.query<Action>(`SELECT id,purpose,recipient_email AS "recipientEmail",account_id AS "accountId",account_version AS "accountVersion",person_id AS "personId",target_id AS "targetId",expected_version AS "expectedVersion",created_at,expires_at,consumed_at,revoked_at FROM identity_action_tokens WHERE token_hash=$1 AND purpose='dependent_transition' FOR UPDATE`,[tokenHash])).rows[0];const time=now();
        if(!action||action.recipientEmail!==recipient||action.created_at>time||action.expires_at<=time||action.consumed_at||action.revoked_at||!(await client.query<{valid:boolean}>('SELECT identity_dependent_transition_valid($1,$2) AS valid',[action.id,config.smtp.transport==='mailpit'])).rows[0]?.valid)throw new ActionError('INVALID_ACTION');
        return consumeAction(client,raw,action,async same=>{
          const accountId=randomUUID();
          await same.query("INSERT INTO accounts(id,person_id,email,password_hash,status,confirmation_status,email_verified_at) VALUES ($1,$2,$3,$4,'active','verified',$5)",[accountId,hint.person_id,recipient,hash,time]);
          await same.query("INSERT INTO account_roles(account_id,role) VALUES ($1,'customer')",[accountId]);
          await same.query('UPDATE dependent_profiles SET independent_at=$2,version=version+1 WHERE person_id=$1',[hint.person_id,time]);
          await same.query("UPDATE dependent_guardians SET ended_at=$2,end_reason='transitioned' WHERE dependent_person_id=$1 AND ended_at IS NULL",[hint.person_id,time]);
          await audit(same,accountId,'dependent.transitioned',hint.person_id,action.expectedVersion!+1);
          if(action.expires_at<=now())throw new ActionError('INVALID_ACTION');return {code:'TRANSITIONED'} as const;
        },time);
      });
    }
  };
}
