import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {authConfig,createAuthAccount,password} from './identity-auth-helpers.mjs';
import {createSessionService} from '../../dist/modules/identity/sessions.js';
import {createChildDetailsService} from '../../dist/modules/identity/child-details.js';
import {createGuardianInvitationService} from '../../dist/modules/identity/guardian-invitations.js';
import {createGuardianService} from '../../dist/modules/identity/guardians.js';
import {createFamilyInTransaction} from '../../dist/modules/identity/families.js';
import {decryptOutboxPayload} from '../../dist/modules/identity/outbox-crypto.js';
async function fixture(){const db=await isolatedDatabase();migrate(db.name);const config=authConfig(),sessions=await createSessionService(db.pool,config),children=createChildDetailsService(db.pool,sessions),invitations=createGuardianInvitationService(db.pool,config,sessions);
  async function account(email,roles=['customer']){return {...await createAuthAccount(db.pool,email,roles),...await sessions.login({email,password},'127.0.0.1')};}
  async function invite(child,parent,recipient,accept=true){await invitations.invite(child.id,{email:recipient.email},parent.sessionToken,'127.0.0.1');const o=(await db.pool.query('SELECT o.* FROM identity_email_outbox o JOIN identity_action_tokens t ON t.id=o.action_token_id WHERE t.recipient_email=$1 ORDER BY o.created_at DESC LIMIT 1',[recipient.email])).rows[0];const raw=JSON.parse(decryptOutboxPayload({keyId:o.key_id,nonce:o.nonce,authTag:o.auth_tag,ciphertext:o.ciphertext},{outboxId:o.id,actionTokenId:o.action_token_id,kind:'action',recipientHash:o.recipient_hash},config.secrets)).token;if(accept)await invitations.accept({token:raw},recipient.sessionToken,'127.0.0.1');return raw;}
  return {...db,config,sessions,children,invitations,account,invite,service:createGuardianService(db.pool,sessions)};
}
test('guardian removal permits self or management only, retains provenance and rejects the last active guardian',async()=>{
  const f=await fixture();try{
    const parent=await f.account('parent@example.test'),other=await f.account('other@example.test'),outsider=await f.account('outsider@example.test'),manager=await f.account('manager@example.test',['manager']);
    const child=await f.children.createDependent({fullName:'Private child',ageText:'8'},parent.sessionToken);await f.invite(child,parent,other);
    const page=await f.service.list(child.id,{},parent.sessionToken),mine=page.items.find(g=>g.accountId===parent.accountId),theirs=page.items.find(g=>g.accountId===other.accountId);
    assert.equal(mine.canRemove,true);assert.equal(theirs.canRemove,false);assert.deepEqual(Object.keys(mine).sort(),['accountId','canRemove','fullName','id']);
    await assert.rejects(f.service.list(child.id,{},outsider.sessionToken),{message:'NOT_FOUND'});
    await assert.rejects(f.service.remove(child.id,theirs.id,{},parent.sessionToken),{message:'FORBIDDEN'});
    const original=(await f.pool.query('SELECT * FROM dependent_guardians WHERE id=$1',[mine.id])).rows[0];
    assert.deepEqual(await f.service.remove(child.id,mine.id,{},parent.sessionToken),{dependentId:child.id,guardianRelationshipId:mine.id});
    await assert.rejects(f.children.getDependent(child.id,parent.sessionToken),{message:'NOT_FOUND'});assert.equal((await f.children.getDependent(child.id,other.sessionToken)).guardians.length,1);
    const ended=(await f.pool.query('SELECT * FROM dependent_guardians WHERE id=$1',[mine.id])).rows[0];assert.equal(ended.end_reason,'self_removed');assert.deepEqual({...ended,ended_at:null,end_reason:null},original);
    await assert.rejects(f.service.remove(child.id,theirs.id,{},manager.sessionToken),{message:'CONFLICT'});assert.equal((await f.pool.query('SELECT ended_at FROM dependent_guardians WHERE id=$1',[theirs.id])).rows[0].ended_at,null);
    assert.equal((await f.service.list(child.id,{},manager.sessionToken)).items[0].canRemove,true);await assert.rejects(f.children.getDependent(child.id,manager.sessionToken));
    const audit=(await f.pool.query("SELECT actor_id,changes FROM audit_events WHERE action='dependent.guardian_removed'")).rows;assert.equal(audit.length,1);assert.equal(audit[0].actor_id,parent.accountId);assert.ok(!JSON.stringify(audit).includes('Private child'));
  }finally{await f.pool.end();}
});
test('concurrent guardian removals serialize; pending invitations never count and audit failure rolls back authority',async()=>{
  const f=await fixture();try{
    const parent=await f.account('parent@example.test'),other=await f.account('other@example.test'),pending=await f.account('pending@example.test'),manager=await f.account('manager@example.test',['manager']);const child=await f.children.createDependent({fullName:'Child',ageText:'8'},parent.sessionToken);
    await f.invite(child,parent,pending,false);const mine=(await f.service.list(child.id,{},parent.sessionToken)).items[0];await assert.rejects(f.service.remove(child.id,mine.id,{},parent.sessionToken),{message:'CONFLICT'});
    await f.invite(child,parent,other);const all=(await f.service.list(child.id,{},manager.sessionToken)).items;
    await f.pool.query("CREATE FUNCTION reject_guardian_remove() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='dependent.guardian_removed' THEN RAISE EXCEPTION 'controlled guardian removal audit failure'; END IF; RETURN NEW; END $$");await f.pool.query('CREATE TRIGGER reject_guardian_remove BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_guardian_remove()');
    await assert.rejects(f.service.remove(child.id,mine.id,{},manager.sessionToken),{message:'controlled guardian removal audit failure'});assert.equal((await f.children.getDependent(child.id,parent.sessionToken)).guardians.length,2);await f.pool.query('DROP TRIGGER reject_guardian_remove ON audit_events');
    const blocker=await f.pool.connect();let results;try{
      await blocker.query('BEGIN');await blocker.query('SELECT id FROM accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[parent.accountId,other.accountId,manager.accountId]]);
      const attempts=Promise.allSettled(all.map(g=>f.service.remove(child.id,g.id,{},manager.sessionToken)));let waiting=0;
      for(let i=0;i<200&&waiting<2;i++){waiting=(await f.pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT id,person_id,status,confirmation_status,session_version FROM accounts%'")).rows[0].n;if(waiting<2)await new Promise(r=>setTimeout(r,10));}
      assert.equal(waiting,2,'Both removals reached the controlled lock barrier');await blocker.query('COMMIT');results=await attempts;
    }finally{await blocker.query('ROLLBACK');blocker.release();}
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.message,'CONFLICT');assert.equal((await f.service.list(child.id,{},manager.sessionToken)).items.length,1);
  }finally{await f.pool.end();}
});

test('management removal preserves child bookings/family, invalidates issuer links and cannot remove a replacement authorization',async()=>{
  const f=await fixture();try{
    const parent=await f.account('parent@example.test'),other=await f.account('other@example.test'),pending=await f.account('pending@example.test'),manager=await f.account('manager@example.test',['manager']);const child=await f.children.createDependent({fullName:'Child',ageText:'8'},parent.sessionToken);
    await f.invite(child,parent,other);const raw=await f.invite(child,parent,pending,false),original=(await f.service.list(child.id,{},manager.sessionToken)).items.find(g=>g.accountId===parent.accountId);
    const member=(await f.pool.query('INSERT INTO members(full_name,email,person_id) VALUES ($1,$2,$3) RETURNING id',['Parent',parent.email,parent.personId])).rows[0].id;
    const instructor=(await f.pool.query("INSERT INTO instructors(full_name) VALUES ('Teacher') RETURNING id")).rows[0].id,session=(await f.pool.query("INSERT INTO class_sessions(title,instructor_id,starts_at,duration_minutes,capacity) VALUES ('Yoga Kids',$1,now()+interval '1 day',60,16) RETURNING id",[instructor])).rows[0].id;
    const booking=(await f.pool.query("INSERT INTO bookings(member_id,class_session_id,acting_account_id,attendee_person_id,child_name_snapshot,child_age_snapshot) VALUES ($1,$2,$3,$4,'Child','8') RETURNING *",[member,session,parent.accountId,child.id])).rows[0];
    const client=await f.pool.connect();try{await client.query('BEGIN');await createFamilyInTransaction(client,{name:'Preserved family',creatorPersonId:parent.personId},{actor:{id:randomUUID(),type:'system'},reason:'Controlled family fixture',correlationId:randomUUID()});await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    const familyBefore=(await f.pool.query('SELECT * FROM family_memberships ORDER BY id')).rows;
    assert.equal(familyBefore.length,1);
    await f.service.remove(child.id,original.id,{},manager.sessionToken);assert.equal((await f.pool.query('SELECT end_reason FROM dependent_guardians WHERE id=$1',[original.id])).rows[0].end_reason,'removed');
    await assert.rejects(f.invitations.accept({token:raw},pending.sessionToken,'127.0.0.1'),{message:'INVALID_ACTION'});
    assert.deepEqual((await f.pool.query('SELECT * FROM bookings WHERE id=$1',[booking.id])).rows[0],booking);assert.deepEqual((await f.pool.query('SELECT * FROM family_memberships ORDER BY id')).rows,familyBefore);
    await f.invite(child,other,parent);await assert.rejects(f.service.remove(child.id,original.id,{},manager.sessionToken),{message:'NOT_FOUND'});assert.equal((await f.children.getDependent(child.id,parent.sessionToken)).guardians.length,2);
    const page=await f.service.list(child.id,{limit:'1'},manager.sessionToken);assert.ok(page.nextCursor);assert.equal((await f.service.list(child.id,{limit:'1',cursor:page.nextCursor},manager.sessionToken)).items.length,1);await assert.rejects(f.service.list(child.id,{limit:'51'},manager.sessionToken),{message:'INVALID_REQUEST'});
  }finally{await f.pool.end();}
});

test('guardian HTTP denies forged fields, private transport violations and ordinary other-guardian removal',async()=>{
  const f=await fixture();let server;const previous=process.env.DATABASE_URL;try{
    const parent=await f.account('parent@example.test'),other=await f.account('other@example.test'),manager=await f.account('manager@example.test',['manager']);const child=await f.children.createDependent({fullName:'HTTP child',ageText:'8'},parent.sessionToken);await f.invite(child,parent,other);const target=(await f.service.list(child.id,{},parent.sessionToken)).items.find(g=>g.accountId===other.accountId);
    process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused';const {createApplication}=await import('../../dist/app.js');server=(await createApplication({database:f.pool,identityConfig:f.config,environment:{NODE_ENV:'test'}})).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
    const base=`http://127.0.0.1:${server.address().port}/api/v1/dependents/${child.id}`,Origin='http://localhost:5173';
    const post=(value={},actor=parent,extra={})=>fetch(base+`/guardians/${target.id}/remove`,{method:'POST',headers:{Origin,'Content-Type':'application/json',Cookie:`conecta_session=${actor.sessionToken}`,'X-CSRF-Token':actor.csrfToken,...extra},body:JSON.stringify(value)});
    assert.equal((await post({},parent,{Origin:'https://evil.example'})).status,403);assert.equal((await post({},parent,{'X-CSRF-Token':''})).status,403);assert.equal((await post({},parent,{Cookie:''})).status,401);assert.equal((await post({reason:'x'.repeat(3000)})).status,413);assert.equal((await post({guardianAccountId:manager.accountId})).status,400);assert.equal((await post()).status,403);
    const get=await fetch(base+'/guardians',{headers:{Origin,Cookie:`conecta_session=${manager.sessionToken}`}});assert.equal(get.status,200);assert.equal(get.headers.get('cache-control'),'no-store');assert.ok((await get.json()).items.every(g=>g.canRemove));
    assert.equal((await post({},manager)).status,200);assert.equal((await post({},manager)).status,404);assert.equal((await fetch(base+'/guardians',{headers:{Origin,Cookie:`conecta_session=${other.sessionToken}`}})).status,404);
    const history=await fetch(`http://127.0.0.1:${server.address().port}/api/v1/audit`,{headers:{Origin,Cookie:`conecta_session=${manager.sessionToken}`}});assert.equal(history.status,200);
    const event=(await history.json()).events.find(row=>row.action==='dependent.guardian_removed');assert.ok(event);assert.equal(event.targetName,null);assert.deepEqual(event.changes.after,{guardianAccountId:other.accountId,guardianRelationshipId:target.id});assert.ok(!JSON.stringify(event).includes('HTTP child'));
  }finally{if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;if(server)await new Promise(r=>server.close(r));await f.pool.end();}
});

test('blocked removal rechecks revoked sessions and current management roles before mutating',async()=>{
  const f=await fixture(),blocker=await f.pool.connect();try{
    const parent=await f.account('parent@example.test'),other=await f.account('other@example.test'),manager=await f.account('manager@example.test',['manager']);const child=await f.children.createDependent({fullName:'Child',ageText:'8'},parent.sessionToken);await f.invite(child,parent,other);const mine=(await f.service.list(child.id,{},parent.sessionToken)).items.find(g=>g.accountId===parent.accountId);
    async function waitForAccounts(){let waiting=false;for(let i=0;i<200&&!waiting;i++){waiting=(await f.pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND (query LIKE 'SELECT id,person_id,status,confirmation_status,session_version FROM accounts%' OR query LIKE '%WHERE s.token_hash=$1 FOR UPDATE OF a%')")).rowCount>0;if(!waiting)await new Promise(r=>setTimeout(r,10));}assert.ok(waiting,'Removal reached controlled account lock');}
    await blocker.query('BEGIN');await blocker.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE',[parent.accountId]);const revoked=assert.rejects(f.service.remove(child.id,mine.id,{},parent.sessionToken),{message:'UNAUTHENTICATED'});await waitForAccounts();await blocker.query('UPDATE identity_sessions SET revoked_at=now() WHERE account_id=$1',[parent.accountId]);await blocker.query('COMMIT');await revoked;
    await blocker.query('BEGIN');await blocker.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE',[manager.accountId]);const demoted=assert.rejects(f.service.remove(child.id,mine.id,{},manager.sessionToken),{message:'NOT_FOUND'});await waitForAccounts();assert.equal((await blocker.query("DELETE FROM account_roles WHERE account_id=$1 AND role='manager'",[manager.accountId])).rowCount,1);await blocker.query("INSERT INTO account_roles(account_id,role) VALUES ($1,'reception')",[manager.accountId]);await blocker.query('COMMIT');await demoted;
    assert.equal((await f.pool.query('SELECT ended_at FROM dependent_guardians WHERE id=$1',[mine.id])).rows[0].ended_at,null);assert.equal((await f.pool.query("SELECT 1 FROM audit_events WHERE action='dependent.guardian_removed'")).rowCount,0);
  }finally{await blocker.query('ROLLBACK');blocker.release();await f.pool.end();}
});
