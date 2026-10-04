import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApiClient, ApiError } from '../src/index.ts';

test('management access uses credentials and preserves server denials', async () => {
  const signal = new AbortController().signal;
  const client = createApiClient('/api/v1', async (url, options) => {
    assert.equal(url, '/api/v1/management/access'); assert.equal(options.credentials, 'include'); assert.equal(options.signal, signal);
    return Response.json({ code: 'FORBIDDEN' }, { status: 403 });
  });
  await assert.rejects(client.getManagementAccess(signal), error => error.code === 'FORBIDDEN');
});

test('login bootstraps anonymous CSRF and posts credentials without storing session tokens', async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const client = createApiClient('/api/v1/', async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/csrf')) return Response.json({ csrfToken: 'anonymous-csrf' });
    return Response.json({ account: { id: 'own-account' }, csrfToken: 'session-csrf', expiresAt: 'later' });
  });
  const body = { email: 'customer@example.test', password: 'long test password', rememberMe: true };
  assert.equal((await client.login(body, signal)).account.id, 'own-account');
  assert.deepEqual(calls.map(call => call.url), ['/api/v1/auth/csrf', '/api/v1/auth/login']);
  for (const { options } of calls) { assert.equal(options.credentials, 'include'); assert.equal(options.signal, signal); assert.equal(options.redirect, 'error'); }
  assert.equal(calls[1].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].options.body), body);
  assert.equal(calls[1].options.headers['X-CSRF-Token'], 'anonymous-csrf');
  assert.equal(calls[1].options.headers['Content-Type'], 'application/json');
});

test('logout reads the current session for fresh CSRF, handles 204 and does not retry mutations', async () => {
  const calls = [];
  const client = createApiClient('', async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/session')) return Response.json({ csrfToken: 'fresh-csrf', account: { id: 'mine' } });
    return new Response(null, { status: 204 });
  });
  await client.logout(); await client.logoutAll();
  assert.deepEqual(calls.map(call => call.url), ['/auth/session', '/auth/logout', '/auth/session', '/auth/logout-all']);
  for (const { options } of calls.filter(call => call.options.method === 'POST')) {
    assert.equal(options.headers['X-CSRF-Token'], 'fresh-csrf'); assert.equal(options.body, '{}');
  }
});

test('auth error codes and Retry-After are safe and unknown/raw bodies never become messages', async () => {
  for (const [status, body, expected] of [
    [401, { code: 'INVALID_CREDENTIALS', password: 'private' }, 'INVALID_CREDENTIALS'],
    [401, { code: 'UNAUTHENTICATED' }, 'UNAUTHENTICATED'],
    [403, { code: 'FORBIDDEN' }, 'FORBIDDEN'],
    [403, { code: 'private-server-value' }, 'FORBIDDEN'],
    [500, { code: 'INVALID_CREDENTIALS' }, 'UNAVAILABLE'],
    [400, { code: 'FORBIDDEN' }, 'INVALID_REQUEST'],
  ]) {
    const client = createApiClient('', async () => Response.json(body, { status }));
    await assert.rejects(client.getSession(), error => error instanceof ApiError && error.code === expected && error.message === expected);
  }
  const client = createApiClient('', async () => Response.json({ code: 'THROTTLED' }, { status: 429, headers: { 'Retry-After': '25' } }));
  await assert.rejects(client.getSession(), error => error.code === 'THROTTLED' && error.retryAfterSeconds === 25);
  const malformed = createApiClient('', async () => new Response('private database failure', { status: 401 }));
  await assert.rejects(malformed.getSession(), error => error.code === 'UNAUTHENTICATED');
});

test('cancelled auth requests preserve AbortError and failed bootstraps never send credentials', async () => {
  const controller = new AbortController(); controller.abort();
  const client = createApiClient('', async (_url, options) => options.signal.throwIfAborted());
  await assert.rejects(client.login({ email: 'customer@example.test', password: 'long password' }, controller.signal), { name: 'AbortError' });
  let calls = 0;
  const failed = createApiClient('', async () => { calls++; return Response.json({}, { status: 503 }); });
  await assert.rejects(failed.login({ email: 'customer@example.test', password: 'long password' }), error => error.code === 'UNAVAILABLE');
  assert.equal(calls, 1);
});

test('invalid CSRF bootstrap responses fail safely before any credential mutation', async () => {
  for (const body of [null, {}, { csrfToken: '' }, { csrfToken: 'private\r\nheader' }, { csrfToken: 'a'.repeat(151) }]) {
    let calls = 0;
    const client = createApiClient('', async () => { calls++; return Response.json(body); });
    await assert.rejects(client.login({ email: 'customer@example.test', password: 'long password' }), error => error instanceof ApiError && error.code === 'INTERNAL_ERROR');
    assert.equal(calls, 1);
  }
});
