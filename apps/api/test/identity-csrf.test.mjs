import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomBytes } from 'node:crypto';
import { readIdentityConfig } from '../dist/modules/identity/config.js';

function config() {
  return readIdentityConfig({ IDENTITY_ENABLED: 'true', NODE_ENV: 'test', IDENTITY_MAIL_TRANSPORT: 'mailpit',
    IDENTITY_OUTBOX_ACTIVE_KEY_ID: 'v1', IDENTITY_OUTBOX_KEYS: JSON.stringify({ v1: randomBytes(32).toString('base64') }),
    IDENTITY_THROTTLE_KEY: randomBytes(32).toString('base64'), IDENTITY_PUBLIC_ORIGIN: 'http://localhost:5173',
    WEB_ORIGINS: 'http://localhost:5173,http://localhost:5174', SMTP_HOST: '127.0.0.1', SMTP_PORT: '11025', SMTP_FROM: 'no-reply@conecta.example.test' });
}
async function harness(options = {}) {
  const { createCsrfProtection } = await import('../dist/modules/identity/csrf.js');
  const protection = createCsrfProtection({ resolve: async token => {
    if (token !== 'valid-session') throw { code: 'UNAUTHENTICATED' };
    return { csrfToken: 'session-csrf' };
  } }, options.config ?? config(), { now: options.now });
  const app = express(); app.use(protection.originGuard);
  app.get('/csrf', protection.bootstrap);
  app.post('/anonymous', protection.anonymousMutation, (_req, res) => res.sendStatus(204));
  app.post('/session', protection.sessionMutation, (_req, res) => res.sendStatus(204));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}
const origin = 'http://localhost:5173';
function post(base, path, cookie, token, extra = {}) {
  return fetch(base + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json',
    ...(cookie ? { Cookie: cookie } : {}), ...(token ? { 'X-CSRF-Token': token } : {}), ...extra }, body: '{}' });
}

test('anonymous CSRF requires exact Origin, JSON, signed cookie and matching custom header', async () => {
  const server = await harness();
  try {
    const bootstrap = await fetch(server.base + '/csrf', { headers: { Origin: origin } });
    assert.equal(bootstrap.status, 200); assert.equal(bootstrap.headers.get('Cache-Control'), 'no-store');
    const cookie = bootstrap.headers.get('Set-Cookie').split(';')[0]; const { csrfToken } = await bootstrap.json();
    assert.match(bootstrap.headers.get('Set-Cookie'), /HttpOnly/);
    assert.doesNotMatch(bootstrap.headers.get('Set-Cookie'), /Domain=/);
    assert.equal((await post(server.base, '/anonymous', cookie, csrfToken)).status, 204);
    for (const [givenCookie, token, extra] of [
      [undefined, csrfToken, {}], [cookie, undefined, {}], [cookie, 'wrong', {}],
      [`${cookie}; ${cookie}`, csrfToken, {}], [cookie, csrfToken, { Origin: '' }],
      [cookie, csrfToken, { Origin: 'null' }], [cookie, csrfToken, { Origin: origin + '.evil.test' }],
      [cookie, csrfToken, { Origin: origin + '/' }], [cookie, csrfToken, { Origin: origin + ',http://localhost:5174' }],
      [cookie, csrfToken, { 'Content-Type': 'text/plain' }],
    ]) {
      const denial = await post(server.base, '/anonymous', givenCookie, token, extra);
      assert.equal(denial.status, 403); assert.deepEqual(await denial.json(), { code: 'FORBIDDEN' });
    }
    const forged = '9999999999999.' + randomBytes(32).toString('base64url') + '.' + randomBytes(32).toString('base64url');
    assert.equal((await post(server.base, '/anonymous', 'conecta_csrf=' + forged, forged)).status, 403);
    assert.equal((await fetch(server.base + '/csrf', { headers: { Origin: 'http://localhost:5999' } })).status, 403);
    const again = await fetch(server.base + '/csrf', { headers: { Cookie: cookie } });
    assert.equal((await again.json()).csrfToken, csrfToken); assert.equal(again.headers.get('Set-Cookie'), null);
    assert.equal((await post(server.base, '/anonymous', cookie, csrfToken, { Origin: 'http://localhost:5174' })).status, 204);
  } finally { await server.close(); }
});

test('anonymous tokens expire at the exact boundary and cannot substitute for session-bound CSRF', async () => {
  let now = Date.UTC(2026, 9, 3); const server = await harness({ now: () => new Date(now) });
  try {
    const response = await fetch(server.base + '/csrf'); const cookie = response.headers.get('Set-Cookie').split(';')[0];
    const { csrfToken } = await response.json();
    now += 15 * 60000 - 1; assert.equal((await post(server.base, '/anonymous', cookie, csrfToken)).status, 204);
    now++; assert.equal((await post(server.base, '/anonymous', cookie, csrfToken)).status, 403);
    assert.equal((await post(server.base, '/session', 'conecta_session=valid-session', csrfToken)).status, 403);
    assert.equal((await post(server.base, '/session', 'conecta_session=valid-session', 'session-csrf')).status, 204);
    assert.equal((await post(server.base, '/anonymous', 'conecta_session=valid-session', 'session-csrf')).status, 403);
  } finally { await server.close(); }
});
