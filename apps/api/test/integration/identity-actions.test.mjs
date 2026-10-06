import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { isolatedDatabase, migrate } from './identity-helpers.mjs';
import { authConfig, createAuthAccount } from './identity-auth-helpers.mjs';
import { decryptOutboxPayload } from '../../dist/modules/identity/outbox-crypto.js';
import { issueAction, consumeAction } from '../../dist/modules/identity/action-tokens.js';

async function transaction(pool, apply) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await apply(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function secret(pool, config, id) {
  const row = (await pool.query('SELECT * FROM identity_email_outbox WHERE action_token_id=$1', [id])).rows[0];
  return JSON.parse(decryptOutboxPayload({ keyId: row.key_id, nonce: row.nonce, authTag: row.auth_tag, ciphertext: row.ciphertext }, {
    outboxId: row.id, actionTokenId: id, kind: 'action', recipientHash: row.recipient_hash
  }, config.secrets)).token;
}
function binding(account, purpose = 'email_confirmation') {
  return { purpose, recipientEmail: account.email, accountId: account.accountId, accountVersion: 0,
    personId: account.personId, targetId: null, expectedVersion: 0 };
}

test('actions bind purpose/recipient/target/versions, use exact lifetimes and roll back token/outbox/domain changes together', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); const config = authConfig(); const account = await createAuthAccount(db.pool);
    const now = new Date(); const expected = binding(account);
    const issue = await transaction(db.pool, client => issueAction(client, config, expected, 'es-MX', now));
    assert.deepEqual(Object.keys(issue).sort(), ['expiresAt', 'id']);
    const token = await secret(db.pool, config, issue.id);
    process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused'; process.env.IDENTITY_ENABLED = 'false';
    const { createApplication } = await import('../../dist/app.js');
    const app = await createApplication({ database: db.pool, identityConfig: config, environment: { NODE_ENV: 'test' } });
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/auth/action?token=${token}`);
      assert.equal(response.status, 404); assert.equal((await response.text()).includes(token), false);
      assert.equal((await db.pool.query('SELECT consumed_at FROM identity_action_tokens WHERE id=$1', [issue.id])).rows[0].consumed_at, null);
    } finally { await new Promise(resolve => server.close(resolve)); }
    const stored = (await db.pool.query('SELECT * FROM identity_action_tokens WHERE id=$1', [issue.id])).rows[0];
    assert.equal(stored.token_hash.equals(createHash('sha256').update(token).digest()), true);
    assert.equal(stored.expires_at - stored.created_at, 24 * 3600000);
    for (const altered of [{ purpose: 'password_reset' }, { recipientEmail: 'other@example.test' },
      { targetId: randomUUID() }, { expectedVersion: 1 }, { accountVersion: 1 }, { personId: null }]) {
      await assert.rejects(transaction(db.pool, client => consumeAction(client, token, { ...expected, ...altered }, async () => assert.fail('must not apply'), now)), { message: 'INVALID_ACTION' });
    }
    for (const malformed of [null, '', token+'=', 'x'.repeat(5000)]) {
      await assert.rejects(transaction(db.pool, client => consumeAction(client, malformed, expected, async () => assert.fail('invalid token'), now)), { message: 'INVALID_ACTION' });
    }
    await assert.rejects(transaction(db.pool, client => consumeAction(client, token, expected, async () => assert.fail('expired'), new Date(issue.expiresAt))), { message: 'INVALID_ACTION' });
    await assert.rejects(transaction(db.pool, client => consumeAction(client, token, expected, async locked => {
      await locked.query("UPDATE people SET full_name='Rolled back' WHERE id=$1", [account.personId]); throw new Error('DOMAIN_FAILURE');
    }, now)), { message: 'DOMAIN_FAILURE' });
    assert.equal((await db.pool.query('SELECT consumed_at FROM identity_action_tokens WHERE id=$1', [issue.id])).rows[0].consumed_at, null);
    const results = await Promise.allSettled([1, 2].map(() => transaction(db.pool, client => consumeAction(client, token, expected,
      locked => locked.query("UPDATE people SET full_name='Applied once' WHERE id=$1", [account.personId]), now))));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected' && result.reason.message === 'INVALID_ACTION').length, 1);
    assert.equal((await db.pool.query('SELECT full_name FROM people WHERE id=$1', [account.personId])).rows[0].full_name, 'Applied once');
    const outbox = (await db.pool.query('SELECT status,ciphertext FROM identity_email_outbox WHERE action_token_id=$1', [issue.id])).rows[0];
    assert.equal(outbox.status, 'cancelled'); assert.equal(outbox.ciphertext, null);
    for (const [purpose, hours] of [['password_reset', 1], ['password_setup', 24], ['email_change', 24], ['family_invitation', 168],
      ['family_successor', 168], ['guardian_invitation', 168], ['dependent_transition', 24], ['guardian_reactivation', 168]]) {
      const issued = await transaction(db.pool, client => issueAction(client, config, binding(account, purpose), 'en', now));
      assert.equal(new Date(issued.expiresAt) - now, hours * 3600000);
    }
    const counts = (await db.pool.query('SELECT count(*)::int AS n FROM identity_action_tokens')).rows[0].n;
    await assert.rejects(transaction(db.pool, async client => { await issueAction(client, config,
      { ...binding(account, 'password_setup'), targetId: randomUUID() }, 'en', new Date(now.getTime()+60000)); throw new Error('ROLLBACK'); }), { message: 'ROLLBACK' });
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_action_tokens')).rows[0].n, counts);
  } finally { await db.pool.end(); }
});

test('redemption and resend serialize with domain versions; pending accounts are allowed and inactive people are denied', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); const config = authConfig(); const account = await createAuthAccount(db.pool);
    await db.pool.query("UPDATE accounts SET status='pending',confirmation_status='pending',email_verified_at=NULL WHERE id=$1", [account.accountId]);
    const expected = binding(account); const start = new Date();
    const first = await transaction(db.pool, client => issueAction(client, config, expected, 'es-MX', start));
    const token = await secret(db.pool, config, first.id); const later = new Date(+start+60000);
    const outcomes = await Promise.allSettled([
      transaction(db.pool, client => consumeAction(client, token, expected,
        locked => locked.query('UPDATE accounts SET session_version=session_version+1 WHERE id=$1', [account.accountId]), later)),
      transaction(db.pool, client => issueAction(client, config, expected, 'es-MX', later))
    ]);
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(result => result.status === 'rejected' && result.reason.message === 'INVALID_ACTION').length, 1);
    assert.equal((await db.pool.query('SELECT status FROM accounts WHERE id=$1', [account.accountId])).rows[0].status, 'pending');
    await db.pool.query("UPDATE people SET status='inactive' WHERE id=$1", [account.personId]);
    const currentVersion = (await db.pool.query('SELECT session_version FROM accounts WHERE id=$1', [account.accountId])).rows[0].session_version;
    await assert.rejects(transaction(db.pool, client => issueAction(client, config, { ...expected, accountVersion: currentVersion }, 'en', new Date(+later+60000))), { message: 'INVALID_ACTION' });
  } finally { await db.pool.end(); }
});

test('resends serialize per recipient/purpose, enforce both exact limits and revoke/scrub the old link atomically', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); const config = authConfig(); const account = await createAuthAccount(db.pool); const expected = binding(account); const start = new Date();
    const first = await transaction(db.pool, client => issueAction(client, config, expected, 'en', start));
    const oldToken = await secret(db.pool, config, first.id);
    await assert.rejects(transaction(db.pool, client => issueAction(client, config, expected, 'en', new Date(+start+59999))), { message: 'THROTTLED', retryAfterSeconds: 1 });
    const simultaneous = await Promise.allSettled([1, 2].map(() => transaction(db.pool, client => issueAction(client, config, expected, 'en', new Date(+start+60000)))));
    assert.equal(simultaneous.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(simultaneous.filter(result => result.status === 'rejected' && result.reason.message === 'THROTTLED').length, 1);
    await assert.rejects(transaction(db.pool, client => consumeAction(client, oldToken, expected, async () => assert.fail('old resend'), new Date(+start+60000))), { message: 'INVALID_ACTION' });
    assert.equal((await db.pool.query('SELECT ciphertext FROM identity_email_outbox WHERE action_token_id=$1', [first.id])).rows[0].ciphertext, null);
    for (let n=2; n<5; n++) await transaction(db.pool, client => issueAction(client, config, expected, 'en', new Date(+start+n*60000)));
    await assert.rejects(transaction(db.pool, client => issueAction(client, config, expected, 'en', new Date(+start+300000))), { message: 'THROTTLED', retryAfterSeconds: 3300 });
    await transaction(db.pool, client => issueAction(client, config, expected, 'en', new Date(+start+3600000)));
    await db.pool.query('UPDATE accounts SET session_version=1 WHERE id=$1', [account.accountId]);
    await assert.rejects(transaction(db.pool, client => issueAction(client, config, expected, 'en', new Date(+start+3660000))), { message: 'INVALID_ACTION' });
    const current = (await db.pool.query('SELECT id FROM identity_action_tokens WHERE revoked_at IS NULL ORDER BY created_at DESC LIMIT 1')).rows[0].id;
    await assert.rejects(transaction(db.pool, async client => consumeAction(client, await secret(db.pool, config, current), expected, async () => assert.fail('version'), new Date(+start+3600000))), { message: 'INVALID_ACTION' });
  } finally { await db.pool.end(); }
});
