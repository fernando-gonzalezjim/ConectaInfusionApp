import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {authConfig,createAuthAccount,password} from './identity-auth-helpers.mjs';
import {createSessionService} from '../../dist/modules/identity/sessions.js';
import {createChildDetailsService} from '../../dist/modules/identity/child-details.js';
import {createGuardianInvitationService} from '../../dist/modules/identity/guardian-invitations.js';
import {decryptOutboxPayload} from '../../dist/modules/identity/outbox-crypto.js';
import {createEmailOutboxWorker} from '../../dist/modules/identity/email-outbox.js';
import {actionSubjectHash} from '../../dist/modules/identity/action-tokens.js';
async function fixture(){const db=await isolatedDatabase();migrate(db.name);const config=authConfig(),sessions=await createSessionService(db.pool,config);let time=new Date();
  async function account(email,roles=['customer']){const value=await createAuthAccount(db.pool,email,roles);return {...value,...await sessions.login({email,password},'127.0.0.1')};}
  async function raw(email){const row=(await db.pool.query('SELECT o.* FROM identity_email_outbox o JOIN identity_action_tokens t ON t.id=o.action_token_id WHERE t.recipient_email=$1 ORDER BY o.created_at DESC LIMIT 1',[email])).rows[0];return JSON.parse(decryptOutboxPayload({keyId:row.key_id,nonce:row.nonce,authTag:row.auth_tag,ciphertext:row.ciphertext},{outboxId:row.id,actionTokenId:row.action_token_id,kind:'action',recipientHash:row.recipient_hash},config.secrets)).token;}
  return {...db,config,sessions,account,raw,clock:()=>time,advance:ms=>{time=new Date(+time+ms);},children:createChildDetailsService(db.pool,sessions),service:createGuardianInvitationService(db.pool,config,sessions,{now:()=>time})};}

test('guardian consent binds dependent/mailbox, grants no pending access and accepts once without changing roles/family',async()=>{
  const f=await fixture();try{
    const parent=await f.account('parent@example.test'),recipient=await f.account('recipient@example.test'),other=await f.account('other@example.test'),manager=await f.account('manager@example.test',['manager']);
    const child=await f.children.createDependent({fullName:'Consent child',ageText:'8'},parent.sessionToken);
    await assert.rejects(f.service.invite(child.id,{email:recipient.email},other.sessionToken,'127.0.0.1'),{message:'NOT_FOUND'});
    assert.deepEqual(await f.service.invite(child.id,{email:recipient.email},parent.sessionToken,'127.0.0.1'),{code:'ACCEPTED'});const raw=await f.raw(recipient.email);
    await assert.rejects(f.children.getDependent(child.id,recipient.sessionToken),{message:'NOT_FOUND'});
    assert.equal((await f.service.preview({token:raw},recipient.sessionToken)).dependent.id,child.id);await assert.rejects(f.service.preview({token:raw},other.sessionToken),{message:'INVALID_ACTION'});
    const results=await Promise.allSettled([1,2].map(()=>f.service.accept({token:raw},recipient.sessionToken,'127.0.0.1')));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.message,'INVALID_ACTION');
    assert.equal((await f.children.getDependent(child.id,recipient.sessionToken)).guardians.length,2);
    assert.deepEqual((await f.pool.query('SELECT role FROM account_roles WHERE account_id=$1',[recipient.accountId])).rows,[{role:'customer'}]);assert.equal((await f.pool.query('SELECT count(*)::int n FROM family_memberships')).rows[0].n,0);
    f.advance(61000);assert.deepEqual(await f.service.invite(child.id,{email:other.email},manager.sessionToken,'127.0.0.1'),{code:'ACCEPTED'});await assert.rejects(f.children.getDependent(child.id,manager.sessionToken));
    const preview=await f.service.preview({token:await f.raw(other.email)},other.sessionToken);assert.deepEqual(Object.keys(preview.dependent).sort(),['fullName','id']);
    assert.equal((await f.service.assistTargets(parent.accountId,{},manager.sessionToken)).items[0].id,child.id);await assert.rejects(f.service.assistTargets(parent.accountId,{},other.sessionToken),{message:'FORBIDDEN'});
  }finally{await f.pool.end();}
});
test('guardian resends expire exactly, audit rollback is atomic and removed senders suppress delivery/acceptance',async()=>{
  const f=await fixture();try{
    const parent=await f.account('parent@example.test'),recipient=await f.account('recipient@example.test'),manager=await f.account('manager@example.test',['manager']);const child=await f.children.createDependent({fullName:'Child',ageText:'8'},parent.sessionToken);
    await f.service.invite(child.id,{email:recipient.email},parent.sessionToken,'127.0.0.1');const first=await f.raw(recipient.email);f.advance(61000);await f.service.invite(child.id,{email:recipient.email},parent.sessionToken,'127.0.0.1');const raw=await f.raw(recipient.email);assert.notEqual(raw,first);await assert.rejects(f.service.preview({token:first},recipient.sessionToken));
    await f.pool.query("CREATE FUNCTION reject_guardian_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='dependent.guardian_accepted' THEN RAISE EXCEPTION 'controlled guardian audit failure'; END IF; RETURN NEW; END $$");await f.pool.query('CREATE TRIGGER reject_guardian_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_guardian_audit()');
    await assert.rejects(f.service.accept({token:raw},recipient.sessionToken,'127.0.0.1'),{message:'controlled guardian audit failure'});assert.equal((await f.pool.query('SELECT count(*)::int n FROM dependent_guardians WHERE guardian_account_id=$1',[recipient.accountId])).rows[0].n,0);assert.equal((await f.pool.query('SELECT consumed_at FROM identity_action_tokens WHERE purpose=\'guardian_invitation\' AND revoked_at IS NULL')).rows[0].consumed_at,null);await f.pool.query('DROP TRIGGER reject_guardian_audit ON audit_events');
    f.advance(168*3600000);await assert.rejects(f.service.accept({token:raw},recipient.sessionToken,'127.0.0.1'),{message:'INVALID_ACTION'});
    await f.service.invite(child.id,{email:recipient.email},manager.sessionToken,'127.0.0.1');const obsolete=await f.raw(recipient.email);await f.pool.query("DELETE FROM account_roles WHERE account_id=$1 AND role='manager'",[manager.accountId]);
    const sent=[];const worker=createEmailOutboxWorker(f.pool,f.config,{now:f.clock,send:async message=>sent.push(message)});await worker.runBatch(10);assert.equal(sent.length,0);await assert.rejects(f.service.accept({token:obsolete},recipient.sessionToken,'127.0.0.1'),{message:'INVALID_ACTION'});
  }finally{await f.pool.end();}
});

test('guardian authority, lifecycle, recipient versions and deferred provenance fail closed',async()=>{
  const f=await fixture();try{
    const parent=await f.account('parent@example.test'),recipient=await f.account('recipient@example.test'),next=await f.account('next@example.test');
    const child=await f.children.createDependent({fullName:'Private child',ageText:'8'},parent.sessionToken);
    await assert.rejects(f.pool.query("INSERT INTO dependent_guardians(dependent_person_id,guardian_account_id,source,accepted_by_account_id,accepted_invitation_id) VALUES ($1,$2,'accepted_invitation',$2,$3)",[child.id,next.accountId,randomUUID()]),/consent is required/);
    await f.service.invite(child.id,{email:recipient.email},parent.sessionToken,'127.0.0.1');const raw=await f.raw(recipient.email);
    await f.service.accept({token:raw},recipient.sessionToken,'127.0.0.1');
    await assert.rejects(f.pool.query('UPDATE guardian_invitations SET accepted_at=accepted_at WHERE accepted_by_account_id=$1',[recipient.accountId]),/immutable/);
    await f.service.invite(child.id,{email:next.email},parent.sessionToken,'127.0.0.1');const pending=await f.raw(next.email);
    await f.pool.query("UPDATE dependent_guardians SET ended_at=clock_timestamp(),end_reason='self_removed' WHERE dependent_person_id=$1 AND guardian_account_id=$2",[child.id,parent.accountId]);
    await assert.rejects(f.service.accept({token:pending},next.sessionToken,'127.0.0.1'),{message:'INVALID_ACTION'});
    await assert.rejects(f.service.invite(child.id,{email:next.email},parent.sessionToken,'127.0.0.1'),{message:'NOT_FOUND'});
    f.advance(61000);await f.service.invite(child.id,{email:next.email},recipient.sessionToken,'127.0.0.1');const replaced=await f.raw(next.email);
    await f.pool.query('UPDATE accounts SET session_version=session_version+1 WHERE id=$1',[next.accountId]);const logged=await f.sessions.login({email:next.email,password},'127.0.0.1');
    await assert.rejects(f.service.accept({token:replaced},logged.sessionToken,'127.0.0.1'),{message:'INVALID_ACTION'});
    f.advance(61000);await f.service.invite(child.id,{email:next.email},recipient.sessionToken,'127.0.0.1');const beforeCycle=await f.raw(next.email);
    await f.pool.query("UPDATE people SET status='inactive' WHERE id=$1",[child.id]);
    await assert.rejects(f.service.preview({token:beforeCycle},logged.sessionToken),{message:'INVALID_ACTION'});
    assert.equal((await f.pool.query('SELECT deactivation_sequence FROM dependent_profiles WHERE person_id=$1',[child.id])).rows[0].deactivation_sequence,1);
    const leaked=JSON.stringify((await f.pool.query("SELECT changes FROM audit_events WHERE action LIKE 'dependent.guardian_%'")).rows);
    assert.ok(!leaked.includes('Private child')&&!leaked.includes('@example.test')&&!leaked.includes(pending));
  }finally{await f.pool.end();}
});

test('guardian issuance samples its seven-day window after a blocked send lock',async()=>{
  const f=await fixture();const blocker=await f.pool.connect();try{
    const parent=await f.account('parent@example.test'),recipient=await f.account('recipient@example.test');const child=await f.children.createDependent({fullName:'Child',ageText:'8'},parent.sessionToken);
    const hash=actionSubjectHash(f.config.secrets,'send',JSON.stringify(['guardian_invitation',recipient.email]));
    await blocker.query('BEGIN');await blocker.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['identity-action-send:'+hash.toString('hex')]);
    const issued=f.service.invite(child.id,{email:recipient.email},parent.sessionToken,'127.0.0.1');
    let waiting=false;for(let tries=0;tries<200&&!waiting;tries++){waiting=(await f.pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory' AND query LIKE 'SELECT pg_advisory_xact_lock%' ")).rowCount>0;if(!waiting)await new Promise(r=>setTimeout(r,10));}
    assert.ok(waiting,'Issuance reached the controlled send lock');f.advance(120000);await blocker.query('COMMIT');await issued;
    const row=(await f.pool.query("SELECT created_at,expires_at FROM identity_action_tokens WHERE purpose='guardian_invitation'")).rows[0];assert.equal(+row.created_at,+f.clock());assert.equal(+row.expires_at-+row.created_at,7*24*3600000);
  }finally{await blocker.query('ROLLBACK');blocker.release();await f.pool.end();}
});

test('guardian acceptance rechecks expiry after a blocked token lock and unknown mailboxes require confirmed customer access',async()=>{
  const f=await fixture();const blocker=await f.pool.connect();try{
    const parent=await f.account('parent@example.test');const child=await f.children.createDependent({fullName:'Child',ageText:'8'},parent.sessionToken);
    await f.service.invite(child.id,{email:'new@example.test'},parent.sessionToken,'127.0.0.1');const raw=await f.raw('new@example.test');
    assert.equal((await f.pool.query("SELECT count(*)::int n FROM accounts WHERE email='new@example.test'")).rows[0].n,0,'Invitation does not create an account');
    const recipient=await f.account('new@example.test');assert.equal((await f.service.preview({token:raw},recipient.sessionToken)).dependent.id,child.id);
    await blocker.query('BEGIN');await blocker.query("SELECT id FROM identity_action_tokens WHERE purpose='guardian_invitation' FOR UPDATE");
    const accepted=f.service.accept({token:raw},recipient.sessionToken,'127.0.0.1');const observed=assert.rejects(accepted,{message:'INVALID_ACTION'});
    let waiting=false;for(let tries=0;tries<200&&!waiting;tries++){waiting=(await f.pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FROM identity_action_tokens WHERE token_hash%' ")).rowCount>0;if(!waiting)await new Promise(r=>setTimeout(r,10));}
    assert.ok(waiting);f.advance(7*24*3600000);await blocker.query('COMMIT');await observed;
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM dependent_guardians WHERE guardian_account_id=$1',[recipient.accountId])).rows[0].n,0);
  }finally{await blocker.query('ROLLBACK');blocker.release();await f.pool.end();}
});

test('V11 preserves populated V10 synthetic history and rolls back conflicting DDL atomically',async()=>{
  const db=await isolatedDatabase();migrate(db.name,'-target=10');try{
    const parent=await createAuthAccount(db.pool,'parent@example.test'),other=await createAuthAccount(db.pool,'other@example.test');const child=randomUUID(),historical=randomUUID();const client=await db.pool.connect();
    try{await client.query('BEGIN');await client.query("INSERT INTO people(id,full_name) VALUES ($1,'Legacy child')",[child]);await client.query("INSERT INTO dependent_profiles(person_id,age_text,created_by_account_id) VALUES ($1,'8',$2)",[child,parent.accountId]);await client.query("INSERT INTO dependent_guardians(dependent_person_id,guardian_account_id,source,accepted_by_account_id) VALUES ($1,$2,'creation',$2)",[child,parent.accountId]);await client.query("INSERT INTO dependent_guardians(id,dependent_person_id,guardian_account_id,source,accepted_by_account_id,accepted_invitation_id) VALUES ($1,$2,$3,'accepted_invitation',$3,$4)",[historical,child,other.accountId,randomUUID()]);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    const before=(await db.pool.query('SELECT * FROM dependent_guardians WHERE id=$1',[historical])).rows[0];migrate(db.name);migrate(db.name);assert.deepEqual((await db.pool.query('SELECT * FROM dependent_guardians WHERE id=$1',[historical])).rows[0],before);assert.equal((await db.pool.query('SELECT reason FROM guardian_consent_exceptions WHERE relationship_id=$1',[historical])).rows[0].reason,'pre_v11');assert.equal((await db.pool.query('SELECT count(*)::int n FROM guardian_invitations')).rows[0].n,0);
    await assert.rejects(db.pool.query("INSERT INTO guardian_consent_exceptions(relationship_id,reason) VALUES ($1,'pre_v11')",[randomUUID()]),/guarded development/);
    await assert.rejects(db.pool.query('DELETE FROM guardian_consent_exceptions'),/immutable/);
  }finally{await db.pool.end();}
  const conflict=await isolatedDatabase();migrate(conflict.name,'-target=10');try{
    await conflict.pool.query('CREATE TABLE guardian_invitations(controlled_fixture boolean)');assert.throws(()=>migrate(conflict.name),/failed/i);
    assert.equal((await conflict.pool.query("SELECT to_regclass('guardian_consent_exceptions') AS value")).rows[0].value,null);assert.equal((await conflict.pool.query("SELECT count(*)::int n FROM flyway_schema_history WHERE version='11'")).rows[0].n,0);
  }finally{await conflict.pool.end();}
});

test('guardian HTTP guards private writes before parsing, bounds management reads and uses minimal consent DTOs',async()=>{
  const f=await fixture();let server;const previous=process.env.DATABASE_URL;try{
    const parent=await f.account('parent@example.test'),recipient=await f.account('recipient@example.test'),manager=await f.account('manager@example.test',['manager']);
    const child=await f.children.createDependent({fullName:'HTTP child',ageText:'8'},parent.sessionToken);
    process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused';const {createApplication}=await import('../../dist/app.js');
    server=(await createApplication({database:f.pool,identityConfig:f.config,environment:{NODE_ENV:'test'}})).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
    const base=`http://127.0.0.1:${server.address().port}/api/v1/dependents`,Origin='http://localhost:5173';
    const post=(path,body,actor=parent,extra={})=>fetch(base+path,{method:'POST',headers:{Origin,'Content-Type':'application/json',Cookie:`conecta_session=${actor.sessionToken}`,'X-CSRF-Token':actor.csrfToken,...extra},body:JSON.stringify(body)});
    for(const path of [`/${child.id}/guardian-invitations`,'/guardian-invitations/preview','/guardian-invitations/accept']){
      assert.equal((await post(path,{},parent,{Origin:'https://evil.example'})).status,403);
      assert.equal((await post(path,{},parent,{'X-CSRF-Token':''})).status,403);
      assert.equal((await post(path,{},parent,{Cookie:''})).status,401);
      assert.equal((await post(path,{token:'x'.repeat(3000)})).status,413);
      assert.equal((await post(path,{email:recipient.email,roles:['manager']})).status,400);
    }
    const sent=await post(`/${child.id}/guardian-invitations`,{email:recipient.email});assert.equal(sent.status,202);assert.equal(sent.headers.get('cache-control'),'no-store');assert.deepEqual(await sent.json(),{code:'ACCEPTED'});
    const raw=await f.raw(recipient.email);assert.equal((await post('/guardian-invitations/preview',{token:raw})).status,400);
    const preview=await post('/guardian-invitations/preview',{token:raw},recipient);assert.equal(preview.status,200);assert.deepEqual(Object.keys((await preview.json()).dependent).sort(),['fullName','id']);
    const get=(actor,query='')=>fetch(base+`/guardian-invitations/for-account/${parent.accountId}`+query,{headers:{Origin,Cookie:`conecta_session=${actor.sessionToken}`}});
    assert.equal((await get(parent)).status,403);assert.equal((await get(manager,'?limit=51')).status,400);assert.deepEqual((await (await get(manager)).json()).items,[{id:child.id,fullName:'HTTP child'}]);
    assert.deepEqual(await (await post('/guardian-invitations/accept',{token:raw},recipient)).json(),{dependentId:child.id});
    assert.equal((await post('/guardian-invitations/accept',{token:raw},recipient)).status,400);
  }finally{if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;if(server)await new Promise(r=>server.close(r));await f.pool.end();}
});
