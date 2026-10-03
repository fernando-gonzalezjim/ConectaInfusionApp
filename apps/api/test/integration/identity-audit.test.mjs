import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { isolatedDatabase, migrate } from './identity-helpers.mjs';

test('customer audit is allowlisted, append-only and shares the caller transaction', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name);
    const { appendIdentityAudit } = await import('../../dist/modules/identity/audit.js');
    const person = (await db.pool.query("INSERT INTO people(full_name) VALUES ('Before') RETURNING id")).rows[0].id;
    const account = (await db.pool.query('INSERT INTO accounts(person_id,email) VALUES ($1,$2) RETURNING id', [person, 'audit@example.test'])).rows[0].id;
    const base = { actor: { id: account, type: 'customer' }, action: 'account.profile_updated', targetType: 'account',
      targetId: account, before: { fullName: 'Before' }, after: { fullName: 'After' }, reason: 'Self profile update', correlationId: randomUUID() };
    const client = await db.pool.connect();
    try {
      for (const field of ['password', 'passwordHash', 'token', 'sessionToken', 'verificationSecret']) {
        await assert.rejects(appendIdentityAudit(client, { ...base, after: { ...base.after, [field]: 'not-recorded' } }), /INVALID_IDENTITY_AUDIT/);
      }
      await assert.rejects(appendIdentityAudit(client, { ...base, after: { roles: [{ token: 'nested-secret' }] } }), /INVALID_IDENTITY_AUDIT/);
      await assert.rejects(appendIdentityAudit(client, { ...base, action: 'invented.action' }), /INVALID_IDENTITY_AUDIT/);
      assert.equal((await client.query('SELECT count(*)::int AS n FROM audit_events')).rows[0].n, 0);
      await client.query('BEGIN');
      await client.query('UPDATE people SET full_name=$1 WHERE id=$2', ['After', person]);
      await appendIdentityAudit(client, base);
      await client.query('COMMIT');
      const audit = (await client.query('SELECT * FROM audit_events')).rows[0];
      assert.equal(audit.actor_type, 'customer');
      assert.equal(audit.actor_id, account);
      assert.deepEqual(audit.changes, { before: { fullName: 'Before' }, after: { fullName: 'After' } });
      await client.query('BEGIN');
      await client.query('UPDATE people SET full_name=$1 WHERE id=$2', ['Must roll back', person]);
      await assert.rejects(appendIdentityAudit(client, { ...base, targetId: randomUUID(), correctionOf: randomUUID() }), { code: '23503' });
      await client.query('ROLLBACK');
      assert.equal((await client.query('SELECT full_name FROM people WHERE id=$1', [person])).rows[0].full_name, 'After');
      assert.equal((await client.query('SELECT count(*)::int AS n FROM audit_events')).rows[0].n, 1);
      await assert.rejects(client.query('DELETE FROM audit_events'));
      await assert.rejects(client.query("UPDATE audit_events SET reason='rewrite'"));
      await assert.rejects(client.query('TRUNCATE audit_events'));
    } finally { client.release(); }
  } finally { await db.pool.end(); }
});
