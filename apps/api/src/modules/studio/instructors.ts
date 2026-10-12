import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import type {createAccountService} from '../identity/accounts.js';
import {AuthError,type SessionContext} from '../identity/sessions.js';

export interface CatalogInstructor {
  instructorId:string;publicName:string;biographyEs:string|null;biographyEn:string|null;
  status:'draft'|'published'|'archived';version:number;disciplineIds:string[];photo:{url:string;altEs:string;altEn:string|null}|null;
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fields=['publicName','biographyEs','biographyEn','status','disciplineIds'];
const columns=`p.instructor_id AS "instructorId",p.public_name AS "publicName",p.biography_es AS "biographyEs",
 p.biography_en AS "biographyEn",p.status,p.version,
 ARRAY(SELECT d.discipline_id FROM studio_instructor_disciplines d WHERE d.instructor_id=p.instructor_id ORDER BY d.discipline_id) AS "disciplineIds",
 (SELECT json_build_object('url','/api/v1/studio/catalog/instructors/'||p.instructor_id||'/photo','altEs',ph.alt_es,'altEn',ph.alt_en)
 FROM studio_instructor_photos ph WHERE ph.instructor_id=p.instructor_id) AS photo`;
export const catalogInstructorColumns=columns;
const eligible=`a.status='active' AND a.confirmation_status IN ('verified','exempt') AND pe.status='active'
 AND EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role='instructor')`;
function object(value:unknown,allowed:string[]){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw new AuthError('INVALID_REQUEST');
  return value as Record<string,unknown>;
}
function validate(data:Record<string,unknown>,update:boolean){
  function text(key:string,max:number,optional:boolean){
    const v=data[key];if(optional&&(v===null||v===undefined))return null;
    if(typeof v!=='string'||v.length>max||!optional&&!v.trim()||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v))throw new AuthError('INVALID_REQUEST');return v.trim();
  }
  const publicName=text('publicName',120,false)!;
  const biographyEs=text('biographyEs',4000,true),biographyEn=text('biographyEn',4000,true);
  const status=data.status===undefined?'draft':data.status;
  if(!['draft','published',...(update?['archived']:[])].includes(status as string))throw new AuthError('INVALID_REQUEST');
  const ids=data.disciplineIds===undefined?[]:data.disciplineIds;
  if(!Array.isArray(ids)||ids.length>50||ids.some(id=>typeof id!=='string'||!uuid.test(id))||new Set(ids.map(id=>id.toLowerCase())).size!==ids.length)throw new AuthError('INVALID_REQUEST');
  if(status==='published'&&!ids.length)throw new AuthError('INVALID_REQUEST');
  if(update&&(!Number.isSafeInteger(data.expectedVersion)||(data.expectedVersion as number)<1||(data.expectedVersion as number)>2147483646))throw new AuthError('INVALID_REQUEST');
  const reason=data.reason===undefined?undefined:text('reason',500,false)!;
  return {publicName,biographyEs,biographyEn,status:status as CatalogInstructor['status'],disciplineIds:ids.map(id=>(id as string).toLowerCase()).sort(),expectedVersion:data.expectedVersion,reason};
}
function page(value:unknown){
  const q=object(value,['cursor','limit']);
  if(q.cursor!==undefined&&(typeof q.cursor!=='string'||!uuid.test(q.cursor)))throw new AuthError('INVALID_REQUEST');
  const limit=q.limit===undefined?50:typeof q.limit==='string'&&/^[1-9][0-9]?$/.test(q.limit)?Number(q.limit):NaN;
  if(!Number.isInteger(limit)||limit<1||limit>50)throw new AuthError('INVALID_REQUEST');return {cursor:q.cursor??null,limit};
}
function current(context:SessionContext){if(Date.parse(context.expiresAt)<=Date.now())throw new AuthError('UNAUTHENTICATED');}

export function createInstructorService(pool:Pool,administration:Pick<ReturnType<typeof createAccountService>,'withManagementRead'|'withInstructorRead'>){
  async function targetAccount(id:unknown){
    if(typeof id!=='string'||!uuid.test(id))return undefined;
    return (await pool.query<{id:string}>(`SELECT a.id FROM instructors i JOIN accounts a ON a.person_id=i.person_id WHERE i.id=$1`,[id])).rows[0]?.id;
  }
  async function write(id:unknown,value:unknown,token:unknown,update:boolean){
    const target=await targetAccount(id);
    return administration.withManagementRead(token,async(client,context)=>{
      if(typeof id!=='string'||!uuid.test(id))throw new AuthError('INVALID_REQUEST');
      const supplied=object(value,[...fields,...(update?['expectedVersion','reason']:['instructorId'])]);
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['studio-catalog:publication']);
      const before=(await client.query<CatalogInstructor>(`SELECT ${columns} FROM studio_instructor_profiles p WHERE p.instructor_id=$1 FOR UPDATE`,[id])).rows[0];
      if(update&&!before)throw new AuthError('NOT_FOUND');if(!update&&before)throw new AuthError('CONFLICT');
      const data=validate({...before,...supplied},update);
      if(update&&before!.version!==data.expectedVersion)throw new AuthError('CONFLICT');
      const identity=(await client.query<{id:string}>(`SELECT a.id FROM instructors i JOIN people pe ON pe.id=i.person_id JOIN accounts a ON a.person_id=pe.id
        WHERE i.id=$1 AND ${eligible}`,[id])).rows[0];
      // The pre-read identifies which target Identity rows the shared helper locks.
      // A link changed between reads cannot escape those deterministic locks.
      if(!identity||identity.id!==target)throw new AuthError('CONFLICT');
      const disciplines=(await client.query<{id:string;status:string}>(`SELECT id,status FROM studio_disciplines WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE`,[data.disciplineIds])).rows;
      if(disciplines.length!==data.disciplineIds.length||disciplines.some(d=>d.status==='archived'||data.status==='published'&&d.status!=='published'))throw new AuthError('CONFLICT');
      if(before&&(data.status==='archived'||before.status==='published'&&data.status!=='published'||before.disciplineIds.some(d=>!data.disciplineIds.includes(d)))){
        const future=await client.query(`SELECT s.id FROM class_sessions s LEFT JOIN studio_classes c ON c.id=s.class_id
          WHERE s.instructor_id=$1 AND s.starts_at>=now() AND s.status<>'cancelled'
          AND ($2::text<>'published' OR c.id IS NULL OR NOT(c.discipline_id=ANY($3::uuid[]))) LIMIT 1`,[id,data.status,data.disciplineIds]);
        if(future.rowCount)throw new AuthError('CONFLICT');
      }
      current(context);
      if(update)await client.query(`UPDATE studio_instructor_profiles SET public_name=$2,biography_es=$3,biography_en=$4,status=$5,version=version+1,updated_at=clock_timestamp() WHERE instructor_id=$1`,[id,data.publicName,data.biographyEs,data.biographyEn,data.status]);
      else await client.query(`INSERT INTO studio_instructor_profiles(instructor_id,public_name,biography_es,biography_en,status) VALUES($1,$2,$3,$4,$5)`,[id,data.publicName,data.biographyEs,data.biographyEn,data.status]);
      await client.query('DELETE FROM studio_instructor_disciplines WHERE instructor_id=$1',[id]);
      await client.query(`INSERT INTO studio_instructor_disciplines(instructor_id,discipline_id) SELECT $1,unnest($2::uuid[])`,[id,data.disciplineIds]);
      const after=(await client.query<CatalogInstructor>(`SELECT ${columns} FROM studio_instructor_profiles p WHERE p.instructor_id=$1`,[id])).rows[0]!;
      await client.query(`INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,business_unit,changes,reason,correlation_id)
        VALUES($1,'staff',$2,'catalog_instructor',$3,'studio',$4,$5,$6)`,[context.account.id,update?'studio.instructor_updated':'studio.instructor_created',id,JSON.stringify({before:before??null,after}),data.reason??'Management maintained instructor catalog facts',randomUUID()]);
      return after;
    },target);
  }
  return {
    async list(query:unknown,token:unknown){return administration.withManagementRead(token,async client=>{
      const q=page(query),rows=(await client.query<CatalogInstructor>(`SELECT ${columns} FROM studio_instructor_profiles p WHERE ($1::uuid IS NULL OR p.instructor_id>$1) ORDER BY p.instructor_id LIMIT $2`,[q.cursor,q.limit+1])).rows;
      return {items:rows.slice(0,q.limit),nextCursor:rows.length>q.limit?rows[q.limit-1]!.instructorId:null};
    });},
    async candidates(query:unknown,token:unknown){return administration.withManagementRead(token,async client=>{
      const q=page(query),rows=(await client.query<{instructorId:string;name:string}>(`SELECT i.id AS "instructorId",pe.full_name AS name FROM instructors i JOIN people pe ON pe.id=i.person_id JOIN accounts a ON a.person_id=pe.id
        WHERE ${eligible} AND ($1::uuid IS NULL OR i.id>$1) ORDER BY i.id LIMIT $2`,[q.cursor,q.limit+1])).rows;
      return {items:rows.slice(0,q.limit),nextCursor:rows.length>q.limit?rows[q.limit-1]!.instructorId:null};
    });},
    create(value:unknown,token:unknown){const id=value&&typeof value==='object'?'instructorId' in value?value.instructorId:undefined:undefined;return write(id,value,token,false);},
    update(id:unknown,value:unknown,token:unknown){return write(id,value,token,true);},
    async own(token:unknown){return administration.withInstructorRead(token,async(client,context)=>{
      current(context);
      const row=(await client.query<CatalogInstructor>(`SELECT ${columns} FROM studio_instructor_profiles p JOIN instructors i ON i.id=p.instructor_id WHERE i.person_id=$1`,[context.account.personId])).rows[0];return row??null;
    });}
  };
}
