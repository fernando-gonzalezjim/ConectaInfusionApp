import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {AuthError} from './sessions.js';
import {appendIdentityAudit} from './audit.js';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export interface FamilyContext {
  actor:{id:string;type:'staff'|'customer'|'system'};session?:{id:string;version:number};reason:string;correlationId:string;
}
export interface AcceptedFamilyInvitation {invitationId:string;acceptedByPersonId:string;acceptedAt:Date}
export interface FamilyState {id:string;name:string;createdByPersonId:string;responsibleMembershipId:string|null;status:'active'|'closed';version:number}
export interface FamilyChange {familyId:string;version:number;operation:'leave'|'remove'|'close';membershipId?:string;personId?:string;closesFamily:boolean}
export type FamilyCoordinator=(client:PoolClient,change:FamilyChange)=>Promise<void>;
function id(value:unknown):asserts value is string{if(typeof value!=='string'||!uuid.test(value))throw new AuthError('INVALID_REQUEST');}
function version(value:unknown){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>2147483646)throw new AuthError('INVALID_REQUEST');}
async function actor(client:PoolClient,context:FamilyContext){
  if(context.actor.type==='system')return {personId:null,management:true}; // Trusted internal jobs only.
  id(context.actor.id);if(!context.session)throw new AuthError('UNAUTHENTICATED');
  const account=(await client.query(`SELECT id,person_id,status,confirmation_status,session_version FROM accounts WHERE id=$1 FOR UPDATE`,[context.actor.id])).rows[0];
  if(!account||account.status!=='active'||!['verified','exempt'].includes(account.confirmation_status)||account.session_version!==context.session.version)throw new AuthError('UNAUTHENTICATED');
  const person=(await client.query('SELECT status FROM people WHERE id=$1 FOR UPDATE',[account.person_id])).rows[0];
  if(person?.status!=='active')throw new AuthError('UNAUTHENTICATED');
  const roles=(await client.query('SELECT role FROM account_roles WHERE account_id=$1 FOR SHARE',[account.id])).rows.map(row=>row.role);
  return {personId:account.person_id as string,management:roles.includes('administrator')||roles.includes('manager'),customer:roles.includes('customer')};
}
async function checkSession(client:PoolClient,context:FamilyContext){
  if(context.actor.type==='system')return;
  const session=(await client.query(`SELECT expires_at FROM identity_sessions WHERE id=$1 AND account_id=$2 AND session_version=$3 AND revoked_at IS NULL FOR UPDATE`,
    [context.session?.id,context.actor.id,context.session?.version])).rows[0];
  if(!session||session.expires_at.getTime()<=Date.now())throw new AuthError('UNAUTHENTICATED');
}
async function participant(client:PoolClient,personId:string){
  const account=(await client.query('SELECT id,status,confirmation_status FROM accounts WHERE person_id=$1 FOR UPDATE',[personId])).rows[0];
  const person=(await client.query('SELECT status FROM people WHERE id=$1 FOR UPDATE',[personId])).rows[0];
  if(!account||account.status!=='active'||!['verified','exempt'].includes(account.confirmation_status)||person?.status!=='active'
    ||!(await client.query("SELECT 1 FROM account_roles WHERE account_id=$1 AND role='customer' FOR SHARE",[account.id])).rowCount)throw new AuthError('FORBIDDEN');
}
async function state(client:PoolClient,familyId:string,expectedVersion:number):Promise<FamilyState>{
  const family=(await client.query<FamilyState>(`SELECT id,name,created_by_person_id AS "createdByPersonId",responsible_membership_id AS "responsibleMembershipId",status,version FROM families WHERE id=$1 FOR UPDATE`,[familyId])).rows[0];
  if(!family)throw new AuthError('NOT_FOUND');if(family.status!=='active'||family.version!==expectedVersion)throw new AuthError('CONFLICT');return family;
}
async function record(client:PoolClient,context:FamilyContext,familyId:string,action:Parameters<typeof appendIdentityAudit>[1]['action'],before:Record<string,unknown>|null,after:Record<string,unknown>){
  await appendIdentityAudit(client,{...context,action,targetType:'family',targetId:familyId,before,after});
}
async function requireNoCurrentFamily(client:PoolClient,personId:string){
  if((await client.query('SELECT 1 FROM family_memberships WHERE person_id=$1 AND ended_at IS NULL',[personId])).rowCount)throw new AuthError('CONFLICT');
}

// Internal only. Caller owns BEGIN/COMMIT and validates invitation consent in that transaction.
// Departure/closure must receive a real domain coordinator. I24 routes expose only creation and consent-backed joining.
export async function createFamilyInTransaction(client:PoolClient,input:{id?:string;membershipId?:string;name:string;creatorPersonId:string},context:FamilyContext):Promise<FamilyState>{
  id(input.creatorPersonId);if(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>120||/[\x00-\x1f\x7f]/.test(input.name))throw new AuthError('INVALID_REQUEST');
  const acting=await actor(client,context);if(acting.personId!==null&&(acting.personId!==input.creatorPersonId||!acting.customer))throw new AuthError('FORBIDDEN');
  await participant(client,input.creatorPersonId);await checkSession(client,context);
  await requireNoCurrentFamily(client,input.creatorPersonId);
  const familyId=input.id??randomUUID(),membershipId=input.membershipId??randomUUID();id(familyId);id(membershipId);const joinedAt=new Date();
  await client.query('INSERT INTO families(id,name,created_by_person_id,responsible_membership_id,created_at) VALUES ($1,$2,$3,$4,$5)',[familyId,input.name.trim(),input.creatorPersonId,membershipId,joinedAt]);
  await client.query("INSERT INTO family_memberships(id,family_id,person_id,source,accepted_by_person_id,joined_at) VALUES ($1,$2,$3,'creation',$3,$4)",[membershipId,familyId,input.creatorPersonId,joinedAt]);
  await record(client,context,familyId,'family.created',null,{name:input.name.trim(),status:'active',version:0,responsibleMembershipId:membershipId,personId:input.creatorPersonId,memberCount:1});
  return {id:familyId,name:input.name.trim(),createdByPersonId:input.creatorPersonId,responsibleMembershipId:membershipId,status:'active',version:0};
}
export async function joinFamilyInTransaction(client:PoolClient,input:{membershipId?:string;familyId:string;personId:string;expectedVersion:number;acceptance:AcceptedFamilyInvitation},context:FamilyContext):Promise<FamilyState>{
  id(input.familyId);id(input.personId);version(input.expectedVersion);const proof=input.acceptance;
  if(!proof||proof.acceptedByPersonId!==input.personId||!(proof.acceptedAt instanceof Date)||!Number.isFinite(proof.acceptedAt.getTime())||proof.acceptedAt.getTime()>Date.now())throw new AuthError('INVALID_REQUEST');id(proof.invitationId);
  const acting=await actor(client,context);if(acting.personId!==null&&(acting.personId!==input.personId||!acting.customer))throw new AuthError('FORBIDDEN');
  await participant(client,input.personId);const family=await state(client,input.familyId,input.expectedVersion);await checkSession(client,context);
  await requireNoCurrentFamily(client,input.personId);
  const membershipId=input.membershipId??randomUUID();id(membershipId);
  await client.query("INSERT INTO family_memberships(id,family_id,person_id,source,accepted_invitation_id,accepted_by_person_id,joined_at) VALUES ($1,$2,$3,'accepted_invitation',$4,$3,$5)",[membershipId,family.id,input.personId,proof.invitationId,proof.acceptedAt]);
  await client.query('UPDATE families SET version=version+1 WHERE id=$1',[family.id]);
  await record(client,context,family.id,'family.member_joined',{version:family.version},{version:family.version+1,membershipId,personId:input.personId,acceptedInvitationId:proof.invitationId});
  return {...family,version:family.version+1};
}
export async function endFamilyMembershipInTransaction(client:PoolClient,input:{familyId:string;membershipId:string;expectedVersion:number;operation:'leave'|'remove'},context:FamilyContext,coordinate?:FamilyCoordinator):Promise<FamilyState>{
  id(input.familyId);id(input.membershipId);version(input.expectedVersion);if(!['leave','remove'].includes(input.operation))throw new AuthError('INVALID_REQUEST');
  const acting=await actor(client,context),family=await state(client,input.familyId,input.expectedVersion);await checkSession(client,context);
  const members=(await client.query('SELECT id,person_id FROM family_memberships WHERE family_id=$1 AND ended_at IS NULL ORDER BY id FOR UPDATE',[family.id])).rows;
  const departing=members.find(member=>member.id===input.membershipId);if(!departing)throw new AuthError('CONFLICT');
  const responsible=members.find(member=>member.id===family.responsibleMembershipId)?.person_id===acting.personId;
  if(acting.personId!==null&&input.operation==='remove'&&departing.person_id===acting.personId)throw new AuthError('FORBIDDEN');
  if(acting.personId!==null&&(input.operation==='leave'?departing.person_id!==acting.personId:!acting.management&&!responsible))throw new AuthError('FORBIDDEN');
  if(!coordinate)throw new AuthError('CONFLICT');const closesFamily=members.length===1;
  await coordinate(client,{familyId:family.id,version:family.version,operation:input.operation,membershipId:departing.id,personId:departing.person_id,closesFamily});
  await checkSession(client,context);
  const endedAt=new Date(),responsibleMembershipId=closesFamily||family.responsibleMembershipId===departing.id?null:family.responsibleMembershipId;
  await client.query('UPDATE family_memberships SET ended_at=$2,end_reason=$3 WHERE id=$1',[departing.id,endedAt,input.operation==='leave'?'left':'removed']);
  await client.query('UPDATE families SET responsible_membership_id=$2,status=$3,closed_at=$4,version=version+1 WHERE id=$1',[family.id,responsibleMembershipId,closesFamily?'closed':'active',closesFamily?endedAt:null]);
  await record(client,context,family.id,input.operation==='leave'?'family.member_left':'family.member_removed',
    {version:family.version,responsibleMembershipId:family.responsibleMembershipId,memberCount:members.length},
    {version:family.version+1,responsibleMembershipId,status:closesFamily?'closed':'active',memberCount:members.length-1,membershipId:departing.id,personId:departing.person_id});
  if(closesFamily)await record(client,context,family.id,'family.closed',{status:'active'},{status:'closed',version:family.version+1,memberCount:0});
  return {...family,version:family.version+1,responsibleMembershipId,status:closesFamily?'closed':'active'};
}
export async function closeFamilyInTransaction(client:PoolClient,input:{familyId:string;expectedVersion:number},context:FamilyContext,coordinate?:FamilyCoordinator):Promise<FamilyState>{
  id(input.familyId);version(input.expectedVersion);const acting=await actor(client,context),family=await state(client,input.familyId,input.expectedVersion);await checkSession(client,context);
  const members=(await client.query('SELECT id,person_id FROM family_memberships WHERE family_id=$1 AND ended_at IS NULL ORDER BY id FOR UPDATE',[family.id])).rows;
  const owned=members.some(member=>member.id===family.responsibleMembershipId&&member.person_id===acting.personId);
  const fallback=family.responsibleMembershipId===null&&members.length===1&&members[0]?.person_id===acting.personId;
  if(!acting.management&&!owned&&!fallback)throw new AuthError('FORBIDDEN');if(!coordinate)throw new AuthError('CONFLICT');
  await coordinate(client,{familyId:family.id,version:family.version,operation:'close',closesFamily:true});await checkSession(client,context);const endedAt=new Date();
  await client.query("UPDATE family_memberships SET ended_at=$2,end_reason='closed' WHERE family_id=$1 AND ended_at IS NULL",[family.id,endedAt]);
  await client.query("UPDATE families SET status='closed',closed_at=$2,responsible_membership_id=NULL,version=version+1 WHERE id=$1",[family.id,endedAt]);
  await record(client,context,family.id,'family.closed',{status:'active',version:family.version,responsibleMembershipId:family.responsibleMembershipId,memberCount:members.length},
    {status:'closed',version:family.version+1,responsibleMembershipId:null,memberCount:0});
  return {...family,status:'closed',version:family.version+1,responsibleMembershipId:null};
}
