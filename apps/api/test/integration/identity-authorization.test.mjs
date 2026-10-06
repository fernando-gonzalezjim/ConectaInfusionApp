import test from 'node:test';
import assert from 'node:assert/strict';
import { isolatedDatabase, migrate } from './identity-helpers.mjs';
import { authConfig, createAuthAccount, password } from './identity-auth-helpers.mjs';

process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused';
process.env.IDENTITY_ENABLED = 'false';
async function harness(db) {
  const { createApplication } = await import('../../dist/app.js');
  const app = await createApplication({ database: db.pool, identityConfig: authConfig(), environment: { NODE_ENV: 'test' } });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  return { base: `http://127.0.0.1:${server.address().port}/api/v1`, close: () => new Promise(resolve => server.close(resolve)) };
}
async function login(base, email) {
  const csrf = await fetch(base + '/auth/csrf');
  const cookie = csrf.headers.get('Set-Cookie').split(';')[0]; const token = (await csrf.json()).csrfToken;
  const response = await fetch(base + '/auth/login', { method: 'POST', headers: { Origin: 'http://localhost:5174',
    Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': token }, body: JSON.stringify({ email, password }) });
  assert.equal(response.status, 200);
  return response.headers.getSetCookie().find(value => value.startsWith('conecta_session=')).split(';')[0];
}

test('administrative access enforces current server roles for every actor and cannot be forged through the frontend', async () => {
  const db = await isolatedDatabase(); let server;
  try {
    migrate(db.name); server = await harness(db);
    const absent = await fetch(server.base + '/management/access');
    assert.equal(absent.status, 401); assert.deepEqual(await absent.json(), { code: 'UNAUTHENTICATED' });
    for (const roles of [['customer'], ['instructor'], ['reception'], ['cafe_staff'], ['customer', 'instructor'], ['administrator'], ['manager'], ['customer', 'manager']]) {
      const account = await createAuthAccount(db.pool, `${roles.join('-')}@example.test`, roles);
      const cookie = await login(server.base, account.email); const privileged = roles.includes('administrator') || roles.includes('manager');
      const response = await fetch(server.base + '/management/access?role=administrator&accountId=forged', { headers: {
        Cookie: cookie, Origin: 'http://localhost:5174', 'X-Role': 'administrator', 'X-Account-Id': 'forged' } });
      assert.equal(response.status, privileged ? 200 : 403); assert.equal(response.headers.get('Cache-Control'), 'no-store');
      const body = await response.json();
      if (privileged) {
        assert.deepEqual(Object.keys(body).sort(), ['account', 'capabilities']); assert.equal(body.account.id, account.accountId);
        assert.deepEqual(body.capabilities, { administerIdentity: true }); assert.equal(JSON.stringify(body).includes(password), false);
        await db.pool.query("DELETE FROM account_roles WHERE account_id=$1 AND role IN ('administrator','manager')", [account.accountId]);
        assert.equal((await fetch(server.base + '/management/access', { headers: { Cookie: cookie } })).status, 403);
      } else assert.deepEqual(body, { code: 'FORBIDDEN' });
    }
    assert.equal((await fetch(server.base + '/management/access', { headers: { Origin: 'http://localhost:5999' } })).status, 403);
    const preflight = await fetch(server.base + '/management/access', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' } });
    assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'), 'true');
  } finally { if (server) await server.close(); await db.pool.end(); }
});

test('administrative access fails closed on revocation, inactive accounts and unavailable persistence', async () => {
  const db = await isolatedDatabase(); let server;
  try {
    migrate(db.name); server = await harness(db); const account = await createAuthAccount(db.pool, 'manager@example.test', ['manager']);
    const cookie = await login(server.base, account.email);
    await db.pool.query('UPDATE accounts SET session_version=session_version+1 WHERE id=$1', [account.accountId]);
    assert.equal((await fetch(server.base + '/management/access', { headers: { Cookie: cookie } })).status, 401);
    const fresh = await login(server.base, account.email);
    await db.pool.query("UPDATE people SET status='inactive' WHERE id=$1", [account.personId]);
    assert.equal((await fetch(server.base + '/management/access', { headers: { Cookie: fresh } })).status, 401);
    await db.pool.end();
    const failure = await fetch(server.base + '/management/access', { headers: { Cookie: fresh } });
    assert.equal(failure.status, 503); assert.deepEqual(await failure.json(), { code: 'UNAVAILABLE' });
  } finally { if (server) await server.close(); if (!db.pool.ended) await db.pool.end(); }
});
