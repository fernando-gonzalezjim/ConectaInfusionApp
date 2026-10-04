import test from 'node:test';
import assert from 'node:assert/strict';
import { isolatedDatabase, migrate } from './identity-helpers.mjs';
import { authConfig, createAuthAccount, password } from './identity-auth-helpers.mjs';

const customerOrigin = 'http://localhost:5173';
const managementOrigin = 'http://localhost:5174';
// The imported default application cannot contact a developer database; harnesses inject their disposable pool.
process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused';
process.env.IDENTITY_ENABLED = 'false';
async function harness(db, config = authConfig()) {
  const { createApplication } = await import('../../dist/app.js');
  const app = await createApplication({ database: db.pool, identityConfig: config, environment: { NODE_ENV: 'test' } });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  return { base: `http://127.0.0.1:${server.address().port}/api/v1`, close: () => new Promise(resolve => server.close(resolve)) };
}
async function anonymous(base, origin = customerOrigin) {
  const response = await fetch(base + '/auth/csrf', { headers: { Origin: origin } });
  assert.equal(response.status, 200);
  return { cookie: response.headers.get('Set-Cookie').split(';')[0], token: (await response.json()).csrfToken };
}
function post(base, path, body, cookie, token, origin = customerOrigin, headers = {}) {
  return fetch(base + '/auth' + path, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(origin !== undefined ? { Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}),
    ...(token ? { 'X-CSRF-Token': token } : {}), ...headers }, body: JSON.stringify(body) });
}

test('enabled application mounts login/session/logout with exact credential origins and safe contracts', async () => {
  const db = await isolatedDatabase(); let server;
  try {
    migrate(db.name); const account = await createAuthAccount(db.pool, 'customer@example.test', ['customer', 'instructor']);
    server = await harness(db);
    assert.equal((await fetch(server.base + '/health')).status, 200);
    assert.equal((await fetch(server.base + '/settings/public')).status, 200);
    const before = await db.pool.query('SELECT count(*)::int AS n FROM identity_sessions');
    const csrf = await anonymous(server.base);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_sessions')).rows[0].n, before.rows[0].n);
    const preflight = await fetch(server.base + '/auth/login', { method: 'OPTIONS', headers: {
      Origin: managementOrigin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Content-Type,X-CSRF-Token' } });
    assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), managementOrigin);
    assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'), 'true');
    assert.match(preflight.headers.get('Access-Control-Allow-Headers'), /X-CSRF-Token/i);
    assert.match(preflight.headers.get('Vary'), /Origin/);
    const login = await post(server.base, '/login', { email: account.email, password, rememberMe: true }, csrf.cookie, csrf.token);
    assert.equal(login.status, 200); assert.equal(login.headers.get('Access-Control-Allow-Origin'), customerOrigin);
    assert.equal(login.headers.get('Access-Control-Allow-Credentials'), 'true');
    assert.equal(login.headers.get('Cache-Control'), 'no-store');
    const setCookies = login.headers.getSetCookie();
    assert.ok(setCookies.some(value => value.startsWith('conecta_csrf=;')));
    const sessionCookie = setCookies.find(value => value.startsWith('conecta_session='));
    assert.match(sessionCookie, /HttpOnly/); assert.match(sessionCookie, /SameSite=Lax/);
    assert.match(sessionCookie, /Max-Age=2592000/); assert.doesNotMatch(sessionCookie, /Domain=/);
    const cookie = sessionCookie.split(';')[0]; const body = await login.json();
    assert.deepEqual(Object.keys(body).sort(), ['account', 'csrfToken', 'expiresAt']);
    assert.equal(body.account.id, account.accountId); assert.deepEqual(body.account.roles, ['customer', 'instructor']);
    assert.equal(JSON.stringify(body).includes(password), false);
    assert.equal(JSON.stringify(body).includes(cookie.split('=')[1]), false);
    for (const origin of [customerOrigin, managementOrigin]) {
      const session = await fetch(server.base + '/auth/session', { headers: { Origin: origin, Cookie: cookie } });
      assert.equal(session.status, 200); assert.equal((await session.json()).csrfToken, body.csrfToken);
    }
    const logout = await post(server.base, '/logout-all', {}, cookie, body.csrfToken, managementOrigin);
    assert.equal(logout.status, 204);
    assert.equal((await fetch(server.base + '/auth/session', { headers: { Cookie: cookie } })).status, 401);
    assert.equal((await db.pool.query('SELECT session_version FROM accounts WHERE id=$1', [account.accountId])).rows[0].session_version, 1);
  } finally { if (server) await server.close(); await db.pool.end(); }
});

test('direct anonymous/session mutations reject foreign Origin, token swapping and simple request bypasses without writes', async () => {
  const db = await isolatedDatabase(); let server;
  try {
    migrate(db.name); await createAuthAccount(db.pool); server = await harness(db);
    const first = await anonymous(server.base); const other = await anonymous(server.base);
    const withoutOrigin = await fetch(server.base + '/auth/login', { method: 'POST', headers: {
      Cookie: first.cookie, 'X-CSRF-Token': first.token, 'Content-Type': 'application/json', Referer: customerOrigin + '/' },
      body: JSON.stringify({ email: 'customer@example.test', password }) });
    assert.equal(withoutOrigin.status, 403); assert.deepEqual(await withoutOrigin.json(), { code: 'FORBIDDEN' });
    for (const [cookie, token, origin, headers] of [
      [undefined, undefined, customerOrigin, {}], [first.cookie, undefined, customerOrigin, {}],
      [first.cookie, other.token, customerOrigin, {}], [first.cookie, first.token, 'null', {}],
      [first.cookie, first.token, 'http://localhost:5999', {}], [first.cookie, first.token, customerOrigin + '.evil.test', {}],
      [first.cookie, first.token, '', {}], [first.cookie, first.token, customerOrigin, { 'Content-Type': 'text/plain' }],
    ]) {
      const response = await post(server.base, '/login', { email: 'customer@example.test', password }, cookie, token, origin, headers);
      assert.equal(response.status, 403); assert.deepEqual(await response.json(), { code: 'FORBIDDEN' });
      assert.equal(response.headers.get('Set-Cookie'), null);
    }
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_sessions')).rows[0].n, 0);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_throttles')).rows[0].n, 0);
    const login = await post(server.base, '/login', { email: 'customer@example.test', password }, first.cookie, first.token);
    assert.equal(login.status, 200);
    const cookie = login.headers.getSetCookie().find(value => value.startsWith('conecta_session=')).split(';')[0];
    const sessionToken = (await login.json()).csrfToken;
    const secondLogin = await post(server.base, '/login', { email: 'customer@example.test', password }, other.cookie, other.token);
    assert.equal(secondLogin.status, 200);
    const foreignSessionCsrf = (await secondLogin.json()).csrfToken;
    for (const path of ['/logout', '/logout-all']) {
      for (const [token, origin] of [[undefined, customerOrigin], [first.token, customerOrigin], [foreignSessionCsrf, customerOrigin], [sessionToken, 'http://localhost:5999']]) {
        const response = await post(server.base, path, {}, cookie, token, origin);
        assert.equal(response.status, 403); assert.deepEqual(await response.json(), { code: 'FORBIDDEN' });
      }
    }
    assert.equal((await fetch(server.base + '/auth/session', { headers: { Cookie: cookie } })).status, 200);
    assert.equal((await post(server.base, '/logout', {}, cookie, sessionToken)).status, 204);
    const foreign = await fetch(server.base + '/auth/csrf', { headers: { Origin: 'http://localhost:5999' } });
    assert.equal(foreign.status, 403); assert.equal(foreign.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal((await fetch(server.base + '/auth/session', { headers: { Origin: 'null', Cookie: cookie } })).status, 403);
    const corsDenied = await fetch(server.base + '/auth/login', { method: 'OPTIONS', headers: { Origin: 'https://attacker.example', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(corsDenied.status, 403); assert.equal(corsDenied.headers.get('Access-Control-Allow-Credentials'), null);
  } finally { if (server) await server.close(); await db.pool.end(); }
});

test('mounted auth parser and database failures stay bounded and sanitized; disabled Identity stays unavailable', async () => {
  const db = await isolatedDatabase(); let server;
  try {
    migrate(db.name); server = await harness(db); const csrf = await anonymous(server.base);
    const oversized = await post(server.base, '/login', { password: 'x'.repeat(3000) }, csrf.cookie, csrf.token);
    assert.equal(oversized.status, 413); assert.deepEqual(await oversized.json(), { code: 'INVALID_REQUEST' });
    const invalid = await fetch(server.base + '/auth/login', { method: 'POST', headers: { Origin: customerOrigin, 'Content-Type': 'application/json' }, body: '{"private-secret-marker"' });
    assert.equal(invalid.status, 400); assert.deepEqual(await invalid.json(), { code: 'INVALID_REQUEST' });
    await db.pool.end();
    const failure = await post(server.base, '/login', { email: 'customer@example.test', password }, csrf.cookie, csrf.token);
    assert.equal(failure.status, 503); assert.deepEqual(await failure.json(), { code: 'UNAVAILABLE' });
    await server.close(); server = await harness(db, { enabled: false });
    assert.equal((await fetch(server.base + '/auth/csrf')).status, 404);
    assert.equal((await post(server.base, '/login', {}, undefined, undefined)).status, 404);
    assert.equal((await fetch(server.base + '/health')).status, 200);
  } finally { if (server) await server.close(); if (!db.pool.ended) await db.pool.end(); }
});
