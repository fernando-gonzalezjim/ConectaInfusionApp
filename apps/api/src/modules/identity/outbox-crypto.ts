import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { IdentitySecrets } from './config.js';

export interface OutboxContext {
  outboxId: string;
  actionTokenId: string | null;
  kind: 'action' | 'security_notification';
  recipientHash: Buffer;
}
export interface EncryptedOutboxPayload {
  keyId: string;
  nonce: Buffer;
  authTag: Buffer;
  ciphertext: Buffer;
}
function invalid(): never { throw new Error('OUTBOX_PAYLOAD_INVALID'); }
const uuid = (value: unknown) => typeof value === 'string'
  && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const bytes = (value: unknown, length: number): value is Buffer => Buffer.isBuffer(value) && value.length === length;

function associatedData(context: OutboxContext, keyId: string): Buffer {
  if (!context || !uuid(context.outboxId) || !bytes(context.recipientHash, 32)
    || (context.kind === 'action' ? !uuid(context.actionTokenId)
      : context.kind !== 'security_notification' || context.actionTokenId !== null)) invalid();
  // Bind ciphertext to its immutable row/token/recipient/kind, so a row swap cannot redirect a link.
  return Buffer.from(JSON.stringify(['identity-outbox-v1', keyId, context.outboxId,
    context.actionTokenId, context.kind, context.recipientHash.toString('hex')]), 'utf8');
}

export function encryptOutboxPayload(payload: unknown, context: OutboxContext, secrets: IdentitySecrets): EncryptedOutboxPayload {
  if (typeof payload !== 'string' || payload.length === 0 || payload.length > 16384 || Buffer.byteLength(payload) > 16384
    || Buffer.from(payload).toString('utf8') !== payload) invalid();
  const keyId = secrets.activeKeyId;
  const aad = associatedData(context, keyId);
  const key = secrets.outboxKey(keyId);
  if (!key) throw new Error('OUTBOX_KEY_UNAVAILABLE');
  const nonce = randomBytes(12);
  try {
    const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
    return { keyId, nonce, authTag: cipher.getAuthTag(), ciphertext };
  } finally { key.fill(0); }
}

export function decryptOutboxPayload(value: unknown, context: OutboxContext, secrets: IdentitySecrets): string {
  if (!value || typeof value !== 'object') invalid();
  const envelope = value as Partial<EncryptedOutboxPayload>;
  if (typeof envelope.keyId !== 'string' || !/^[a-zA-Z0-9_-]{1,32}$/.test(envelope.keyId)
    || !bytes(envelope.nonce, 12) || !bytes(envelope.authTag, 16)
    || !Buffer.isBuffer(envelope.ciphertext) || envelope.ciphertext.length < 1 || envelope.ciphertext.length > 16384) invalid();
  const aad = associatedData(context, envelope.keyId);
  const key = secrets.outboxKey(envelope.keyId);
  if (!key) throw new Error('OUTBOX_KEY_UNAVAILABLE');
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, envelope.nonce, { authTagLength: 16 });
    decipher.setAAD(aad);
    decipher.setAuthTag(envelope.authTag);
    const plaintext = Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]);
    const text = plaintext.toString('utf8');
    if (!Buffer.from(text).equals(plaintext)) invalid();
    return text;
  } catch { return invalid(); }
  finally { key.fill(0); }
}
