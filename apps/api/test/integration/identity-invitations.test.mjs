import test from 'node:test';
import assert from 'node:assert/strict';
import { isolatedDatabase, migrate } from './identity-helpers.mjs';
import { authConfig, createAuthAccount, password } from './identity-auth-helpers.mjs';
import { createSessionService } from '../../dist/modules/identity/sessions.js';
import { createAccountInvitationService } from '../../dist/modules/identity/account-invitations.js';
import { decryptOutboxPayload } from '../../dist/modules/identity/outbox-crypto.js';

async function token(pool, config) {
  const row=(await pool.query("SELECT * FROM identity_email_outbox WHERE status='pending' ORDER BY created_at DESC,id LIMIT 1")).rows[0];
  return JSON.parse(decryptOutboxPayload({keyId:row.key_id,nonce:row.nonce,authTag:row.auth_tag,ciphertext:row.ciphertext},
    {outboxId:row.id,actionTokenId:row.action_token_id,kind:'action',recipientHash:row.recipient_hash},config.secrets)).token;
}
async function fixture() {
  const db=await isolatedDatabase(); migrate(db.name); const config=authConfig();
  const sessions=await createSessionService(db.pool,config,{environment:{NODE_ENV:'test'}});
  let now=new Date();
  const service=createAccountInvitationService(db.pool,config,sessions,{now:()=>now});
  const invitations={...service,invite:(value,session)=>service.invite(value,session,'127.0.0.1'),resend:(value,session)=>service.resend(value,session,'127.0.0.1')};
  return {...db,config,sessions,invitations,now:()=>now,advance:ms=>{now=new Date(now.getTime()+ms);}};
}

test('invitation actor matrix, exemption provenance, strict input and secure single-use setup',async()=>{
  const f=await fixture();
  try {
    for(const role of ['administrator','manager','reception','cafe_staff','instructor','customer']) {
      const actor=await createAuthAccount(f.pool,`${role}@example.test`,[role]);
      const login=await f.sessions.login({email:actor.email,password},'127.0.0.1');
      const input={fullName:'Invited customer',email:`invited-${role}@example.test`};
      if(role==='customer') {await assert.rejects(f.invitations.invite(input,login.sessionToken),{message:'FORBIDDEN'});continue;}
      for(const extra of [{roles:['administrator']},{password:'secret'},{confirmationStatus:'verified'},{personId:actor.personId},{fullName:'Invalid\nname'},{phone:'123\u0000'}])
        await assert.rejects(f.invitations.invite({...input,...extra},login.sessionToken),{message:'INVALID_REQUEST'});
      await assert.rejects(f.invitations.invite({fullName:'Missing email'},login.sessionToken),{message:'INVALID_REQUEST'});
      const exempt=['administrator','manager'].includes(role);
      if(!exempt) await assert.rejects(f.invitations.invite({...input,waiveConfirmation:true,reason:'Approved'},login.sessionToken),{message:'FORBIDDEN'});
      assert.deepEqual(await f.invitations.invite({...input,...(exempt?{waiveConfirmation:true,reason:'Approved exception'}:{})},login.sessionToken),{code:'ACCEPTED'});
      const pending=(await f.pool.query('SELECT * FROM accounts WHERE email=$1',[input.email])).rows[0];
      assert.equal(pending.status,'pending');assert.equal(pending.password_hash,null);
      assert.equal(pending.confirmation_status,exempt?'exempt':'pending');
      assert.equal(pending.exemption_actor_id,exempt?actor.accountId:null);
      await assert.rejects(f.sessions.login({email:input.email,password},'127.0.0.1'),{message:'INVALID_CREDENTIALS'});
      const link=await token(f.pool,f.config);
      await assert.rejects(f.invitations.setup({token:link,password:'testuser'},'127.0.0.1'),{message:'INVALID_REQUEST'});
      const results=await Promise.allSettled([f.invitations.setup({token:link,password},'127.0.0.1'),f.invitations.setup({token:link,password},'127.0.0.1')]);
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
      assert.equal(results.find(r=>r.status==='rejected').reason.message,'INVALID_ACTION');
      const saved=(await f.pool.query('SELECT * FROM accounts WHERE id=$1',[pending.id])).rows[0];
      assert.equal(saved.status,'active');assert.equal(saved.confirmation_status,exempt?'exempt':'verified');
      assert.equal(saved.email_verified_at===null,exempt);
      assert.deepEqual((await f.sessions.login({email:input.email,password},'127.0.0.1')).account.roles,['customer']);
      const audit=JSON.stringify((await f.pool.query('SELECT * FROM audit_events WHERE target_id=$1',[pending.id])).rows);
      assert.equal(audit.includes(link),false);assert.equal(audit.includes(password),false);
      assert.equal(audit.includes(actor.accountId),true);
    }
  } finally {await f.pool.end();}
});

test('invitation resend preserves records, replaces links, expires at 24 hours and rejects inactive targets',async()=>{
  const f=await fixture();
  try {
    const actor=await createAuthAccount(f.pool,'instructor@example.test',['instructor','customer']);
    const login=await f.sessions.login({email:actor.email,password},'127.0.0.1');
    const input={fullName:'Original name',email:'invited@example.test'};
    await f.invitations.invite(input,login.sessionToken);const first=await token(f.pool,f.config);
    await f.invitations.resend({email:input.email},login.sessionToken);
    assert.equal(await token(f.pool,f.config),first);
    f.advance(61000);await f.invitations.resend({email:input.email},login.sessionToken);const second=await token(f.pool,f.config);
    assert.notEqual(first,second);
    await assert.rejects(f.invitations.setup({token:first,password},'127.0.0.1'),{message:'INVALID_ACTION'});
    await f.invitations.invite({...input,fullName:'Overwrite attempt'},login.sessionToken);
    assert.equal((await f.pool.query('SELECT full_name FROM people p JOIN accounts a ON a.person_id=p.id WHERE a.email=$1',[input.email])).rows[0].full_name,'Original name');
    f.advance(86400000);await assert.rejects(f.invitations.setup({token:second,password},'127.0.0.1'),{message:'INVALID_ACTION'});
    await f.invitations.resend({email:input.email},login.sessionToken);const third=await token(f.pool,f.config);
    await f.pool.query("UPDATE accounts SET status='inactive',deactivated_at=now() WHERE email=$1",[input.email]);
    await assert.rejects(f.invitations.setup({token:third,password},'127.0.0.1'),{message:'INVALID_ACTION'});
    for(const email of [actor.email,'unknown@example.test','admin@conecta.example.test'])
      assert.deepEqual(await f.invitations.resend({email},login.sessionToken),{code:'ACCEPTED'});
    await f.sessions.logout(login.sessionToken);
    await assert.rejects(f.invitations.invite({fullName:'No access',email:'no@example.test'},login.sessionToken),{message:'UNAUTHENTICATED'});
  } finally {await f.pool.end();}
});

test('invitation HTTP enforces Origin, both CSRF modes, bounded input and private generic responses',async()=>{
  const f=await fixture();let server;
  try {
    const actor=await createAuthAccount(f.pool,'staff@example.test',['reception']);
    const login=await f.sessions.login({email:actor.email,password},'127.0.0.1');
    process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused';process.env.IDENTITY_ENABLED='false';
    const {createApplication}=await import('../../dist/app.js');
    server=(await createApplication({database:f.pool,identityConfig:f.config,environment:{NODE_ENV:'test'}})).listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${server.address().port}/api/v1`;const Origin='http://localhost:5174';
    const post=(path,body,headers={})=>fetch(base+path,{method:'POST',headers:{Origin,'Content-Type':'application/json',Cookie:`conecta_session=${login.sessionToken}`,'X-CSRF-Token':login.csrfToken,...headers},body:JSON.stringify(body)});
    const input={fullName:'HTTP customer',email:'http@example.test'};
    for(const path of ['/accounts/invitations','/accounts/invitations/resend']) {
      assert.equal((await post(path,input,{Origin:'http://evil.example'})).status,403);
      assert.equal((await post(path,input,{'X-CSRF-Token':''})).status,403);
      assert.equal((await fetch(base+path,{headers:{Origin}})).status,404);
    }
    assert.equal((await post('/accounts/invitations',{...input,fullName:'x'.repeat(3000)})).status,413);
    assert.equal((await post('/accounts/invitations',{...input,roles:['administrator']})).status,400);
    const response=await post('/accounts/invitations',input);
    assert.equal(response.status,202);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{code:'ACCEPTED'});
    const duplicate=await post('/accounts/invitations',{...input,fullName:'Changed'});assert.deepEqual(await duplicate.json(),{code:'ACCEPTED'});
    const link=await token(f.pool,f.config);
    const bootstrap=await fetch(base+'/auth/csrf',{headers:{Origin}});
    const Cookie=bootstrap.headers.get('set-cookie').split(';')[0];const csrf=(await bootstrap.json()).csrfToken;
    const setupHeaders={Cookie,'X-CSRF-Token':csrf};
    assert.equal((await post('/auth/setup',{token:link,password},{...setupHeaders,'X-CSRF-Token':''})).status,403);
    const result=await post('/auth/setup',{token:link,password},setupHeaders);
    assert.equal(result.status,200);assert.deepEqual(await result.json(),{code:'PASSWORD_SET'});assert.equal(result.headers.get('set-cookie'),null);
    assert.equal((await post('/auth/setup',{token:link,password},setupHeaders)).status,400);
    const customer=await f.sessions.login({email:input.email,password},'127.0.0.1');
    assert.equal((await post('/accounts/invitations',{fullName:'Denied',email:'denied@example.test'},
      {Cookie:`conecta_session=${customer.sessionToken}`,'X-CSRF-Token':customer.csrfToken})).status,403);
  } finally {if(server)await new Promise(resolve=>server.close(resolve));await f.pool.end();}
});

test('invitation transaction rechecks actor and rolls back account creation and setup on audit failure',async()=>{
  const f=await fixture();
  try {
    const actor=await createAuthAccount(f.pool,'manager@example.test',['manager']);
    const login=await f.sessions.login({email:actor.email,password},'127.0.0.1');
    const stale=createAccountInvitationService(f.pool,f.config,{...f.sessions,resolve:async(...args)=>{
      const context=await f.sessions.resolve(...args);
      await f.pool.query("UPDATE account_roles SET role='customer' WHERE account_id=$1",[actor.accountId]);return context;
    }});
    await assert.rejects(stale.invite({fullName:'Stale access',email:'stale@example.test'},login.sessionToken,'127.0.0.1'),{message:'FORBIDDEN'});
    assert.equal((await f.pool.query("SELECT count(*)::int n FROM accounts WHERE email='stale@example.test'")).rows[0].n,0);
    await f.pool.query("UPDATE account_roles SET role='manager' WHERE account_id=$1",[actor.accountId]);
    await f.pool.query(`CREATE FUNCTION reject_invitation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END $$;
      CREATE TRIGGER reject_invitation_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_invitation_audit()`);
    await assert.rejects(f.invitations.invite({fullName:'Rollback',email:'rollback@example.test',waiveConfirmation:true,reason:'Test'},login.sessionToken));
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM people')).rows[0].n,1);
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM identity_email_outbox')).rows[0].n,0);
    await f.pool.query('DROP TRIGGER reject_invitation_audit ON audit_events');
    const input={fullName:'Setup rollback',email:'setup@example.test'};await f.invitations.invite(input,login.sessionToken);const link=await token(f.pool,f.config);
    await f.pool.query('CREATE TRIGGER reject_invitation_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_invitation_audit()');
    await assert.rejects(f.invitations.setup({token:link,password},'127.0.0.1'));
    const saved=(await f.pool.query('SELECT password_hash,status FROM accounts WHERE email=$1',[input.email])).rows[0];
    assert.deepEqual(saved,{password_hash:null,status:'pending'});
    assert.equal((await f.pool.query('SELECT consumed_at FROM identity_action_tokens')).rows[0].consumed_at,null);
    await f.pool.query('DROP TRIGGER reject_invitation_audit ON audit_events');
    assert.deepEqual(await f.invitations.setup({token:link,password},'127.0.0.1'),{code:'PASSWORD_SET'});
  } finally {await f.pool.end();}
});

test('invitation links reject changed versions, wrong purposes and inactive people; send budgets survive service recreation',async()=>{
  const f=await fixture();
  try {
    const actor=await createAuthAccount(f.pool,'staff@example.test',['cafe_staff']);
    const login=await f.sessions.login({email:actor.email,password},'127.0.0.1');
    const input={fullName:'Bound customer',email:'bound@example.test'};
    await f.invitations.invite(input,login.sessionToken);const first=await token(f.pool,f.config);
    assert.equal((await f.pool.query('SELECT expires_at-created_at AS lifetime FROM identity_action_tokens')).rows[0].lifetime.days,1);
    await f.pool.query("UPDATE identity_action_tokens SET purpose='email_confirmation'");
    await assert.rejects(f.invitations.setup({token:first,password},'127.0.0.1'),{message:'INVALID_ACTION'});
    await f.pool.query("UPDATE identity_action_tokens SET purpose='password_setup'");
    await f.pool.query('UPDATE accounts SET session_version=session_version+1 WHERE email=$1',[input.email]);
    await assert.rejects(f.invitations.setup({token:first,password},'127.0.0.1'),{message:'INVALID_ACTION'});
    f.advance(61000);await f.invitations.resend({email:input.email},login.sessionToken);const second=await token(f.pool,f.config);
    await f.pool.query("UPDATE people SET status='inactive' WHERE id=(SELECT person_id FROM accounts WHERE email=$1)",[input.email]);
    await assert.rejects(f.invitations.setup({token:second,password},'127.0.0.1'),{message:'INVALID_ACTION'});
    await f.pool.query("UPDATE people SET status='active' WHERE id=(SELECT person_id FROM accounts WHERE email=$1)",[input.email]);
    for(let i=0;i<3;i++) {f.advance(61000);await f.invitations.resend({email:input.email},login.sessionToken);}
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM identity_action_tokens')).rows[0].n,5);
    f.advance(61000);await f.invitations.resend({email:input.email},login.sessionToken);
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM identity_action_tokens')).rows[0].n,5);
    // New service instances share the durable IP budget instead of resetting counters.
    const another=createAccountInvitationService(f.pool,f.config,f.sessions);
    for(let i=0;i<30;i++) await another.resend({email:'unknown@example.test'},login.sessionToken,'127.0.0.2');
    const recreated=createAccountInvitationService(f.pool,f.config,f.sessions);
    await assert.rejects(recreated.resend({email:'unknown@example.test'},login.sessionToken,'127.0.0.2'),{message:'THROTTLED'});
  } finally {await f.pool.end();}
});

test('setup checks expiry after waiting on account locks and invitations reject expired sessions',async()=>{
  const f=await fixture();const blocker=await f.pool.connect();
  try {
    const actor=await createAuthAccount(f.pool,'staff@example.test',['instructor']);
    const login=await f.sessions.login({email:actor.email,password},'127.0.0.1');
    const input={fullName:'Delayed customer',email:'delayed@example.test'};
    await f.invitations.invite(input,login.sessionToken);const link=await token(f.pool,f.config);
    await blocker.query('BEGIN');await blocker.query('SELECT id FROM accounts WHERE email=$1 FOR UPDATE',[input.email]);
    let notify;const waiting=new Promise(resolve=>{notify=resolve;});
    const wrapped={query:(...args)=>f.pool.query(...args),connect:async()=>{
      const client=await f.pool.connect();return {release:()=>client.release(),query:(...args)=>{
        if(typeof args[0]==='string'&&args[0].includes("a.password_hash IS NULL"))notify();
        return client.query(...args);
      }};
    }};
    const delayed=createAccountInvitationService(wrapped,f.config,f.sessions,{now:f.now});
    const result=delayed.setup({token:link,password},'127.0.0.1').then(value=>({value}),error=>({error}));
    await waiting;f.advance(86400000);await blocker.query('COMMIT');
    assert.equal((await result).error.message,'INVALID_ACTION');
    assert.equal((await f.pool.query('SELECT consumed_at FROM identity_action_tokens')).rows[0].consumed_at,null);
    f.advance(7*86400000);
    await assert.rejects(f.invitations.invite({fullName:'Expired session',email:'expired@example.test'},login.sessionToken),{message:'UNAUTHENTICATED'});
  } finally {await blocker.query('ROLLBACK');blocker.release();await f.pool.end();}
});
