import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isolatedDatabase, migrate } from './identity-helpers.mjs';
import { authConfig, createAuthAccount, password } from './identity-auth-helpers.mjs';

const load = () => import('../../dist/modules/identity/sessions.js');
const digest = value => createHash('sha256').update(value).digest();
const denied = code => error => error.code === code;

test('normal login stores hashes only, returns own profile and expires at exact fixed 7/30-day boundaries', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); const owner = await createAuthAccount(db.pool);
    const { createSessionService } = await load();
    let now = new Date('2026-10-03T12:00Z');
    const service = await createSessionService(db.pool, authConfig(), { now: () => now, environment: { NODE_ENV: 'test' } });
    const login = () => service.login({ email: ' CUSTOMER@EXAMPLE.TEST ', password }, '127.0.0.1');
    const first = await login();
    const remembered = await service.login({ email: owner.email, password, rememberMe: true }, '127.0.0.1');
    assert.notEqual(first.sessionToken, remembered.sessionToken);
    assert.match(first.sessionToken, /^[A-Za-z0-9_-]{43}$/);
    assert.match(first.csrfToken, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(first.sessionToken, first.csrfToken);
    assert.equal(first.account.id, owner.accountId);
    assert.deepEqual(first.account.roles, ['customer']);
    assert.equal(first.expiresAt, '2026-10-10T12:00:00.000Z');
    assert.equal(remembered.expiresAt, '2026-11-02T12:00:00.000Z');
    const rows = (await db.pool.query('SELECT * FROM identity_sessions ORDER BY remember_me')).rows;
    assert.deepEqual(rows[0].token_hash, digest(first.sessionToken));
    assert.deepEqual(rows[0].csrf_hash, digest(first.csrfToken));
    assert.equal(JSON.stringify(rows).includes(first.sessionToken), false);
    assert.equal(JSON.stringify(rows).includes(first.csrfToken), false);
    assert.equal((await service.resolve(first.sessionToken)).csrfToken, first.csrfToken);
    await assert.rejects(service.login({ email: owner.email, password: 'wrong password' }, '127.0.0.1'), denied('INVALID_CREDENTIALS'));
    await assert.rejects(service.login({ email: 'missing@example.test', password }, '127.0.0.1'), denied('INVALID_CREDENTIALS'));
    await assert.rejects(service.login({ email: owner.email, password, roles: ['administrator'] }, '127.0.0.1'), denied('INVALID_REQUEST'));
    for (const token of [undefined, '', first.sessionToken + '=', '%malformed', 'a'.repeat(4096)]) {
      await assert.rejects(service.resolve(token), denied('UNAUTHENTICATED'));
    }
    now = new Date('2026-10-10T11:59:59.999Z');
    assert.equal((await service.resolve(first.sessionToken)).expiresAt, first.expiresAt);
    now = new Date('2026-10-10T12:00:00Z');
    await assert.rejects(service.resolve(first.sessionToken), denied('UNAUTHENTICATED'));
    await service.resolve(remembered.sessionToken);
    now = new Date('2026-11-02T12:00:00Z');
    await assert.rejects(service.resolve(remembered.sessionToken), denied('UNAUTHENTICATED'));
  } finally { await db.pool.end(); }
});

test('current multi-role facts enforce management denial and status/version/credential changes revoke access', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); const customer = await createAuthAccount(db.pool, 'multi@example.test', ['customer', 'instructor']);
    const manager = await createAuthAccount(db.pool, 'manager@example.test', ['manager']);
    const { createSessionService } = await load();
    const service = await createSessionService(db.pool, authConfig(), { environment: { NODE_ENV: 'test' } });
    const logged = await service.login({ email: customer.email, password }, '127.0.0.1');
    const managed = await service.login({ email: manager.email, password }, '127.0.0.2');
    await assert.rejects(service.resolve(logged.sessionToken, ['administrator', 'manager']), denied('FORBIDDEN'));
    await service.resolve(logged.sessionToken, ['customer']);
    assert.deepEqual((await service.resolve(managed.sessionToken, ['administrator', 'manager'])).account.roles, ['manager']);
    // Changing returned objects cannot forge DB-derived permissions on subsequent requests.
    logged.account.roles.push('administrator');
    await assert.rejects(service.resolve(logged.sessionToken, ['administrator']), denied('FORBIDDEN'));
    await db.pool.query('DELETE FROM account_roles WHERE account_id=$1', [manager.accountId]);
    await assert.rejects(service.resolve(managed.sessionToken, ['manager']), denied('FORBIDDEN'));
    await db.pool.query('UPDATE accounts SET session_version=session_version+1 WHERE id=$1', [customer.accountId]);
    await assert.rejects(service.resolve(logged.sessionToken), denied('UNAUTHENTICATED'));
    const fresh = await service.login({ email: customer.email, password }, '127.0.0.1');
    await db.pool.query("UPDATE people SET status='inactive' WHERE id=$1", [customer.personId]);
    await assert.rejects(service.resolve(fresh.sessionToken), denied('UNAUTHENTICATED'));
    await assert.rejects(service.login({ email: customer.email, password }, '127.0.0.1'), denied('INVALID_CREDENTIALS'));
    await db.pool.query("UPDATE people SET status='active' WHERE id=$1", [customer.personId]);
    await db.pool.query("UPDATE accounts SET status='inactive',deactivated_at=now() WHERE id=$1", [customer.accountId]);
    await assert.rejects(service.resolve(fresh.sessionToken), denied('UNAUTHENTICATED'));
    await assert.rejects(service.login({ email: customer.email, password }, '127.0.0.1'), denied('INVALID_CREDENTIALS'));
    await db.pool.query("UPDATE accounts SET status='pending',deactivated_at=NULL WHERE id=$1", [customer.accountId]);
    await assert.rejects(service.login({ email: customer.email, password }, '127.0.0.1'), denied('INVALID_CREDENTIALS'));
    await db.pool.query("UPDATE accounts SET status='active',password_hash='$argon2id$malformed' WHERE id=$1", [customer.accountId]);
    await assert.rejects(service.login({ email: customer.email, password }, '127.0.0.1'), denied('INVALID_CREDENTIALS'));
  } finally { await db.pool.end(); }
});

test('logout affects one session; all-device logout revokes every session without changing profile or role history', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); const owner = await createAuthAccount(db.pool);
    const { createSessionService } = await load();
    const service = await createSessionService(db.pool, authConfig(), { environment: { NODE_ENV: 'test' } });
    const login = () => service.login({ email: owner.email, password }, '127.0.0.1');
    const first = await login(); const second = await login();
    await service.logout(first.sessionToken); await service.logout(first.sessionToken); await service.logout('malformed');
    await assert.rejects(service.resolve(first.sessionToken), denied('UNAUTHENTICATED'));
    await service.resolve(second.sessionToken);
    const third = await login();
    const result = await Promise.allSettled([service.logoutAll(second.sessionToken), service.logoutAll(third.sessionToken)]);
    assert.equal(result.filter(item => item.status === 'fulfilled').length, 1);
    assert.ok(result.filter(item => item.status === 'rejected').every(item => item.reason.code === 'UNAUTHENTICATED'));
    await assert.rejects(service.resolve(second.sessionToken), denied('UNAUTHENTICATED'));
    await assert.rejects(service.resolve(third.sessionToken), denied('UNAUTHENTICATED'));
    assert.equal((await db.pool.query('SELECT session_version FROM accounts WHERE id=$1', [owner.accountId])).rows[0].session_version, 1);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_sessions WHERE revoked_at IS NULL')).rows[0].n, 0);
    assert.equal((await db.pool.query('SELECT full_name FROM people WHERE id=$1', [owner.personId])).rows[0].full_name, 'Auth fixture');
    assert.equal((await db.pool.query('SELECT role FROM account_roles WHERE account_id=$1', [owner.accountId])).rows[0].role, 'customer');
  } finally { await db.pool.end(); }
});

test('fixture login requires opt-in development and the matching local database, including after session issuance', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name);
    const environment = { NODE_ENV: 'development', IDENTITY_DEV_FIXTURES: 'true', DATABASE_URL: db.pool.options.connectionString };
    const { generateFirstAdminSql, createDevelopmentTestUser } = await import('../../dist/modules/identity/bootstrap.js');
    await db.pool.query(await generateFirstAdminSql({ development: true, operator: 'isolated-test', environment }));
    await createDevelopmentTestUser(db.pool, 'admin', environment);
    const { createSessionService } = await load();
    const config = authConfig();
    const service = await createSessionService(db.pool, config, { environment });
    const logged = await service.login({ email: 'admin@conecta.example.test', password: 'admin' }, '127.0.0.1');
    await service.resolve(logged.sessionToken, ['administrator']);
    await service.login({ email: 'testuser@conecta.example.test', password: 'testuser' }, '127.0.0.2');
    for (const change of [{ NODE_ENV: 'production' }, { NODE_ENV: 'test' }, { IDENTITY_DEV_FIXTURES: 'false' },
      { DATABASE_URL: 'postgresql://unused:unused@localhost/production' }]) {
      const deniedService = await createSessionService(db.pool, config, { environment: { ...environment, ...change } });
      await assert.rejects(deniedService.login({ email: 'admin@conecta.example.test', password: 'admin' }, '127.0.0.3'), denied('INVALID_CREDENTIALS'));
      await assert.rejects(deniedService.resolve(logged.sessionToken), denied('UNAUTHENTICATED'));
    }
    await db.pool.query("UPDATE accounts SET development_fixture=NULL WHERE email='admin@conecta.example.test'");
    await assert.rejects(service.login({ email: 'admin@conecta.example.test', password: 'admin' }, '127.0.0.1'), denied('INVALID_CREDENTIALS'));
    await assert.rejects(service.resolve(logged.sessionToken), denied('UNAUTHENTICATED'));
  } finally { await db.pool.end(); }
});

test('login cannot reissue access after a concurrent session-version change during password verification', async () => {
  const db = await isolatedDatabase();
  const blocker = await db.pool.connect();
  let pending;
  try {
    migrate(db.name); const owner = await createAuthAccount(db.pool);
    const { createSessionService } = await load();
    const service = await createSessionService(db.pool, authConfig(), { environment: { NODE_ENV: 'test' } });
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [owner.accountId]);
    pending = service.login({ email: owner.email, password }, '127.0.0.1').then(value => ({ value }), error => ({ error }));
    let waiting = false;
    for (let i = 0; i < 100; i++) {
      waiting = (await db.pool.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%identity-login-lock%') AS waiting")).rows[0].waiting;
      if (waiting) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(waiting, true, 'login must reach the real PostgreSQL lock barrier');
    await blocker.query('UPDATE accounts SET session_version=session_version+1 WHERE id=$1', [owner.accountId]);
    await blocker.query('COMMIT');
    assert.equal((await pending).error.code, 'INVALID_CREDENTIALS');
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_sessions')).rows[0].n, 0);
  } finally { await blocker.query('ROLLBACK'); blocker.release(); if (pending) await pending; await db.pool.end(); }
});

test('session hash corruption fails closed and failed session writes or revocations roll back atomically', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); const owner = await createAuthAccount(db.pool);
    const { createSessionService } = await load();
    const service = await createSessionService(db.pool, authConfig(), { environment: { NODE_ENV: 'test' } });
    const first = await service.login({ email: owner.email, password }, '127.0.0.1');
    await db.pool.query('UPDATE identity_sessions SET csrf_hash=$1 WHERE token_hash=$2', [Buffer.alloc(32), digest(first.sessionToken)]);
    await assert.rejects(service.resolve(first.sessionToken), denied('UNAUTHENTICATED'));
    await db.pool.query(`CREATE FUNCTION reject_session_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'isolated insertion failure'; END $$;
      CREATE TRIGGER reject_session_insert BEFORE INSERT ON identity_sessions FOR EACH ROW EXECUTE FUNCTION reject_session_insert()`);
    await assert.rejects(service.login({ email: owner.email, password }, '127.0.0.1'), { code: 'P0001' });
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_sessions')).rows[0].n, 1);
    await db.pool.query('DROP TRIGGER reject_session_insert ON identity_sessions');
    const second = await service.login({ email: owner.email, password }, '127.0.0.1');
    await db.pool.query(`CREATE FUNCTION reject_session_revocation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'isolated revocation failure'; END $$;
      CREATE TRIGGER reject_session_revocation BEFORE UPDATE OF revoked_at ON identity_sessions FOR EACH ROW EXECUTE FUNCTION reject_session_revocation()`);
    await assert.rejects(service.logoutAll(second.sessionToken), { code: 'P0001' });
    assert.equal((await db.pool.query('SELECT session_version FROM accounts WHERE id=$1', [owner.accountId])).rows[0].session_version, 0);
    await service.resolve(second.sessionToken);
  } finally { await db.pool.end(); }
});
