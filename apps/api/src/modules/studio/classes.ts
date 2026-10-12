import {randomBytes,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {createAccountService} from '../identity/accounts.js';
import {AuthError,type SessionContext} from '../identity/sessions.js';

export interface StudioClass {
  id:string;disciplineId:string;nameEs:string;nameEn:string|null;descriptionEs:string;descriptionEn:string|null;
  audience:'children'|'adults';minAge:number|null;maxAge:number|null;level:'beginner'|'intermediate'|'advanced'|'all';
  color:string;durationMinutes:55;status:'draft'|'published'|'archived';version:number;
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fields=['disciplineId','nameEs','nameEn','descriptionEs','descriptionEn','audience','minAge','maxAge','level','color','status'];
const columns=`id,discipline_id AS "disciplineId",name_es AS "nameEs",name_en AS "nameEn",description_es AS "descriptionEs",
 description_en AS "descriptionEn",audience,min_age AS "minAge",max_age AS "maxAge",level,color,duration_minutes AS "durationMinutes",status,version`;
function object(value:unknown,allowed:string[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw new AuthError('INVALID_REQUEST');
  return value as Record<string,unknown>;
}
function revision(value:unknown){if(!Number.isSafeInteger(value)||(value as number)<1||(value as number)>2147483646)throw new AuthError('INVALID_REQUEST');return value as number;}
function identifier(value:unknown){if(typeof value!=='string'||!uuid.test(value))throw new AuthError('INVALID_REQUEST');return value;}
function text(value:unknown,max:number,nullable=false,empty=false):string|null{
  if(nullable&&(value===undefined||value===null))return null;
  if(typeof value!=='string'||value.length>max||!empty&&!value.trim()||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))throw new AuthError('INVALID_REQUEST');
  return value.trim();
}
function color(value:unknown){if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw new AuthError('INVALID_REQUEST');return value.toLowerCase();}
function input(data:Record<string,unknown>,update:boolean):Omit<StudioClass,'id'|'version'|'durationMinutes'>{
  const audience=data.audience,level=data.level,status=data.status??'draft';
  if(!['children','adults'].includes(audience as string)||!['beginner','intermediate','advanced','all'].includes(level as string)
    ||!['draft','published',...(update?['archived']:[])].includes(status as string))throw new AuthError('INVALID_REQUEST');
  function age(v:unknown){if(v===null||v===undefined)return null;if(!Number.isSafeInteger(v)||(v as number)<0||(v as number)>2147483647)throw new AuthError('INVALID_REQUEST');return v as number;}
  const minAge=age(data.minAge),maxAge=age(data.maxAge);
  if(audience==='adults'&&(minAge!==null||maxAge!==null)||minAge!==null&&maxAge!==null&&minAge>maxAge)throw new AuthError('INVALID_REQUEST');
  const descriptionEs=text(data.descriptionEs??'',4000,false,true)!;
  if(status==='published'&&!descriptionEs)throw new AuthError('INVALID_REQUEST');
  return {disciplineId:identifier(data.disciplineId),nameEs:text(data.nameEs,120)!,nameEn:text(data.nameEn,120,true),descriptionEs,
    descriptionEn:text(data.descriptionEn,4000,true,true),audience:audience as StudioClass['audience'],minAge,maxAge,
    level:level as StudioClass['level'],color:data.color===undefined?'#'+randomBytes(3).toString('hex'):color(data.color),status:status as StudioClass['status']};
}
function current(context:SessionContext){if(Date.parse(context.expiresAt)<=Date.now())throw new AuthError('UNAUTHENTICATED');}
async function lock(client:PoolClient){await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['studio-catalog:publication']);}
async function audit(client:PoolClient,actor:string,before:StudioClass|null,after:StudioClass,action:string,reason:string){
  await client.query(`INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,business_unit,changes,reason,correlation_id)
    VALUES ($1,'staff',$2,'class',$3,'studio',$4,$5,$6)`,[actor,action,after.id,JSON.stringify({before,after}),reason,randomUUID()]);
}
async function parent(client:PoolClient,data:Omit<StudioClass,'id'|'version'|'durationMinutes'>){
  const row=(await client.query<{status:string}>('SELECT status FROM studio_disciplines WHERE id=$1 FOR SHARE',[data.disciplineId])).rows[0];
  if(!row)throw new AuthError('NOT_FOUND');
  if(data.status==='published'&&row.status!=='published'||row.status==='archived'&&data.status!=='archived')throw new AuthError('CONFLICT');
}

export function createClassService(administration:Pick<ReturnType<typeof createAccountService>,'withManagementRead'|'withStaffRead'>){
  return {
    async list(value:unknown,token:unknown):Promise<{items:StudioClass[];nextCursor:string|null}>{
      return administration.withStaffRead(token,async(client,context)=>{
        const q=object(value,['cursor','limit','disciplineId']);
        if(q.cursor!==undefined)identifier(q.cursor);if(q.disciplineId!==undefined)identifier(q.disciplineId);
        const limit=q.limit===undefined?50:typeof q.limit==='string'&&/^[1-9][0-9]?$/.test(q.limit)?Number(q.limit):NaN;
        if(!Number.isInteger(limit)||limit>50)throw new AuthError('INVALID_REQUEST');current(context);
        const rows=(await client.query<StudioClass>(`SELECT ${columns} FROM studio_classes WHERE ($1::uuid IS NULL OR id>$1)
          AND ($2::uuid IS NULL OR discipline_id=$2) ORDER BY id LIMIT $3`,[q.cursor??null,q.disciplineId??null,limit+1])).rows;
        return {items:rows.slice(0,limit),nextCursor:rows.length>limit?rows[limit-1]!.id:null};
      });
    },
    async create(value:unknown,token:unknown):Promise<StudioClass>{
      return administration.withManagementRead(token,async(client,context)=>{
        const data=input(object(value,fields),false);await lock(client);current(context);await parent(client,data);current(context);
        const row=(await client.query<StudioClass>(`INSERT INTO studio_classes(discipline_id,name_es,name_en,description_es,description_en,
          audience,min_age,max_age,level,color,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ${columns}`,
        [data.disciplineId,data.nameEs,data.nameEn,data.descriptionEs,data.descriptionEn,data.audience,data.minAge,data.maxAge,data.level,data.color,data.status])).rows[0]!;
        await audit(client,context.account.id,null,row,'studio.class_created','Management created a reusable class');return row;
      });
    },
    async update(id:unknown,value:unknown,token:unknown):Promise<StudioClass>{
      return administration.withManagementRead(token,async(client,context)=>{
        identifier(id);const patch=object(value,[...fields,'expectedVersion','reason']);const expectedVersion=revision(patch.expectedVersion);
        const reason=patch.reason===undefined?'Management updated a reusable class':text(patch.reason,500)!;
        await lock(client);const before=(await client.query<StudioClass>(`SELECT ${columns} FROM studio_classes WHERE id=$1 FOR UPDATE`,[id])).rows[0];
        if(!before)throw new AuthError('NOT_FOUND');current(context);if(before.version!==expectedVersion)throw new AuthError('CONFLICT');
        const data=input({...before,...patch},true);await parent(client,data);
        if(data.status==='archived'||before.status==='published'&&data.status!=='published'||data.disciplineId!==before.disciplineId){
          if((await client.query(`SELECT id FROM class_sessions WHERE class_id=$1 AND starts_at>=now() AND status<>'cancelled' LIMIT 1`,[id])).rowCount)throw new AuthError('CONFLICT');
        }
        // C16 owns atomic booking grandfathering, notifications and penalty-free cancellation.
        // Until its adapter is available, changes affecting existing reservations fail closed.
        if(['audience','minAge','maxAge','level'].some(k=>data[k as keyof typeof data]!==before[k as keyof StudioClass])){
          if((await client.query(`SELECT b.id FROM bookings b JOIN class_sessions s ON s.id=b.class_session_id WHERE s.class_id=$1 LIMIT 1`,[id])).rowCount)throw new AuthError('CONFLICT');
        }
        current(context);
        const row=(await client.query<StudioClass>(`UPDATE studio_classes SET discipline_id=$2,name_es=$3,name_en=$4,description_es=$5,
          description_en=$6,audience=$7,min_age=$8,max_age=$9,level=$10,color=$11,status=$12,version=version+1,updated_at=clock_timestamp()
          WHERE id=$1 RETURNING ${columns}`,[id,data.disciplineId,data.nameEs,data.nameEn,data.descriptionEs,data.descriptionEn,data.audience,data.minAge,data.maxAge,data.level,data.color,data.status])).rows[0]!;
        await audit(client,context.account.id,before,row,'studio.class_updated',reason);return row;
      });
    },
    async updateColor(id:unknown,value:unknown,token:unknown):Promise<StudioClass>{
      return administration.withStaffRead(token,async(client,context)=>{
        identifier(id);const patch=object(value,['color','expectedVersion']);const nextColor=color(patch.color),expectedVersion=revision(patch.expectedVersion);
        await lock(client);const before=(await client.query<StudioClass>(`SELECT ${columns} FROM studio_classes WHERE id=$1 FOR UPDATE`,[id])).rows[0];
        if(!before)throw new AuthError('NOT_FOUND');current(context);if(before.version!==expectedVersion)throw new AuthError('CONFLICT');
        const row=(await client.query<StudioClass>(`UPDATE studio_classes SET color=$2,version=version+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING ${columns}`,[id,nextColor])).rows[0]!;
        await audit(client,context.account.id,before,row,'studio.class_color_updated','Staff updated a reusable class color');return row;
      });
    }
  };
}
