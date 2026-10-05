import {createHash,randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import type {EnabledIdentityConfig} from './config.js';
import {AuthError,type SessionService,type SessionContext} from './sessions.js';
import type {createAccountService} from './accounts.js';
import {ActionError,issueAction,consumeAction,cancelActionDelivery,normalizeActionRecipient,actionSubjectHash} from './action-tokens.js';
import {reservePublicAction} from './public-action-limit.js';
import {appendIdentityAudit} from './audit.js';
import {encryptOutboxPayload} from './outbox-crypto.js';

interface Account {id:string;person_id:string;email:string;session_version:number;preferred_locale:'es-MX'|'en';development_fixture:string|null;roles:string[]}
function object(value:unknown,field:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||!Object.hasOwn(value,field))throw new AuthError('INVALID_REQUEST');
  return value as Record<string,unknown>;
}
function binding(account:Account,email:string){return {purpose:'email_change' as const,recipientEmail:email,accountId:account.id,
  accountVersion:account.session_version,personId:account.person_id,targetId:null,expectedVersion:account.session_version};}

export function createProfileService(pool:Pool,config:EnabledIdentityConfig,sessions:SessionService,
  accounts:ReturnType<typeof createAccountService>,options:{now?:()=>Date}={}){
  const clock=options.now??(()=>new Date());
  async function transaction<T>(apply:(client:PoolClient)=>Promise<T>):Promise<T>{
    const client=await pool.connect();try{await client.query('BEGIN');const result=await apply(client);await client.query('COMMIT');return result;}
    catch(error){await client.query('ROLLBACK');
      if(error&&typeof error==='object'&&'code' in error&&error.code==='23505')throw new AuthError('CONFLICT');throw error;
    }finally{client.release();}
  }
  async function active(client:PoolClient,id:string):Promise<Account>{
    // Account then person, matching login, profile editing and action redemption lock order.
    await client.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE',[id]);
    const account=(await client.query<Account>(`SELECT a.id,a.person_id,a.email,a.session_version,a.development_fixture,p.preferred_locale,
      ARRAY(SELECT role FROM account_roles WHERE account_id=a.id) AS roles
      FROM accounts a JOIN people p ON p.id=a.person_id WHERE a.id=$1 AND a.status='active' AND p.status='active'
      AND a.confirmation_status IN ('verified','exempt') FOR UPDATE OF p`,[id])).rows[0];
    if(!account)throw new ActionError('INVALID_ACTION');return account;
  }
  async function recent(client:PoolClient,context:SessionContext,now:Date){
    const row=(await client.query<{authenticated_at:Date}>(`SELECT authenticated_at FROM identity_sessions
      WHERE id=$1 AND account_id=$2 AND session_version=$3 AND revoked_at IS NULL AND expires_at>$4
      AND authenticated_at<=$4 FOR UPDATE`,[context.sessionId,context.account.id,context.sessionVersion,now])).rows[0];
    if(!row)throw new AuthError('UNAUTHENTICATED');
    if(now.getTime()-row.authenticated_at.getTime()>=600000)throw new AuthError('RECENT_AUTH_REQUIRED');
  }
  return {
    async read(token:unknown){
      const context=await sessions.resolve(token);
      // Reuse the own-only authorization and sanitized profile DTO inside a transaction.
      return accounts.readOwn(token,context.account.id);
    },
    async update(value:unknown,token:unknown){const context=await sessions.resolve(token);return accounts.update(context.account.id,value,token);},
    async requestEmail(value:unknown,token:unknown,ip:string){
      const context=await sessions.resolve(token);const input=object(value,'email');let email:string;
      try{email=normalizeActionRecipient(input.email as string);}catch{throw new AuthError('INVALID_REQUEST');}
      await reservePublicAction(pool,config,ip,'action_ip',clock());
      await transaction(async client=>{
        const account=await active(client,context.account.id);
        const now=clock();
        if(account.session_version!==context.sessionVersion)throw new AuthError('UNAUTHENTICATED');
        await recent(client,context,now);
        // Reserved opt-in fixtures have fixed emails and short passwords; they never become normal accounts through this flow.
        if(account.development_fixture||email===account.email||['admin@conecta.example.test','testuser@conecta.example.test'].includes(email))throw new AuthError('CONFLICT');
        if((await client.query('SELECT id FROM accounts WHERE email=$1',[email])).rowCount)throw new AuthError('CONFLICT');
        const old=await client.query<{id:string}>(`UPDATE identity_action_tokens SET revoked_at=$2 WHERE account_id=$1 AND purpose='email_change'
          AND consumed_at IS NULL AND revoked_at IS NULL RETURNING id`,[account.id,now]);
        await cancelActionDelivery(client,old.rows.map(row=>row.id),now);
        await issueAction(client,config,binding(account,email),account.preferred_locale,now);
        await appendIdentityAudit(client,{actor:{id:account.id,type:account.roles.some(role=>role!=='customer')?'staff':'customer'},action:'account.email_change_requested',targetType:'account',targetId:account.id,
          before:null,after:null,reason:'New mailbox confirmation requested; login email unchanged',correlationId:randomUUID()});
      });return {code:'ACCEPTED' as const};
    },
    async confirmEmail(value:unknown,ip:string){
      const input=object(value,'token');await reservePublicAction(pool,config,ip,'action_ip',clock());
      if(typeof input.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(input.token))throw new ActionError('INVALID_ACTION');
      const token=input.token;
      await transaction(async client=>{
        const link=(await client.query<{account_id:string;recipient_email:string}>("SELECT account_id,recipient_email FROM identity_action_tokens WHERE token_hash=$1 AND purpose='email_change'",
          [createHash('sha256').update(token).digest()])).rows[0];
        if(!link?.account_id)throw new ActionError('INVALID_ACTION');
        const account=await active(client,link.account_id);if(account.development_fixture)throw new ActionError('INVALID_ACTION');
        const now=clock();
        await consumeAction(client,token,binding(account,link.recipient_email),async locked=>{
          await locked.query(`UPDATE accounts SET email=$2,confirmation_status='verified',email_verified_at=$3,
            exemption_source=NULL,exemption_actor_id=NULL,exemption_reason=NULL,exemption_at=NULL,
            session_version=session_version+1,updated_at=$3 WHERE id=$1`,[account.id,link.recipient_email,now]);
          await locked.query('UPDATE identity_sessions SET revoked_at=$2 WHERE account_id=$1 AND revoked_at IS NULL',[account.id,now]);
          const outboxId=randomUUID(),recipientHash=actionSubjectHash(config.secrets,'recipient',account.email);
          const encrypted=encryptOutboxPayload(JSON.stringify({recipientEmail:account.email,event:'email_changed',locale:account.preferred_locale}),
            {outboxId,actionTokenId:null,kind:'security_notification',recipientHash},config.secrets);
          await locked.query(`INSERT INTO identity_email_outbox(id,kind,recipient_hash,key_id,nonce,auth_tag,ciphertext,created_at,available_at,expires_at)
            VALUES ($1,'security_notification',$2,$3,$4,$5,$6,$7,$7,$7::timestamptz+interval '24 hours')`,
            [outboxId,recipientHash,encrypted.keyId,encrypted.nonce,encrypted.authTag,encrypted.ciphertext,now]);
          await appendIdentityAudit(locked,{actor:{id:account.id,type:account.roles.some(role=>role!=='customer')?'staff':'customer'},action:'account.email_changed',targetType:'account',targetId:account.id,
          before:{email:account.email},after:{email:link.recipient_email},reason:'New mailbox confirmed; prior mailbox notification queued and all sessions revoked',correlationId:randomUUID()});
        },now);
      });return {code:'EMAIL_CHANGED' as const};
    }
  };
}
