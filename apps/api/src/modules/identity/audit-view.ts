import type {OperationalAuditEvent,OperationalAuditPage} from '@conecta/contracts';
import type {createAccountService} from './accounts.js';
import {AuthError} from './sessions.js';
import {identityAuditActions,readIdentityAuditSnapshot} from './audit.js';
import {childAuditActions,readChildAuditSnapshot} from './child-details.js';
import {validateSettings} from '../foundation/validation.js';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const actions:readonly string[]=[...identityAuditActions,...childAuditActions,'settings.updated','development.demo_seeded'];
const time=/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$/;
function query(value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['limit','cursor'].includes(key)))throw new AuthError('INVALID_REQUEST');
  const input=value as {limit?:unknown;cursor?:unknown};
  if(input.limit!==undefined&&(typeof input.limit!=='string'||! /^[1-9][0-9]?$/.test(input.limit)||Number(input.limit)>50))throw new AuthError('INVALID_REQUEST');
  let cursor:[string,string]|null=null;
  if(input.cursor!==undefined){
    try{
      if(typeof input.cursor!=='string'||input.cursor.length>200||!/^[A-Za-z0-9_-]+$/.test(input.cursor))throw new Error();
      const raw=Buffer.from(input.cursor,'base64url');if(raw.toString('base64url')!==input.cursor)throw new Error();
      const parsed:unknown=JSON.parse(raw.toString());
      if(!Array.isArray(parsed)||parsed.length!==2||typeof parsed[0]!=='string'||!time.test(parsed[0])||Number(parsed[0].slice(0,4))<1
        ||new Date(parsed[0]).toISOString()!==parsed[0].slice(0,23)+'Z'||typeof parsed[1]!=='string'||!uuid.test(parsed[1]))throw new Error();
      cursor=[parsed[0],parsed[1]];
    }catch{throw new AuthError('INVALID_REQUEST');}
  }
  return {limit:input.limit===undefined?25:Number(input.limit),cursor};
}
interface Row {id:string;occurredAt:string;actor_id:string;actor_type:OperationalAuditEvent['actorType'];action:string;target_type:string;target_id:string;
  business_unit:OperationalAuditEvent['businessUnit'];correction_of:string|null;changes:unknown;actorName:string|null;targetName:string|null}
function event(row:Row):OperationalAuditEvent{
  const action=(actions.includes(row.action)?row.action:'other') as OperationalAuditEvent['action'];
  const targetType=(['account','family','dependent','child_details','business_settings','dataset'].includes(row.target_type)?row.target_type:'other') as OperationalAuditEvent['targetType'];
  const changes=row.changes&&typeof row.changes==='object'?row.changes as {before?:unknown;after?:unknown}:{};
  const snapshot=(value:unknown)=>{
    if(action.startsWith('account.'))return readIdentityAuditSnapshot(value);
    if(action.startsWith('family.'))return readIdentityAuditSnapshot(value,true);
    if(action.startsWith('dependent.')||action.startsWith('child_details.'))return readChildAuditSnapshot(value);
    if(action==='settings.updated')try{return {...validateSettings(value)};}catch{return null;}
    if(action==='development.demo_seeded'&&value&&typeof value==='object'){
      const result:Record<string,number>={};for(const key of ['createdAccounts','sessions','bookings']){
        const count=(value as Record<string,unknown>)[key];if(typeof count==='number'&&Number.isSafeInteger(count)&&count>=0&&count<=1000000)result[key]=count;
      }return result;
    }return null;
  };
  return {id:row.id,occurredAt:row.occurredAt,actorType:row.actor_type,
    targetName:typeof row.targetName==='string'&&row.targetName.length<=120&&!/[\x00-\x1f\x7f]/.test(row.targetName)?row.targetName:null,
    actorName:typeof row.actorName==='string'&&row.actorName.length<=120&&!/[\x00-\x1f\x7f]/.test(row.actorName)?row.actorName:null,
    actorId:uuid.test(row.actor_id)||row.actor_type==='system'&&row.actor_id==='development-demo-script'?row.actor_id:null,
    action,targetType,targetId:uuid.test(row.target_id)||targetType==='business_settings'&&row.target_id==='1'
      ||targetType==='dataset'&&row.target_id==='conecta-development-demo-v1'?row.target_id:null,
    businessUnit:row.business_unit,correctionOf:row.correction_of,changes:{before:snapshot(changes.before),after:snapshot(changes.after)}};
}
export function createAuditViewService(accounts:ReturnType<typeof createAccountService>){
  return {list(value:unknown,token:unknown):Promise<OperationalAuditPage>{
    return accounts.withManagementRead(token,async client=>{
      const input=query(value);
      const rows=(await client.query<Row>(`WITH page AS (SELECT id,to_char(occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "occurredAt",
        occurred_at,actor_id,actor_type,action,target_type,target_id,business_unit,correction_of,changes FROM audit_events
        WHERE ($1::timestamptz IS NULL OR (occurred_at,id)<($1::timestamptz,$2::uuid)) ORDER BY occurred_at DESC,id DESC LIMIT $3)
        SELECT page.*,p.full_name AS "actorName",COALESCE(tp.full_name,f.name) AS "targetName" FROM page LEFT JOIN accounts a
        ON a.id=CASE WHEN page.actor_id ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN page.actor_id::uuid ELSE NULL END
        LEFT JOIN people p ON p.id=a.person_id LEFT JOIN accounts target
        ON target.id=CASE WHEN page.target_type='account' AND page.target_id ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN page.target_id::uuid ELSE NULL END
        LEFT JOIN people tp ON tp.id=target.person_id LEFT JOIN families f
        ON f.id=CASE WHEN page.target_type='family' AND page.target_id ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN page.target_id::uuid ELSE NULL END
        ORDER BY page.occurred_at DESC,page.id DESC`,
        [input.cursor?.[0]??null,input.cursor?.[1]??null,input.limit+1])).rows;
      const page=rows.slice(0,input.limit),last=page.at(-1);
      return {events:page.map(event),nextCursor:rows.length>input.limit&&last?Buffer.from(JSON.stringify([last.occurredAt,last.id])).toString('base64url'):null};
    });
  }};
}
