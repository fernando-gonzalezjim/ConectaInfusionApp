import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApiClient, ApiError } from '../src/index.ts';

test('client reads settings and keeps base path', async () => {
  const client = createApiClient('/api/v1', async (url) => {
    assert.equal(url, '/api/v1/settings/public');
    return Response.json({ displayName: 'Conecta' });
  });
  assert.equal((await client.getPublicSettings()).displayName, 'Conecta');
});
test('client hides raw server failures and exposes stable codes', async () => {
  const client = createApiClient('', async () => new Response('database password leaked', { status: 503 }));
  await assert.rejects(client.getPublicSettings(), e => e instanceof ApiError && e.code === 'UNAVAILABLE' && !e.message.includes('password'));
});
test('client forwards cancellation instead of turning it into a server failure', async () => {
  const controller = new AbortController(); controller.abort();
  const client = createApiClient('', async (_url, options) => { options.signal.throwIfAborted(); });
  await assert.rejects(client.getPublicSettings(controller.signal), { name: 'AbortError' });
});
