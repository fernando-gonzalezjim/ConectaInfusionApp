import type {ApiErrorCode,StudioDiscipline,StudioDisciplineInput,StudioDisciplineUpdate,StudioDisciplineList} from '@conecta/contracts';
type Read=<T>(path:string,signal?:AbortSignal)=>Promise<T>;
type Write=<T>(path:string,input:unknown,signal?:AbortSignal)=>Promise<T>;
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export function createStudioClient(read:Read,write:Write,error:(code:ApiErrorCode)=>Error){
  function id(v:string){if(!uuid(v))throw error('INVALID_REQUEST');return v;}
  function safe(v:StudioDiscipline):StudioDiscipline{
    if(!v||!uuid(v.id)||typeof v.nameEs!=='string'||!v.nameEs.trim()||v.nameEs.length>120
      ||!(v.nameEn===null||typeof v.nameEn==='string'&&v.nameEn.length<=120)
      ||typeof v.descriptionEs!=='string'||v.descriptionEs.length>4000
      ||!(v.descriptionEn===null||typeof v.descriptionEn==='string'&&v.descriptionEn.length<=4000)
      ||!['draft','published','archived'].includes(v.status)||!Number.isInteger(v.version)||v.version<1||v.version>2147483647)throw error('INTERNAL_ERROR');
    return {id:v.id,nameEs:v.nameEs,nameEn:v.nameEn,descriptionEs:v.descriptionEs,descriptionEn:v.descriptionEn,status:v.status,version:v.version};
  }
  return {
    async listStudioDisciplines(query:{limit?:number;cursor?:string}={},signal?:AbortSignal):Promise<StudioDisciplineList>{
      const limit=query.limit??50;if(!Number.isInteger(limit)||limit<1||limit>50)throw error('INVALID_REQUEST');
      const params=new URLSearchParams({limit:String(limit)});if(query.cursor!==undefined)params.set('cursor',id(query.cursor));
      const v=await read<StudioDisciplineList>('/management/studio/disciplines?'+params,signal);
      if(!v||!Array.isArray(v.items)||v.items.length>limit||!(v.nextCursor===null||uuid(v.nextCursor)))throw error('INTERNAL_ERROR');
      return {items:v.items.map(safe),nextCursor:v.nextCursor};
    },
    async createStudioDiscipline(input:StudioDisciplineInput,signal?:AbortSignal):Promise<StudioDiscipline>{
      return safe(await write<StudioDiscipline>('/management/studio/disciplines',input,signal));
    },
    async updateStudioDiscipline(value:string,input:StudioDisciplineUpdate,signal?:AbortSignal):Promise<StudioDiscipline>{
      return safe(await write<StudioDiscipline>('/management/studio/disciplines/'+id(value),input,signal));
    }
  };
}
