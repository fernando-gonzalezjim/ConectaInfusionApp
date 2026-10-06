import test from 'node:test';
import assert from 'node:assert/strict';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {authConfig,createAuthAccount,password} from './identity-auth-helpers.mjs';
import {createSessionService} from '../../dist/modules/identity/sessions.js';
import {createLifecycleReadService} from '../../dist/modules/identity/lifecycle-read.js';
import {createChildDetailsService} from '../../dist/modules/identity/child-details.js';
import {createGuardianReactivationService} from '../../dist/modules/identity/guardian-reactivation.js';
import {decryptOutboxPayload} from '../../dist/modules/identity/outbox-crypto.js';
async function fixture(){const db=await isolatedDatabase();migrate(db.name);const config=authConfig(),sessions=await createSessionService(db.pool,config),manager=await createAuthAccount(db.pool,'manager@example.test',['manager']),parent=await createAuthAccount(db.pool,'parent@example.test'),managerLogin=await sessions.login({email:manager.email,password},'127.0.0.1'),parentLogin=await sessions.login({email:parent.email,password},'127.0.0.2');return {...db,config,sessions,manager,parent,managerLogin,parentLogin,reads:createLifecycleReadService(db.pool,sessions)};}
test('lifecycle reads authorize ownership and fresh management while exposing only bounded safe state',async()=>{
 const f=await fixture();try{
  const children=createChildDetailsService(f.pool,f.sessions),child=await children.createDependent({fullName:'Dependent',ageText:'8'},f.parentLogin.sessionToken);
  const own=await f.reads.account(f.parent.accountId,f.parentLogin.sessionToken);assert.deepEqual(Object.keys(own).sort(),['accountId','dependents','sessionVersion','status']);assert.deepEqual(own.dependents,[{id:child.id,fullName:'Dependent',canDeactivateTogether:true}]);
  await assert.rejects(f.reads.account(f.manager.accountId,f.parentLogin.sessionToken),{message:'FORBIDDEN'});
  for(const role of ['customer','instructor','reception','cafe_staff']){const a=await createAuthAccount(f.pool,role+'@example.test',[role]),login=await f.sessions.login({email:a.email,password},'127.0.0.3');await assert.rejects(f.reads.candidates({},login.sessionToken),{message:'FORBIDDEN'});await assert.rejects(f.reads.dependent(child.id,login.sessionToken),{message:'FORBIDDEN'});}
  assert.equal((await f.reads.account(f.parent.accountId,f.managerLogin.sessionToken)).accountId,f.parent.accountId);
  await assert.rejects(f.reads.candidates({limit:'26'},f.managerLogin.sessionToken),{message:'INVALID_REQUEST'});await assert.rejects(f.reads.candidates({cursor:'bad'},f.managerLogin.sessionToken),{message:'INVALID_REQUEST'});
  await f.pool.query('DELETE FROM account_roles WHERE account_id=$1',[f.manager.accountId]);await assert.rejects(f.reads.candidates({},f.managerLogin.sessionToken),{message:'FORBIDDEN'});
 }finally{await f.pool.end();}
});
test('dependent renewal reads follow latest provenance and lose finalizable consent when bindings change',async()=>{
 const f=await fixture();try{
  const child=await createChildDetailsService(f.pool,f.sessions).createDependent({fullName:'Inactive child',ageText:'7'},f.parentLogin.sessionToken),c=await f.pool.connect();try{await c.query('BEGIN');await c.query("UPDATE people SET status='inactive' WHERE id=$1",[child.id]);await c.query("UPDATE dependent_guardians SET ended_at=clock_timestamp(),end_reason='dependent_deactivated' WHERE dependent_person_id=$1",[child.id]);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  assert.deepEqual((await f.reads.candidates({limit:'1'},f.managerLogin.sessionToken)).items,[{id:child.id,fullName:'Inactive child'}]);
  const state=await f.reads.dependent(child.id,f.managerLogin.sessionToken);assert.equal(state.deactivationSequence,1);assert.deepEqual(state.guardians,[{accountId:f.parent.accountId,fullName:'Auth fixture',eligible:true,acceptedInvitationId:null}]);
  const renewal=createGuardianReactivationService(f.pool,f.config,f.sessions);await renewal.invite(child.id,{guardianAccountId:f.parent.accountId,expectedDeactivationSequence:1},f.managerLogin.sessionToken,'127.0.0.1');const o=(await f.pool.query('SELECT * FROM identity_email_outbox ORDER BY created_at DESC LIMIT 1')).rows[0],raw=JSON.parse(decryptOutboxPayload({keyId:o.key_id,nonce:o.nonce,authTag:o.auth_tag,ciphertext:o.ciphertext},{outboxId:o.id,actionTokenId:o.action_token_id,kind:'action',recipientHash:o.recipient_hash},f.config.secrets)).token;
  const accepted=await renewal.accept({token:raw},f.parentLogin.sessionToken,'127.0.0.2');assert.equal((await f.reads.dependent(child.id,f.managerLogin.sessionToken)).guardians[0].acceptedInvitationId,accepted.invitationId);assert.equal((await f.pool.query('SELECT status FROM people WHERE id=$1',[child.id])).rows[0].status,'inactive');
  await f.pool.query('UPDATE accounts SET session_version=session_version+1 WHERE id=$1',[f.parent.accountId]);assert.equal((await f.reads.dependent(child.id,f.managerLogin.sessionToken)).guardians[0].acceptedInvitationId,null);assert.equal((await f.pool.query('SELECT count(*)::int n FROM dependent_guardians WHERE dependent_person_id=$1 AND ended_at IS NULL',[child.id])).rows[0].n,0);
 }finally{await f.pool.end();}
});
