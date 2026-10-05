import {endFamilyMembershipInTransaction,closeFamilyInTransaction} from './identity-family-lifecycle-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {createAuthAccount,authConfig,password} from './identity-auth-helpers.mjs';
import {createSessionService} from '../../dist/modules/identity/sessions.js';
import {createRoleService} from '../../dist/modules/identity/roles.js';
import {createFamilyInTransaction,joinFamilyInTransaction} from '../../dist/modules/identity/families.js';
const context=actor=>({actor:{id:actor.accountId,type:'customer'},session:actor.session,reason:'Controlled family fixture',correlationId:randomUUID()});
async function familyAccount(pool,email,roles=['customer']){const account=await createAuthAccount(pool,email,roles),sessions=await createSessionService(pool,authConfig());
  const login=await sessions.login({email:account.email,password},'127.0.0.1'),resolved=await sessions.resolve(login.sessionToken);
  return {...account,sessions,sessionToken:login.sessionToken,session:{id:resolved.sessionId,version:resolved.sessionVersion}};
}
async function transaction(pool,work){const client=await pool.connect();try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
const consent=person=>({invitationId:randomUUID(),acceptedByPersonId:person.personId,acceptedAt:new Date()});

test('one active family rejects cross-group creation/join, serializes races and retains departure history',async()=>{
  const db=await isolatedDatabase();migrate(db.name);
  try{
    const first=await familyAccount(db.pool,'first@example.test'),second=await familyAccount(db.pool,'second@example.test'),member=await familyAccount(db.pool,'member@example.test');
    const groups=[];
    for(const owner of [first,second])groups.push(await transaction(db.pool,client=>createFamilyInTransaction(client,{name:'Exclusive family',creatorPersonId:owner.personId},context(owner))));
    await assert.rejects(transaction(db.pool,client=>createFamilyInTransaction(client,{name:'Second family',creatorPersonId:first.personId},context(first))),{message:'CONFLICT'});
    await assert.rejects(transaction(db.pool,client=>joinFamilyInTransaction(client,{familyId:groups[1].id,personId:first.personId,expectedVersion:0,acceptance:consent(first)},context(first))),{message:'CONFLICT'});
    const results=await Promise.allSettled(groups.map(group=>transaction(db.pool,client=>joinFamilyInTransaction(client,{familyId:group.id,personId:member.personId,expectedVersion:0,acceptance:consent(member)},context(member)))));
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.find(result=>result.status==='rejected').reason.message,'CONFLICT');
    const current=(await db.pool.query('SELECT id,family_id FROM family_memberships WHERE person_id=$1 AND ended_at IS NULL',[member.personId])).rows;
    assert.equal(current.length,1);const other=groups.find(group=>group.id!==current[0].family_id);
    await assert.rejects(transaction(db.pool,client=>client.query("INSERT INTO family_memberships(family_id,person_id,source,accepted_invitation_id,accepted_by_person_id,joined_at) VALUES ($1,$2,'accepted_invitation',$3,$2,clock_timestamp())",[other.id,member.personId,randomUUID()])),{code:'23505'});
    await transaction(db.pool,client=>endFamilyMembershipInTransaction(client,{familyId:current[0].family_id,membershipId:current[0].id,expectedVersion:1,operation:'leave'},context(member),async()=>{}));
    await transaction(db.pool,client=>joinFamilyInTransaction(client,{familyId:other.id,personId:member.personId,expectedVersion:0,acceptance:consent(member)},context(member)));
    const history=(await db.pool.query('SELECT family_id,ended_at FROM family_memberships WHERE person_id=$1',[member.personId])).rows;
    assert.equal(history.length,2);assert.equal(history.filter(row=>row.ended_at===null).length,1);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM families')).rows[0].n,2);
  }finally{await db.pool.end();}
});

test('V7 refuses conflicting V6 memberships without choosing a group or rewriting history',async()=>{
  const db=await isolatedDatabase();migrate(db.name,'-target=6');
  try{
    const owner=await createAuthAccount(db.pool);
    for(let index=0;index<2;index++)await transaction(db.pool,async client=>{
      const group=(await client.query('INSERT INTO families(name,created_by_person_id) VALUES ($1,$2) RETURNING id',['Legacy duplicate',owner.personId])).rows[0];
      await client.query("INSERT INTO family_memberships(family_id,person_id,source,accepted_by_person_id,joined_at) VALUES ($1,$2,'creation',$2,clock_timestamp())",[group.id,owner.personId]);
    });
    const failed=spawnSync('docker',['compose','-f','compose.test.yaml','-p','conecta-foundation-tests','run','--rm','--no-deps','-e',`FLYWAY_URL=jdbc:postgresql://db:5432/${db.name}`,'flyway','migrate'],{encoding:'utf8'});
    assert.notEqual(failed.status,0);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM family_memberships WHERE person_id=$1 AND ended_at IS NULL',[owner.personId])).rows[0].n,2);
    assert.equal((await db.pool.query("SELECT to_regclass('public.family_one_current_group_per_person_idx') AS name")).rows[0].name,null);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM accounts')).rows[0].n,1);
  }finally{await db.pool.end();}
});

test('V6 preserves populated V5 data, rolls back conflicting DDL and repeats without creating families',async()=>{
  const db=await isolatedDatabase();migrate(db.name,'-target=5');
  try{
    const person=await createAuthAccount(db.pool);
    await db.pool.query('CREATE TABLE family_memberships(collision text)');
    const failed=spawnSync('docker',['compose','-f','compose.test.yaml','-p','conecta-foundation-tests','run','--rm','--no-deps','-e',`FLYWAY_URL=jdbc:postgresql://db:5432/${db.name}`,'flyway','migrate'],{encoding:'utf8'});
    assert.notEqual(failed.status,0);
    assert.equal((await db.pool.query("SELECT to_regclass('public.families') AS table_name")).rows[0].table_name,null);
    assert.equal((await db.pool.query('SELECT person_id FROM accounts WHERE id=$1',[person.accountId])).rows[0].person_id,person.personId);
    await db.pool.query('DROP TABLE family_memberships');migrate(db.name);migrate(db.name);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM families')).rows[0].n,0);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM family_memberships')).rows[0].n,0);
  }finally{await db.pool.end();}
});

test('role changes preserve family facts while unknown domain obligations still fail closed',async()=>{
  const db=await isolatedDatabase();migrate(db.name);
  try{
    const manager=await familyAccount(db.pool,'manager@example.test',['manager','customer']);
    const member=await familyAccount(db.pool,'member@example.test',['reception','customer']);
    const family=await transaction(db.pool,client=>createFamilyInTransaction(client,{name:'Role preservation',creatorPersonId:member.personId},context(member)));
    const roles=createRoleService(db.pool,manager.sessions);
    assert.deepEqual((await roles.change(member.accountId,{roles:['customer']},manager.sessionToken)).roles,['customer']);
    assert.equal((await db.pool.query('SELECT ended_at FROM family_memberships WHERE id=$1',[family.responsibleMembershipId])).rows[0].ended_at,null);
    await roles.change(member.accountId,{roles:['reception']},manager.sessionToken);
    await db.pool.query('CREATE TABLE future_domain_obligations(id uuid)');
    await assert.rejects(roles.change(member.accountId,{roles:['customer']},manager.sessionToken),{message:'CONFLICT'});
  }finally{await db.pool.end();}
});

test('families retain historical memberships, constrain responsible state and require a coordinator for departure',async()=>{
  const db=await isolatedDatabase();migrate(db.name);
  try{
    const owner=await familyAccount(db.pool),member=await familyAccount(db.pool,'member@example.test');
    const family=await transaction(db.pool,client=>createFamilyInTransaction(client,{name:'Test family',creatorPersonId:owner.personId},context(owner)));
    assert.equal(family.version,0);assert.ok(family.responsibleMembershipId);
    await assert.rejects(transaction(db.pool,client=>endFamilyMembershipInTransaction(client,{familyId:family.id,membershipId:family.responsibleMembershipId,expectedVersion:0,operation:'remove'},context(owner),async()=>{throw new Error('must not coordinate');})),{message:'FORBIDDEN'});
    await transaction(db.pool,client=>joinFamilyInTransaction(client,{familyId:family.id,personId:member.personId,expectedVersion:0,acceptance:consent(member)},context(member)));
    const membership=(await db.pool.query('SELECT id FROM family_memberships WHERE family_id=$1 AND person_id=$2',[family.id,member.personId])).rows[0];
    await assert.rejects(transaction(db.pool,client=>endFamilyMembershipInTransaction(client,{familyId:family.id,membershipId:membership.id,expectedVersion:1,operation:'leave'},context(member))),{message:'CONFLICT'});
    assert.equal((await db.pool.query('SELECT ended_at FROM family_memberships WHERE id=$1',[membership.id])).rows[0].ended_at,null);
    await transaction(db.pool,client=>endFamilyMembershipInTransaction(client,{familyId:family.id,membershipId:membership.id,expectedVersion:1,operation:'leave'},context(member),async()=>{}));
    const ended=(await db.pool.query('SELECT * FROM family_memberships WHERE id=$1',[membership.id])).rows[0];assert.ok(ended.ended_at);assert.equal(ended.end_reason,'left');
    await assert.rejects(db.pool.query('UPDATE family_memberships SET ended_at=NULL,end_reason=NULL WHERE id=$1',[membership.id]));
    await assert.rejects(db.pool.query('DELETE FROM family_memberships WHERE id=$1',[membership.id]));
    await transaction(db.pool,client=>joinFamilyInTransaction(client,{familyId:family.id,personId:member.personId,expectedVersion:2,acceptance:consent(member)},context(member)));
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM family_memberships WHERE family_id=$1 AND person_id=$2',[family.id,member.personId])).rows[0].n,2);
    const current=(await db.pool.query('SELECT id FROM family_memberships WHERE family_id=$1 AND person_id=$2 AND ended_at IS NULL',[family.id,member.personId])).rows[0];
    await transaction(db.pool,client=>endFamilyMembershipInTransaction(client,{familyId:family.id,membershipId:family.responsibleMembershipId,expectedVersion:3,operation:'leave'},context(owner),async()=>{}));
    const state=(await db.pool.query('SELECT responsible_membership_id,version FROM families WHERE id=$1',[family.id])).rows[0];assert.equal(state.responsible_membership_id,null);assert.equal(state.version,4);
    await assert.rejects(transaction(db.pool,client=>closeFamilyInTransaction(client,{familyId:family.id,expectedVersion:4},context(member),async()=>{throw new Error('credits unavailable');})),{message:'credits unavailable'});
    await transaction(db.pool,client=>closeFamilyInTransaction(client,{familyId:family.id,expectedVersion:4},context(member),async()=>{}));
    const closed=(await db.pool.query('SELECT status,closed_at FROM families WHERE id=$1',[family.id])).rows[0];assert.equal(closed.status,'closed');assert.ok(closed.closed_at);
    assert.equal((await db.pool.query('SELECT ended_at FROM family_memberships WHERE id=$1',[current.id])).rows[0].ended_at!==null,true);
    assert.equal((await db.pool.query("SELECT count(*)::int n FROM audit_events WHERE target_id=$1 AND action LIKE 'family.%'",[family.id])).rows[0].n,6);
  }finally{await db.pool.end();}
});

test('family authority and coordinator failures preserve membership and audit atomically',async()=>{
  const db=await isolatedDatabase();migrate(db.name);
  try{
    const owner=await familyAccount(db.pool),member=await familyAccount(db.pool,'member@example.test'),outsider=await familyAccount(db.pool,'outsider@example.test');
    const manager=await familyAccount(db.pool,'manager@example.test',['manager','customer']);
    const managerFamily=await transaction(db.pool,client=>createFamilyInTransaction(client,{name:'Manager family',creatorPersonId:manager.personId},context(manager)));
    await assert.rejects(transaction(db.pool,client=>endFamilyMembershipInTransaction(client,{familyId:managerFamily.id,membershipId:managerFamily.responsibleMembershipId,expectedVersion:0,operation:'remove'},context(manager),async()=>{})),{message:'FORBIDDEN'});
    const family=await transaction(db.pool,client=>createFamilyInTransaction(client,{name:'Permission family',creatorPersonId:owner.personId},context(owner)));
    await transaction(db.pool,client=>joinFamilyInTransaction(client,{familyId:family.id,personId:member.personId,expectedVersion:0,acceptance:consent(member)},context(member)));
    const target=(await db.pool.query('SELECT id FROM family_memberships WHERE family_id=$1 AND person_id=$2',[family.id,member.personId])).rows[0];
    for(const denied of [member,outsider])await assert.rejects(transaction(db.pool,client=>closeFamilyInTransaction(client,{familyId:family.id,expectedVersion:1},context(denied),async()=>{})),{message:'FORBIDDEN'});
    await assert.rejects(transaction(db.pool,client=>endFamilyMembershipInTransaction(client,{familyId:family.id,membershipId:family.responsibleMembershipId,expectedVersion:1,operation:'remove'},context(member),async()=>{})),{message:'FORBIDDEN'});
    const before=(await db.pool.query('SELECT count(*)::int n FROM audit_events')).rows[0].n;
    await assert.rejects(transaction(db.pool,client=>endFamilyMembershipInTransaction(client,{familyId:family.id,membershipId:target.id,expectedVersion:1,operation:'remove'},context(manager),async client=>{
      await client.query("UPDATE people SET phone='rollback marker' WHERE id=$1",[member.personId]);throw new Error('coordinator failure');
    })),{message:'coordinator failure'});
    assert.equal((await db.pool.query('SELECT phone FROM people WHERE id=$1',[member.personId])).rows[0].phone,null);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM audit_events')).rows[0].n,before);
    assert.equal((await db.pool.query('SELECT ended_at FROM family_memberships WHERE id=$1',[target.id])).rows[0].ended_at,null);
    await db.pool.query('UPDATE identity_sessions SET revoked_at=now() WHERE id=$1',[manager.session.id]);
    await assert.rejects(transaction(db.pool,client=>closeFamilyInTransaction(client,{familyId:family.id,expectedVersion:1},context(manager),async()=>{})),{message:'UNAUTHENTICATED'});
    await transaction(db.pool,client=>endFamilyMembershipInTransaction(client,{familyId:family.id,membershipId:target.id,expectedVersion:1,operation:'remove'},context(owner),async()=>{}));
    assert.equal((await db.pool.query('SELECT end_reason FROM family_memberships WHERE id=$1',[target.id])).rows[0].end_reason,'removed');
    await db.pool.query("WITH boundary AS (SELECT clock_timestamp()+interval '150 milliseconds' AS expires) UPDATE identity_sessions SET created_at=boundary.expires-interval '168 hours',authenticated_at=boundary.expires-interval '1 hour',expires_at=boundary.expires FROM boundary WHERE id=$1",[owner.session.id]);
    await assert.rejects(transaction(db.pool,client=>closeFamilyInTransaction(client,{familyId:family.id,expectedVersion:2},context(owner),async client=>{
      await client.query("UPDATE people SET phone='must roll back' WHERE id=$1",[owner.personId]);await new Promise(resolve=>setTimeout(resolve,200));
    })),{message:'UNAUTHENTICATED'});
    assert.equal((await db.pool.query('SELECT phone FROM people WHERE id=$1',[owner.personId])).rows[0].phone,null);
    assert.equal((await db.pool.query('SELECT status FROM families WHERE id=$1',[family.id])).rows[0].status,'active');
  }finally{await db.pool.end();}
});

test('family joins serialize duplicate acceptance and database constraints reject invalid responsible/empty states',async()=>{
  const db=await isolatedDatabase();migrate(db.name);
  try{
    const owner=await familyAccount(db.pool),member=await familyAccount(db.pool,'member@example.test');
    const family=await transaction(db.pool,client=>createFamilyInTransaction(client,{name:'Concurrent family',creatorPersonId:owner.personId},context(owner)));
    const outcomes=await Promise.allSettled([1,2].map(()=>transaction(db.pool,client=>joinFamilyInTransaction(client,{familyId:family.id,personId:member.personId,expectedVersion:0,acceptance:consent(member)},context(member)))));
    assert.equal(outcomes.filter(value=>value.status==='fulfilled').length,1);assert.equal(outcomes.find(value=>value.status==='rejected').reason.message,'CONFLICT');
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM family_memberships WHERE family_id=$1 AND person_id=$2 AND ended_at IS NULL',[family.id,member.personId])).rows[0].n,1);
    await assert.rejects(transaction(db.pool,async client=>{await client.query('INSERT INTO families(name,created_by_person_id) VALUES ($1,$2)',['Empty',owner.personId]);}));
    await assert.rejects(transaction(db.pool,client=>client.query('UPDATE families SET responsible_membership_id=$2,version=version+1 WHERE id=$1',[family.id,randomUUID()])));
    await assert.rejects(transaction(db.pool,client=>client.query("UPDATE families SET status='closed',closed_at=now(),responsible_membership_id=NULL,version=version+1 WHERE id=$1",[family.id])));
    await assert.rejects(transaction(db.pool,client=>joinFamilyInTransaction(client,{familyId:family.id,personId:owner.personId,expectedVersion:1,acceptance:consent(member)},context(owner))),{message:'INVALID_REQUEST'});
  }finally{await db.pool.end();}
});
