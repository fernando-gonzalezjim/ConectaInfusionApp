import assert from 'node:assert/strict';
import { test } from 'node:test';

// This endpoint prevents the test from touching a real database.
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test';
const { app } = await import('../dist/app.js');
const { pool } = await import('../dist/db.js');

test('database outage preserves liveness and returns unavailable responses', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(`${base}/api/v1/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    const ready = await fetch(`${base}/api/v1/ready`);
    assert.equal(ready.status, 503);
    assert.deepEqual(await ready.json(), { status: 'unavailable', database: 'postgresql' });
    const overview = await fetch(`${base}/api/v1/studio/overview`);
    assert.equal(overview.status, 503);
    const body = await overview.json();
    assert.equal(body.code, 'UNAVAILABLE');
    assert.match(body.error, /database connection/);
    assert.equal(body.classes, undefined);
    assert.equal(JSON.stringify(body).includes('test:test'), false);
    const settings = await fetch(`${base}/api/v1/settings/public`);
    assert.equal(settings.status, 503);
    assert.deepEqual(await settings.json(), { code: 'UNAVAILABLE' });
    assert.equal((await fetch(`${base}/api/v1/settings/public`, { method: 'POST' })).status, 404);
    assert.equal((await fetch(`${base}/api/v1/audit`)).status, 404);
    // Identity remains opt-in: Foundation-only applications expose no auth routes.
    assert.equal((await fetch(`${base}/api/v1/auth/session`)).status, 404);
    assert.equal((await fetch(`${base}/api/v1/auth/login`, { method: 'POST' })).status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
