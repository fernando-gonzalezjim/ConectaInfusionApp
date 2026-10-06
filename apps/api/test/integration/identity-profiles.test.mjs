import test from 'node:test';
import assert from 'node:assert/strict';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {authConfig,createAuthAccount,password} from './identity-auth-helpers.mjs';
import {createSessionService} from '../../dist/modules/identity/sessions.js';
import {createAccountService} from '../../dist/modules/identity/accounts.js';
import {createProfileService} from '../../dist/modules/identity/profiles.js';
import {decryptOutboxPayload} from '../../dist/modules/identity/outbox-crypto.js';
import {createEmailOutboxWorker} from '../../dist/modules/identity/email-outbox.js';

async function token(pool,config,email){
  const row=(await pool.query(`SELECT o.* FROM identity_email_outbox o JOIN identity_action_tokens t ON t.id=o.action_token_id
    WHERE t.recipient_email=$1 AND t.revoked_at IS NULL ORDER BY t.created_at DESC LIMIT 1`,[email])).rows[0];
  return JSON.parse(decryptOutboxPayload({keyId:row.key_id,nonce:row.nonce,authTag:row.auth_tag,ciphertext:row.ciphertext},
    {outboxId:row.id,actionTokenId:row.action_token_id,kind:row.kind,recipientHash:row.recipient_hash},config.secrets)).token;
}
async function fixture(){
  const db=await isolatedDatabase();migrate(db.name);const config=authConfig();
  const account=await createAuthAccount(db.pool);const sessions=await createSessionService(db.pool,config);
  const login=await sessions.login({email:account.email,password},'127.0.0.1');
  return {...db,config,account,sessions,login,profiles:createProfileService(db.pool,config,sessions,createAccountService(db.pool,sessions))};
}
test('own profiles reject forged fields and email change confirms once, revokes sessions and notifies prior address',async()=>{
  const f=await fixture();try{
    assert.equal((await f.profiles.read(f.login.sessionToken)).id,f.account.accountId);
    await assert.rejects(f.profiles.update({id:f.account.accountId,roles:['administrator']},f.login.sessionToken),{message:'INVALID_REQUEST'});
    assert.equal((await f.profiles.update({fullName:'Updated',phone:'555',preferredLocale:'en'},f.login.sessionToken)).fullName,'Updated');
    const another=await f.sessions.login({email:f.account.email,password},'127.0.0.2');
    await f.profiles.requestEmail({email:' NEW@example.test '},f.login.sessionToken,'127.0.0.1');
    const link=await token(f.pool,f.config,'new@example.test');
    assert.equal((await f.sessions.resolve(f.login.sessionToken)).account.email,f.account.email);
    await assert.rejects(f.sessions.login({email:'new@example.test',password},'127.0.0.1'),{message:'INVALID_CREDENTIALS'});
    const results=await Promise.allSettled([f.profiles.confirmEmail({token:link},'127.0.0.1'),f.profiles.confirmEmail({token:link},'127.0.0.2')]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.find(r=>r.status==='rejected').reason.message,'INVALID_ACTION');
    for(const login of [f.login,another])await assert.rejects(f.sessions.resolve(login.sessionToken),{message:'UNAUTHENTICATED'});
    await assert.rejects(f.sessions.login({email:f.account.email,password},'127.0.0.1'),{message:'INVALID_CREDENTIALS'});
    assert.equal((await f.sessions.login({email:'new@example.test',password},'127.0.0.1')).account.personId,f.account.personId);
    const deliveries=[];await createEmailOutboxWorker(f.pool,f.config,{send:async message=>deliveries.push(message)}).runBatch();
    assert.equal(deliveries.length,1);assert.equal(deliveries[0].to,f.account.email);assert.match(deliveries[0].text,/email.*changed/i);
    assert.equal(deliveries[0].text.includes(link),false);
    const audit=JSON.stringify((await f.pool.query("SELECT * FROM audit_events WHERE action='account.email_changed'")).rows);
    assert.equal(audit.includes(link),false);assert.equal(audit.includes(password),false);
  }finally{await f.pool.end();}
});
test('email changes require recent current ownership, replace older links and reject stale, expired and inactive actions',async()=>{
  const f=await fixture();try{
    await f.pool.query("UPDATE identity_sessions SET created_at=now()-interval '10 minutes',authenticated_at=now()-interval '10 minutes',expires_at=now()-interval '10 minutes'+interval '168 hours' WHERE account_id=$1",[f.account.accountId]);
    await assert.rejects(f.profiles.requestEmail({email:'new@example.test'},f.login.sessionToken,'127.0.0.1'),{message:'RECENT_AUTH_REQUIRED'});
    const login=await f.sessions.login({email:f.account.email,password},'127.0.0.1');
    await assert.rejects(f.profiles.requestEmail({email:'new@example.test',accountId:f.account.accountId},login.sessionToken,'127.0.0.1'),{message:'INVALID_REQUEST'});
    await f.profiles.requestEmail({email:'new@example.test'},login.sessionToken,'127.0.0.1');const old=await token(f.pool,f.config,'new@example.test');
    await f.profiles.requestEmail({email:'other@example.test'},login.sessionToken,'127.0.0.1');const next=await token(f.pool,f.config,'other@example.test');
    await assert.rejects(f.profiles.confirmEmail({token:old},'127.0.0.1'),{message:'INVALID_ACTION'});
    await f.pool.query('UPDATE accounts SET session_version=session_version+1 WHERE id=$1',[f.account.accountId]);
    await assert.rejects(f.profiles.confirmEmail({token:next},'127.0.0.1'),{message:'INVALID_ACTION'});
    const fresh=await f.sessions.login({email:f.account.email,password},'127.0.0.1');
    await f.profiles.requestEmail({email:'expired@example.test'},fresh.sessionToken,'127.0.0.1');const expired=await token(f.pool,f.config,'expired@example.test');
    const clock=new Date(Date.now()+86400001);
    const later=createProfileService(f.pool,f.config,f.sessions,createAccountService(f.pool,f.sessions),{now:()=>clock});
    await assert.rejects(later.confirmEmail({token:expired},'127.0.0.1'),{message:'INVALID_ACTION'});
    await f.pool.query("UPDATE people SET status='inactive' WHERE id=$1",[f.account.personId]);
    await assert.rejects(f.profiles.confirmEmail({token:expired},'127.0.0.1'),{message:'INVALID_ACTION'});
  }finally{await f.pool.end();}
});
test('email uniqueness races and audit failure roll back confirmation, sessions, tokens and notifications',async()=>{
  const f=await fixture();try{
    const second=await createAuthAccount(f.pool,'second@example.test');const login=await f.sessions.login({email:second.email,password},'127.0.0.2');
    await assert.rejects(f.profiles.requestEmail({email:second.email},f.login.sessionToken,'127.0.0.1'),{message:'CONFLICT'});
    await f.profiles.requestEmail({email:'shared@example.test'},f.login.sessionToken,'127.0.0.1');const firstToken=await token(f.pool,f.config,'shared@example.test');
    await f.pool.query("UPDATE identity_throttles SET window_started_at=now()-interval '62 seconds',last_attempt_at=now()-interval '61 seconds' WHERE scope='resend_identity'");
    await f.profiles.requestEmail({email:'shared@example.test'},login.sessionToken,'127.0.0.2');
    const rows=(await f.pool.query("SELECT o.* FROM identity_email_outbox o JOIN identity_action_tokens t ON t.id=o.action_token_id WHERE t.account_id=$1",[second.accountId])).rows;
    const row=rows[0];const secondToken=JSON.parse(decryptOutboxPayload({keyId:row.key_id,nonce:row.nonce,authTag:row.auth_tag,ciphertext:row.ciphertext},
      {outboxId:row.id,actionTokenId:row.action_token_id,kind:row.kind,recipientHash:row.recipient_hash},f.config.secrets)).token;
    await f.pool.query(`CREATE FUNCTION reject_email_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='account.email_changed' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_email_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_email_audit()`);
    await assert.rejects(f.profiles.confirmEmail({token:firstToken},'127.0.0.1'));
    assert.equal((await f.sessions.resolve(f.login.sessionToken)).account.email,f.account.email);
    assert.equal((await f.pool.query("SELECT count(*)::int n FROM identity_email_outbox WHERE kind='security_notification'")).rows[0].n,0);
    await f.pool.query('DROP TRIGGER reject_email_audit ON audit_events');
    const results=await Promise.allSettled([f.profiles.confirmEmail({token:firstToken},'127.0.0.1'),f.profiles.confirmEmail({token:secondToken},'127.0.0.2')]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.message,'CONFLICT');
    assert.equal((await f.pool.query("SELECT count(*)::int n FROM accounts WHERE email='shared@example.test'")).rows[0].n,1);
  }finally{await f.pool.end();}
});
test('profile and email HTTP require ownership, exact Origin, correct CSRF and bounded allowlisted input',async()=>{
  const f=await fixture();let server;try{
    process.env.IDENTITY_ENABLED='false';process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused';
    const {createApplication}=await import('../../dist/app.js');
    const app=await createApplication({database:f.pool,identityConfig:f.config});server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${server.address().port}/api/v1`,Origin='http://localhost:5173';
    const cookie=`conecta_session=${f.login.sessionToken}`,headers={Origin,Cookie:cookie,'X-CSRF-Token':f.login.csrfToken,'Content-Type':'application/json'};
    const post=(path,body,extra={})=>fetch(base+path,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
    const own=await fetch(base+'/me',{headers:{Origin,Cookie:cookie}});assert.equal(own.status,200);assert.equal(own.headers.get('cache-control'),'no-store');
    const body=await own.json();assert.equal(body.id,f.account.accountId);assert.equal(Object.hasOwn(body,'password_hash'),false);
    assert.equal((await fetch(base+'/me',{headers:{Origin}})).status,401);
    for(const path of ['/me','/auth/email-change']){
      assert.equal((await post(path,{}, {Origin:'http://evil.example'})).status,403);
      assert.equal((await post(path,{}, {'X-CSRF-Token':'wrong'})).status,403);
      assert.equal((await post(path,{email:'new@example.test',accountId:f.account.accountId})).status,400);
      assert.equal((await post(path,{fullName:'x'.repeat(3000)})).status,413);
    }
    assert.equal((await post('/me',{fullName:'Mine',phone:null,preferredLocale:'es-MX'})).status,200);
    const another=await createAuthAccount(f.pool,'another@example.test',['instructor']);
    assert.equal((await post(`/accounts/${another.accountId}/profile`,{fullName:'Forged'})).status,403);
    assert.equal((await post('/auth/email-change',{email:'next@example.test'})).status,202);
    assert.equal((await post('/auth/email-change',{email:'next@example.test'})).status,429);
    assert.equal((await fetch(base+'/auth/email-change/confirmation',{headers:{Origin}})).status,404);
    const link=await token(f.pool,f.config,'next@example.test');
    assert.equal((await post('/auth/email-change/confirmation',{token:link})).status,403); // Session proof is not anonymous action proof.
    const bootstrap=await fetch(base+'/auth/csrf',{headers:{Origin}}),anonymousCookie=bootstrap.headers.get('set-cookie').split(';')[0],csrf=(await bootstrap.json()).csrfToken;
    const confirm=await post('/auth/email-change/confirmation',{token:link},{Cookie:anonymousCookie,'X-CSRF-Token':csrf});
    assert.equal(confirm.status,200);assert.deepEqual(await confirm.json(),{code:'EMAIL_CHANGED'});assert.equal(confirm.headers.get('set-cookie'),null);
    assert.equal((await fetch(base+'/me',{headers:{Origin,Cookie:cookie}})).status,401);
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await f.pool.end();}
});
test('lock waits cannot extend recent authentication or email confirmation expiry',async()=>{
  const f=await fixture();const blocker=await f.pool.connect();try{
    let time=new Date();const profiles=createProfileService(f.pool,f.config,f.sessions,createAccountService(f.pool,f.sessions),{now:()=>time});
    async function waitForAccountLock(){
      for(let i=0;i<100;i++){
        const waiting=(await f.pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT id FROM accounts WHERE id=%'")).rows[0].n;
        if(waiting>0)return;await new Promise(resolve=>setTimeout(resolve,20));
      }throw new Error('Account lock barrier not reached');
    }
    await blocker.query('BEGIN');await blocker.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE',[f.account.accountId]);
    const request=profiles.requestEmail({email:'delayed@example.test'},f.login.sessionToken,'127.0.0.1');
    const denial=assert.rejects(request,{message:'RECENT_AUTH_REQUIRED'});
    await waitForAccountLock();time=new Date(time.getTime()+600001);await blocker.query('COMMIT');await denial;
    time=new Date();await profiles.requestEmail({email:'delayed@example.test'},f.login.sessionToken,'127.0.0.1');const link=await token(f.pool,f.config,'delayed@example.test');
    await blocker.query('BEGIN');await blocker.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE',[f.account.accountId]);
    const confirmation=profiles.confirmEmail({token:link},'127.0.0.1');const expiration=assert.rejects(confirmation,{message:'INVALID_ACTION'});
    await waitForAccountLock();time=new Date(time.getTime()+86400001);await blocker.query('COMMIT');await expiration;
    assert.equal((await f.pool.query('SELECT email FROM accounts WHERE id=$1',[f.account.accountId])).rows[0].email,f.account.email);
  }finally{await blocker.query('ROLLBACK');blocker.release();await f.pool.end();}
});
