import {appendIdentityAudit} from './audit.js';
import type {PoolClient} from 'pg';
import type {FamilyLifecycleRequest,FamilyLifecycleExecutionRequest,FamilyLifecyclePreview,FamilyCreditPolicy} from '@conecta/contracts';
import {AuthError} from './sessions.js';
import {previewFamilyChangeInTransaction,checkFamilySessionInTransaction} from './families.js';
import type {FamilyContext,FamilyChange,FamilyState} from './families.js';

export interface FamilyFinancialObligations {
  ownership:true;reservations:true;valueAndExpiry:true;noRefundOrRestoration:true;transactionalAudit:true;
}
export interface FamilyFinancialPlan extends FamilyChange {
  policy:FamilyCreditPolicy;donationConsentReference?:string;
}
export interface FamilyFinancialExecutionPlan extends FamilyLifecyclePreview {
  donationConsentReference?:string;donationAcceptedByPersonId?:string;
}
// Trusted credits-bookings adapter. No remote effects or independent commits.
// It locks financial rows, derives revision from current obligations (including
// reservations), verifies any removed purchaser's consent, and audits disposition.
export interface FamilyLifecycleCoordinator {
  inspect(client:PoolClient,plan:Readonly<FamilyFinancialPlan>):Promise<
    {status:'unknown'}|{status:'known';revision:string;obligations:FamilyFinancialObligations;donationAcceptedByPersonId?:string}>;
  apply(client:PoolClient,plan:Readonly<FamilyFinancialExecutionPlan>):Promise<{status:'applied';revision:string}>;
}

async function prepare(client:PoolClient,input:FamilyLifecycleRequest,context:FamilyContext,coordinator?:FamilyLifecycleCoordinator):Promise<FamilyFinancialExecutionPlan>{
  const {change}=await previewFamilyChangeInTransaction(client,input,context);
  if(input.operation==='leave'&&!['keep','donate'].includes(input.creditChoice))throw new AuthError('INVALID_REQUEST');
  if(input.operation==='remove'&&input.creditChoice!==undefined&&!['keep','donate'].includes(input.creditChoice))throw new AuthError('INVALID_REQUEST');
  const donation=input.operation!=='close'&&input.creditChoice==='donate';
  if(donation&&context.actor.type==='system')throw new AuthError('FORBIDDEN');
  if(input.operation==='remove'&&donation&&(typeof input.donationConsentReference!=='string'||!input.donationConsentReference||input.donationConsentReference.length>256))throw new AuthError('FORBIDDEN');
  if(!coordinator)throw new AuthError('CONFLICT');
  const policy:FamilyCreditPolicy=change.closesFamily?'return-all-to-original-purchasers':donation?'leave-own-eligible':'return-own-eligible';
  const plan:FamilyFinancialPlan={...change,policy,...(input.operation==='remove'&&donation?{donationConsentReference:input.donationConsentReference}:{})};
  const inspected=await coordinator.inspect(client,Object.freeze(plan));
  if(!inspected||inspected.status!=='known'||typeof inspected.revision!=='string'||!inspected.revision||inspected.revision.length>256
    ||!inspected.obligations||!['ownership','reservations','valueAndExpiry','noRefundOrRestoration','transactionalAudit'].every(key=>inspected.obligations[key as keyof FamilyFinancialObligations]===true))throw new AuthError('CONFLICT');
  if(input.operation==='remove'&&donation&&inspected.donationAcceptedByPersonId!==change.personId)throw new AuthError('FORBIDDEN');
  return {...plan,revision:inspected.revision,...(input.operation==='remove'&&donation?{donationAcceptedByPersonId:inspected.donationAcceptedByPersonId}:{})};
}

// Both calls require an existing caller-owned transaction. Preview is advisory;
// execute repeats permission/version checks and recomputes locked credit obligations.
export async function previewFamilyLifecycleInTransaction(client:PoolClient,input:FamilyLifecycleRequest,context:FamilyContext,coordinator?:FamilyLifecycleCoordinator):Promise<FamilyLifecyclePreview>{
  const {donationConsentReference:_reference,donationAcceptedByPersonId:_person,...preview}=await prepare(client,input,context,coordinator);
  return preview;
}
export async function executeFamilyLifecycleInTransaction(client:PoolClient,input:FamilyLifecycleExecutionRequest,context:FamilyContext,coordinator?:FamilyLifecycleCoordinator):Promise<FamilyState>{
  const preview=Object.freeze(await prepare(client,input,context,coordinator));
  if(typeof input.expectedFinancialRevision!=='string'||!input.expectedFinancialRevision||input.expectedFinancialRevision.length>256)throw new AuthError('INVALID_REQUEST');
  if(input.expectedFinancialRevision!==preview.revision)throw new AuthError('CONFLICT');
  const coordinate=async(sameClient:PoolClient,change:FamilyChange)=>{
    if(change.familyId!==preview.familyId||change.version!==preview.version||change.operation!==preview.operation
      ||change.membershipId!==preview.membershipId||change.personId!==preview.personId||change.closesFamily!==preview.closesFamily)throw new AuthError('CONFLICT');
    const receipt=await coordinator!.apply(sameClient,preview);
    if(!receipt||receipt.status!=='applied'||receipt.revision!==preview.revision)throw new AuthError('CONFLICT');
  };
  return input.operation==='close'?closeFamilyInTransaction(client,input,context,coordinate):endFamilyMembershipInTransaction(client,input,context,coordinate);
}

type FamilyCoordinator=(client:PoolClient,change:FamilyChange)=>Promise<void>;
async function appendFamilyAudit(client:PoolClient,context:FamilyContext,familyId:string,action:Parameters<typeof appendIdentityAudit>[1]["action"],before:Record<string,unknown>|null,after:Record<string,unknown>){await appendIdentityAudit(client,{...context,action,targetType:"family",targetId:familyId,before,after});}
async function endFamilyMembershipInTransaction(client:PoolClient,input:{familyId:string;membershipId:string;expectedVersion:number;operation:'leave'|'remove'},context:FamilyContext,coordinate?:FamilyCoordinator):Promise<FamilyState>{
  const {family,change,memberCount}=await previewFamilyChangeInTransaction(client,input,context);
  if(!coordinate)throw new AuthError('CONFLICT');const closesFamily=change.closesFamily;
  await coordinate(client,change);
  await checkFamilySessionInTransaction(client,context);
  const endedAt=new Date(),responsibleMembershipId=closesFamily||family.responsibleMembershipId===change.membershipId?null:family.responsibleMembershipId;
  await client.query('UPDATE family_memberships SET ended_at=$2,end_reason=$3 WHERE id=$1',[change.membershipId,endedAt,input.operation==='leave'?'left':'removed']);
  await client.query('UPDATE families SET responsible_membership_id=$2,status=$3,closed_at=$4,version=version+1 WHERE id=$1',[family.id,responsibleMembershipId,closesFamily?'closed':'active',closesFamily?endedAt:null]);
  await appendFamilyAudit(client,context,family.id,input.operation==='leave'?'family.member_left':'family.member_removed',
    {version:family.version,responsibleMembershipId:family.responsibleMembershipId,memberCount},
    {version:family.version+1,responsibleMembershipId,status:closesFamily?'closed':'active',memberCount:memberCount-1,membershipId:change.membershipId,personId:change.personId});
  if(closesFamily)await appendFamilyAudit(client,context,family.id,'family.closed',{status:'active'},{status:'closed',version:family.version+1,memberCount:0});
  return {...family,version:family.version+1,responsibleMembershipId,status:closesFamily?'closed':'active'};
}
async function closeFamilyInTransaction(client:PoolClient,input:{familyId:string;expectedVersion:number},context:FamilyContext,coordinate?:FamilyCoordinator):Promise<FamilyState>{
  const {family,change,memberCount}=await previewFamilyChangeInTransaction(client,{...input,operation:'close'},context);
  if(!coordinate)throw new AuthError('CONFLICT');
  await coordinate(client,change);await checkFamilySessionInTransaction(client,context);const endedAt=new Date();
  await client.query("UPDATE family_memberships SET ended_at=$2,end_reason='closed' WHERE family_id=$1 AND ended_at IS NULL",[family.id,endedAt]);
  await client.query("UPDATE families SET status='closed',closed_at=$2,responsible_membership_id=NULL,version=version+1 WHERE id=$1",[family.id,endedAt]);
  await appendFamilyAudit(client,context,family.id,'family.closed',{status:'active',version:family.version,responsibleMembershipId:family.responsibleMembershipId,memberCount},
    {status:'closed',version:family.version+1,responsibleMembershipId:null,memberCount:0});
  return {...family,status:'closed',version:family.version+1,responsibleMembershipId:null};
}
