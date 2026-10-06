import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {createAuthAccount,authConfig,password} from './identity-auth-helpers.mjs';
import {createSessionService} from '../../dist/modules/identity/sessions.js';
import {createFamilyInTransaction,joinFamilyInTransaction} from '../../dist/modules/identity/families.js';
import * as persistence from '../../dist/modules/identity/families.js';
import * as lifecycle from '../../dist/modules/identity/family-lifecycle.js';
import {previewFamilyLifecycleInTransaction,executeFamilyLifecycleInTransaction} from '../../dist/modules/identity/family-lifecycle.js';
const context=account=>({actor:{id:account.accountId,type:'customer'},session:account.session,reason:'Lifecycle verification',correlationId:randomUUID()});
async function transaction(pool,work){const client=await pool.connect();try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
async function account(pool,email,roles=['customer']){const value=await createAuthAccount(pool,email,roles),sessions=await createSessionService(pool,authConfig());const login=await sessions.login({email:value.email,password},'127.0.0.1'),session=await sessions.resolve(login.sessionToken);return {...value,session:{id:session.sessionId,version:session.sessionVersion}};}
const obligations={ownership:true,reservations:true,valueAndExpiry:true,noRefundOrRestoration:true,transactionalAudit:true};
function coordinator(overrides={}){return {inspect:async()=>({status:'known',revision:'credit-revision-1',obligations}),apply:async()=>({status:'applied',revision:'credit-revision-1'}),...overrides};}

test('lifecycle preview is read-only; denials, unknown obligations and coordinator failure preserve membership and audit',async()=>{
  const db=await isolatedDatabase();migrate(db.name);
  try{
    const owner=await account(db.pool,'owner@example.test'),member=await account(db.pool,'member@example.test'),outsider=await account(db.pool,'outsider@example.test');
    const family=await transaction(db.pool,client=>createFamilyInTransaction(client,{name:'Lifecycle family',creatorPersonId:owner.personId},context(owner)));
    await transaction(db.pool,client=>joinFamilyInTransaction(client,{familyId:family.id,personId:member.personId,expectedVersion:0,acceptance:{invitationId:randomUUID(),acceptedByPersonId:member.personId,acceptedAt:new Date()}},context(member)));
    const membership=(await db.pool.query('SELECT id FROM family_memberships WHERE person_id=$1',[member.personId])).rows[0].id;
    const leave={familyId:family.id,membershipId:membership,expectedVersion:1,expectedFinancialRevision:'credit-revision-1',operation:'leave',creditChoice:'keep'};
    const snapshot=async()=>({family:(await db.pool.query('SELECT version,status FROM families WHERE id=$1',[family.id])).rows[0],members:(await db.pool.query('SELECT id,ended_at FROM family_memberships WHERE family_id=$1 ORDER BY id',[family.id])).rows,audit:(await db.pool.query('SELECT count(*)::int n FROM audit_events')).rows[0].n});
    const before=await snapshot();
    for(const exported of [persistence,lifecycle]){assert.equal(exported.endFamilyMembershipInTransaction,undefined);assert.equal(exported.closeFamilyInTransaction,undefined);}
    const preview=await transaction(db.pool,client=>previewFamilyLifecycleInTransaction(client,leave,context(member),coordinator()));
    assert.equal(preview.policy,'return-own-eligible');assert.equal(preview.closesFamily,false);assert.deepEqual(await snapshot(),before);
    for(const adapter of [undefined,coordinator({inspect:async()=>({status:'unknown'})}),coordinator({inspect:async()=>({status:'known',revision:'x',obligations:{...obligations,reservations:false}})}),coordinator({apply:async()=>{throw new Error('financial service unavailable');}}),coordinator({apply:async()=>({status:'applied',revision:'stale'})})]){
      await assert.rejects(transaction(db.pool,client=>executeFamilyLifecycleInTransaction(client,leave,context(member),adapter)));assert.deepEqual(await snapshot(),before);
    }
    let inspected=false;
    await assert.rejects(transaction(db.pool,client=>executeFamilyLifecycleInTransaction(client,leave,context(outsider),coordinator({inspect:async()=>{inspected=true;throw new Error('must not run');}}))),{message:'FORBIDDEN'});assert.equal(inspected,false);
    await assert.rejects(transaction(db.pool,client=>executeFamilyLifecycleInTransaction(client,{...leave,creditChoice:undefined},context(member),coordinator())),{message:'INVALID_REQUEST'});
    await assert.rejects(transaction(db.pool,client=>executeFamilyLifecycleInTransaction(client,{...leave,operation:'remove',creditChoice:'donate'},context(owner),coordinator())),{message:'FORBIDDEN'});
    assert.deepEqual(await snapshot(),before);
    await assert.rejects(transaction(db.pool,client=>executeFamilyLifecycleInTransaction(client,{...leave,expectedFinancialRevision:'old-preview'},context(member),coordinator())),{message:'CONFLICT'});
    assert.deepEqual(await snapshot(),before);
    let applied;
    await transaction(db.pool,client=>executeFamilyLifecycleInTransaction(client,{...leave,creditChoice:'donate'},context(member),coordinator({apply:async(sameClient,plan)=>{assert.equal(sameClient,client);applied=plan;return {status:'applied',revision:plan.revision};}})));
    assert.equal(applied.policy,'leave-own-eligible');assert.equal(applied.personId,member.personId);assert.equal((await snapshot()).family.version,2);
    await assert.rejects(transaction(db.pool,client=>executeFamilyLifecycleInTransaction(client,leave,context(member),coordinator())),{message:'CONFLICT'});
    const close={familyId:family.id,expectedVersion:2,expectedFinancialRevision:'credit-revision-1',operation:'close'};
    await transaction(db.pool,client=>executeFamilyLifecycleInTransaction(client,close,context(owner),coordinator({apply:async(_client,plan)=>{assert.equal(plan.policy,'return-all-to-original-purchasers');assert.equal(plan.closesFamily,true);return {status:'applied',revision:plan.revision};}})));
    assert.equal((await snapshot()).family.status,'closed');
  }finally{await db.pool.end();}
});

test('removal defaults to purchaser return, donation requires verified purchaser consent, and last departure closes with original ownership',async()=>{
  const db=await isolatedDatabase();migrate(db.name);
  try{
    const owner=await account(db.pool,'owner@example.test'),member=await account(db.pool,'member@example.test'),manager=await account(db.pool,'manager@example.test',['manager','customer']);
    const family=await transaction(db.pool,client=>createFamilyInTransaction(client,{name:'Ownership family',creatorPersonId:owner.personId},context(owner)));
    await transaction(db.pool,client=>joinFamilyInTransaction(client,{familyId:family.id,personId:member.personId,expectedVersion:0,acceptance:{invitationId:randomUUID(),acceptedByPersonId:member.personId,acceptedAt:new Date()}},context(member)));
    const membership=(await db.pool.query('SELECT id FROM family_memberships WHERE person_id=$1',[member.personId])).rows[0].id;
    const remove={familyId:family.id,membershipId:membership,expectedVersion:1,expectedFinancialRevision:'credit-revision-1',operation:'remove'};
    const preview=await transaction(db.pool,client=>previewFamilyLifecycleInTransaction(client,remove,context(manager),coordinator()));
    assert.equal(preview.policy,'return-own-eligible');assert.equal(preview.personId,member.personId);
    await assert.rejects(transaction(db.pool,client=>previewFamilyLifecycleInTransaction(client,{familyId:family.id,expectedVersion:1,operation:'close'},context(member),coordinator())),{message:'FORBIDDEN'});
    const donate={...remove,creditChoice:'donate',donationConsentReference:'trusted-consent-reference'};
    for(const acceptedBy of [undefined,owner.personId])await assert.rejects(transaction(db.pool,client=>executeFamilyLifecycleInTransaction(client,donate,context(owner),coordinator({inspect:async()=>({status:'known',revision:'credit-revision-1',obligations,donationAcceptedByPersonId:acceptedBy})}))),{message:'FORBIDDEN'});
    // A coordinator's same-client write must roll back when its receipt fails.
    await db.pool.query('CREATE TABLE financial_probe (id uuid PRIMARY KEY)');
    await assert.rejects(transaction(db.pool,client=>executeFamilyLifecycleInTransaction(client,remove,context(manager),coordinator({apply:async(sameClient)=>{await sameClient.query('INSERT INTO financial_probe VALUES ($1)',[randomUUID()]);return {status:'unknown'};}}))),{message:'CONFLICT'});
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM financial_probe')).rows[0].n,0);
    await db.pool.query("CREATE FUNCTION reject_departure_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='family.member_removed' THEN RAISE EXCEPTION 'controlled audit failure'; END IF; RETURN NEW; END $$");
    await db.pool.query('CREATE TRIGGER reject_departure_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_departure_audit()');
    await assert.rejects(transaction(db.pool,client=>executeFamilyLifecycleInTransaction(client,remove,context(manager),coordinator({apply:async(sameClient)=>{await sameClient.query('INSERT INTO financial_probe VALUES ($1)',[randomUUID()]);return {status:'applied',revision:'credit-revision-1'};}}))),{message:'controlled audit failure'});
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM financial_probe')).rows[0].n,0);
    assert.equal((await db.pool.query('SELECT version FROM families WHERE id=$1',[family.id])).rows[0].version,1);
    assert.equal((await db.pool.query('SELECT ended_at FROM family_memberships WHERE id=$1',[membership])).rows[0].ended_at,null);
    await db.pool.query('DROP TRIGGER reject_departure_audit ON audit_events');
    await transaction(db.pool,client=>executeFamilyLifecycleInTransaction(client,donate,context(owner),coordinator({inspect:async(_client,plan)=>{assert.equal(plan.donationConsentReference,'trusted-consent-reference');return {status:'known',revision:'credit-revision-1',obligations,donationAcceptedByPersonId:member.personId};},apply:async(_client,plan)=>{assert.equal(plan.policy,'leave-own-eligible');assert.equal(plan.donationConsentReference,'trusted-consent-reference');assert.equal(plan.donationAcceptedByPersonId,member.personId);return {status:'applied',revision:plan.revision};}})));
    const last={familyId:family.id,membershipId:family.responsibleMembershipId,expectedVersion:2,expectedFinancialRevision:'credit-revision-1',operation:'leave',creditChoice:'donate'};
    await transaction(db.pool,client=>executeFamilyLifecycleInTransaction(client,last,context(owner),coordinator({apply:async(_client,plan)=>{assert.equal(plan.closesFamily,true);assert.equal(plan.policy,'return-all-to-original-purchasers');return {status:'applied',revision:plan.revision};}})));
    assert.equal((await db.pool.query('SELECT status FROM families WHERE id=$1',[family.id])).rows[0].status,'closed');
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM family_memberships WHERE family_id=$1 AND ended_at IS NULL',[family.id])).rows[0].n,0);
  }finally{await db.pool.end();}
});
