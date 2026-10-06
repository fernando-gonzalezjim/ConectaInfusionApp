import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readIdentityConfig } from '../dist/modules/identity/config.js';

const load = () => import('../dist/modules/identity/outbox-crypto.js');
const key = () => randomBytes(32).toString('base64');
function secrets(keys = { v1: key() }, active = 'v1') {
  return readIdentityConfig({ IDENTITY_ENABLED: 'true', NODE_ENV: 'test', IDENTITY_MAIL_TRANSPORT: 'mailpit',
    IDENTITY_OUTBOX_KEYS: JSON.stringify(keys), IDENTITY_OUTBOX_ACTIVE_KEY_ID: active, IDENTITY_THROTTLE_KEY: key(),
    IDENTITY_PUBLIC_ORIGIN: 'http://localhost:5173', WEB_ORIGINS: 'http://localhost:5173,http://localhost:5174',
    SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_FROM: 'no-reply@conecta.example.test' }).secrets;
}
const context = () => ({ outboxId: randomUUID(), actionTokenId: randomUUID(), kind: 'action', recipientHash: randomBytes(32) });

test('outbox encryption uses independent nonces and authenticates payload plus row metadata', async () => {
  const { encryptOutboxPayload, decryptOutboxPayload } = await load();
  const material = secrets(); const row = context();
  const payload = JSON.stringify({ recipient: 'fixture@example.test', token: 'dummy-test-token', text: 'Confirmación ☕' });
  const first = encryptOutboxPayload(payload, row, material);
  const second = encryptOutboxPayload(payload, row, material);
  assert.equal(first.nonce.length, 12); assert.equal(first.authTag.length, 16);
  assert.notDeepEqual(first.nonce, second.nonce); assert.notDeepEqual(first.ciphertext, second.ciphertext);
  assert.equal(first.ciphertext.includes(Buffer.from('dummy-test-token')), false);
  assert.equal(decryptOutboxPayload(first, row, material), payload);
  for (const field of ['ciphertext', 'nonce', 'authTag']) {
    const changed = { ...first, [field]: Buffer.from(first[field]) }; changed[field][0] ^= 1;
    assert.throws(() => decryptOutboxPayload(changed, row, material), /OUTBOX_PAYLOAD_INVALID/);
  }
  for (const changed of [{ ...row, outboxId: randomUUID() }, { ...row, actionTokenId: randomUUID() },
    { ...row, recipientHash: randomBytes(32) }, { ...row, kind: 'security_notification', actionTokenId: null }]) {
    assert.throws(() => decryptOutboxPayload(first, changed, material), /OUTBOX_PAYLOAD_INVALID/);
  }
});

test('retained keys decrypt older pending payloads; removed or wrong keys never fall back', async () => {
  const { encryptOutboxPayload, decryptOutboxPayload } = await load();
  const old = key(); const current = key(); const row = context();
  const encrypted = encryptOutboxPayload('private payload', row, secrets({ old }, 'old'));
  assert.equal(decryptOutboxPayload(encrypted, row, secrets({ old, current }, 'current')), 'private payload');
  assert.throws(() => decryptOutboxPayload(encrypted, row, secrets({ current }, 'current')), /OUTBOX_KEY_UNAVAILABLE/);
  assert.throws(() => decryptOutboxPayload(encrypted, row, secrets({ old: key() }, 'old')), /OUTBOX_PAYLOAD_INVALID/);
  const notification = { ...row, kind: 'security_notification', actionTokenId: null };
  const secretMaterial = secrets();
  assert.equal(decryptOutboxPayload(encryptOutboxPayload('security notice', notification, secretMaterial), notification, secretMaterial), 'security notice');
});

test('outbox crypto rejects oversized/malformed input before encryption or verification', async () => {
  const { encryptOutboxPayload, decryptOutboxPayload } = await load();
  const material = secrets(); const row = context();
  for (const payload of [null, '', 'x'.repeat(16385), '\ud800']) {
    assert.throws(() => encryptOutboxPayload(payload, row, material), /OUTBOX_PAYLOAD_INVALID/);
  }
  for (const malformed of [{ ...row, outboxId: 'unknown' }, { ...row, recipientHash: Buffer.alloc(8) },
    { ...row, kind: 'unknown' }, { ...row, actionTokenId: null }]) {
    assert.throws(() => encryptOutboxPayload('payload', malformed, material), /OUTBOX_PAYLOAD_INVALID/);
  }
  const envelope = encryptOutboxPayload('x'.repeat(16384), row, material);
  assert.equal(decryptOutboxPayload(envelope, row, material).length, 16384);
  for (const invalid of [null, { ...envelope, authTag: Buffer.alloc(8) }, { ...envelope, ciphertext: Buffer.alloc(16385) }]) {
    assert.throws(() => decryptOutboxPayload(invalid, row, material), /OUTBOX_PAYLOAD_INVALID/);
  }
});
