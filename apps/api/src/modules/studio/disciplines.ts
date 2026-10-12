import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {StudioDiscipline,StudioDisciplineUpdate,StudioDisciplineList} from '@conecta/contracts';
import type {createAccountService} from '../identity/accounts.js';
import {AuthError} from '../identity/sessions.js';
import type {SessionContext} from '../identity/sessions.js';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fields=['nameEs','nameEn','descriptionEs','descriptionEn','status'];
const columns='id,name_es AS "nameEs",name_en AS "nameEn",description_es AS "descriptionEs",description_en AS "descriptionEn",status,version';
function currentSession(context:SessionContext){
  if(Date.parse(context.expiresAt)<=Date.now())throw new AuthError('UNAUTHENTICATED');
}
function input(value:unknown,update:boolean):Omit<StudioDiscipline,'id'|'version'> & {expectedVersion?:number;reason?:string} {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new AuthError('INVALID_REQUEST');
  const data=value as Record<string,unknown>;
  if(Object.keys(data).some(key=>![...fields,...(update?['expectedVersion','reason']:[])].includes(key)))throw new AuthError('INVALID_REQUEST');
  function text(key:string,max:number,optional:boolean,empty:boolean):string|null {
    const v=data[key];
    if(optional&&(v===null||v===undefined))return null;
    if(typeof v!=='string'||v.length>max||(!empty&&!v.trim())||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v))throw new AuthError('INVALID_REQUEST');
    return v.trim();
  }
  const result={nameEs:text('nameEs',120,false,false)!,nameEn:text('nameEn',120,true,false),
    descriptionEs:data.descriptionEs===undefined?'':text('descriptionEs',4000,false,true)!,
    descriptionEn:text('descriptionEn',4000,true,true),status:data.status===undefined?'draft':data.status};
  if(!['draft','published',...(update?['archived']:[])].includes(result.status as string)
    ||result.status==='published'&&!result.descriptionEs)throw new AuthError('INVALID_REQUEST');
  if(update&&(!Number.isSafeInteger(data.expectedVersion)||(data.expectedVersion as number)<1||(data.expectedVersion as number)>2147483646))throw new AuthError('INVALID_REQUEST');
  const reason=update&&data.reason!==undefined?text('reason',500,false,false)!:undefined;
  return {...result,status:result.status as StudioDiscipline['status'],...(update?{expectedVersion:data.expectedVersion as number,reason}:{})};
}
async function audit(client:PoolClient,actorId:string,action:string,before:StudioDiscipline|null,after:StudioDiscipline,reason:string){
  await client.query(`INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,business_unit,changes,reason,correlation_id)
    VALUES ($1,'staff',$2,'discipline',$3,'studio',$4,$5,$6)`,
  [actorId,action,after.id,JSON.stringify({before,after}),reason,randomUUID()]);
}

export function createDisciplineService(administration:Pick<ReturnType<typeof createAccountService>,'withManagementRead'>){
  return {
    async list(value:unknown,token:unknown):Promise<StudioDisciplineList>{
      return administration.withManagementRead(token,async client=>{
        if(!value||typeof value!=='object'||Array.isArray(value))throw new AuthError('INVALID_REQUEST');
        const q=value as Record<string,unknown>;
        if(Object.keys(q).some(k=>!['cursor','limit'].includes(k))||q.cursor!==undefined&&(typeof q.cursor!=='string'||!uuid.test(q.cursor)))throw new AuthError('INVALID_REQUEST');
        const limit=q.limit===undefined?50:typeof q.limit==='string'&&/^[1-9][0-9]?$/.test(q.limit)?Number(q.limit):NaN;
        if(!Number.isInteger(limit)||limit<1||limit>50)throw new AuthError('INVALID_REQUEST');
        const rows=(await client.query<StudioDiscipline>(`SELECT ${columns} FROM studio_disciplines
          WHERE ($1::uuid IS NULL OR id>$1) ORDER BY id LIMIT $2`,[q.cursor??null,limit+1])).rows;
        return {items:rows.slice(0,limit),nextCursor:rows.length>limit?rows[limit-1]!.id:null};
      });
    },
    async create(value:unknown,token:unknown):Promise<StudioDiscipline>{
      return administration.withManagementRead(token,async(client,context)=>{
        const data=input(value,false);
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['studio-catalog:publication']);
        currentSession(context);
        const row=(await client.query<StudioDiscipline>(`INSERT INTO studio_disciplines(name_es,name_en,description_es,description_en,status)
          VALUES ($1,$2,$3,$4,$5) RETURNING ${columns}`,[data.nameEs,data.nameEn,data.descriptionEs,data.descriptionEn,data.status])).rows[0]!;
        await audit(client,context.account.id,'studio.discipline_created',null,row,'Management created a studio discipline');
        return row;
      });
    },
    async update(id:unknown,value:unknown,token:unknown):Promise<StudioDiscipline>{
      return administration.withManagementRead(token,async(client,context)=>{
        if(typeof id!=='string'||!uuid.test(id))throw new AuthError('INVALID_REQUEST');
        if(!value||typeof value!=='object'||Array.isArray(value)
          ||Object.keys(value).some(k=>![...fields,'expectedVersion','reason'].includes(k)))throw new AuthError('INVALID_REQUEST');
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['studio-catalog:publication']);
        const before=(await client.query<StudioDiscipline>(`SELECT ${columns} FROM studio_disciplines WHERE id=$1 FOR UPDATE`,[id])).rows[0];
        if(!before)throw new AuthError('NOT_FOUND');
        currentSession(context);
        const data=input({nameEs:before.nameEs,nameEn:before.nameEn,descriptionEs:before.descriptionEs,
          descriptionEn:before.descriptionEn,status:before.status,...value},true) as StudioDisciplineUpdate;
        if(before.version!==data.expectedVersion)throw new AuthError('CONFLICT');
        // Publication status changes cannot silently hide upcoming teaching sessions.
        if(data.status!=='published'&&before.status==='published'||data.status==='archived'){
          const future=await client.query(`SELECT s.id FROM class_sessions s JOIN studio_classes c ON c.id=s.class_id
            WHERE c.discipline_id=$1 AND s.starts_at>=now() AND s.status<>'cancelled' LIMIT 1`,[id]);
          if(future.rowCount)throw new AuthError('CONFLICT');
        }
        const row=(await client.query<StudioDiscipline>(`UPDATE studio_disciplines SET name_es=$2,name_en=$3,description_es=$4,
          description_en=$5,status=$6,version=version+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING ${columns}`,
        [id,data.nameEs,data.nameEn,data.descriptionEs,data.descriptionEn,data.status])).rows[0]!;
        await audit(client,context.account.id,'studio.discipline_updated',before,row,data.reason??'Management updated a studio discipline');
        return row;
      });
    }
  };
}
