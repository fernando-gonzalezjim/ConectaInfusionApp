import {createHash,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {AuthError} from './sessions.js';

export const lifecycleDomains=['credits-bookings','studio-catalog','instructor-payroll'] as const;
export type LifecycleDomain=typeof lifecycleDomains[number];
export type LifecycleOperation='account-deactivation'|'dependent-deactivation'|'family-leave'|'family-remove'|'family-close'|'staff-eligibility-change';
export interface LifecycleRequest {
  actorAccountId:string;operation:LifecycleOperation;personIds:readonly string[];
  // Trusted caller's immutable intent/version binding, including explicit choices.
  // Retain the original binding on retries; fresh DB state is inspected separately.
  identityRevision:string;
  deactivation?:Readonly<{accountId:string;creditChoice:'keep'|'leave-family'}>;
}
export interface LifecycleExecutionRequest extends LifecycleRequest {idempotencyKey:string;expectedRevision:string}
export type LifecycleBlock='INTEGRATION_REQUIRED'|'UNKNOWN_SCHEMA'|'LEGACY_OBLIGATIONS';
export type LifecycleTransaction=Pick<PoolClient,'query'>;
export type LifecyclePreview={status:'blocked';reasons:LifecycleBlock[]}|{status:'ready';revision:string};
export interface LifecycleCoordinator {
  domain:LifecycleDomain;tables:readonly string[];handlesLegacy:boolean;
  inspect(client:LifecycleTransaction,request:Readonly<LifecycleRequest>):Promise<{status:'unknown'}|{status:'ready';revision:string;assurances:{atomic:true;audit:true;preservesHistory:true}}>;
  // No independent commit, remote payout or external side effect is permitted.
  apply(client:LifecycleTransaction,request:Readonly<LifecycleRequest>,revision:string):Promise<{status:'applied';revision:string}>;
}
export interface LifecycleReceipt {operationId:string;code:'APPLIED'}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest();
function adapterTransaction(client:PoolClient):LifecycleTransaction{
  const query=new Proxy(client.query.bind(client),{apply(target,_receiver,args){
    const input=args[0],text=typeof input==='string'?input:input&&typeof input==='object'&&'text'in input?input.text:undefined;
    // Single parameterized DML/read/lock statements only. No transaction/session
    // commands, callbacks, client release or secondary connection are exposed.
    if(typeof text!=='string'||text.includes(';')||text.includes('--')||text.includes('/*')||text.includes('*/')
      ||!/^\s*(SELECT|INSERT|UPDATE|DELETE|WITH|LOCK)\b/i.test(text)||args.some(arg=>typeof arg==='function'))throw new Error('LIFECYCLE_TRANSACTION_CONTROL_FORBIDDEN');
    return Reflect.apply(target,undefined,args);
  }});
  return Object.freeze({query});
}
export function lifecycleRequest(value:LifecycleRequest):Readonly<LifecycleRequest>{
  if(!value||!uuid.test(value.actorAccountId)||!['account-deactivation','dependent-deactivation','family-leave','family-remove','family-close','staff-eligibility-change'].includes(value.operation)
    ||!Array.isArray(value.personIds)||!value.personIds.length||value.personIds.length>100||value.personIds.some(id=>typeof id!=='string'||!uuid.test(id))
    ||typeof value.identityRevision!=='string'||!value.identityRevision.trim()||value.identityRevision.length>256)throw new AuthError('INVALID_REQUEST');
  if(value.deactivation&&(!uuid.test(value.deactivation.accountId)||!['keep','leave-family'].includes(value.deactivation.creditChoice)||value.operation!=='account-deactivation'))throw new AuthError('INVALID_REQUEST');
  return Object.freeze({actorAccountId:value.actorAccountId.toLowerCase(),operation:value.operation,personIds:Object.freeze([...new Set(value.personIds.map(id=>id.toLowerCase()))].sort()),identityRevision:value.identityRevision,
    ...(value.deactivation?{deactivation:Object.freeze({accountId:value.deactivation.accountId.toLowerCase(),creditChoice:value.deactivation.creditChoice})}:{})});
}
export function requiredLifecycleDomains(request:LifecycleRequest):readonly LifecycleDomain[]{return request.operation.startsWith('family-')?['credits-bookings']:lifecycleDomains;}

// Internal only: callers authorize under canonical account/person/relationship
// locks before each call, including a retry. These functions never grant access.
export function createLifecycleGuard(coordinators:readonly LifecycleCoordinator[],inspectLegacy:(client:PoolClient,request:Readonly<LifecycleRequest>)=>Promise<LifecycleBlock[]>){
  const registry=new Map(coordinators.map(c=>[c.domain,c]));
  if(registry.size!==coordinators.length||coordinators.some(c=>!lifecycleDomains.includes(c.domain)||typeof c.inspect!=='function'||typeof c.apply!=='function'))throw new Error('INVALID_LIFECYCLE_COORDINATOR');
  async function prepare(client:PoolClient,request:Readonly<LifecycleRequest>){
    const reasons=new Set(await inspectLegacy(client,request));const revisions:Record<string,string>={};
    if(reasons.has('UNKNOWN_SCHEMA'))return {reasons:[...reasons],revision:hash(request).toString('hex'),revisions};
    // Current Identity facts, in one statement. Callers already hold canonical
    // account/person/relationship locks; these reads never grant permission.
    const identity=(await client.query(`SELECT jsonb_build_object(
      'accounts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM
        (SELECT id,person_id,status,confirmation_status,session_version FROM accounts WHERE person_id=ANY($1::uuid[]) OR id=$2) a),
      'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.account_id,r.role) FROM account_roles r JOIN accounts a ON a.id=r.account_id WHERE a.person_id=ANY($1::uuid[]) OR a.id=$2),
      'people',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM
        (SELECT id,status,updated_at FROM people WHERE id=ANY($1::uuid[])) p),
      'dependents',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.person_id) FROM
        (SELECT person_id,version,deactivation_sequence,independent_at FROM dependent_profiles WHERE person_id=ANY($1::uuid[])
          OR person_id IN(SELECT dependent_person_id FROM dependent_guardians WHERE guardian_account_id IN(SELECT id FROM accounts WHERE person_id=ANY($1::uuid[])))) d),
      'guardians',(SELECT jsonb_agg(to_jsonb(g) ORDER BY g.id) FROM dependent_guardians g WHERE g.dependent_person_id=ANY($1::uuid[])
        OR g.guardian_account_id IN(SELECT id FROM accounts WHERE person_id=ANY($1::uuid[]))),
      'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM family_memberships m WHERE m.family_id IN(SELECT family_id FROM family_memberships WHERE person_id=ANY($1::uuid[]))),
      'families',(SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM
        (SELECT id,version,status,responsible_membership_id FROM families WHERE id IN(SELECT family_id FROM family_memberships WHERE person_id=ANY($1::uuid[]))) f)
    ) AS state`,[request.personIds,request.actorAccountId])).rows[0]?.state;
    for(const domain of requiredLifecycleDomains(request)){
      const coordinator=registry.get(domain);if(!coordinator){reasons.add('INTEGRATION_REQUIRED');continue;}
      const state=await coordinator.inspect(adapterTransaction(client),request);
      if(!state||state.status!=='ready'||typeof state.revision!=='string'||!state.revision.trim()||state.revision.length>256
        ||!state.assurances||state.assurances.atomic!==true||state.assurances.audit!==true||state.assurances.preservesHistory!==true){reasons.add('INTEGRATION_REQUIRED');continue;}
      revisions[domain]=state.revision;
    }
    const revision=hash({request,identity,revisions}).toString('hex');return {reasons:[...reasons].sort(),revision,revisions};
  }
  async function scoped<T>(client:PoolClient,work:()=>Promise<T>,readOnly=false){
    // SAVEPOINT fails outside an explicit transaction and rolls back partial
    // adapters/callbacks even if the caller catches an error and commits later.
    await client.query('SAVEPOINT identity_lifecycle_guard');
    try{const result=await work();if(readOnly)await client.query('ROLLBACK TO SAVEPOINT identity_lifecycle_guard');await client.query('RELEASE SAVEPOINT identity_lifecycle_guard');return result;}
    catch(error){await client.query('ROLLBACK TO SAVEPOINT identity_lifecycle_guard');await client.query('RELEASE SAVEPOINT identity_lifecycle_guard');throw error;}
  }
  return {
    async preview(client:PoolClient,input:LifecycleRequest):Promise<LifecyclePreview>{const request=lifecycleRequest(input);return scoped(client,async()=>{const state=await prepare(client,request);return state.reasons.length?{status:'blocked',reasons:state.reasons}:{status:'ready',revision:state.revision};},true);},
    async execute(client:PoolClient,input:LifecycleExecutionRequest,applyIdentity:(client:LifecycleTransaction)=>Promise<void>):Promise<LifecycleReceipt>{
      const request=lifecycleRequest(input);
      if(!uuid.test(input.idempotencyKey)||typeof input.expectedRevision!=='string'||!/^[a-f0-9]{64}$/.test(input.expectedRevision)||typeof applyIdentity!=='function')throw new AuthError('INVALID_REQUEST');
      return scoped(client,async()=>{
        // Actor-scoped retries serialize before taking domain locks. Identity
        // authorization must still be freshly checked by the caller on replay.
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[request.actorAccountId+':'+input.idempotencyKey.toLowerCase()]);
        const requestHash=hash({request,expectedRevision:input.expectedRevision});
        const old=(await client.query<{id:string;request_hash:Buffer}>('SELECT id,request_hash FROM identity_lifecycle_operations WHERE actor_account_id=$1 AND idempotency_key=$2',[request.actorAccountId,input.idempotencyKey])).rows[0];
        if(old){if(!old.request_hash.equals(requestHash))throw new AuthError('CONFLICT');return {operationId:old.id,code:'APPLIED'};}
        const state=await prepare(client,request);if(state.reasons.length||state.revision!==input.expectedRevision)throw new AuthError('CONFLICT');
        const sameTransaction=adapterTransaction(client);
        for(const domain of requiredLifecycleDomains(request)){const receipt=await registry.get(domain)!.apply(sameTransaction,request,state.revisions[domain]!);if(!receipt||receipt.status!=='applied'||receipt.revision!==state.revisions[domain])throw new AuthError('CONFLICT');}
        await applyIdentity(sameTransaction);const operationId=randomUUID();
        await client.query('INSERT INTO identity_lifecycle_operations(id,actor_account_id,idempotency_key,request_hash,preview_revision) VALUES ($1,$2,$3,$4,$5)',[operationId,request.actorAccountId,input.idempotencyKey,requestHash,state.revision]);
        await client.query(`INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,changes,reason,correlation_id) VALUES ($1::text,CASE WHEN EXISTS(SELECT 1 FROM account_roles WHERE account_id=$1::uuid AND role<>'customer') THEN 'staff' ELSE 'customer' END,'identity.lifecycle_applied','lifecycle_operation',$2::text,$3,'Internal transactional lifecycle coordination completed',$2::uuid)`,[request.actorAccountId,operationId,JSON.stringify({before:null,after:{personId:request.personIds[0]}})]);
        return {operationId,code:'APPLIED'};
      });
    }
  };
}
