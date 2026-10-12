import type {ApiErrorCode,CatalogPage,CatalogQuery,PublicDiscipline,PublicInstructor,PublicStudioClass,StudioClass,StudioClassInput,StudioClassUpdate,StudioInstructor,StudioInstructorInput,StudioInstructorUpdate} from '@conecta/contracts';
type Read=<T>(path:string,signal?:AbortSignal)=>Promise<T>;
type Write=<T>(path:string,input:unknown,signal?:AbortSignal)=>Promise<T>;
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const text=(v:unknown,max:number,nullable=false)=>nullable&&v===null||typeof v==='string'&&v.length<=max;
const state=(v:unknown)=>['draft','published','archived'].includes(v as string);
const age=(v:unknown)=>v===null||Number.isSafeInteger(v)&&(v as number)>=0&&(v as number)<=2147483647;
export function createCatalogClient(read:Read,write:Write,error:(code:ApiErrorCode)=>Error){
 function invalid():never{throw error('INTERNAL_ERROR');}
 function id(v:string){if(!validId(v))throw error('INVALID_REQUEST');return v;}
 function query(value:CatalogQuery={},publicRead=false,filter=false){
  const limit=value.limit??(publicRead?20:50);if(!Number.isInteger(limit)||limit<1||limit>50)throw error('INVALID_REQUEST');
  const p=new URLSearchParams({limit:String(limit)});if(value.cursor!==undefined)p.set('cursor',id(value.cursor));
  if(value.disciplineId!==undefined){if(!filter)throw error('INVALID_REQUEST');p.set('disciplineId',id(value.disciplineId));}
  if(publicRead){if(value.locale!==undefined&&!['es-MX','en'].includes(value.locale))throw error('INVALID_REQUEST');p.set('locale',value.locale??'es-MX');}
  return p;
 }
 function localized(v:StudioClass){
  if(!v||!validId(v.id)||!validId(v.disciplineId)||!text(v.nameEs,120)||!v.nameEs.trim()||!text(v.nameEn,120,true)
   ||!text(v.descriptionEs,4000)||!text(v.descriptionEn,4000,true)||!state(v.status)||!Number.isSafeInteger(v.version)||v.version<1||v.version>2147483647)invalid();
 }
 function classFacts(v:StudioClass|PublicStudioClass){
  if(!v||!['children','adults'].includes(v.audience)||!age(v.minAge)||!age(v.maxAge)
   ||v.minAge!==null&&v.maxAge!==null&&v.minAge>v.maxAge||v.audience==='adults'&&(v.minAge!==null||v.maxAge!==null)
   ||!['beginner','intermediate','advanced','all'].includes(v.level)||typeof v.color!=='string'||!/^#[0-9a-f]{6}$/i.test(v.color)||v.durationMinutes!==55)invalid();
  return {audience:v.audience,minAge:v.minAge,maxAge:v.maxAge,level:v.level,color:v.color,durationMinutes:55 as const};
 }
 function safeClass(v:StudioClass):StudioClass{localized(v);return {id:v.id,disciplineId:v.disciplineId,nameEs:v.nameEs,nameEn:v.nameEn,descriptionEs:v.descriptionEs,descriptionEn:v.descriptionEn,status:v.status,version:v.version,...classFacts(v)};}
 function safeInstructor(v:StudioInstructor):StudioInstructor{
  if(!v||!validId(v.instructorId)||!text(v.publicName,120)||!v.publicName.trim()||!text(v.biographyEs,4000,true)||!text(v.biographyEn,4000,true)
   ||!state(v.status)||!Number.isSafeInteger(v.version)||v.version<1||v.version>2147483647||!Array.isArray(v.disciplineIds)||v.disciplineIds.length>50||v.disciplineIds.some(x=>!validId(x))||new Set(v.disciplineIds).size!==v.disciplineIds.length)invalid();
  if(v.photo!==null&&(!v.photo||v.photo.url!=='/api/v1/studio/catalog/instructors/'+v.instructorId+'/photo'||!text(v.photo.altEs,500)||!v.photo.altEs.trim()||!text(v.photo.altEn,500,true)))invalid();
  return {instructorId:v.instructorId,publicName:v.publicName,biographyEs:v.biographyEs,biographyEn:v.biographyEn,status:v.status,version:v.version,photo:v.photo===null?null:{url:v.photo.url,altEs:v.photo.altEs,altEn:v.photo.altEn},disciplineIds:[...v.disciplineIds]};
 }
 function safeDiscipline(v:PublicDiscipline):PublicDiscipline{if(!v||!validId(v.id)||!text(v.name,120)||!v.name.trim()||!text(v.description,4000))invalid();return {id:v.id,name:v.name,description:v.description};}
 function safePublicInstructor(v:PublicInstructor):PublicInstructor{if(!v||!validId(v.id)||!text(v.publicName,120)||!v.publicName.trim()||!text(v.biography,4000,true))invalid();if(v.photo!==null&&(!v.photo||v.photo.url!=='/api/v1/studio/catalog/instructors/'+v.id+'/photo'||!text(v.photo.alt,500)||!v.photo.alt.trim()))invalid();return {id:v.id,publicName:v.publicName,biography:v.biography,photo:v.photo===null?null:{url:v.photo.url,alt:v.photo.alt}};}
 function safePublicClass(v:PublicStudioClass):PublicStudioClass{if(!v||!validId(v.id)||!text(v.name,120)||!v.name.trim()||!text(v.description,4000)||!Array.isArray(v.instructors))invalid();return {id:v.id,name:v.name,description:v.description,discipline:safeDiscipline(v.discipline),...classFacts(v),instructors:v.instructors.map(safePublicInstructor)};}
 async function page<T>(path:string,p:URLSearchParams,safe:(value:T)=>T,signal?:AbortSignal):Promise<CatalogPage<T>>{
  const v=await read<CatalogPage<T>>(path+'?'+p,signal);
  if(!v||!Array.isArray(v.items)||v.items.length>Number(p.get('limit'))||!(v.nextCursor===null||validId(v.nextCursor)))invalid();
  return {items:v.items.map(safe),nextCursor:v.nextCursor};
 }
 function locale(value:CatalogQuery['locale']){if(value!==undefined&&!['es-MX','en'].includes(value))throw error('INVALID_REQUEST');return '?locale='+(value??'es-MX');}
 return {
  listStudioClasses:(q:CatalogQuery={},signal?:AbortSignal)=>page('/management/studio/classes',query(q,false,true),safeClass,signal),
  async createStudioClass(input:StudioClassInput,signal?:AbortSignal){return safeClass(await write<StudioClass>('/management/studio/classes',input,signal));},
  async updateStudioClass(value:string,input:StudioClassUpdate,signal?:AbortSignal){return safeClass(await write<StudioClass>('/management/studio/classes/'+id(value),input,signal));},
  async updateStudioClassColor(value:string,input:{color:string;expectedVersion:number},signal?:AbortSignal){return safeClass(await write<StudioClass>('/management/studio/classes/'+id(value)+'/color',input,signal));},
  listStudioInstructors:(q:CatalogQuery={},signal?:AbortSignal)=>page('/management/studio/instructors',query(q),safeInstructor,signal),
  listStudioInstructorCandidates:(q:CatalogQuery={},signal?:AbortSignal)=>page('/management/studio/instructors/candidates',query(q),(v:{instructorId:string;name:string})=>{if(!v||!validId(v.instructorId)||!text(v.name,120))invalid();return {instructorId:v.instructorId,name:v.name};},signal),
  async createStudioInstructor(input:StudioInstructorInput,signal?:AbortSignal){return safeInstructor(await write<StudioInstructor>('/management/studio/instructors',input,signal));},
  async updateStudioInstructor(value:string,input:StudioInstructorUpdate,signal?:AbortSignal){return safeInstructor(await write<StudioInstructor>('/management/studio/instructors/'+id(value),input,signal));},
  async uploadStudioInstructorPhoto(value:string,input:{data:string;altEs:string;altEn?:string|null;expectedVersion:number},signal?:AbortSignal){return safeInstructor(await write<StudioInstructor>('/management/studio/instructors/'+id(value)+'/photo',input,signal));},
  async removeStudioInstructorPhoto(value:string,input:{expectedVersion:number},signal?:AbortSignal){return safeInstructor(await write<StudioInstructor>('/management/studio/instructors/'+id(value)+'/photo/remove',input,signal));},
  async getOwnStudioInstructor(signal?:AbortSignal){const v=await read<StudioInstructor|null>('/management/studio/instructors/own',signal);return v===null?null:safeInstructor(v);},
  listPublicDisciplines:(q:CatalogQuery={},signal?:AbortSignal)=>page('/studio/catalog/disciplines',query(q,true),safeDiscipline,signal),
  listPublicClasses:(q:CatalogQuery={},signal?:AbortSignal)=>page('/studio/catalog/classes',query(q,true,true),safePublicClass,signal),
  async getPublicDiscipline(value:string,q:{locale?:CatalogQuery['locale']}={},signal?:AbortSignal){return safeDiscipline(await read<PublicDiscipline>('/studio/catalog/disciplines/'+id(value)+locale(q.locale),signal));},
  async getPublicClass(value:string,q:{locale?:CatalogQuery['locale']}={},signal?:AbortSignal){return safePublicClass(await read<PublicStudioClass>('/studio/catalog/classes/'+id(value)+locale(q.locale),signal));}
 };
}
