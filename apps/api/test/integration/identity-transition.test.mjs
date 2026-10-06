import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {authConfig,createAuthAccount,password} from './identity-auth-helpers.mjs';
import {createSessionService} from '../../dist/modules/identity/sessions.js';
import {createChildDetailsService} from '../../dist/modules/identity/child-details.js';
import {createDependentTransitionService} from '../../dist/modules/identity/dependent-transition.js';
import {decryptOutboxPayload} from '../../dist/modules/identity/outbox-crypto.js';
import {createGuardianInvitationService} from '../../dist/modules/identity/guardian-invitations.js';
import {createGuardianService} from '../../dist/modules/identity/guardians.js';
import {createFamilyInTransaction} from '../../dist/modules/identity/families.js';

function deliveryToken(row,config){return JSON.parse(decryptOutboxPayload({keyId:row.key_id,nonce:row.nonce,authTag:row.auth_tag,ciphertext:row.ciphertext},{outboxId:row.id,actionTokenId:row.action_token_id,kind:'action',recipientHash:row.recipient_hash},config.secrets)).token;}

async function fixture(){
  const db=await isolatedDatabase();migrate(db.name);
  const config=authConfig(),sessions=await createSessionService(db.pool,config);
  const children=createChildDetailsService(db.pool,sessions),service=createDependentTransitionService(db.pool,config,sessions);
  const parent=await createAuthAccount(db.pool,'parent@example.test');
  const login=await sessions.login({email:parent.email,password},'127.0.0.1');
  const child=await children.createDependent({fullName:'Preserved child',ageText:'7'},login.sessionToken);
  async function request(email='independent@example.test'){
    await service.request(child.id,{email},login.sessionToken,'127.0.0.1');
    const row=(await db.pool.query("SELECT o.* FROM identity_email_outbox o JOIN identity_action_tokens t ON t.id=o.action_token_id WHERE t.purpose='dependent_transition' ORDER BY o.created_at DESC LIMIT 1")).rows[0];
    return JSON.parse(decryptOutboxPayload({keyId:row.key_id,nonce:row.nonce,authTag:row.auth_tag,ciphertext:row.ciphertext},{outboxId:row.id,actionTokenId:row.action_token_id,kind:'action',recipientHash:row.recipient_hash},config.secrets)).token;
  }
  return {...db,config,sessions,children,service,parent,login,child,request};
}

test('transition confirms email and password atomically, preserves identity and ends guardian authority',async()=>{
  const f=await fixture();try{
    const other=await createAuthAccount(f.pool,'second-parent@example.test'),otherLogin=await f.sessions.login({email:other.email,password},'127.0.0.1'),invitations=createGuardianInvitationService(f.pool,f.config,f.sessions);
    await invitations.invite(f.child.id,{email:other.email},f.login.sessionToken,'127.0.0.1');const invitation=(await f.pool.query("SELECT o.* FROM identity_email_outbox o JOIN identity_action_tokens t ON t.id=o.action_token_id WHERE t.purpose='guardian_invitation'")).rows[0];await invitations.accept({token:deliveryToken(invitation,f.config)},otherLogin.sessionToken,'127.0.0.1');
    const member=(await f.pool.query('INSERT INTO members(full_name,email,person_id) VALUES ($1,$2,$3) RETURNING id',['Parent',f.parent.email,f.parent.personId])).rows[0].id;
    const instructor=(await f.pool.query("INSERT INTO instructors(full_name) VALUES ('Teacher') RETURNING id")).rows[0].id,session=(await f.pool.query("INSERT INTO class_sessions(title,instructor_id,starts_at,duration_minutes,capacity) VALUES ('Yoga Kids',$1,now()+interval '1 day',60,16) RETURNING id",[instructor])).rows[0].id;
    await f.pool.query("INSERT INTO bookings(member_id,class_session_id,acting_account_id,attendee_person_id,child_name_snapshot,child_age_snapshot) VALUES ($1,$2,$3,$4,'Preserved child','7')",[member,session,f.parent.accountId,f.child.id]);
    const client=await f.pool.connect();try{await client.query('BEGIN');await createFamilyInTransaction(client,{name:'Preserved family',creatorPersonId:f.parent.personId},{actor:{id:randomUUID(),type:'system'},reason:'Controlled family fixture',correlationId:randomUUID()});await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    const bookings=(await f.pool.query('SELECT * FROM bookings ORDER BY id')).rows,families=(await f.pool.query('SELECT * FROM family_memberships ORDER BY id')).rows;
    const raw=await f.request();
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM accounts WHERE person_id=$1',[f.child.id])).rows[0].n,0);
    await assert.rejects(f.service.complete({token:raw,email:'wrong@example.test',password},'127.0.0.1'),{message:'INVALID_ACTION'});
    await assert.rejects(f.service.complete({token:raw,email:'independent@example.test',password:'short'},'127.0.0.1'),{message:'INVALID_REQUEST'});
    assert.deepEqual(await f.service.complete({token:raw,email:'independent@example.test',password},'127.0.0.1'),{code:'TRANSITIONED'});
    const account=(await f.pool.query('SELECT * FROM accounts WHERE person_id=$1',[f.child.id])).rows[0];assert.equal(account.email,'independent@example.test');assert.equal(account.confirmation_status,'verified');
    assert.deepEqual((await f.pool.query('SELECT role FROM account_roles WHERE account_id=$1',[account.id])).rows.map(r=>r.role),['customer']);
    assert.equal((await f.pool.query('SELECT end_reason FROM dependent_guardians WHERE dependent_person_id=$1',[f.child.id])).rows[0].end_reason,'transitioned');
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM dependent_guardians WHERE dependent_person_id=$1 AND ended_at IS NULL',[f.child.id])).rows[0].n,0);await assert.rejects(f.children.getDependent(f.child.id,otherLogin.sessionToken),{message:'NOT_FOUND'});
    assert.deepEqual((await f.pool.query('SELECT * FROM bookings ORDER BY id')).rows,bookings);assert.deepEqual((await f.pool.query('SELECT * FROM family_memberships ORDER BY id')).rows,families);
    await assert.rejects(f.children.getDependent(f.child.id,f.login.sessionToken),{message:'NOT_FOUND'});
    await f.sessions.resolve(f.login.sessionToken);await f.sessions.login({email:account.email,password},'127.0.0.1');
    await assert.rejects(f.service.complete({token:raw,email:account.email,password},'127.0.0.1'),{message:'INVALID_ACTION'});
    const history=(await f.pool.query("SELECT changes FROM audit_events WHERE action='dependent.transitioned'")).rows;assert.equal(history.length,1);assert.ok(!JSON.stringify(history).includes('Preserved child'));
  }finally{await f.pool.end();}
});

test('all current guardians end, history stays unchanged, and a removed issuer cannot complete',async()=>{
  const f=await fixture();try{
    const other=await createAuthAccount(f.pool,'other@example.test'),otherLogin=await f.sessions.login({email:other.email,password},'127.0.0.1');
    const invitations=createGuardianInvitationService(f.pool,f.config,f.sessions);
    await invitations.invite(f.child.id,{email:other.email},f.login.sessionToken,'127.0.0.1');
    const row=(await f.pool.query("SELECT o.* FROM identity_email_outbox o JOIN identity_action_tokens t ON t.id=o.action_token_id WHERE t.purpose='guardian_invitation'")).rows[0];await invitations.accept({token:deliveryToken(row,f.config)},otherLogin.sessionToken,'127.0.0.1');
    const raw=await f.request();const guardians=createGuardianService(f.pool,f.sessions),mine=(await guardians.list(f.child.id,{},f.login.sessionToken)).items.find(g=>g.accountId===f.parent.accountId);
    await guardians.remove(f.child.id,mine.id,{},f.login.sessionToken);
    await assert.rejects(f.service.complete({token:raw,email:'independent@example.test',password},'127.0.0.1'),{message:'INVALID_ACTION'});
    await f.service.request(f.child.id,{email:'other-child@example.test'},otherLogin.sessionToken,'127.0.0.1');
    const newRow=(await f.pool.query("SELECT o.* FROM identity_email_outbox o JOIN identity_action_tokens t ON t.id=o.action_token_id WHERE t.purpose='dependent_transition' ORDER BY o.created_at DESC LIMIT 1")).rows[0];
    const peopleBefore=(await f.pool.query('SELECT * FROM people ORDER BY id')).rows,detailsBefore=(await f.pool.query('SELECT * FROM saved_child_details ORDER BY id')).rows;
    await f.service.complete({token:deliveryToken(newRow,f.config),email:'other-child@example.test',password},'127.0.0.1');
    assert.deepEqual((await f.pool.query('SELECT * FROM people ORDER BY id')).rows,peopleBefore);assert.deepEqual((await f.pool.query('SELECT * FROM saved_child_details ORDER BY id')).rows,detailsBefore);
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM dependent_guardians WHERE dependent_person_id=$1 AND ended_at IS NULL',[f.child.id])).rows[0].n,0);await assert.rejects(f.children.getDependent(f.child.id,otherLogin.sessionToken),{message:'NOT_FOUND'});
  }finally{await f.pool.end();}
});

test('confirmation rechecks expiry after waiting for the issuer account lock',async()=>{
  const f=await fixture(),blocker=await f.pool.connect();let completion;try{
    const raw=await f.request();let time=new Date();const service=createDependentTransitionService(f.pool,f.config,f.sessions,{now:()=>time});
    await blocker.query('BEGIN');await blocker.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE',[f.parent.accountId]);
    completion=service.complete({token:raw,email:'independent@example.test',password},'127.0.0.1').then(value=>({value}),error=>({error}));
    let waiting=0;for(let i=0;i<200&&!waiting;i++){waiting=(await f.pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT * FROM accounts WHERE id=ANY%'")).rows[0].n;if(!waiting)await new Promise(r=>setTimeout(r,10));}
    assert.equal(waiting,1);time=new Date(Date.now()+25*3600000);await blocker.query('COMMIT');assert.equal((await completion).error.message,'INVALID_ACTION');
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM accounts WHERE person_id=$1',[f.child.id])).rows[0].n,0);
  }finally{await blocker.query('ROLLBACK');blocker.release();if(completion)await completion;await f.pool.end();}
});

test('duplicate email and concurrent completions cannot duplicate or consume a failed transition',async()=>{
  const f=await fixture();try{
    const raw=await f.request();await createAuthAccount(f.pool,'independent@example.test');
    await assert.rejects(f.service.complete({token:raw,email:'independent@example.test',password},'127.0.0.1'),{message:'INVALID_ACTION'});
    assert.equal((await f.pool.query("SELECT consumed_at FROM identity_action_tokens WHERE purpose='dependent_transition'")).rows[0].consumed_at,null);
    const raw2=await f.request('available@example.test');
    const results=await Promise.allSettled([1,2].map(()=>f.service.complete({token:raw2,email:'available@example.test',password},'127.0.0.1')));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.message,'INVALID_ACTION');
  }finally{await f.pool.end();}
});

test('expired and stale profile links fail; only an authorized guardian can issue a transition',async()=>{
  const f=await fixture();try{
    const manager=await createAuthAccount(f.pool,'manager@example.test',['manager']),login=await f.sessions.login({email:manager.email,password},'127.0.0.1');
    await assert.rejects(f.service.request(f.child.id,{email:'child@example.test'},login.sessionToken,'127.0.0.1'),{message:'NOT_FOUND'});
    const raw=await f.request();
    const later=createDependentTransitionService(f.pool,f.config,f.sessions,{now:()=>new Date(Date.now()+25*3600000)});
    await assert.rejects(later.complete({token:raw,email:'independent@example.test',password},'127.0.0.1'),{message:'INVALID_ACTION'});
    await f.children.updateDependent(f.child.id,{fullName:'Edited child',ageText:'8',expectedVersion:f.child.version},f.login.sessionToken);
    await assert.rejects(f.service.complete({token:raw,email:'independent@example.test',password},'127.0.0.1'),{message:'INVALID_ACTION'});
    assert.equal((await f.pool.query('SELECT independent_at FROM dependent_profiles WHERE person_id=$1',[f.child.id])).rows[0].independent_at,null);
  }finally{await f.pool.end();}
});

test('audit failure rolls back account creation, guardian endings and token consumption',async()=>{
  const f=await fixture();try{
    const raw=await f.request();
    await f.pool.query("CREATE FUNCTION reject_transition() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='dependent.transitioned' THEN RAISE EXCEPTION 'controlled transition audit failure'; END IF; RETURN NEW; END $$");await f.pool.query('CREATE TRIGGER reject_transition BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_transition()');
    await assert.rejects(f.service.complete({token:raw,email:'independent@example.test',password},'127.0.0.1'),{message:'controlled transition audit failure'});
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM accounts WHERE person_id=$1',[f.child.id])).rows[0].n,0);assert.equal((await f.children.getDependent(f.child.id,f.login.sessionToken)).guardians.length,1);
    assert.equal((await f.pool.query("SELECT consumed_at FROM identity_action_tokens WHERE purpose='dependent_transition'")).rows[0].consumed_at,null);
  }finally{await f.pool.end();}
});

test('transition HTTP enforces origin, session and anonymous CSRF before bounded parsing',async()=>{
  const f=await fixture(),previous=process.env.DATABASE_URL;let server;try{
    process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused';
    const {createApplication}=await import('../../dist/app.js');server=(await createApplication({database:f.pool,identityConfig:f.config,environment:{NODE_ENV:'test'}})).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
    const base=`http://127.0.0.1:${server.address().port}/api/v1`,Origin='http://localhost:5173';
    const headers={Origin,'Content-Type':'application/json',Cookie:`conecta_session=${f.login.sessionToken}`,'X-CSRF-Token':f.login.csrfToken};
    const request=value=>fetch(`${base}/dependents/${f.child.id}/transition`,{method:'POST',headers,body:JSON.stringify(value)});
    assert.equal((await request({email:'http-child@example.test',role:'administrator'})).status,400);
    assert.equal((await fetch(`${base}/dependents/${f.child.id}/transition`,{method:'POST',headers:{...headers,'X-CSRF-Token':''},body:'x'.repeat(3000)})).status,403);
    assert.equal((await request({email:'http-child@example.test'})).status,202);
    const row=(await f.pool.query("SELECT o.* FROM identity_email_outbox o JOIN identity_action_tokens t ON t.id=o.action_token_id WHERE t.purpose='dependent_transition'")).rows[0],raw=deliveryToken(row,f.config);
    const body=JSON.stringify({token:raw,email:'http-child@example.test',password});
    assert.equal((await fetch(base+'/dependents/transitions/complete',{method:'POST',headers,body})).status,403);
    const csrf=await fetch(base+'/auth/csrf',{headers:{Origin}}),token=(await csrf.json()).csrfToken,cookie=csrf.headers.get('set-cookie').split(';')[0];
    const anon={Origin,'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':token};
    assert.equal((await fetch(base+'/dependents/transitions/complete',{method:'POST',headers:{...anon,Origin:'https://evil.example'},body})).status,403);
    const complete=await fetch(base+'/dependents/transitions/complete',{method:'POST',headers:anon,body});assert.equal(complete.status,200);assert.equal(complete.headers.get('cache-control'),'no-store');assert.deepEqual(await complete.json(),{code:'TRANSITIONED'});
  }finally{if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;if(server)await new Promise(r=>server.close(r));await f.pool.end();}
});
