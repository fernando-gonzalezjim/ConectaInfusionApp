import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { isolatedDatabase, migrate } from './identity-helpers.mjs';

async function account(pool) {
  const person = (await pool.query("INSERT INTO people(full_name) VALUES ('Persistence fixture') RETURNING id")).rows[0].id;
  return (await pool.query("INSERT INTO accounts(person_id,email) VALUES ($1,'persistence@example.test') RETURNING id", [person])).rows[0].id;
}
const hash = () => randomBytes(32);

test('V5 stores bounded hashed sessions and purpose-bound action tokens without seeding access', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); migrate(db.name);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_sessions')).rows[0].n, 0);
    const owner = await account(db.pool);
    const sessionHash = hash();
    const insertSession = (token = hash(), csrf = hash(), days = 7, remembered = false) => db.pool.query(`
      INSERT INTO identity_sessions(account_id,token_hash,csrf_hash,session_version,created_at,authenticated_at,expires_at,remember_me)
      VALUES ($1,$2,$3,0,'2026-10-03T12:00Z','2026-10-03T12:00Z',
        '2026-10-03T12:00Z'::timestamptz + $4 * interval '24 hours',$5)`, [owner, token, csrf, days, remembered]);
    await insertSession(sessionHash);
    await insertSession(hash(), hash(), 30, true);
    await assert.rejects(insertSession(sessionHash), { code: '23505' });
    await assert.rejects(insertSession(Buffer.from('raw-session')), { code: '23514' });
    await assert.rejects(insertSession(hash(), Buffer.alloc(8)), { code: '23514' });
    await assert.rejects(insertSession(hash(), hash(), 8), { code: '23514' });
    await assert.rejects(insertSession(hash(), hash(), 30, false), { code: '23514' });
    await assert.rejects(db.pool.query('UPDATE identity_sessions SET session_version=-1'), { code: '23514' });
    const tokenHash = hash();
    const insertToken = (purpose = 'email_confirmation', hours = 24, recipient = 'persistence@example.test', digest = hash()) => db.pool.query(`
      INSERT INTO identity_action_tokens(account_id,account_version,token_hash,purpose,recipient_email,expected_version,created_at,expires_at)
      VALUES ($1,0,$2,$3,$4,0,'2026-10-03T12:00Z','2026-10-03T12:00Z'::timestamptz + $5 * interval '1 hour') RETURNING id`,
    [owner, digest, purpose, recipient, hours]);
    const token = (await insertToken('email_confirmation', 24, 'persistence@example.test', tokenHash)).rows[0].id;
    await insertToken('password_reset', 1);
    await insertToken('family_invitation', 168);
    await assert.rejects(insertToken('email_confirmation', 24, 'persistence@example.test', tokenHash), { code: '23505' });
    await assert.rejects(insertToken('invented'), { code: '23514' });
    await assert.rejects(insertToken('password_reset', 2), { code: '23514' });
    await assert.rejects(insertToken('email_confirmation', 25), { code: '23514' });
    await assert.rejects(insertToken('guardian_invitation', 169), { code: '23514' });
    await assert.rejects(insertToken('email_change', 24, ' Mixed@EXAMPLE.test '), { code: '23514' });
    await assert.rejects(insertToken('email_confirmation', 24, 'persistence@example.test', Buffer.alloc(16)), { code: '23514' });
    await db.pool.query("UPDATE identity_action_tokens SET consumed_at='2026-10-03T13:00Z' WHERE id=$1", [token]);
    await assert.rejects(db.pool.query("UPDATE identity_action_tokens SET revoked_at='2026-10-03T13:00Z' WHERE id=$1", [token]), { code: '23514' });
    await assert.rejects(db.pool.query('DELETE FROM accounts WHERE id=$1', [owner]), { code: '23503' });
  } finally { await db.pool.end(); }
});

test('V5 throttle uniqueness and outbox terminal scrubbing constraints preserve atomic delivery storage', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name);
    const owner = await account(db.pool);
    const subject = hash();
    const throttle = (scope = 'resend_identity', attempts = 1) => db.pool.query(`
      INSERT INTO identity_throttles(scope,subject_hash,window_started_at,expires_at,attempts)
      VALUES ($1,$2,'2026-10-03T12:00Z','2026-10-03T13:00Z',$3)`, [scope, subject, attempts]);
    await throttle();
    await assert.rejects(throttle(), { code: '23505' });
    await assert.rejects(throttle('unknown'), { code: '23514' });
    await assert.rejects(throttle('login_identity', -1), { code: '23514' });
    const token = (await db.pool.query(`INSERT INTO identity_action_tokens(account_id,account_version,token_hash,purpose,recipient_email,expected_version,expires_at)
      VALUES ($1,0,$2,'password_reset','persistence@example.test',0,now()+interval '1 hour') RETURNING id`, [owner, hash()])).rows[0].id;
    const row = (await db.pool.query(`INSERT INTO identity_email_outbox(action_token_id,recipient_hash,key_id,nonce,auth_tag,ciphertext,expires_at)
      VALUES ($1,$2,'v1',$3,$4,$5,now()+interval '1 hour') RETURNING id`, [token, hash(), randomBytes(12), randomBytes(16), randomBytes(48)])).rows[0].id;
    await assert.rejects(db.pool.query("UPDATE identity_email_outbox SET status='sent',terminal_at=now() WHERE id=$1", [row]), { code: '23514' });
    await assert.rejects(db.pool.query('UPDATE identity_email_outbox SET auth_tag=$1 WHERE id=$2', [Buffer.alloc(8), row]), { code: '23514' });
    await assert.rejects(db.pool.query('UPDATE identity_email_outbox SET attempts=6 WHERE id=$1', [row]), { code: '23514' });
    await db.pool.query(`UPDATE identity_email_outbox SET status='sent',terminal_at=now(),scrubbed_at=now(),key_id=NULL,nonce=NULL,auth_tag=NULL,ciphertext=NULL WHERE id=$1`, [row]);
    assert.equal((await db.pool.query('SELECT ciphertext FROM identity_email_outbox WHERE id=$1', [row])).rows[0].ciphertext, null);
    // Delivery insertion must participate in the caller transaction; a constraint failure rolls back token creation too.
    const client = await db.pool.connect();
    const digest = hash();
    try {
      await client.query('BEGIN');
      const action = (await client.query(`INSERT INTO identity_action_tokens(account_id,account_version,token_hash,purpose,recipient_email,expected_version,expires_at)
        VALUES ($1,0,$2,'password_reset','persistence@example.test',0,now()+interval '1 hour') RETURNING id`, [owner, digest])).rows[0].id;
      await assert.rejects(client.query(`INSERT INTO identity_email_outbox(action_token_id,recipient_hash,key_id,nonce,auth_tag,ciphertext,expires_at)
        VALUES ($1,$2,'v1',$3,$4,$5,now()+interval '1 hour')`, [action, hash(), Buffer.alloc(8), randomBytes(16), randomBytes(48)]), { code: '23514' });
      await client.query('ROLLBACK');
    } finally { client.release(); }
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM identity_action_tokens WHERE token_hash=$1', [digest])).rows[0].n, 0);
  } finally { await db.pool.end(); }
});

test('V5 preserves populated V4 data and rolls back conflicting DDL', async () => {
  for (const conflict of [false, true]) {
    const db = await isolatedDatabase();
    try {
      migrate(db.name, '-target=4');
      const owner = await account(db.pool);
      const member = (await db.pool.query("INSERT INTO members(full_name,email) VALUES ('Legacy customer','legacy-v5@example.test') RETURNING id")).rows[0].id;
      if (conflict) {
        await db.pool.query('CREATE TABLE identity_email_outbox(marker text)');
        assert.throws(() => migrate(db.name), /already exists/i);
        assert.equal((await db.pool.query("SELECT to_regclass('identity_sessions') AS name")).rows[0].name, null);
        assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM flyway_schema_history WHERE version='5'")).rows[0].n, 0);
      } else migrate(db.name);
      assert.equal((await db.pool.query('SELECT email FROM accounts WHERE id=$1', [owner])).rows[0].email, 'persistence@example.test');
      assert.equal((await db.pool.query('SELECT full_name FROM members WHERE id=$1', [member])).rows[0].full_name, 'Legacy customer');
    } finally { await db.pool.end(); }
  }
});

test('encrypted outbox payload survives PostgreSQL round-trip and rejects row metadata tampering', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name);
    const { randomUUID } = await import('node:crypto');
    const { readIdentityConfig } = await import('../../dist/modules/identity/config.js');
    const { encryptOutboxPayload, decryptOutboxPayload } = await import('../../dist/modules/identity/outbox-crypto.js');
    const secrets = readIdentityConfig({ IDENTITY_ENABLED: 'true', NODE_ENV: 'test', IDENTITY_MAIL_TRANSPORT: 'mailpit',
      IDENTITY_OUTBOX_ACTIVE_KEY_ID: 'v1', IDENTITY_OUTBOX_KEYS: JSON.stringify({ v1: hash().toString('base64') }),
      IDENTITY_THROTTLE_KEY: hash().toString('base64'), SMTP_HOST: '127.0.0.1', SMTP_PORT: '11025',
      SMTP_FROM: 'fixture@example.test', WEB_ORIGINS: 'http://localhost:5173', IDENTITY_PUBLIC_ORIGIN: 'http://localhost:5173' }).secrets;
    const context = { outboxId: randomUUID(), actionTokenId: null, kind: 'security_notification', recipientHash: hash() };
    const plaintext = JSON.stringify({ recipient: 'fixture@example.test', text: 'Private dummy security notification' });
    const encrypted = encryptOutboxPayload(plaintext, context, secrets);
    await db.pool.query(`INSERT INTO identity_email_outbox(id,kind,recipient_hash,key_id,nonce,auth_tag,ciphertext,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,now()+interval '1 hour')`,
    [context.outboxId, context.kind, context.recipientHash, encrypted.keyId, encrypted.nonce, encrypted.authTag, encrypted.ciphertext]);
    const stored = (await db.pool.query('SELECT * FROM identity_email_outbox WHERE id=$1', [context.outboxId])).rows[0];
    assert.equal(stored.ciphertext.includes(Buffer.from('fixture@example.test')), false);
    const envelope = { keyId: stored.key_id, nonce: stored.nonce, authTag: stored.auth_tag, ciphertext: stored.ciphertext };
    assert.equal(decryptOutboxPayload(envelope, context, secrets), plaintext);
    assert.throws(() => decryptOutboxPayload(envelope, { ...context, recipientHash: hash() }, secrets), /OUTBOX_PAYLOAD_INVALID/);
  } finally { await db.pool.end(); }
});
