import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { isolatedDatabase, migrate } from './identity-helpers.mjs';
import { authConfig, createAuthAccount, password } from './identity-auth-helpers.mjs';

const load = () => import('../../dist/modules/identity/auth-routes.js');
async function harness(db, config = authConfig()) {
  const { createSessionService } = await import('../../dist/modules/identity/sessions.js');
  const { createAuthRouter, readSessionCookie } = await load();
  const service = await createSessionService(db.pool, config, { environment: { NODE_ENV: 'test' } });
  const app = express();
  // Explicit isolated-test guard only. Real Origin/CSRF middleware is I07; this router is not publicly mounted.
  app.use('/auth', createAuthRouter(service, config, (req, res, next) => {
    if (req.get('X-I06-Test-Guard') !== 'accepted') { res.status(403).json({ code: 'FORBIDDEN' }); return; }
    next();
  }));
  // Test-only protected operation proves server-derived roles; no management operation is mounted by I06.
  app.get('/auth/management-probe', async (req, res) => {
    try {
      const session = await service.resolve(readSessionCookie(req.headers.cookie), ['administrator', 'manager']);
      res.json({ accountId: session.account.id });
    } catch (error) { res.status(error.code === 'FORBIDDEN' ? 403 : 401).json({ code: error.code }); }
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/auth`;
  return { base, service, close: () => new Promise(resolve => server.close(resolve)) };
}
function post(base, path, body, cookie, guard = true) {
  return fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(guard ? { 'X-I06-Test-Guard': 'accepted' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
}

test('auth router issues a host-only cookie and exposes only safe account/session metadata', async () => {
  const db = await isolatedDatabase(); let server;
  try {
    migrate(db.name); await createAuthAccount(db.pool, 'customer@example.test', ['customer', 'instructor']);
    server = await harness(db);
    const login = await post(server.base, '/login', { email: 'customer@example.test', password });
    assert.equal(login.status, 200);
    assert.equal(login.headers.get('Cache-Control'), 'no-store');
    const cookie = login.headers.get('Set-Cookie');
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /Path=\//);
    assert.match(cookie, /Max-Age=604800/); assert.doesNotMatch(cookie, /Domain=|Secure/);
    const header = cookie.split(';')[0]; const token = header.split('=')[1];
    const body = await login.json();
    assert.equal((await fetch(server.base + '/management-probe?role=administrator', { headers: { Cookie: header } })).status, 403);
    assert.deepEqual(Object.keys(body).sort(), ['account', 'csrfToken', 'expiresAt']);
    assert.equal(JSON.stringify(body).includes(token), false);
    assert.equal(JSON.stringify(body).includes(password), false);
    assert.equal(JSON.stringify(body).includes('password_hash'), false);
    const current = await fetch(server.base + '/session', { headers: { Cookie: header } });
    assert.equal(current.status, 200);
    const currentBody = await current.json();
    assert.deepEqual(currentBody.account, body.account); assert.equal(currentBody.csrfToken, body.csrfToken);
    assert.equal(currentBody.expiresAt, body.expiresAt);
    assert.equal((await post(server.base, '/logout-all', { accountId: 'forged-other-account' }, header)).status, 400);
    assert.equal((await fetch(server.base + '/session', { headers: { Cookie: `${header};${header}` } })).status, 401);
    const remembered = await post(server.base, '/login', { email: 'customer@example.test', password, rememberMe: true });
    assert.equal(remembered.status, 200); assert.match(remembered.headers.get('Set-Cookie'), /Max-Age=2592000/);
    const loggedOut = await post(server.base, '/logout', {}, header);
    assert.equal(loggedOut.status, 204); assert.match(loggedOut.headers.get('Set-Cookie'), /conecta_session=;/);
    assert.equal((await fetch(server.base + '/session', { headers: { Cookie: header } })).status, 401);
    const other = remembered.headers.get('Set-Cookie').split(';')[0];
    assert.equal((await post(server.base, '/logout-all', {}, other)).status, 204);
    assert.equal((await fetch(server.base + '/session', { headers: { Cookie: other } })).status, 401);
    await createAuthAccount(db.pool, 'manager@example.test', ['manager']);
    const manager = await post(server.base, '/login', { email: 'manager@example.test', password });
    const managerCookie = manager.headers.get('Set-Cookie').split(';')[0];
    assert.equal((await fetch(server.base + '/management-probe', { headers: { Cookie: managerCookie } })).status, 200);
  } finally { if (server) await server.close(); await db.pool.end(); }
});

test('auth router keeps failures generic, rejects role/body injection and maps infrastructure failures safely', async () => {
  const db = await isolatedDatabase(); let server;
  try {
    migrate(db.name); const owner = await createAuthAccount(db.pool);
    server = await harness(db);
    for (const email of [owner.email, 'missing@example.test']) {
      const response = await post(server.base, '/login', { email, password: 'wrong password' });
      assert.equal(response.status, 401); assert.deepEqual(await response.json(), { code: 'INVALID_CREDENTIALS' });
      assert.equal(response.headers.get('Set-Cookie'), null);
    }
    await db.pool.query("UPDATE accounts SET status='inactive',deactivated_at=now() WHERE id=$1", [owner.accountId]);
    const inactive = await post(server.base, '/login', { email: owner.email, password });
    assert.equal(inactive.status, 401); assert.deepEqual(await inactive.json(), { code: 'INVALID_CREDENTIALS' });
    for (const body of [{ email: owner.email, password, role: 'administrator' }, { email: owner.email, password, rememberMe: 'true' }, null]) {
      const response = await post(server.base, '/login', body);
      assert.equal(response.status, 400); assert.deepEqual(await response.json(), { code: 'INVALID_REQUEST' });
    }
    const invalidJson = await fetch(server.base + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"private-secret-marker"' });
    assert.equal(invalidJson.status, 400); assert.deepEqual(await invalidJson.json(), { code: 'INVALID_REQUEST' });
    const oversized = await post(server.base, '/login', { email: owner.email, password: 'x'.repeat(4096) });
    assert.equal(oversized.status, 413); assert.deepEqual(await oversized.json(), { code: 'INVALID_REQUEST' });
    assert.equal((await post(server.base, '/login', { email: owner.email, password }, undefined, false)).status, 403);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_sessions')).rows[0].n, 0);
    await db.pool.end();
    const unavailable = await post(server.base, '/login', { email: owner.email, password });
    assert.equal(unavailable.status, 503); assert.deepEqual(await unavailable.json(), { code: 'UNAVAILABLE' });
  } finally { if (server) await server.close(); if (!db.pool.ended) await db.pool.end(); }
});

test('HTTP login enforces shared throttling before hashing and HTTPS configuration sets Secure cookies', async () => {
  const db = await isolatedDatabase(); let server;
  try {
    migrate(db.name); await createAuthAccount(db.pool);
    const config = authConfig(); server = await harness(db, { ...config, publicOrigin: 'https://studio.example.test' });
    const success = await post(server.base, '/login', { email: 'customer@example.test', password });
    assert.equal(success.status, 200); assert.match(success.headers.get('Set-Cookie'), /Secure/);
    for (let i = 0; i < 10; i++) {
      assert.equal((await post(server.base, '/login', { email: 'missing@example.test', password })).status, 401);
    }
    const limited = await post(server.base, '/login', { email: 'missing@example.test', password });
    assert.equal(limited.status, 429); assert.deepEqual(await limited.json(), { code: 'THROTTLED' });
    assert.ok(Number(limited.headers.get('Retry-After')) > 0);
  } finally { if (server) await server.close(); await db.pool.end(); }
});
