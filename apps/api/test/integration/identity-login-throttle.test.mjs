import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { isolatedDatabase, migrate } from './identity-helpers.mjs';

const secrets = { throttleKey: () => Buffer.from('0123456789abcdef0123456789abcdef') };
const load = () => import('../../dist/modules/identity/login-throttle.js');
test('login counters are shared, atomic, bounded and reset at the exact 15-minute boundary', async () => {
  const db = await isolatedDatabase();
  const other = new pg.Pool({ connectionString: db.pool.options.connectionString });
  try {
    migrate(db.name);
    const { reserveLoginAttempt } = await load();
    const now = new Date('2026-10-03T12:00:00Z');
    const attempts = await Promise.allSettled(Array.from({ length: 20 }, (_, i) =>
      reserveLoginAttempt(i % 2 ? other : db.pool, secrets, 'private@example.test', '127.0.0.1', now)));
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 10);
    assert.ok(attempts.filter(result => result.status === 'rejected').every(result => result.reason.code === 'THROTTLED'));
    const before = await db.pool.query('SELECT scope,subject_hash,attempts FROM identity_throttles');
    assert.equal(before.rows.length, 2);
    assert.ok(before.rows.every(row => Buffer.isBuffer(row.subject_hash) && row.subject_hash.length === 32));
    assert.equal(JSON.stringify(before.rows).includes('private@example.test'), false);
    await assert.rejects(reserveLoginAttempt(db.pool, secrets, 'private@example.test', '127.0.0.1', new Date('2026-10-03T12:14:59.999Z')),
      error => error.code === 'THROTTLED' && error.retryAfterSeconds === 1);
    await reserveLoginAttempt(db.pool, secrets, 'private@example.test', '127.0.0.1', new Date('2026-10-03T12:15:00Z'));
    assert.ok((await db.pool.query('SELECT attempts FROM identity_throttles')).rows.every(row => row.attempts === 1));
    const differentKey = { throttleKey: () => randomBytes(32) };
    await reserveLoginAttempt(db.pool, differentKey, 'private@example.test', '127.0.0.1', now);
  } finally { await other.end(); await db.pool.end(); }
});

test('one IP cannot evade the aggregate limit using different account emails', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name);
    const { reserveLoginAttempt } = await load();
    const now = new Date('2026-10-03T12:00Z');
    for (let i = 0; i < 30; i++) await reserveLoginAttempt(db.pool, secrets, `user${i}@example.test`, '::1', now);
    await assert.rejects(reserveLoginAttempt(db.pool, secrets, 'another@example.test', '::1', now),
      error => error.code === 'THROTTLED' && error.retryAfterSeconds === 900);
    for (const ip of ['attacker-supplied-header', '', '127.0.0.1,evil']) {
      await assert.rejects(reserveLoginAttempt(db.pool, secrets, 'other@example.test', ip, now), /INVALID_LOGIN_CONTEXT/);
    }
  } finally { await db.pool.end(); }
});
