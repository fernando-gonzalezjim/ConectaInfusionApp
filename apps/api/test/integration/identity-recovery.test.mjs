import test from 'node:test';
import assert from 'node:assert/strict';
import { isolatedDatabase, migrate } from './identity-helpers.mjs';
import { authConfig, createAuthAccount, password } from './identity-auth-helpers.mjs';
import { decryptOutboxPayload } from '../../dist/modules/identity/outbox-crypto.js';
import { createSessionService } from '../../dist/modules/identity/sessions.js';
import { createRecoveryService } from '../../dist/modules/identity/recovery.js';

const nextPassword = 'An entirely new password with spaces';
async function latestToken(pool, config) {
  const row = (await pool.query("SELECT * FROM identity_email_outbox WHERE status='pending' ORDER BY created_at DESC,id LIMIT 1")).rows[0];
  return JSON.parse(decryptOutboxPayload({ keyId: row.key_id, nonce: row.nonce, authTag: row.auth_tag, ciphertext: row.ciphertext },
    { outboxId: row.id, actionTokenId: row.action_token_id, kind: 'action', recipientHash: row.recipient_hash }, config.secrets)).token;
}

test('recovery HTTP requires exact Origin/anonymous CSRF, blocks GET, bounds input and never creates a session', async () => {
  const db=await isolatedDatabase(); let server;
  try {
    migrate(db.name); const config=authConfig(); const account=await createAuthAccount(db.pool);
    process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused'; process.env.IDENTITY_ENABLED='false';
    const { createApplication }=await import('../../dist/app.js');
    const app=await createApplication({database:db.pool,identityConfig:config,environment:{NODE_ENV:'test'}});
    server=app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${server.address().port}/api/v1/auth`; const Origin='http://localhost:5173';
    const bootstrap=await fetch(base+'/csrf',{headers:{Origin}}); const cookie=bootstrap.headers.get('set-cookie').split(';')[0]; const csrf=(await bootstrap.json()).csrfToken;
    const post=(path,body,headers={})=>fetch(base+path,{method:'POST',headers:{Origin,'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf,...headers},body:JSON.stringify(body)});
    for(const path of ['/recovery','/recovery/reset']) {
      assert.equal((await post(path,{}, {Origin:'http://evil.example'})).status,403);
      assert.equal((await post(path,{}, {'X-CSRF-Token':''})).status,403);
      assert.equal((await fetch(base+path,{headers:{Origin}})).status,404);
    }
    assert.equal((await post('/recovery',{email:account.email,role:'administrator'})).status,400);
    const reply=await post('/recovery',{email:account.email}); assert.equal(reply.status,202); assert.equal(reply.headers.get('cache-control'),'no-store'); assert.deepEqual(await reply.json(),{code:'ACCEPTED'});
    const token=await latestToken(db.pool,config);
    const invalid=await post('/recovery/reset',{token:'A'.repeat(43),password:nextPassword}); assert.equal(invalid.status,400);assert.deepEqual(await invalid.json(),{code:'INVALID_ACTION'});
    assert.equal((await post('/recovery/reset',{token,password:'x'.repeat(3000)})).status,413);
    const reset=await post('/recovery/reset',{token,password:nextPassword});assert.equal(reset.status,200);assert.deepEqual(await reset.json(),{code:'PASSWORD_RESET'});assert.equal(reset.headers.get('set-cookie'),null);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM identity_sessions')).rows[0].n,0);
    assert.equal((await post('/recovery/reset',{token,password:nextPassword})).status,400);
    for(let i=0;i<29;i++) await post('/recovery',{email:'unknown@example.test'});
    const throttled=await post('/recovery',{email:account.email});assert.equal(throttled.status,429);assert.match(throttled.headers.get('retry-after'),/^\d+$/);
  } finally {if(server)await new Promise(resolve=>server.close(resolve));await db.pool.end();}
});

test('recovery resets once concurrently, revokes every session and preserves roles/exemption', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); const config = authConfig(); const account = await createAuthAccount(db.pool, 'manager@example.test', ['manager','customer']);
    await db.pool.query("UPDATE accounts SET confirmation_status='exempt',email_verified_at=NULL,exemption_source='management',exemption_actor_id=$1,exemption_reason='Fixture exemption',exemption_at=now() WHERE id=$1", [account.accountId]);
    const sessions = await createSessionService(db.pool, config, { environment: { NODE_ENV: 'test' } });
    const first = await sessions.login({ email: account.email, password }, '127.0.0.1');
    const second = await sessions.login({ email: account.email, password, rememberMe: true }, '127.0.0.1');
    const recovery = createRecoveryService(db.pool, config);
    assert.deepEqual(await recovery.request({ email: ' MANAGER@example.test ' }, '127.0.0.1'), { code: 'ACCEPTED' });
    const token = await latestToken(db.pool, config);
    assert.equal((await db.pool.query('SELECT expires_at-created_at AS lifetime FROM identity_action_tokens')).rows[0].lifetime.hours, 1);
    const results = await Promise.allSettled([recovery.reset({ token, password: nextPassword }, '127.0.0.1'), recovery.reset({ token, password: nextPassword }, '127.0.0.1')]);
    assert.equal(results.filter(r => r.status==='fulfilled').length, 1);
    assert.equal(results.find(r => r.status==='rejected').reason.message, 'INVALID_ACTION');
    for (const session of [first,second]) await assert.rejects(sessions.resolve(session.sessionToken), { message: 'UNAUTHENTICATED' });
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM identity_sessions WHERE revoked_at IS NULL')).rows[0].n, 0);
    await assert.rejects(sessions.login({ email: account.email, password }, '127.0.0.1'), { message: 'INVALID_CREDENTIALS' });
    assert.deepEqual((await sessions.login({ email: account.email, password: nextPassword }, '127.0.0.1')).account.roles, ['customer','manager']);
    const saved = (await db.pool.query('SELECT status,confirmation_status,email_verified_at,exemption_source FROM accounts')).rows[0];
    assert.deepEqual(saved, { status: 'active', confirmation_status: 'exempt', email_verified_at: null, exemption_source: 'management' });
    const audit = JSON.stringify((await db.pool.query("SELECT * FROM audit_events WHERE action='account.password_set'")).rows);
    for (const secret of [password,nextPassword,token,first.sessionToken]) assert.equal(audit.includes(secret), false);
  } finally { await db.pool.end(); }
});

test('recovery replies generically for unknown/pending/inactive accounts and enforces resend limits', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); const config = authConfig(); let now = new Date();
    const account = await createAuthAccount(db.pool);
    const recovery = createRecoveryService(db.pool, config, { now: () => now });
    for (const status of ['pending','inactive']) {
      await db.pool.query("UPDATE accounts SET status=$1,deactivated_at=CASE WHEN $1='inactive' THEN now() ELSE NULL END", [status]);
      assert.deepEqual(await recovery.request({ email: account.email }, '127.0.0.1'), { code: 'ACCEPTED' });
    }
    assert.deepEqual(await recovery.request({ email: 'unknown@example.test' }, '127.0.0.1'), { code: 'ACCEPTED' });
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM identity_email_outbox')).rows[0].n, 0);
    await db.pool.query("UPDATE accounts SET status='active',deactivated_at=NULL");
    await recovery.request({ email: account.email }, '127.0.0.1'); const old = await latestToken(db.pool, config);
    await recovery.request({ email: account.email }, '127.0.0.1');
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM identity_action_tokens')).rows[0].n, 1);
    for (let i=0;i<4;i++) { now=new Date(+now+60000); await recovery.request({ email: account.email }, '127.0.0.1'); }
    const current = await latestToken(db.pool, config);
    await assert.rejects(recovery.reset({ token: old, password: nextPassword }, '127.0.0.1'), { message: 'INVALID_ACTION' });
    now=new Date(+now+60000); await recovery.request({ email: account.email }, '127.0.0.1');
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM identity_action_tokens')).rows[0].n, 5);
    await recovery.reset({ token: current, password: nextPassword }, '127.0.0.1');
    for (let i=0;i<30;i++) await recovery.request({ email: 'unknown@example.test' }, '127.0.0.2');
    await assert.rejects(recovery.request({ email: account.email }, '127.0.0.2'), { message: 'THROTTLED' });
  } finally { await db.pool.end(); }
});

test('recovery denies exact expiry, inactive people/accounts, stale versions and wrong-purpose links', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); const config = authConfig(); let now=new Date(); const account=await createAuthAccount(db.pool);
    const recovery=createRecoveryService(db.pool,config,{now:()=>now});
    await recovery.request({email:account.email},'127.0.0.1'); const token=await latestToken(db.pool,config);
    await db.pool.query("UPDATE accounts SET status='inactive',deactivated_at=now()");
    await assert.rejects(recovery.reset({token,password:nextPassword},'127.0.0.1'),{message:'INVALID_ACTION'});
    assert.equal((await db.pool.query('SELECT status FROM accounts')).rows[0].status,'inactive');
    await db.pool.query("UPDATE accounts SET status='active',deactivated_at=NULL; UPDATE people SET status='inactive'");
    await assert.rejects(recovery.reset({token,password:nextPassword},'127.0.0.1'),{message:'INVALID_ACTION'});
    await db.pool.query("UPDATE people SET status='active'; UPDATE accounts SET session_version=1");
    await assert.rejects(recovery.reset({token,password:nextPassword},'127.0.0.1'),{message:'INVALID_ACTION'});
    await db.pool.query('UPDATE accounts SET session_version=0');
    await db.pool.query("UPDATE identity_action_tokens SET purpose='email_confirmation'");
    await assert.rejects(recovery.reset({token,password:nextPassword},'127.0.0.1'),{message:'INVALID_ACTION'});
    await db.pool.query("UPDATE identity_action_tokens SET purpose='password_reset'");
    now=new Date(+now+3600000);
    await assert.rejects(recovery.reset({token,password:nextPassword},'127.0.0.1'),{message:'INVALID_ACTION'});
    assert.equal((await db.pool.query('SELECT consumed_at FROM identity_action_tokens')).rows[0].consumed_at,null);
  } finally { await db.pool.end(); }
});

test('reset audit failure rolls back credentials, sessions, token and delivery; weak/mass-assigned input is rejected', async () => {
  const db=await isolatedDatabase();
  try {
    migrate(db.name); const config=authConfig(); const account=await createAuthAccount(db.pool);
    const sessions=await createSessionService(db.pool,config); const login=await sessions.login({email:account.email,password},'127.0.0.1');
    const recovery=createRecoveryService(db.pool,config); await recovery.request({email:account.email},'127.0.0.1'); const token=await latestToken(db.pool,config);
    for (const input of [{token,password:'short'},{token,password:nextPassword,roles:['administrator']},{token,password:nextPassword,status:'active'}]) {
      await assert.rejects(recovery.reset(input,'127.0.0.1'),{message:'INVALID_REQUEST'});
    }
    await db.pool.query(`CREATE FUNCTION reject_reset_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$;
      CREATE TRIGGER reject_reset_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_reset_audit()`);
    await assert.rejects(recovery.reset({token,password:nextPassword},'127.0.0.1'));
    await sessions.resolve(login.sessionToken);
    assert.equal((await db.pool.query('SELECT consumed_at FROM identity_action_tokens')).rows[0].consumed_at,null);
    assert.equal((await db.pool.query("SELECT count(*)::int n FROM identity_email_outbox WHERE status='pending'")).rows[0].n,1);
    await db.pool.query('DROP TRIGGER reject_reset_audit ON audit_events');
    await recovery.reset({token,password:nextPassword},'127.0.0.1');
    await assert.rejects(sessions.resolve(login.sessionToken),{message:'UNAUTHENTICATED'});
  } finally { await db.pool.end(); }
});

test('recovery keeps development fixtures local and reserves persistent reset IP limits before password work', async () => {
  const db=await isolatedDatabase();
  try {
    migrate(db.name); const config=authConfig(); const account=await createAuthAccount(db.pool,'admin@conecta.example.test',['administrator']);
    await db.pool.query("UPDATE accounts SET development_fixture='admin'");
    const production=createRecoveryService(db.pool,config,{environment:{NODE_ENV:'production'}});
    assert.deepEqual(await production.request({email:account.email},'127.0.0.1'),{code:'ACCEPTED'});
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM identity_action_tokens')).rows[0].n,0);
    const environment={NODE_ENV:'development',IDENTITY_DEV_FIXTURES:'true',DATABASE_URL:db.pool.options.connectionString};
    const local=createRecoveryService(db.pool,config,{environment});
    await local.request({email:account.email},'127.0.0.1');const token=await latestToken(db.pool,config);
    await assert.rejects(production.reset({token,password:nextPassword},'127.0.0.1'),{message:'INVALID_ACTION'});
    await local.reset({token,password:nextPassword},'127.0.0.1');
    for(let i=0;i<30;i++) await assert.rejects(local.reset({token:'bad',password:'short'},'127.0.0.2'),{message:'INVALID_ACTION'});
    const restarted=createRecoveryService(db.pool,config,{environment});
    await assert.rejects(restarted.reset({token,password:'short'},'127.0.0.2'),{message:'THROTTLED'});
  } finally {await db.pool.end();}
});
