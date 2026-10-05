import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import type {IdentityRole,RoleChangeResponse} from '@conecta/contracts';
import {AuthError,type SessionService} from './sessions.js';
import {appendIdentityAudit} from './audit.js';
import {isSupportedPasswordHash} from './passwords.js';
import {developmentDatabaseUrl} from './bootstrap.js';

const allowed:readonly IdentityRole[]=['administrator','manager','reception','cafe_staff','instructor','customer'];
const privileged=(roles:readonly string[])=>roles.some(role=>role==='administrator'||role==='manager');
export function staffAttendanceEligible(active:boolean,roles:readonly string[]){return active&&roles.some(role=>allowed.includes(role as IdentityRole)&&role!=='customer');}
export interface EligibilityChange {accountId:string;personId:string;previousRoles:IdentityRole[];roles:IdentityRole[];losesStaffAttendance:boolean;removesInstructor:boolean}
export function createRoleService(pool:Pool,sessions:SessionService,options:{now?:()=>Date;environment?:NodeJS.ProcessEnv;
  coordinateEligibilityLoss?:(client:PoolClient,change:EligibilityChange)=>Promise<void>}={}){
 const clock=options.now??(()=>new Date());
 const environment={...(options.environment??process.env)};
 async function loginEligible(client:PoolClient,row:{password_hash:string;email:string;development_fixture:string|null}){
  if(!isSupportedPasswordHash(row.password_hash))return false;
  if(!row.development_fixture)return !['admin@conecta.example.test','testuser@conecta.example.test'].includes(row.email);
  try{
   const target=developmentDatabaseUrl(environment);
   if(pool.options.connectionString!==environment.DATABASE_URL||row.email!==`${row.development_fixture}@conecta.example.test`)return false;
   return (await client.query<{name:string}>('SELECT current_database() AS name')).rows[0]?.name===target.pathname.slice(1);
  }catch(error){if(error instanceof Error&&['DEVELOPMENT_FIXTURES_DISABLED','UNSAFE_DEVELOPMENT_DATABASE'].includes(error.message))return false;throw error;}
 }
 return {async change(target:unknown,value:unknown,token:unknown):Promise<RoleChangeResponse>{
  const context=await sessions.resolve(token,['administrator','manager']);
  if(typeof target!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(target)
   ||!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>key!=='roles'))throw new AuthError('INVALID_REQUEST');
  const input=(value as {roles?:unknown}).roles;
  if(!Array.isArray(input)||input.length<1||input.length>6||new Set(input).size!==input.length||input.some(role=>!allowed.includes(role)))throw new AuthError('INVALID_REQUEST');
  const targetId=target.toLowerCase();const client=await pool.connect();
  try{
   await client.query('BEGIN');
   // Every role/lifecycle operation affecting the last-admin invariant must take this lock first.
   await client.query("SELECT pg_advisory_xact_lock(hashtextextended('identity-active-administration',0))");
   const accounts=(await client.query<{id:string;person_id:string;status:string;confirmation_status:string;session_version:number;email:string}>(
    'SELECT id,person_id,status,confirmation_status,session_version,email FROM accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[...new Set([context.account.id,targetId])]])).rows;
   const actor=accounts.find(a=>a.id===context.account.id);const account=accounts.find(a=>a.id===targetId);
   if(!actor||actor.status!=='active'||!['verified','exempt'].includes(actor.confirmation_status)||actor.session_version!==context.sessionVersion)throw new AuthError('UNAUTHENTICATED');
   const people=(await client.query<{id:string;status:string}>('SELECT id,status FROM people WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[accounts.map(a=>a.person_id)])).rows;
   const session=(await client.query<{expires_at:Date}>('SELECT expires_at FROM identity_sessions WHERE id=$1 AND account_id=$2 AND session_version=$3 AND revoked_at IS NULL FOR UPDATE',[context.sessionId,actor.id,context.sessionVersion])).rows[0];
   const assignments=(await client.query<{account_id:string;role:IdentityRole}>('SELECT account_id,role FROM account_roles WHERE account_id=ANY($1::uuid[]) ORDER BY account_id,role FOR UPDATE',[accounts.map(a=>a.id)])).rows;
   const actorRoles=assignments.filter(r=>r.account_id===actor.id).map(r=>r.role);
   if(!session||session.expires_at.getTime()<=clock().getTime()||people.find(p=>p.id===actor.person_id)?.status!=='active')throw new AuthError('UNAUTHENTICATED');
   if(!privileged(actorRoles))throw new AuthError('FORBIDDEN');
   if(!account)throw new AuthError('NOT_FOUND');
   // Pending invitations are customer-only until secure setup; inactive accounts use lifecycle workflows.
   if(account.status!=='active'||people.find(p=>p.id===account.person_id)?.status!=='active')throw new AuthError('CONFLICT');
   const previousRoles=assignments.filter(r=>r.account_id===targetId).map(r=>r.role).sort();
   const nextRoles=[...new Set([...input,...(previousRoles.includes('customer')?['customer']:[])])].sort() as IdentityRole[];
   if(privileged(previousRoles)&&!privileged(nextRoles)){
    const remaining=(await client.query<{password_hash:string;email:string;development_fixture:string|null}>(`SELECT a.password_hash,a.email,a.development_fixture FROM accounts a JOIN people p ON p.id=a.person_id
     WHERE a.id<>$1 AND a.status='active' AND p.status='active' AND a.confirmation_status IN ('verified','exempt')
     AND EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role IN ('administrator','manager'))`,[targetId])).rows;
    let eligible=false;for(const row of remaining)if(await loginEligible(client,row)){eligible=true;break;}
    if(!eligible)throw new AuthError('CONFLICT');
   }
   const change:EligibilityChange={accountId:targetId,personId:account.person_id,previousRoles,roles:nextRoles,
    losesStaffAttendance:staffAttendanceEligible(true,previousRoles)&&!staffAttendanceEligible(true,nextRoles),
    removesInstructor:previousRoles.includes('instructor')&&!nextRoles.includes('instructor')};
   if(JSON.stringify(previousRoles)!==JSON.stringify(nextRoles)){
    if(change.losesStaffAttendance||change.removesInstructor){
     if(options.coordinateEligibilityLoss)await options.coordinateEligibilityLoss(client,change);
     else{
      // Known legacy obligations and unresolved teaching identities require their owning coordinator.
      await client.query('LOCK TABLE members,instructors,class_sessions,bookings IN SHARE MODE');
      const legacy=(await client.query<{blocked:boolean}>(`SELECT EXISTS(SELECT 1 FROM bookings)
       OR EXISTS(SELECT 1 FROM members WHERE person_id=$1 OR lower(btrim(email))=$2)
       OR EXISTS(SELECT 1 FROM instructors WHERE person_id=$1 OR person_id IS NULL)
       OR EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND NOT(tablename=ANY($3::text[]))) AS blocked`,[account.person_id,account.email,
       // Family facts are Identity-owned and preserved because the customer role
       // cannot be removed here. Unknown domain tables still require coordination.
       ['members','instructors','class_sessions','bookings','products','sales','sale_items','business_units','business_settings','audit_events','people','accounts','account_roles','identity_sessions','identity_action_tokens','identity_throttles','identity_email_outbox','families','family_memberships','family_invitations','family_successor_offers','dependent_profiles','dependent_guardians','dependent_deactivations','dependent_prior_guardians','saved_child_details','guardian_invitations','guardian_consent_exceptions','flyway_schema_history']])).rows[0];
      if(legacy?.blocked)throw new AuthError('CONFLICT');
     }
    }
    if(session.expires_at.getTime()<=clock().getTime())throw new AuthError('UNAUTHENTICATED');
    await client.query('DELETE FROM account_roles WHERE account_id=$1 AND NOT(role=ANY($2::text[]))',[targetId,nextRoles]);
    await client.query('INSERT INTO account_roles(account_id,role,assigned_by) SELECT $1,unnest($2::text[]),$3 ON CONFLICT DO NOTHING',[targetId,nextRoles,actor.id]);
    const now=clock();await client.query('UPDATE accounts SET session_version=session_version+1,updated_at=$2 WHERE id=$1',[targetId,now]);
    await client.query('UPDATE identity_sessions SET revoked_at=$2 WHERE account_id=$1 AND revoked_at IS NULL',[targetId,now]);
    await appendIdentityAudit(client,{actor:{id:actor.id,type:'staff'},action:'account.roles_changed',targetType:'account',targetId,
     before:{roles:previousRoles},after:{roles:nextRoles},reason:'Account roles changed by management',correlationId:randomUUID()});
   }
   await client.query('COMMIT');return {accountId:targetId,roles:nextRoles,staffAttendanceEligible:staffAttendanceEligible(true,nextRoles)};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }};
}
