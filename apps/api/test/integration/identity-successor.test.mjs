import {endFamilyMembershipInTransaction,closeFamilyInTransaction} from './identity-family-lifecycle-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {authConfig,createAuthAccount,password} from './identity-auth-helpers.mjs';
import {createSessionService} from '../../dist/modules/identity/sessions.js';
import {createFamilyResponsibilityService} from '../../dist/modules/identity/family-responsibility.js';
import {createFamilyInTransaction,joinFamilyInTransaction} from '../../dist/modules/identity/families.js';
import {decryptOutboxPayload} from '../../dist/modules/identity/outbox-crypto.js';
import {createEmailOutboxWorker} from '../../dist/modules/identity/email-outbox.js';

async function fixture(){
  const db=await isolatedDatabase();migrate(db.name);const config=authConfig(),sessions=await createSessionService(db.pool,config);
  let now=new Date(Date.now()-120000);const service=createFamilyResponsibilityService(db.pool,config,sessions,{now:()=>now});
  async function account(email,roles=['customer']){const a=await createAuthAccount(db.pool,email,roles);return {...a,...await sessions.login({email,password},'127.0.0.1')};}
  const owner=await account('owner@example.test'),member=await account('member@example.test'),other=await account('other@example.test'),manager=await account('manager@example.test',['manager']);
  const system={actor:{id:'controlled-consent-fixture',type:'system'},reason:'Synthetic fixture consent',correlationId:randomUUID()};
  async function transaction(work){const c=await db.pool.connect();try{await c.query('BEGIN');const r=await work(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
  let family=await transaction(c=>createFamilyInTransaction(c,{name:'Successor family',creatorPersonId:owner.personId},system));
  for(const a of [member,other])family=await transaction(c=>joinFamilyInTransaction(c,{familyId:family.id,personId:a.personId,expectedVersion:family.version,acceptance:{invitationId:randomUUID(),acceptedByPersonId:a.personId,acceptedAt:new Date()}},system));
  async function token(email=member.email){const r=(await db.pool.query(`SELECT o.* FROM identity_email_outbox o JOIN identity_action_tokens t ON t.id=o.action_token_id WHERE t.purpose='family_successor' AND t.recipient_email=$1 AND o.status='pending' ORDER BY o.created_at DESC LIMIT 1`,[email])).rows[0];return JSON.parse(decryptOutboxPayload({keyId:r.key_id,nonce:r.nonce,authTag:r.auth_tag,ciphertext:r.ciphertext},{outboxId:r.id,actionTokenId:r.action_token_id,kind:'action',recipientHash:r.recipient_hash},config.secrets)).token;}
  // Login response exposes the session through resolve, not an untrusted input.
  async function actorContext(a){const s=await sessions.resolve(a.sessionToken);return {actor:{id:a.accountId,type:'customer'},session:{id:s.sessionId,version:s.sessionVersion},reason:'Controlled lifecycle test',correlationId:randomUUID()};}
  return {...db,config,sessions,service,owner,member,other,manager,family,transaction,system,token,actorContext,advance:ms=>{now=new Date(+now+ms);}};
}

test('successor consent changes responsibility only; pending, declined and unrelated offers grant no authority',async()=>{
  const f=await fixture();try{
    assert.equal((await f.service.state(f.family.id,f.owner.sessionToken)).canNominate,true);
    assert.equal((await f.service.state(f.family.id,f.member.sessionToken)).canNominate,false);
    await assert.rejects(f.service.nominate(f.family.id,{email:f.other.email},f.member.sessionToken,'127.0.0.1'),{message:'FORBIDDEN'});
    await f.service.nominate(f.family.id,{email:f.member.email},f.owner.sessionToken,'127.0.0.1');const raw=await f.token();
    await assert.rejects(f.service.accept({token:raw},f.other.sessionToken,'127.0.0.1'),{message:'INVALID_ACTION'});
    assert.equal((await f.service.preview({token:raw},f.member.sessionToken)).family.name,'Successor family');
    const memberContext=await f.actorContext(f.member);
    await assert.rejects(f.transaction(c=>closeFamilyInTransaction(c,{familyId:f.family.id,expectedVersion:2},memberContext,async()=>{})),{message:'FORBIDDEN'});
    await f.service.decline({token:raw},f.member.sessionToken,'127.0.0.1');
    assert.equal((await f.pool.query('SELECT responsible_membership_id FROM families WHERE id=$1',[f.family.id])).rows[0].responsible_membership_id,f.family.responsibleMembershipId);
    await assert.rejects(f.service.accept({token:raw},f.member.sessionToken,'127.0.0.1'),{message:'INVALID_ACTION'});
    f.advance(60000);await f.service.nominate(f.family.id,{email:f.member.email},f.owner.sessionToken,'127.0.0.1');const fresh=await f.token();
    const accepted=await f.service.accept({token:fresh},f.member.sessionToken,'127.0.0.1');
    const membership=(await f.pool.query('SELECT id FROM family_memberships WHERE person_id=$1 AND ended_at IS NULL',[f.member.personId])).rows[0].id;
    assert.equal(accepted.responsibleMembershipId,membership);assert.equal(accepted.createdByPersonId,f.owner.personId);
    assert.deepEqual((await f.sessions.resolve(f.member.sessionToken)).account.roles,['customer']);
    assert.equal((await f.service.state(f.family.id,f.owner.sessionToken)).canNominate,false);
    const ownerContext=await f.actorContext(f.owner);
    await assert.rejects(f.transaction(c=>closeFamilyInTransaction(c,{familyId:f.family.id,expectedVersion:accepted.version},ownerContext,async()=>{})),{message:'FORBIDDEN'});
  }finally{await f.pool.end();}
});

test('replacements, cooldown/hour limits, exact expiry and concurrent redemption preserve single consent',async()=>{
  const f=await fixture();try{
    await f.service.nominate(f.family.id,{email:f.member.email},f.owner.sessionToken,'127.0.0.1');const first=await f.token();
    await f.service.nominate(f.family.id,{email:f.member.email},f.owner.sessionToken,'127.0.0.1');assert.equal(await f.token(),first);
    for(let i=0;i<4;i++){f.advance(60000);await f.service.nominate(f.family.id,{email:f.member.email},f.owner.sessionToken,'127.0.0.1');}
    const fifth=await f.token();assert.notEqual(first,fifth);await assert.rejects(f.service.preview({token:first},f.member.sessionToken),{message:'INVALID_ACTION'});
    f.advance(60000);await f.service.nominate(f.family.id,{email:f.member.email},f.owner.sessionToken,'127.0.0.1');assert.equal(await f.token(),fifth);
    const expires=(await f.pool.query('SELECT expires_at FROM identity_action_tokens WHERE token_hash=$1',[createHash('sha256').update(fifth).digest()])).rows[0].expires_at;
    // This fixture clock began two minutes before wall time and advanced five minutes.
    f.advance(7*24*3600000-60000);await assert.rejects(f.service.preview({token:fifth},f.member.sessionToken),{message:'INVALID_ACTION'});
    assert.ok(expires instanceof Date);
    await f.service.nominate(f.family.id,{email:f.other.email},f.manager.sessionToken,'127.0.0.1');const fresh=await f.token(f.other.email);
    const results=await Promise.allSettled([f.service.accept({token:fresh},f.other.sessionToken,'127.0.0.1'),f.service.decline({token:fresh},f.other.sessionToken,'127.0.0.1')]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.message==='INVALID_ACTION').length,1);
  }finally{await f.pool.end();}
});

test('membership changes invalidate offers; declining does not block departure, departed creators lose authority and last-member fallback remains',async()=>{
  const f=await fixture();try{
    await f.service.nominate(f.family.id,{email:f.member.email},f.owner.sessionToken,'127.0.0.1');const raw=await f.token();
    const ownerContext=await f.actorContext(f.owner);let coordinated=false;
    let changed=await f.transaction(c=>endFamilyMembershipInTransaction(c,{familyId:f.family.id,membershipId:f.family.responsibleMembershipId,expectedVersion:2,operation:'leave'},ownerContext,async()=>{coordinated=true;}));
    assert.ok(coordinated);assert.equal(changed.responsibleMembershipId,null);
    await assert.rejects(f.service.preview({token:raw},f.member.sessionToken),{message:'INVALID_ACTION'});
    await assert.rejects(f.service.state(f.family.id,f.owner.sessionToken),{message:'FORBIDDEN'});
    await assert.rejects(f.transaction(c=>closeFamilyInTransaction(c,{familyId:f.family.id,expectedVersion:changed.version},ownerContext,async()=>{})),{message:'FORBIDDEN'});
    const otherMembership=(await f.pool.query('SELECT id FROM family_memberships WHERE person_id=$1',[f.other.personId])).rows[0].id;
    changed=await f.transaction(c=>endFamilyMembershipInTransaction(c,{familyId:f.family.id,membershipId:otherMembership,expectedVersion:changed.version,operation:'leave'},f.system,async()=>{}));
    await f.service.nominate(f.family.id,{email:f.member.email},f.manager.sessionToken,'127.0.0.1'); // Pending successor cannot remove last-member fallback.
    const memberContext=await f.actorContext(f.member);
    assert.equal((await f.transaction(c=>closeFamilyInTransaction(c,{familyId:f.family.id,expectedVersion:changed.version},memberContext,async()=>{}))).status,'closed');
  }finally{await f.pool.end();}
});

test('blocking token locks cannot extend expiry; obsolete offer delivery is cancelled before SMTP',async()=>{
  const f=await fixture();let blocker,worker;try{
    await f.service.nominate(f.family.id,{email:f.member.email},f.owner.sessionToken,'127.0.0.1');const raw=await f.token();
    blocker=await f.pool.connect();await blocker.query('BEGIN');await blocker.query('SELECT id FROM identity_action_tokens WHERE token_hash=$1 FOR UPDATE',[createHash('sha256').update(raw).digest()]);
    const result=f.service.accept({token:raw},f.member.sessionToken,'127.0.0.1').then(value=>({value}),error=>({error}));
    let waiting=false;for(let attempt=0;attempt<100;attempt++){
      waiting=(await f.pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FROM identity_action_tokens WHERE token_hash=%'")).rowCount>0;
      if(waiting)break;await new Promise(r=>setTimeout(r,20));
    }
    if(!waiting){await blocker.query('ROLLBACK');await result;assert.fail('Consent must actually wait on the token lock');}
    f.advance(7*24*3600000);await blocker.query('COMMIT');assert.equal((await result).error.message,'INVALID_ACTION');
    // A departed issuer invalidates the domain policy even when the worker uses real time.
    const c=await f.actorContext(f.owner);await f.transaction(client=>endFamilyMembershipInTransaction(client,{familyId:f.family.id,membershipId:f.family.responsibleMembershipId,expectedVersion:2,operation:'leave'},c,async()=>{}));
    let sends=0;worker=createEmailOutboxWorker(f.pool,f.config,{send:async()=>{sends++;}});await worker.runBatch();assert.equal(sends,0);
    const outbox=(await f.pool.query('SELECT status,ciphertext FROM identity_email_outbox')).rows[0];assert.equal(outbox.status,'cancelled');assert.equal(outbox.ciphertext,null);
  }finally{worker?.close();if(blocker){await blocker.query('ROLLBACK');blocker.release();}await f.pool.end();}
});

test('audit rollback and recipient/issuer changes deny obsolete consent without changing responsibility',async()=>{
  const f=await fixture();try{
    await f.service.nominate(f.family.id,{email:f.member.email},f.owner.sessionToken,'127.0.0.1');const raw=await f.token();
    await f.pool.query(`CREATE FUNCTION reject_successor_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='family.responsibility_accepted' THEN RAISE EXCEPTION 'controlled audit rejection'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_successor_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_successor_audit()`);
    await assert.rejects(f.service.accept({token:raw},f.member.sessionToken,'127.0.0.1'),/controlled audit rejection/);
    assert.equal((await f.pool.query('SELECT responsible_membership_id FROM families WHERE id=$1',[f.family.id])).rows[0].responsible_membership_id,f.family.responsibleMembershipId);
    assert.equal((await f.pool.query("SELECT status FROM family_successor_offers WHERE status='pending'")).rowCount,1);
    assert.equal((await f.pool.query("SELECT consumed_at FROM identity_action_tokens WHERE purpose='family_successor'")).rows[0].consumed_at,null);
    await f.pool.query('DROP TRIGGER reject_successor_audit ON audit_events');
    await f.pool.query('UPDATE accounts SET email=$2 WHERE id=$1',[f.member.accountId,'new@example.test']);await assert.rejects(f.service.preview({token:raw},f.member.sessionToken),{message:'INVALID_ACTION'});
    await f.pool.query('UPDATE accounts SET email=$2 WHERE id=$1',[f.member.accountId,f.member.email]);
    await f.pool.query('UPDATE accounts SET session_version=session_version+1 WHERE id=$1',[f.owner.accountId]);await assert.rejects(f.service.preview({token:raw},f.member.sessionToken),{message:'INVALID_ACTION'});
    await assert.rejects(f.pool.query('DELETE FROM family_successor_offers'),/cannot be deleted/);
  }finally{await f.pool.end();}
});

test('successor HTTP is authenticated, Origin/CSRF guarded, strictly bounded and privately serialized',async()=>{
  const f=await fixture();let server;const previous=process.env.DATABASE_URL;try{
    process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused';const {createApplication}=await import('../../dist/app.js');
    server=(await createApplication({database:f.pool,identityConfig:f.config,environment:{NODE_ENV:'test'}})).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
    const base=`http://127.0.0.1:${server.address().port}/api/v1/families`,Origin='http://localhost:5173';
    const post=(path,body,actor=f.owner,extra={})=>fetch(base+path,{method:'POST',headers:{Origin,'Content-Type':'application/json',Cookie:`conecta_session=${actor.sessionToken}`,'X-CSRF-Token':actor.csrfToken,...extra},body:JSON.stringify(body)});
    const nominate=`/${f.family.id}/successor-offers`;
    assert.equal((await post(nominate,{email:f.member.email},f.owner,{Origin:'https://evil.example'})).status,403);
    assert.equal((await post(nominate,{email:f.member.email},f.owner,{'X-CSRF-Token':''})).status,403);
    assert.equal((await post(nominate,{email:f.member.email},f.owner,{Cookie:''})).status,401);
    assert.equal((await post(nominate,{email:f.member.email,role:'manager'})).status,400);
    assert.equal((await post(nominate,{email:'x'.repeat(3000)})).status,413);
    assert.equal((await post(nominate,{email:f.member.email},f.other)).status,403);
    assert.equal((await post(nominate,{email:'unknown@example.test'})).status,202);assert.equal((await f.pool.query('SELECT 1 FROM family_successor_offers')).rowCount,0);
    const sent=await post(nominate,{email:f.member.email});assert.equal(sent.status,202);assert.equal(sent.headers.get('cache-control'),'no-store');assert.deepEqual(await sent.json(),{code:'ACCEPTED'});const raw=await f.token();
    for(const decision of ['preview','accept','decline']){
      const path='/successor-offers/'+decision;
      assert.equal((await post(path,{token:raw},f.member,{'X-CSRF-Token':''})).status,403);
      assert.equal((await post(path,{token:raw},f.member,{Cookie:''})).status,401);
      assert.equal((await fetch(base+path)).status,404);
      assert.equal((await post(path,{token:raw},f.manager)).status,400);
    }
    const preview=await post('/successor-offers/preview',{token:raw},f.member);assert.deepEqual(Object.keys(await preview.json()).sort(),['expiresAt','family']);
    assert.equal((await post('/successor-offers/decline',{token:raw},f.member)).status,200);
    const replay=await post('/successor-offers/accept',{token:raw},f.member);assert.equal(replay.status,400);assert.deepEqual(await replay.json(),{code:'INVALID_ACTION'});
  }finally{if(server)await new Promise(r=>server.close(r));await f.pool.end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;}
});

test('V9 preserves populated V8 history and rejects missing offer-token binding',async()=>{
  const db=await isolatedDatabase();migrate(db.name,'-target=8');try{
    const owner=await createAuthAccount(db.pool,'upgrade-owner@example.test');
    const client=await db.pool.connect();let family;try{await client.query('BEGIN');family=await createFamilyInTransaction(client,{name:'Upgrade family',creatorPersonId:owner.personId},{actor:{id:'upgrade-fixture',type:'system'},reason:'Controlled migration test',correlationId:randomUUID()});await client.query('COMMIT');}finally{client.release();}
    const before=(await db.pool.query('SELECT * FROM family_memberships')).rows;migrate(db.name);migrate(db.name);assert.deepEqual((await db.pool.query('SELECT * FROM family_memberships')).rows,before);
    assert.equal((await db.pool.query('SELECT 1 FROM family_successor_offers')).rowCount,0);
    await assert.rejects(db.pool.query('INSERT INTO family_successor_offers(family_id,family_version,recipient_email,target_membership_id,issued_by_account_id,issuer_version,created_at) VALUES ($1,0,$2,$3,$4,0,now())',[family.id,owner.email,family.responsibleMembershipId,owner.accountId]),/Invalid family successor token binding/);
  }finally{await db.pool.end();}
});
