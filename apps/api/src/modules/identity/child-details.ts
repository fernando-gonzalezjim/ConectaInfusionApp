import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import type {DependentProfileView,SavedChildView,IdentityPage} from '@conecta/contracts';
import {AuthError,type SessionContext,type SessionService} from './sessions.js';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function identifier(value:unknown){if(typeof value!=='string'||!uuid.test(value))throw new AuthError('INVALID_REQUEST');return value.toLowerCase();}
function input(value:unknown,fields:string[],required:string[]){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!fields.includes(key))||required.some(key=>!Object.hasOwn(value,key)))throw new AuthError('INVALID_REQUEST');
  return value as Record<string,unknown>;
}
function text(value:unknown,max:number){if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\x00-\x1f\x7f]/.test(value))throw new AuthError('INVALID_REQUEST');return value.trim();}
function version(value:unknown){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>=2147483647)throw new AuthError('INVALID_REQUEST');return value;}
function locale(value:unknown){if(value!==undefined&&value!=='es-MX'&&value!=='en')throw new AuthError('INVALID_REQUEST');return value as 'es-MX'|'en'|undefined;}
function page(value:unknown){const body=input(value,['limit','cursor'],[]);if(body.limit!==undefined&&(typeof body.limit!=='string'||! /^[1-9][0-9]?$/.test(body.limit)||Number(body.limit)>50))throw new AuthError('INVALID_REQUEST');return {limit:body.limit===undefined?25:Number(body.limit),cursor:body.cursor===undefined?null:identifier(body.cursor)};}
export const childAuditActions=['dependent.created','dependent.profile_updated','child_details.created','child_details.updated','child_details.converted','dependent.guardian_invited','dependent.guardian_accepted','dependent.guardian_removed','dependent.reactivation_invited','dependent.reactivation_accepted','dependent.reactivated','dependent.transition_requested','dependent.transitioned'] as const;
type AuditAction=typeof childAuditActions[number];
export function readChildAuditSnapshot(value:unknown):Record<string,import('@conecta/contracts').AuditValue>|null{
  if(value===null)return null;const result:Record<string,import('@conecta/contracts').AuditValue>={};if(!value||typeof value!=='object'||Array.isArray(value))return result;
  for(const [key,entry] of Object.entries(value))if(['personId','invitationId','guardianAccountId','guardianRelationshipId'].includes(key)&&typeof entry==='string'&&uuid.test(entry)||['version','invitationVersion'].includes(key)&&typeof entry==='number'&&Number.isSafeInteger(entry)&&entry>=0&&entry<=2147483647)result[key]=entry;
  return result;
}

export function createChildDetailsService(pool:Pool,sessions:SessionService){
  async function checkSession(client:PoolClient,context:SessionContext){const row=(await client.query<{expires_at:Date}>(`SELECT expires_at FROM identity_sessions WHERE id=$1 AND account_id=$2 AND session_version=$3 AND revoked_at IS NULL FOR UPDATE`,[context.sessionId,context.account.id,context.sessionVersion])).rows[0];if(!row||+row.expires_at<=Date.now())throw new AuthError('UNAUTHENTICATED');}
  async function authorize(client:PoolClient,context:SessionContext,personId?:string){
    const account=(await client.query('SELECT person_id,status,confirmation_status,session_version FROM accounts WHERE id=$1 FOR UPDATE',[context.account.id])).rows[0];
    if(!account||account.status!=='active'||!['verified','exempt'].includes(account.confirmation_status)||account.session_version!==context.sessionVersion)throw new AuthError('UNAUTHENTICATED');
    const people=(await client.query('SELECT id,status,preferred_locale FROM people WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[...new Set([account.person_id,...(personId?[personId]:[])])]])).rows;
    const person=people.find(p=>p.id===account.person_id);if(person?.status!=='active')throw new AuthError('UNAUTHENTICATED');
    const roles=(await client.query('SELECT role FROM account_roles WHERE account_id=$1 FOR SHARE',[context.account.id])).rows.map(r=>r.role);
    await checkSession(client,context);if(!roles.includes('customer'))throw new AuthError('FORBIDDEN');return {locale:person.preferred_locale as 'es-MX'|'en'};
  }
  async function transaction<T>(token:unknown,work:(client:PoolClient,context:SessionContext)=>Promise<T>){const context=await sessions.resolve(token),client=await pool.connect();try{await client.query('BEGIN');const result=await work(client,context);await checkSession(client,context);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
  async function audit(client:PoolClient,context:SessionContext,action:AuditAction,id:string,before:Record<string,unknown>|null,after:Record<string,unknown>){
    // Fixed reference/version snapshots only; raw child names/ages never enter audit.
    await client.query(`INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,changes,reason,correlation_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,[context.account.id,context.account.roles.some(r=>r!=='customer')?'staff':'customer',action,action.startsWith('dependent.')?'dependent':'child_details',id,JSON.stringify({before,after}),'Authorized guardian or owner child profile operation',randomUUID()]);
  }
  async function dependent(client:PoolClient,id:string,context:SessionContext):Promise<DependentProfileView>{
    const row=(await client.query<DependentProfileView>(`SELECT d.person_id AS id,p.full_name AS "fullName",d.age_text AS "ageText",p.preferred_locale AS "preferredLocale",d.version FROM dependent_profiles d JOIN people p ON p.id=d.person_id WHERE d.person_id=$1 AND d.independent_at IS NULL AND p.status='active' FOR UPDATE OF d`,[id])).rows[0];
    if(!row||!(await client.query('SELECT id FROM dependent_guardians WHERE dependent_person_id=$1 AND guardian_account_id=$2 AND ended_at IS NULL FOR SHARE',[id,context.account.id])).rowCount)throw new AuthError('NOT_FOUND');
    const guardians=(await client.query<{accountId:string;fullName:string}>(`SELECT a.id AS "accountId",p.full_name AS "fullName" FROM dependent_guardians g JOIN accounts a ON a.id=g.guardian_account_id JOIN people p ON p.id=a.person_id WHERE g.dependent_person_id=$1 AND g.ended_at IS NULL AND a.status='active' AND a.confirmation_status IN ('verified','exempt') AND p.status='active' AND EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role='customer') ORDER BY a.id`,[id])).rows;
    return {...row,guardians};
  }
  async function child(client:PoolClient,id:string,context:SessionContext):Promise<SavedChildView>{const row=(await client.query<SavedChildView>(`SELECT id,child_name AS "childName",age_text AS "ageText",dependent_person_id AS "dependentPersonId",version FROM saved_child_details WHERE id=$1 AND owner_account_id=$2 FOR UPDATE`,[id,context.account.id])).rows[0];if(!row)throw new AuthError('NOT_FOUND');return row;}
  async function createDependent(client:PoolClient,context:SessionContext,value:{fullName:string;ageText:string;preferredLocale:'es-MX'|'en'}){
    const id=randomUUID();await client.query('INSERT INTO people(id,full_name,preferred_locale) VALUES ($1,$2,$3)',[id,value.fullName,value.preferredLocale]);
    await client.query('INSERT INTO dependent_profiles(person_id,age_text,created_by_account_id) VALUES ($1,$2,$3)',[id,value.ageText,context.account.id]);
    await client.query("INSERT INTO dependent_guardians(dependent_person_id,guardian_account_id,source,accepted_by_account_id) VALUES ($1,$2,'creation',$2)",[id,context.account.id]);
    await audit(client,context,'dependent.created',id,null,{personId:id,version:0});return dependent(client,id,context);
  }
  return {
    async createDependent(value:unknown,token:unknown){const body=input(value,['fullName','ageText','preferredLocale'],['fullName','ageText']),fullName=text(body.fullName,120),ageText=text(body.ageText,40),preferredLocale=locale(body.preferredLocale);return transaction(token,async(client,context)=>{const actor=await authorize(client,context);return createDependent(client,context,{fullName,ageText,preferredLocale:preferredLocale??actor.locale});});},
    async getDependent(value:unknown,token:unknown){const id=identifier(value);return transaction(token,async(client,context)=>{await authorize(client,context,id);return dependent(client,id,context);});},
    async updateDependent(target:unknown,value:unknown,token:unknown){const id=identifier(target),body=input(value,['fullName','ageText','preferredLocale','expectedVersion'],['fullName','ageText','expectedVersion']),fullName=text(body.fullName,120),ageText=text(body.ageText,40),expected=version(body.expectedVersion),preferredLocale=locale(body.preferredLocale);return transaction(token,async(client,context)=>{await authorize(client,context,id);const before=await dependent(client,id,context);if(before.version!==expected)throw new AuthError('CONFLICT');await client.query('UPDATE people SET full_name=$2,preferred_locale=$3,updated_at=clock_timestamp() WHERE id=$1',[id,fullName,preferredLocale??before.preferredLocale]);await client.query('UPDATE dependent_profiles SET age_text=$2,version=version+1 WHERE person_id=$1',[id,ageText]);await audit(client,context,'dependent.profile_updated',id,{personId:id,version:expected},{personId:id,version:expected+1});return dependent(client,id,context);});},
    async listDependents(value:unknown,token:unknown):Promise<IdentityPage<DependentProfileView>>{
      const paging=page(value);return transaction(token,async(client,context)=>{
        await authorize(client,context);
        // One statement keeps authorization and the returned page in the same read snapshot.
        const rows=(await client.query<DependentProfileView>(`SELECT d.person_id AS id,p.full_name AS "fullName",d.age_text AS "ageText",p.preferred_locale AS "preferredLocale",d.version,
          (SELECT COALESCE(json_agg(json_build_object('accountId',a.id,'fullName',gp.full_name) ORDER BY a.id),'[]'::json)
           FROM dependent_guardians g JOIN accounts a ON a.id=g.guardian_account_id JOIN people gp ON gp.id=a.person_id
           WHERE g.dependent_person_id=d.person_id AND g.ended_at IS NULL AND a.status='active' AND a.confirmation_status IN ('verified','exempt') AND gp.status='active'
           AND EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role='customer')) AS guardians
          FROM dependent_profiles d JOIN people p ON p.id=d.person_id WHERE d.independent_at IS NULL AND p.status='active'
          AND EXISTS(SELECT 1 FROM dependent_guardians g WHERE g.dependent_person_id=d.person_id AND g.guardian_account_id=$1 AND g.ended_at IS NULL)
          AND ($2::uuid IS NULL OR d.person_id>$2) ORDER BY d.person_id LIMIT $3`,[context.account.id,paging.cursor,paging.limit+1])).rows;
        return {items:rows.slice(0,paging.limit),nextCursor:rows.length>paging.limit?rows[paging.limit-1]!.id:null};
      });
    },
    async createChild(value:unknown,token:unknown){const body=input(value,['childName','ageText'],['childName','ageText']),childName=text(body.childName,120),ageText=text(body.ageText,40);return transaction(token,async(client,context)=>{await authorize(client,context);const id=randomUUID();await client.query('INSERT INTO saved_child_details(id,owner_account_id,child_name,age_text) VALUES ($1,$2,$3,$4)',[id,context.account.id,childName,ageText]);await audit(client,context,'child_details.created',id,null,{version:0});return child(client,id,context);});},
    async getChild(value:unknown,token:unknown){const id=identifier(value);return transaction(token,async(client,context)=>{await authorize(client,context);return child(client,id,context);});},
    async listChildren(value:unknown,token:unknown):Promise<IdentityPage<SavedChildView>>{const paging=page(value);return transaction(token,async(client,context)=>{await authorize(client,context);const rows=(await client.query<SavedChildView>(`SELECT id,child_name AS "childName",age_text AS "ageText",dependent_person_id AS "dependentPersonId",version FROM saved_child_details WHERE owner_account_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3`,[context.account.id,paging.cursor,paging.limit+1])).rows;return {items:rows.slice(0,paging.limit),nextCursor:rows.length>paging.limit?rows[paging.limit-1]!.id:null};});},
    async updateChild(target:unknown,value:unknown,token:unknown){const id=identifier(target),body=input(value,['childName','ageText','expectedVersion'],['childName','ageText','expectedVersion']),childName=text(body.childName,120),ageText=text(body.ageText,40),expected=version(body.expectedVersion);return transaction(token,async(client,context)=>{await authorize(client,context);const before=await child(client,id,context);if(before.version!==expected)throw new AuthError('CONFLICT');await client.query('UPDATE saved_child_details SET child_name=$2,age_text=$3,version=version+1 WHERE id=$1',[id,childName,ageText]);await audit(client,context,'child_details.updated',id,{version:expected},{version:expected+1});return child(client,id,context);});},
    async convertChild(target:unknown,value:unknown,token:unknown){const id=identifier(target),body=input(value,['expectedVersion'],['expectedVersion']),expected=version(body.expectedVersion);return transaction(token,async(client,context)=>{const actor=await authorize(client,context);const before=await child(client,id,context);if(before.version!==expected||before.dependentPersonId!==null)throw new AuthError('CONFLICT');const profile=await createDependent(client,context,{fullName:before.childName,ageText:before.ageText,preferredLocale:actor.locale});await client.query('UPDATE saved_child_details SET dependent_person_id=$2,version=version+1 WHERE id=$1',[id,profile.id]);await audit(client,context,'child_details.converted',id,{version:expected},{version:expected+1,personId:profile.id});return {child:await child(client,id,context),dependent:profile};});},
  };
}
