import test from 'node:test';
import assert from 'node:assert/strict';
import { isolatedDatabase, migrate } from './identity-helpers.mjs';
import { authConfig, password } from './identity-auth-helpers.mjs';
import { decryptOutboxPayload } from '../../dist/modules/identity/outbox-crypto.js';
import { createRegistrationService } from '../../dist/modules/identity/registration.js';

async function token(pool, config) {
  const row = (await pool.query("SELECT * FROM identity_email_outbox WHERE status='pending' ORDER BY created_at DESC LIMIT 1")).rows[0];
  return JSON.parse(decryptOutboxPayload({ keyId: row.key_id, nonce: row.nonce, authTag: row.auth_tag, ciphertext: row.ciphertext },
    { outboxId: row.id, actionTokenId: row.action_token_id, kind: 'action', recipientHash: row.recipient_hash }, config.secrets)).token;
}
const input = { fullName: 'Registration fixture', email: 'new@example.test', password, preferredLocale: 'es-MX', phone: null };

test('registration HTTP requires Origin/CSRF, denies pending login and GET confirmation, and sanitizes errors', async () => {
  const db = await isolatedDatabase(); let server;
  try {
    migrate(db.name); const config = authConfig();
    process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused'; process.env.IDENTITY_ENABLED = 'false';
    const { createApplication } = await import('../../dist/app.js');
    const app = await createApplication({ database: db.pool, identityConfig: config, environment: { NODE_ENV: 'test' } });
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1/auth`; const Origin = 'http://localhost:5173';
    const bootstrap = await fetch(base + '/csrf', { headers: { Origin } });
    const cookie = bootstrap.headers.get('set-cookie').split(';')[0]; const csrf = (await bootstrap.json()).csrfToken;
    const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: {
      Origin, 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': csrf, ...headers }, body: JSON.stringify(body) });
    for (const path of ['/register', '/confirmation/resend', '/confirmation']) {
      assert.equal((await post(path, {}, { Origin: 'http://evil.example', 'X-CSRF-Token': '' })).status, 403);
      assert.equal((await post(path, {}, { 'X-CSRF-Token': '' })).status, 403);
    }
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM accounts')).rows[0].n, 0);
    assert.equal((await post('/register', { ...input, roles: ['administrator'] })).status, 400);
    const response = await post('/register', input); assert.equal(response.status, 202);
    assert.equal(response.headers.get('cache-control'), 'no-store'); assert.deepEqual(await response.json(), { code: 'ACCEPTED' });
    const secret = await token(db.pool, config);
    assert.equal((await post('/login', { email: input.email, password, rememberMe: false })).status, 401);
    const get = await fetch(base + '/confirmation?token=' + secret, { headers: { Origin } });
    assert.equal(get.status, 404); assert.equal((await get.text()).includes(secret), false);
    assert.equal((await post('/confirmation', { token: secret })).status, 200);
    assert.equal((await post('/confirmation', { token: secret })).status, 400);
    const login = await post('/login', { email: input.email, password, rememberMe: false });
    assert.equal(login.status, 200); assert.deepEqual((await login.json()).account.roles, ['customer']);
    assert.equal((await post('/register', { ...input, fullName: 'x'.repeat(3000) })).status, 413);
  } finally { if (server) await new Promise(resolve => server.close(resolve)); await db.pool.end(); }
});

test('registration rolls back audit failures and concurrent duplicates; public IP limits persist', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); const config = authConfig(); const service = createRegistrationService(db.pool, config);
    await db.pool.query(`CREATE FUNCTION reject_registration_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END $$;
      CREATE TRIGGER reject_registration_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_registration_audit()`);
    await assert.rejects(service.register(input, '127.0.0.1'));
    for (const table of ['people', 'accounts', 'account_roles', 'identity_action_tokens', 'identity_email_outbox']) {
      assert.equal((await db.pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n, 0);
    }
    await db.pool.query('DROP TRIGGER reject_registration_audit ON audit_events');
    await Promise.all([service.register(input, '127.0.0.1'), service.register(input, '127.0.0.1')]);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM accounts')).rows[0].n, 1);
    for (let i = 0; i < 30; i++) await service.resend({ email: 'unknown@example.test' }, '127.0.0.2');
    await assert.rejects(service.resend({ email: input.email }, '127.0.0.2'), { message: 'THROTTLED' });
  } finally { await db.pool.end(); }
});

test('confirmation rejects stale versions/inactive people and rolls back token consumption when audit fails', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); const config = authConfig(); let now = new Date();
    const service = createRegistrationService(db.pool, config, { now: () => now });
    await service.register(input, '127.0.0.1'); const first = await token(db.pool, config);
    await db.pool.query('UPDATE accounts SET session_version=session_version+1');
    await assert.rejects(service.confirm({ token: first }, '127.0.0.1'), { message: 'INVALID_ACTION' });
    now = new Date(+now+60000); await service.resend({ email: input.email }, '127.0.0.1'); const current = await token(db.pool, config);
    await db.pool.query("UPDATE people SET status='inactive'");
    await assert.rejects(service.confirm({ token: current }, '127.0.0.1'), { message: 'INVALID_ACTION' });
    await db.pool.query("UPDATE people SET status='active'");
    await db.pool.query(`CREATE FUNCTION reject_confirmation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END $$;
      CREATE TRIGGER reject_confirmation_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_confirmation_audit()`);
    await assert.rejects(service.confirm({ token: current }, '127.0.0.1'));
    assert.equal((await db.pool.query('SELECT status FROM accounts')).rows[0].status, 'pending');
    assert.equal((await db.pool.query('SELECT consumed_at FROM identity_action_tokens WHERE revoked_at IS NULL')).rows[0].consumed_at, null);
    assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM identity_email_outbox WHERE status='pending'")).rows[0].n, 1);
    await db.pool.query('DROP TRIGGER reject_confirmation_audit ON audit_events');
    await service.confirm({ token: current }, '127.0.0.1');
  } finally { await db.pool.end(); }
});

test('registration assigns only customer, preserves duplicate identity and confirms once without automatic login', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); const config = authConfig(); let now = new Date();
    const service = createRegistrationService(db.pool, config, { now: () => now });
    for (const field of ['roles', 'status', 'personId', 'confirmationStatus', 'developmentFixture']) {
      await assert.rejects(service.register({ ...input, [field]: 'administrator' }, '127.0.0.1'), { message: 'INVALID_REQUEST' });
    }
    for (const email of ['admin@conecta.example.test', 'testuser@conecta.example.test']) {
      assert.deepEqual(await service.register({ ...input, email }, '127.0.0.1'), { code: 'ACCEPTED' });
    }
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM accounts')).rows[0].n, 0);
    assert.deepEqual(await service.register(input, '127.0.0.1'), { code: 'ACCEPTED' });
    const account = (await db.pool.query('SELECT * FROM accounts')).rows[0];
    assert.equal(account.status, 'pending'); assert.equal(account.confirmation_status, 'pending');
    assert.deepEqual((await db.pool.query('SELECT role FROM account_roles')).rows.map(r => r.role), ['customer']);
    const secret = await token(db.pool, config);
    assert.deepEqual(await service.register({ ...input, fullName: 'Attacker', password: 'Different long password' }, '127.0.0.1'), { code: 'ACCEPTED' });
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM people')).rows[0].n, 1);
    assert.equal((await db.pool.query('SELECT full_name FROM people')).rows[0].full_name, input.fullName);
    const result = await Promise.allSettled([service.confirm({ token: secret }, '127.0.0.1'), service.confirm({ token: secret }, '127.0.0.1')]);
    assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await db.pool.query('SELECT status FROM accounts')).rows[0].status, 'active');
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_sessions')).rows[0].n, 0);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM audit_events')).rows[0].n, 2);
    assert.equal(JSON.stringify((await db.pool.query('SELECT changes FROM audit_events')).rows).includes(secret), false);
  } finally { await db.pool.end(); }
});

test('confirmation expiry, resend limits and inactive/unknown recipients have safe responses', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); const config = authConfig(); const start = new Date(); let now = start;
    const service = createRegistrationService(db.pool, config, { now: () => now });
    await service.register(input, '127.0.0.1'); const old = await token(db.pool, config);
    assert.deepEqual(await service.resend({ email: input.email }, '127.0.0.1'), { code: 'ACCEPTED' });
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_action_tokens')).rows[0].n, 1);
    for (let i = 1; i <= 4; i++) { now = new Date(+start + i * 60000); await service.resend({ email: input.email }, '127.0.0.1'); }
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_action_tokens')).rows[0].n, 5);
    await assert.rejects(service.confirm({ token: old }, '127.0.0.1'), { message: 'INVALID_ACTION' });
    now = new Date(+start + 5 * 60000); await service.resend({ email: input.email }, '127.0.0.1');
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_action_tokens')).rows[0].n, 5);
    now = new Date(+start + 3600000); await service.resend({ email: input.email }, '127.0.0.1'); const latest = await token(db.pool, config);
    now = new Date(+now + 24 * 3600000); await assert.rejects(service.confirm({ token: latest }, '127.0.0.1'), { message: 'INVALID_ACTION' });
    assert.deepEqual(await service.resend({ email: 'unknown@example.test' }, '127.0.0.1'), { code: 'ACCEPTED' });
    await db.pool.query("UPDATE accounts SET status='inactive',deactivated_at=now() WHERE email=$1", [input.email]);
    await service.resend({ email: input.email }, '127.0.0.1'); await service.register(input, '127.0.0.1');
    assert.equal((await db.pool.query('SELECT status FROM accounts')).rows[0].status, 'inactive');
  } finally { await db.pool.end(); }
});
