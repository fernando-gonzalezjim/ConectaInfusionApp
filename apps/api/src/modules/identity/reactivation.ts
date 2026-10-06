import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {AuthError,type SessionContext,type SessionService} from './sessions.js';
import {isSupportedPasswordHash} from './passwords.js';
export const reactivationId=(value:unknown)=>{if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value))throw new AuthError('INVALID_REQUEST');return value.toLowerCase();};
export function reactivationInput(value:unknown,fields:string[]){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==fields.sort().join(','))throw new AuthError('INVALID_REQUEST');return value as Record<string,unknown>;}
export function reactivationVersion(value:unknown){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>=2147483647)throw new AuthError('INVALID_REQUEST');return value;}
export interface ReactivationAccount {id:string;person_id:string;email:string;status:string;confirmation_status:string;session_version:number;password_hash:string|null;development_fixture:string|null}
export async function reactivationTransaction<T>(pool:Pool,sessions:SessionService,token:unknown,extraAccounts:string[],extraPeople:string[],management:boolean,
  work:(c:PoolClient,context:SessionContext,state:{accounts:ReactivationAccount[];people:{id:string;status:string}[];roles:{account_id:string;role:string}[]})=>Promise<T>,clock:()=>Date=()=>new Date()):Promise<T>{
  const context=await sessions.resolve(token,management?['administrator','manager']:undefined),c=await pool.connect();
  try{
    await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtextextended('identity-active-administration',0))");
    const accounts=(await c.query<ReactivationAccount>('SELECT * FROM accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[...new Set([context.account.id,...extraAccounts])]])).rows;
    const people=(await c.query<{id:string;status:string}>('SELECT id,status FROM people WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[...new Set([...extraPeople,...accounts.map(a=>a.person_id)])]])).rows;
    const roles=(await c.query<{account_id:string;role:string}>('SELECT account_id,role FROM account_roles WHERE account_id=ANY($1::uuid[]) ORDER BY account_id,role FOR SHARE',[accounts.map(a=>a.id)])).rows;
    async function check(){const actor=accounts.find(a=>a.id===context.account.id),session=(await c.query<{expires_at:Date}>('SELECT expires_at FROM identity_sessions WHERE id=$1 AND account_id=$2 AND session_version=$3 AND revoked_at IS NULL FOR UPDATE',[context.sessionId,context.account.id,context.sessionVersion])).rows[0];
      if(!actor||actor.status!=='active'||actor.session_version!==context.sessionVersion||!['verified','exempt'].includes(actor.confirmation_status)||people.find(p=>p.id===actor.person_id)?.status!=='active'||!session||+session.expires_at<=+clock())throw new AuthError('UNAUTHENTICATED');
      if(!roles.some(r=>r.account_id===actor.id&&(management?['administrator','manager'].includes(r.role):r.role==='customer')))throw new AuthError('FORBIDDEN');}
    await check();const result=await work(c,context,{accounts,people,roles});await check();await c.query('COMMIT');return result;
  }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
}
export function createReactivationService(pool:Pool,sessions:SessionService){return {
  async account(target:unknown,value:unknown,token:unknown){
    const accountId=reactivationId(target),input=reactivationInput(value,['confirmation','expectedSessionVersion']),version=reactivationVersion(input.expectedSessionVersion);if(input.confirmation!==true)throw new AuthError('INVALID_REQUEST');
    return reactivationTransaction(pool,sessions,token,[accountId],[],true,async(c,context,state)=>{
      const a=state.accounts.find(a=>a.id===accountId);if(!a)throw new AuthError('NOT_FOUND');
      if(a.status!=='inactive'||a.session_version!==version||state.people.find(p=>p.id===a.person_id)?.status!=='inactive')throw new AuthError('CONFLICT');
      // Inconsistent legacy live relationships must be resolved explicitly, never
      // silently revived by changing account/person status.
      if((await c.query(`SELECT 1 FROM family_memberships WHERE person_id=$1 AND ended_at IS NULL UNION ALL SELECT 1 FROM dependent_guardians WHERE guardian_account_id=$2 AND ended_at IS NULL`,[a.person_id,a.id])).rowCount)throw new AuthError('CONFLICT');
      if(a.password_hash!==null&&!isSupportedPasswordHash(a.password_hash))throw new AuthError('CONFLICT');
      const status=a.password_hash&&['verified','exempt'].includes(a.confirmation_status)?'active':'pending';
      await c.query("UPDATE accounts SET status=$2,deactivated_at=NULL,session_version=session_version+1,updated_at=clock_timestamp() WHERE id=$1",[a.id,status]);await c.query("UPDATE people SET status='active',updated_at=clock_timestamp() WHERE id=$1",[a.person_id]);await c.query('UPDATE identity_sessions SET revoked_at=clock_timestamp() WHERE account_id=$1 AND revoked_at IS NULL',[a.id]);
      await c.query(`INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,changes,reason,correlation_id) VALUES ($1,'staff','account.reactivated','account',$2,$3,'Management restored access without restoring relationships or financial effects',$4)`,[context.account.id,a.id,JSON.stringify({before:{status:'inactive'},after:{status}}),randomUUID()]);return {accountId:a.id,status,sessionVersion:version+1};
    });
  }
};}
