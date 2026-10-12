import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import type {createAccountService} from '../identity/accounts.js';
import {encodeProfilePhoto} from '../identity/photos.js';
import {AuthError} from '../identity/sessions.js';
import {catalogInstructorColumns,type CatalogInstructor,type createInstructorService} from './instructors.js';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const maxBytes=5*1024*1024;
function input(value:unknown,remove:boolean){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!(remove?['expectedVersion']:['data','expectedVersion','altEs','altEn']).includes(k)))throw new AuthError('INVALID_REQUEST');
 const d=value as Record<string,unknown>;
 if(!Number.isSafeInteger(d.expectedVersion)||(d.expectedVersion as number)<1||(d.expectedVersion as number)>2147483646)throw new AuthError('INVALID_REQUEST');
 function alt(v:unknown,optional:boolean){if(optional&&(v===null||v===undefined))return null;if(typeof v!=='string'||!v.trim()||v.length>300||/[\x00-\x1f\x7f]/.test(v))throw new AuthError('INVALID_REQUEST');return v.trim();}
 if(remove)return {expectedVersion:d.expectedVersion,altEs:null,altEn:null,bytes:null};
 if(typeof d.data!=='string'||!d.data.length||d.data.length%4!==0||d.data.length>Math.ceil(maxBytes/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(d.data))throw new AuthError('INVALID_REQUEST');
 const bytes=Buffer.from(d.data,'base64');if(!bytes.length||bytes.length>maxBytes||bytes.toString('base64')!==d.data)throw new AuthError('INVALID_REQUEST');
 return {expectedVersion:d.expectedVersion,altEs:alt(d.altEs,false),altEn:alt(d.altEn,true),bytes};
}
export function createInstructorPhotoService(pool:Pool,administration:Pick<ReturnType<typeof createAccountService>,'withManagementRead'>,_catalog?:ReturnType<typeof createInstructorService>){
 async function target(id:unknown){if(typeof id!=='string'||!uuid.test(id))return undefined;return (await pool.query<{id:string}>(`SELECT a.id FROM instructors i JOIN accounts a ON a.person_id=i.person_id WHERE i.id=$1`,[id])).rows[0]?.id;}
 async function mutate(id:unknown,value:unknown,token:unknown,remove:boolean){
  const accountId=await target(id);
  return administration.withManagementRead(token,async(client,context)=>{
   if(typeof id!=='string'||!uuid.test(id))throw new AuthError('INVALID_REQUEST');const d=input(value,remove);
   // Decode only after locked current management authorization. Pure shared image
   // processing accesses no private Identity references or storage.
   const output=d.bytes?await encodeProfilePhoto(d.bytes):null;
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['studio-catalog:publication']);
   const before=(await client.query<CatalogInstructor>(`SELECT ${catalogInstructorColumns} FROM studio_instructor_profiles p WHERE p.instructor_id=$1 FOR UPDATE`,[id])).rows[0];
   if(!before)throw new AuthError('NOT_FOUND');if(before.version!==d.expectedVersion)throw new AuthError('CONFLICT');
   const active=(await client.query<{id:string}>(`SELECT a.id FROM instructors i JOIN people pe ON pe.id=i.person_id AND pe.status='active'
     JOIN accounts a ON a.person_id=pe.id AND a.status='active' AND a.confirmation_status IN ('verified','exempt')
     WHERE i.id=$1 AND EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role='instructor')`,[id])).rows[0];
   if(!remove&&(!active||active.id!==accountId))throw new AuthError('CONFLICT');
   if(Date.parse(context.expiresAt)<=Date.now())throw new AuthError('UNAUTHENTICATED');
   if(remove)await client.query('DELETE FROM studio_instructor_photos WHERE instructor_id=$1',[id]);
   else await client.query(`INSERT INTO studio_instructor_photos(instructor_id,data,alt_es,alt_en) VALUES($1,$2,$3,$4)
    ON CONFLICT(instructor_id) DO UPDATE SET data=excluded.data,alt_es=excluded.alt_es,alt_en=excluded.alt_en,updated_at=clock_timestamp()`,[id,output,d.altEs,d.altEn]);
   await client.query('UPDATE studio_instructor_profiles SET version=version+1,updated_at=clock_timestamp() WHERE instructor_id=$1',[id]);
   const after=(await client.query<CatalogInstructor>(`SELECT ${catalogInstructorColumns} FROM studio_instructor_profiles p WHERE p.instructor_id=$1`,[id])).rows[0]!;
   await client.query(`INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,business_unit,changes,reason,correlation_id)
    VALUES($1,'staff',$2,'catalog_instructor',$3,'studio',$4,$5,$6)`,[context.account.id,remove?'studio.instructor_photo_removed':'studio.instructor_photo_approved',id,JSON.stringify({before:{photo:before.photo,version:before.version},after:{photo:after.photo,version:after.version}}),remove?'Management removed catalog portrait':'Management approved catalog portrait',randomUUID()]);
   return after;
  },accountId);
 }
 return {
  upload:(id:unknown,value:unknown,token:unknown)=>mutate(id,value,token,false),remove:(id:unknown,value:unknown,token:unknown)=>mutate(id,value,token,true),
  async readManagement(id:unknown,token:unknown){return administration.withManagementRead(token,async client=>{
   if(typeof id!=='string'||!uuid.test(id))throw new AuthError('INVALID_REQUEST');const row=(await client.query<{data:Buffer}>('SELECT data FROM studio_instructor_photos WHERE instructor_id=$1',[id])).rows[0];if(!row)throw new AuthError('NOT_FOUND');return row.data;
  });},
  async readPublic(id:unknown){
   if(typeof id!=='string'||!uuid.test(id))throw new AuthError('INVALID_REQUEST');
   const row=(await pool.query<{data:Buffer}>(`SELECT ph.data FROM studio_instructor_photos ph JOIN studio_instructor_profiles p ON p.instructor_id=ph.instructor_id AND p.status='published'
    JOIN instructors i ON i.id=p.instructor_id JOIN people pe ON pe.id=i.person_id AND pe.status='active'
    JOIN accounts a ON a.person_id=pe.id AND a.status='active' AND a.confirmation_status IN ('verified','exempt')
    WHERE ph.instructor_id=$1 AND EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role='instructor')
    AND EXISTS(SELECT 1 FROM studio_instructor_disciplines q JOIN studio_disciplines d ON d.id=q.discipline_id AND d.status='published' WHERE q.instructor_id=i.id)`,[id])).rows[0];
   if(!row)throw new AuthError('NOT_FOUND');return row.data;
  }
 };
}
