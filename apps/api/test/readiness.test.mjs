import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test';
const { app } = await import('../dist/app.js');
const { pool } = await import('../dist/db.js');

test('readiness rejects a schema without its required settings singleton', async t => {
  const query = t.mock.method(pool, 'query', async () => ({ rows: [], rowCount: 0 }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/v1/ready`;
    assert.equal((await fetch(url)).status, 503);
    query.mock.mockImplementation(async () => ({ rows: [{ id: 1 }], rowCount: 1 }));
    assert.equal((await fetch(url)).status, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
