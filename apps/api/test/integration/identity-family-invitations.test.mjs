import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {authConfig,createAuthAccount,password} from './identity-auth-helpers.mjs';
import {createSessionService} from '../../dist/modules/identity/sessions.js';
import {createFamilyInvitationService} from '../../dist/modules/identity/family-invitations.js';
import {decryptOutboxPayload} from '../../dist/modules/identity/outbox-crypto.js';
import {createEmailOutboxWorker} from '../../dist/modules/identity/email-outbox.js';
import {createFamilyInTransaction,joinFamilyInTransaction} from '../../dist/modules/identity/families.js';

test('V8 upgrades populated V7 families without inventing invitations or changing legacy consent',async()=>{
  const db=await isolatedDatabase();migrate(db.name,'-target=7');let client;
  try{
    const owner=await createAuthAccount(db.pool,'upgrade-owner@example.test'),member=await createAuthAccount(db.pool,'upgrade-member@example.test');
    const context={actor:{id:'controlled-upgrade-fixture',type:'system'},reason:'Synthetic historical consent',correlationId:randomUUID()};
    client=await db.pool.connect();await client.query('BEGIN');
    const group=await createFamilyInTransaction(client,{name:'Historical family',creatorPersonId:owner.personId},context),consentId=randomUUID();
    await joinFamilyInTransaction(client,{familyId:group.id,personId:member.personId,expectedVersion:0,
      acceptance:{invitationId:consentId,acceptedByPersonId:member.personId,acceptedAt:new Date()}},context);
    await client.query('COMMIT');client.release();client=null;
    const before=(await db.pool.query('SELECT * FROM family_memberships ORDER BY id')).rows;
    migrate(db.name);migrate(db.name);
    assert.deepEqual((await db.pool.query('SELECT * FROM family_memberships ORDER BY id')).rows,before);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM family_invitations')).rows[0].n,0);
    assert.equal((await db.pool.query('SELECT version FROM families WHERE id=$1',[group.id])).rows[0].version,1);
    await assert.rejects(db.pool.query('INSERT INTO family_invitations(family_id,recipient_email,issued_by_account_id) VALUES ($1,$2,$3)',[group.id,'missing-token@example.test',owner.accountId]),/Invalid family invitation token binding/);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM family_invitations')).rows[0].n,0);
  }finally{if(client){await client.query('ROLLBACK');client.release();}await db.pool.end();}
});

async function fixture(){
  const db=await isolatedDatabase();migrate(db.name);const config=authConfig();let now=new Date(Date.now()-120000);
  const sessions=await createSessionService(db.pool,config);
  const service=createFamilyInvitationService(db.pool,config,sessions,{now:()=>now});
  async function account(email,roles=['customer']){const actor=await createAuthAccount(db.pool,email,roles);
    const login=await sessions.login({email,password},'127.0.0.1');return {...actor,...login};}
  async function token(email){const row=(await db.pool.query(`SELECT o.* FROM identity_email_outbox o JOIN identity_action_tokens t
    ON t.id=o.action_token_id WHERE t.purpose='family_invitation' AND t.recipient_email=$1 AND o.status='pending'
    ORDER BY o.created_at DESC,o.id LIMIT 1`,[email])).rows[0];
    return JSON.parse(decryptOutboxPayload({keyId:row.key_id,nonce:row.nonce,authTag:row.auth_tag,ciphertext:row.ciphertext},
      {outboxId:row.id,actionTokenId:row.action_token_id,kind:'action',recipientHash:row.recipient_hash},config.secrets)).token;}
  return {...db,config,sessions,service,account,token,now:()=>now,advance:ms=>{now=new Date(+now+ms);}};
}

test('family invitations require recipient consent; members and management may invite without granting roles or guardianship',async()=>{
  const f=await fixture();try{
    const owner=await f.account('owner@example.test'),member=await f.account('member@example.test');
    const outsider=await f.account('outside@example.test'),manager=await f.account('manager@example.test',['manager']);
    const group=await f.service.create({name:'Consent family'},owner.sessionToken);
    await assert.rejects(f.service.forAccount(owner.accountId,outsider.sessionToken),{message:'FORBIDDEN'});
    assert.equal((await f.service.forAccount(owner.accountId,manager.sessionToken)).family.id,group.id);
    assert.equal((await f.service.forAccount(member.accountId,manager.sessionToken)).family,null);
    assert.equal((await f.service.current(owner.sessionToken)).family.id,group.id);
    await assert.rejects(f.service.create({name:'Another'},owner.sessionToken),{message:'CONFLICT'});
    await assert.rejects(f.service.create({name:'Other person',creatorPersonId:owner.personId},manager.sessionToken),{message:'INVALID_REQUEST'});
    await assert.rejects(f.service.invite(group.id,{email:member.email},outsider.sessionToken,'127.0.0.1'),{message:'FORBIDDEN'});
    assert.deepEqual(await f.service.invite(group.id,{email:member.email},owner.sessionToken,'127.0.0.1'),{code:'ACCEPTED'});
    const link=await f.token(member.email);
    assert.equal((await f.service.current(member.sessionToken)).family,null);
    await assert.rejects(f.service.get(group.id,member.sessionToken),{message:'FORBIDDEN'});
    await assert.rejects(f.service.accept({token:link},manager.sessionToken,'127.0.0.1'),{message:'INVALID_ACTION'});
    await assert.rejects(f.service.accept({token:link},outsider.sessionToken,'127.0.0.1'),{message:'INVALID_ACTION'});
    assert.equal((await f.service.preview({token:link},member.sessionToken)).family.name,'Consent family');
    assert.equal((await f.service.current(member.sessionToken)).family,null); // Preview never accepts.
    const accepted=await f.service.accept({token:link},member.sessionToken,'127.0.0.1');assert.equal(accepted.id,group.id);
    await assert.rejects(f.service.accept({token:link},member.sessionToken,'127.0.0.1'),{message:'INVALID_ACTION'});
    assert.deepEqual((await f.sessions.resolve(member.sessionToken)).account.roles,['customer']);
    const tokenCount=(await f.pool.query('SELECT count(*)::int n FROM identity_action_tokens')).rows[0].n;
    await f.service.invite(group.id,{email:member.email},owner.sessionToken,'127.0.0.1');
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM identity_action_tokens')).rows[0].n,tokenCount);
    // Ordinary accepted members may invite; responsibility is not needed.
    await f.service.invite(group.id,{email:outsider.email},member.sessionToken,'127.0.0.1');
    await f.service.accept({token:await f.token(outsider.email)},outsider.sessionToken,'127.0.0.1');
    const assisted=await f.account('assisted@example.test');
    await f.service.invite(group.id,{email:assisted.email},manager.sessionToken,'127.0.0.1');
    assert.equal((await f.service.current(assisted.sessionToken)).family,null);
    await f.service.accept({token:await f.token(assisted.email)},assisted.sessionToken,'127.0.0.1');
    const saved=(await f.pool.query('SELECT * FROM family_memberships WHERE person_id=$1',[member.personId])).rows[0];
    assert.equal(saved.accepted_by_person_id,member.personId);assert.equal(saved.source,'accepted_invitation');
    assert.equal((await f.pool.query('SELECT accepted_by_person_id FROM family_invitations WHERE id=$1',[saved.accepted_invitation_id])).rows[0].accepted_by_person_id,member.personId);
    const audit=JSON.stringify((await f.pool.query("SELECT * FROM audit_events WHERE target_type='family'")).rows);
    assert.ok(audit.includes('family.invitation_sent'));assert.equal(audit.includes(link),false);
  }finally{await f.pool.end();}
});

test('family resend allows five sends per hour, silently limits the sixth, and resets after the window',async()=>{
  const f=await fixture();try{
    const owner=await f.account('owner@example.test'),recipient=await f.account('resend@example.test');
    const group=await f.service.create({name:'Resend family'},owner.sessionToken);
    const links=[];
    for(let attempt=0;attempt<5;attempt++){
      if(attempt)f.advance(61000);
      await f.service.invite(group.id,{email:recipient.email},owner.sessionToken,'127.0.0.1');links.push(await f.token(recipient.email));
    }
    assert.equal(new Set(links).size,5);f.advance(61000);
    assert.deepEqual(await f.service.invite(group.id,{email:recipient.email},owner.sessionToken,'127.0.0.1'),{code:'ACCEPTED'});
    assert.equal(await f.token(recipient.email),links[4]);
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM family_invitations')).rows[0].n,1);
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM identity_action_tokens')).rows[0].n,5);
    f.advance(3600000);await f.service.invite(group.id,{email:recipient.email},owner.sessionToken,'127.0.0.1');
    assert.notEqual(await f.token(recipient.email),links[4]);
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM identity_action_tokens WHERE revoked_at IS NULL')).rows[0].n,1);
  }finally{await f.pool.end();}
});

test('family acceptance samples expiration after waiting for the token lock',async()=>{
  const f=await fixture();let blocker;try{
    const owner=await f.account('owner@example.test'),recipient=await f.account('waiting@example.test');
    const group=await f.service.create({name:'Expiry barrier'},owner.sessionToken);
    await f.service.invite(group.id,{email:recipient.email},owner.sessionToken,'127.0.0.1');const link=await f.token(recipient.email);
    blocker=await f.pool.connect();await blocker.query('BEGIN');await blocker.query("SELECT id FROM identity_action_tokens WHERE purpose='family_invitation' FOR UPDATE");
    const result=f.service.accept({token:link},recipient.sessionToken,'127.0.0.1').then(value=>({value}),error=>({error}));
    let waiting=false;
    for(let attempt=0;attempt<100;attempt++){
      waiting=(await f.pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FROM identity_action_tokens WHERE token_hash=%'")).rowCount>0;
      if(waiting)break;await new Promise(resolve=>setTimeout(resolve,20));
    }
    if(!waiting){await blocker.query('ROLLBACK');await result;assert.fail('Redemption must actually wait on the token lock');}
    f.advance(7*86400000);await blocker.query('COMMIT');assert.equal((await result).error?.message,'INVALID_ACTION');
    assert.equal((await f.pool.query("SELECT consumed_at FROM identity_action_tokens WHERE purpose='family_invitation'")).rows[0].consumed_at,null);
    assert.equal((await f.service.current(recipient.sessionToken)).family,null);
  }finally{if(blocker){await blocker.query('ROLLBACK');blocker.release();}await f.pool.end();}
});

test('family invitation expiry, resend invalidation, simultaneous acceptance and unrelated joins',async()=>{
  const f=await fixture();try{
    const owner=await f.account('owner@example.test'),one=await f.account('one@example.test'),two=await f.account('two@example.test');
    const group=await f.service.create({name:'Race family'},owner.sessionToken);
    await f.service.invite(group.id,{email:one.email},owner.sessionToken,'127.0.0.1');const first=await f.token(one.email);
    assert.deepEqual(await f.service.invite(group.id,{email:one.email},owner.sessionToken,'127.0.0.1'),{code:'ACCEPTED'});
    assert.equal(await f.token(one.email),first);f.advance(61000);
    await f.service.invite(group.id,{email:one.email},owner.sessionToken,'127.0.0.1');const replacement=await f.token(one.email);assert.notEqual(first,replacement);
    await assert.rejects(f.service.accept({token:first},one.sessionToken,'127.0.0.1'),{message:'INVALID_ACTION'});
    await f.service.invite(group.id,{email:two.email},owner.sessionToken,'127.0.0.1');const second=await f.token(two.email);
    const results=await Promise.allSettled([f.service.accept({token:replacement},one.sessionToken,'127.0.0.1'),f.service.accept({token:replacement},one.sessionToken,'127.0.0.1')]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.message,'INVALID_ACTION');
    await f.service.accept({token:second},two.sessionToken,'127.0.0.1'); // Another join must not invalidate it.
    const expiring=await f.account('expire@example.test');
    await f.service.invite(group.id,{email:expiring.email},owner.sessionToken,'127.0.0.1');const expired=await f.token(expiring.email);
    const tokenRow=(await f.pool.query('SELECT created_at,expires_at FROM identity_action_tokens WHERE token_hash=$1',[createHash('sha256').update(expired).digest()])).rows[0];
    assert.equal(+tokenRow.expires_at-+tokenRow.created_at,7*86400000);
    // Advance only invitation clock: fixture sessions are deliberately kept valid in real time.
    f.advance(7*86400000);
    await assert.rejects(f.service.accept({token:expired},expiring.sessionToken,'127.0.0.1'),{message:'INVALID_ACTION'});
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM family_memberships WHERE person_id=$1',[expiring.personId])).rows[0].n,0);
  }finally{await f.pool.end();}
});

test('family invitation supports registration after invitation and blocks another family without consuming consent',async()=>{
  const f=await fixture();try{
    const owner=await f.account('owner@example.test');const group=await f.service.create({name:'Future account'},owner.sessionToken);
    await f.service.invite(group.id,{email:'future@example.test'},owner.sessionToken,'127.0.0.1');const link=await f.token('future@example.test');
    assert.equal((await f.pool.query("SELECT count(*)::int n FROM accounts WHERE email='future@example.test'")).rows[0].n,0);
    const recipient=await f.account('future@example.test');await f.service.create({name:'Already joined'},recipient.sessionToken);
    await assert.rejects(f.service.accept({token:link},recipient.sessionToken,'127.0.0.1'),{message:'CONFLICT'});
    assert.equal((await f.pool.query("SELECT consumed_at FROM identity_action_tokens WHERE purpose='family_invitation'")).rows[0].consumed_at,null);
    assert.equal((await f.pool.query("SELECT accepted_at FROM family_invitations")).rows[0].accepted_at,null);
  }finally{await f.pool.end();}
});

test('family invitation sender/recipient changes suppress delivery and acceptance; audit failure rolls back token and membership',async()=>{
  const f=await fixture();try{
    const owner=await f.account('owner@example.test'),recipient=await f.account('recipient@example.test');
    const group=await f.service.create({name:'Rollback family'},owner.sessionToken);
    await f.service.invite(group.id,{email:recipient.email},owner.sessionToken,'127.0.0.1');const link=await f.token(recipient.email);
    await f.pool.query(`CREATE FUNCTION fail_family_join() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.action='family.member_joined' THEN RAISE EXCEPTION 'controlled audit failure'; END IF;RETURN NEW;END $$;
      CREATE TRIGGER fail_family_join BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION fail_family_join()`);
    await assert.rejects(f.service.accept({token:link},recipient.sessionToken,'127.0.0.1'),{message:'controlled audit failure'});
    assert.equal((await f.pool.query("SELECT consumed_at FROM identity_action_tokens WHERE purpose='family_invitation'")).rows[0].consumed_at,null);
    assert.equal((await f.service.current(recipient.sessionToken)).family,null);
    await f.pool.query('DROP TRIGGER fail_family_join ON audit_events; DROP FUNCTION fail_family_join()');
    await f.pool.query("UPDATE accounts SET email='changed@example.test',session_version=session_version+1 WHERE id=$1",[recipient.accountId]);
    const changed=await f.sessions.login({email:'changed@example.test',password},'127.0.0.1');
    await assert.rejects(f.service.accept({token:link},changed.sessionToken,'127.0.0.1'),{message:'INVALID_ACTION'});
    let deliveries=0;const worker=createEmailOutboxWorker(f.pool,f.config,{send:async()=>{deliveries++;}});
    await worker.runBatch();assert.equal(deliveries,0);
    const next=await f.account('next@example.test');await f.service.invite(group.id,{email:next.email},owner.sessionToken,'127.0.0.1');const stale=await f.token(next.email);
    await f.pool.query("DELETE FROM account_roles WHERE account_id=$1 AND role='customer'",[owner.accountId]);
    await assert.rejects(f.service.accept({token:stale},next.sessionToken,'127.0.0.1'),{message:'INVALID_ACTION'});
    await worker.runBatch();assert.equal(deliveries,0);
  }finally{await f.pool.end();}
});

test('family invitation HTTP guards, private DTOs and immutable accepted provenance',async()=>{
  const f=await fixture();let server;const originalEnvironment={DATABASE_URL:process.env.DATABASE_URL,IDENTITY_ENABLED:process.env.IDENTITY_ENABLED};try{
    const owner=await f.account('http-owner@example.test'),recipient=await f.account('http-recipient@example.test');
    process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused';process.env.IDENTITY_ENABLED='false';
    const {createApplication}=await import('../../dist/app.js');
    server=(await createApplication({database:f.pool,identityConfig:f.config,environment:{NODE_ENV:'test'}})).listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}/api/v1/families`;
    const Origin='http://localhost:5173';
    const post=(path,value,actor=owner,extra={})=>fetch(base+path,{method:'POST',headers:{Origin,'Content-Type':'application/json',Cookie:`conecta_session=${actor.sessionToken}`,'X-CSRF-Token':actor.csrfToken,...extra},body:JSON.stringify(value)});
    for(const headers of [{Origin:'https://evil.example'},{'X-CSRF-Token':''}])assert.equal((await post('',{name:'Blocked'},owner,headers)).status,403);
    assert.equal((await post('',{name:'Blocked'},owner,{Cookie:''})).status,401);
    assert.equal((await post('',{name:'x'.repeat(3000)})).status,413);
    assert.equal((await post('',{name:'Forbidden fields',roles:['manager']})).status,400);
    const created=await post('',{name:'HTTP family'});assert.equal(created.status,201);assert.equal(created.headers.get('cache-control'),'no-store');const group=await created.json();
    assert.deepEqual(Object.keys(group).sort(),['createdByPersonId','id','name','responsibleMembershipId','status','version']);
    assert.equal((await post(`/${group.id}/invitations`,{email:recipient.email})).status,202);
    const link=await f.token(recipient.email);
    for(const path of ['/invitations/preview','/invitations/accept']){
      assert.equal((await post(path,{token:link},recipient,{'X-CSRF-Token':''})).status,403);
      assert.equal((await fetch(base+path,{headers:{Origin}})).status,404);
    }
    const preview=await post('/invitations/preview',{token:link},recipient);assert.equal(preview.status,200);
    assert.equal(JSON.stringify(await preview.json()).includes(link),false);
    const accept=await post('/invitations/accept',{token:link},recipient);assert.equal(accept.status,200);
    const consumed=await post('/invitations/accept',{token:link},recipient);assert.equal(consumed.status,400);assert.deepEqual(await consumed.json(),{code:'INVALID_ACTION'});
    for(const path of ['/current',`/${group.id}`])assert.equal((await fetch(base+path,{headers:{Origin}})).status,401);
    for(const path of [`/${group.id}/leave`,`/${group.id}/close`])assert.equal((await post(path,{})).status,404);
    await assert.rejects(f.pool.query('UPDATE family_invitations SET accepted_at=NULL,accepted_by_person_id=NULL'));
    await assert.rejects(f.pool.query('DELETE FROM family_invitations'));
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM family_memberships WHERE person_id=$1',[recipient.personId])).rows[0].n,1);
    await f.sessions.logout(owner.sessionToken);await assert.rejects(f.service.invite(group.id,{email:'revoked@example.test'},owner.sessionToken,'127.0.0.1'),{message:'UNAUTHENTICATED'});
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await f.pool.end();
    for(const [key,value] of Object.entries(originalEnvironment)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

test('recipient role matrix, two-family acceptance races and live invitation email content',async()=>{
  const f=await fixture();try{
    const owner=await f.account('owner@example.test'),other=await f.account('other@example.test');
    const one=await f.service.create({name:'First family'},owner.sessionToken),two=await f.service.create({name:'Second family'},other.sessionToken);
    for(const role of ['reception','cafe_staff','instructor','administrator','manager']){
      const staff=await f.account(`${role}@example.test`,[role]);
      await assert.rejects(f.service.create({name:'No customer role'},staff.sessionToken),{message:'FORBIDDEN'});
      if(!['administrator','manager'].includes(role))await assert.rejects(f.service.invite(one.id,{email:'not-sent@example.test'},staff.sessionToken,'127.0.0.1'),{message:'FORBIDDEN'});
      await f.service.invite(one.id,{email:staff.email},owner.sessionToken,'127.0.0.1');
      assert.equal((await f.pool.query("SELECT count(*)::int n FROM family_invitations WHERE recipient_email=$1",[staff.email])).rows[0].n,0);
    }
    const recipient=await f.account('compete@example.test',['instructor','customer']);
    await f.service.invite(one.id,{email:recipient.email},owner.sessionToken,'127.0.0.1');const first=await f.token(recipient.email);f.advance(61000);
    await f.pool.query("UPDATE people SET preferred_locale='en' WHERE id=$1",[recipient.personId]);
    await f.service.invite(two.id,{email:recipient.email},other.sessionToken,'127.0.0.1');const second=await f.token(recipient.email);
    const sent=[];const worker=createEmailOutboxWorker(f.pool,f.config,{now:f.now,send:async message=>{sent.push(message);}});
    assert.equal((await worker.runBatch()).sent,2);assert.equal(sent.length,2);
    assert.ok(sent.every(message=>message.to===recipient.email&&message.text.includes('#purpose=family_invitation&token=')));
    assert.ok(sent[0].subject.includes('Invitación'));assert.ok(sent[1].subject.includes('Family group invitation'));
    const results=await Promise.allSettled([f.service.accept({token:first},recipient.sessionToken,'127.0.0.1'),f.service.accept({token:second},recipient.sessionToken,'127.0.0.1')]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.message,'CONFLICT');
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM family_memberships WHERE person_id=$1 AND ended_at IS NULL',[recipient.personId])).rows[0].n,1);
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM family_invitations WHERE accepted_by_person_id=$1',[recipient.personId])).rows[0].n,1);
  }finally{await f.pool.end();}
});
