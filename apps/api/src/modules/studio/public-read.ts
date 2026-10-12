import type {Pool} from 'pg';
import {AuthError} from '../identity/sessions.js';

export type PublicDiscipline={id:string;name:string;description:string};
export type PublicClass={id:string;discipline:PublicDiscipline;name:string;description:string;audience:'children'|'adults';minAge:number|null;maxAge:number|null;level:'beginner'|'intermediate'|'advanced'|'all';color:string;durationMinutes:55;instructors:{id:string;publicName:string;biography:string|null;photo:{url:string;alt:string}|null}[]};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function id(value:unknown):string{if(typeof value!=='string'||!uuid.test(value))throw new AuthError('INVALID_REQUEST');return value;}
function options(value:unknown,listing:boolean,classes:boolean){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new AuthError('INVALID_REQUEST');
 const q=value as Record<string,unknown>;
 const allowed=['locale',...(listing?['limit','cursor',...(classes?['disciplineId']:[])]:[])];
 if(Object.keys(q).some(key=>!allowed.includes(key))||(q.locale!==undefined&&!['es-MX','en'].includes(q.locale as string)))throw new AuthError('INVALID_REQUEST');
 if(q.limit!==undefined&&(typeof q.limit!=='string'||!/^([1-9]|[1-4][0-9]|50)$/.test(q.limit)))throw new AuthError('INVALID_REQUEST');
 return {english:q.locale==='en',limit:q.limit===undefined?20:Number(q.limit),cursor:q.cursor===undefined?null:id(q.cursor),disciplineId:q.disciplineId===undefined?null:id(q.disciplineId)};
}
function localized(alias:string,field:string){return `CASE WHEN $1::boolean THEN COALESCE(NULLIF(${alias}.${field}_en,''),${alias}.${field}_es) ELSE ${alias}.${field}_es END`;}
const disciplineColumns=`d.id,${localized('d','name')} AS name,${localized('d','description')} AS description`;
const classColumns=`c.id,json_build_object('id',d.id,'name',${localized('d','name')},'description',${localized('d','description')}) AS discipline,
 ${localized('c','name')} AS name,${localized('c','description')} AS description,c.audience,c.min_age AS "minAge",c.max_age AS "maxAge",c.level,c.color,c.duration_minutes AS "durationMinutes",
 COALESCE((SELECT json_agg(json_build_object('id',p.instructor_id,'publicName',p.public_name,'biography',CASE WHEN $1::boolean THEN COALESCE(NULLIF(p.biography_en,''),p.biography_es) ELSE p.biography_es END,
 'photo',CASE WHEN ph.instructor_id IS NULL THEN NULL ELSE json_build_object('url','/api/v1/studio/catalog/instructors/'||p.instructor_id||'/photo','alt',CASE WHEN $1::boolean THEN COALESCE(ph.alt_en,ph.alt_es) ELSE ph.alt_es END) END) ORDER BY p.instructor_id)
 FROM studio_instructor_profiles p JOIN studio_instructor_disciplines q ON q.instructor_id=p.instructor_id AND q.discipline_id=c.discipline_id
 JOIN instructors i ON i.id=p.instructor_id JOIN people pe ON pe.id=i.person_id AND pe.status='active'
 JOIN accounts a ON a.person_id=pe.id AND a.status='active' AND a.confirmation_status IN ('verified','exempt')
 JOIN account_roles r ON r.account_id=a.id AND r.role='instructor' LEFT JOIN studio_instructor_photos ph ON ph.instructor_id=p.instructor_id WHERE p.status='published'),'[]'::json) AS instructors`;

// A single statement snapshot checks the full publication and current instructor chain.
// Explicit columns prevent identity details and management metadata escaping via DTOs.
export function createPublicCatalogService(pool:Pool){
 async function list<T>(query:unknown,classes:boolean){
  const o=options(query,true,classes);
  const sql=classes?`SELECT ${classColumns} FROM studio_classes c JOIN studio_disciplines d ON d.id=c.discipline_id
   WHERE c.status='published' AND d.status='published' AND ($2::uuid IS NULL OR c.id>$2) AND ($3::uuid IS NULL OR c.discipline_id=$3) ORDER BY c.id LIMIT $4`
   :`SELECT ${disciplineColumns} FROM studio_disciplines d WHERE d.status='published' AND ($2::uuid IS NULL OR d.id>$2) ORDER BY d.id LIMIT $3`;
  const result=await pool.query(sql,classes?[o.english,o.cursor,o.disciplineId,o.limit+1]:[o.english,o.cursor,o.limit+1]);
  const items=result.rows.slice(0,o.limit) as (T&{id:string})[];
  return {items,nextCursor:result.rows.length>o.limit?items.at(-1)!.id:null};
 }
 async function detail<T>(itemId:unknown,query:unknown,classes:boolean):Promise<T>{
  const validId=id(itemId);const o=options(query,false,classes);
  const sql=classes?`SELECT ${classColumns} FROM studio_classes c JOIN studio_disciplines d ON d.id=c.discipline_id WHERE c.id=$2 AND c.status='published' AND d.status='published'`
   :`SELECT ${disciplineColumns} FROM studio_disciplines d WHERE d.id=$2 AND d.status='published'`;
  const result=await pool.query(sql,[o.english,validId]);if(!result.rows[0])throw new AuthError('NOT_FOUND');return result.rows[0] as T;
 }
 return {listDisciplines:(query:unknown)=>list<PublicDiscipline>(query,false),discipline:(itemId:unknown,query:unknown)=>detail<PublicDiscipline>(itemId,query,false),
  listClasses:(query:unknown)=>list<PublicClass>(query,true),classDetail:(itemId:unknown,query:unknown)=>detail<PublicClass>(itemId,query,true)};
}
