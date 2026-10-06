import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { EnabledIdentityConfig, IdentitySecrets } from './config.js';
import { encryptOutboxPayload } from './outbox-crypto.js';

const lifetimes = { email_confirmation: 24, password_setup: 24, password_reset: 1, email_change: 24,
  family_invitation: 168, family_successor: 168, guardian_invitation: 168, dependent_transition: 24,
  guardian_reactivation: 168 } as const;
export type ActionPurpose = keyof typeof lifetimes;
// Internal, authoritative domain context. Never construct this from an untrusted request body.
export interface ActionBinding {
  purpose: ActionPurpose; recipientEmail: string; accountId: string | null; accountVersion: number | null;
  personId: string | null; targetId: string | null; expectedVersion: number;
}
export class ActionError extends Error {
  constructor(readonly code: 'INVALID_ACTION' | 'THROTTLED', readonly retryAfterSeconds?: number) { super(code); }
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const version = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 2147483647;
function invalid(): never { throw new ActionError('INVALID_ACTION'); }
export function normalizeActionRecipient(value: string): string {
  if (typeof value !== 'string' || value.length > 320) invalid();
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 3 || !/^[^\s@<>\x00-\x1f\x7f]+@[^\s@<>\x00-\x1f\x7f]+$/.test(normalized)) invalid();
  return normalized;
}
export function actionSubjectHash(secrets: IdentitySecrets, domain: string, subject: string): Buffer {
  const key = secrets.throttleKey();
  try { return createHmac('sha256', key).update(JSON.stringify(['identity-action-v1', domain, subject])).digest(); }
  finally { key.fill(0); }
}
function validate(binding: ActionBinding, now: Date): ActionBinding {
  if (!binding || !Object.hasOwn(lifetimes, binding.purpose) || !version(binding.expectedVersion)
    || !Number.isFinite(now.getTime()) || [binding.accountId, binding.personId, binding.targetId].some(id => id !== null && (typeof id !== 'string' || !uuid.test(id)))
    || (!binding.accountId && !binding.personId && !binding.targetId)
    || (binding.accountId ? !version(binding.accountVersion) : binding.accountVersion !== null)) invalid();
  return { ...binding, recipientEmail: normalizeActionRecipient(binding.recipientEmail) };
}
async function lockContext(client: PoolClient, binding: ActionBinding, local = true) {
  if (binding.accountId) {
    const account = (await client.query<{ session_version: number; status: string; person_status: string; development_fixture: string | null }>(
      `SELECT a.session_version,a.status,p.status AS person_status,a.development_fixture FROM accounts a
       JOIN people p ON p.id=a.person_id WHERE a.id=$1 FOR UPDATE OF a`, [binding.accountId])).rows[0];
    if (!account || account.session_version !== binding.accountVersion || account.status === 'inactive'
      || account.person_status !== 'active' || (!local && account.development_fixture)) invalid();
  }
  if (binding.personId) {
    const person = (await client.query<{ status: string }>('SELECT status FROM people WHERE id=$1 FOR UPDATE', [binding.personId])).rows[0];
    if (!person || person.status !== 'active') invalid();
  }
}
export async function cancelActionDelivery(client: PoolClient, ids: string[], now: Date): Promise<void> {
  await client.query(`UPDATE identity_email_outbox SET status='cancelled',terminal_at=$2,scrubbed_at=$2,
    key_id=NULL,nonce=NULL,auth_tag=NULL,ciphertext=NULL,claimed_until=NULL
    WHERE action_token_id=ANY($1::uuid[]) AND status='pending'`, [ids, now]);
}

// Caller owns BEGIN/COMMIT/ROLLBACK on this client, including domain mutations and their audit.
// The caller establishes a consistent domain lock order. Multi-account family
// commands prelock accounts/people in UUID order before relationship rows;
// helpers recheck those locks, then take the recipient send lock, token and outbox.
export async function issueAction(client: PoolClient, config: EnabledIdentityConfig, input: ActionBinding,
  locale: 'es-MX' | 'en', now = new Date(), clock?:()=>Date): Promise<{ id: string; expiresAt: string }> {
  if (!config.enabled || !['es-MX', 'en'].includes(locale)) invalid();
  const binding = validate(input, now);
  await lockContext(client, binding, config.smtp.transport === 'mailpit');
  const sendHash = actionSubjectHash(config.secrets, 'send', JSON.stringify([binding.purpose, binding.recipientEmail]));
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['identity-action-send:' + sendHash.toString('hex')]);
  // Callers with a live clock measure validity and throttling after blocking locks.
  if(clock){now=clock();validate(binding,now);}
  const previous = (await client.query<{ attempts: number; expires_at: Date; last_attempt_at: Date }>(
    "SELECT attempts,expires_at,last_attempt_at FROM identity_throttles WHERE scope='resend_identity' AND subject_hash=$1", [sendHash])).rows[0];
  const sameWindow = previous && previous.expires_at > now;
  if (previous && previous.last_attempt_at.getTime()+60000 > now.getTime()) {
    throw new ActionError('THROTTLED', Math.ceil((previous.last_attempt_at.getTime()+60000-now.getTime())/1000));
  }
  if (sameWindow && previous.attempts >= 5) throw new ActionError('THROTTLED', Math.ceil((previous.expires_at.getTime()-now.getTime())/1000));
  await client.query(`INSERT INTO identity_throttles(scope,subject_hash,window_started_at,expires_at,attempts,last_attempt_at)
    VALUES ('resend_identity',$1,$2,$2::timestamptz+interval '1 hour',1,$2)
    ON CONFLICT(scope,subject_hash) DO UPDATE SET
    attempts=CASE WHEN identity_throttles.expires_at <= $2 THEN 1 ELSE identity_throttles.attempts+1 END,
    window_started_at=CASE WHEN identity_throttles.expires_at <= $2 THEN $2 ELSE identity_throttles.window_started_at END,
    expires_at=CASE WHEN identity_throttles.expires_at <= $2 THEN $2::timestamptz+interval '1 hour' ELSE identity_throttles.expires_at END,
    last_attempt_at=$2`, [sendHash, now]);
  // Replace this logical action across state versions; unrelated targets retain their own links.
  const old = await client.query<{ id: string }>(`UPDATE identity_action_tokens SET revoked_at=$6
    WHERE purpose=$1 AND recipient_email=$2 AND account_id IS NOT DISTINCT FROM $3::uuid
    AND person_id IS NOT DISTINCT FROM $4::uuid AND target_id IS NOT DISTINCT FROM $5::uuid
    AND consumed_at IS NULL AND revoked_at IS NULL AND created_at <= $6 RETURNING id`, [binding.purpose, binding.recipientEmail, binding.accountId,
    binding.personId, binding.targetId, now]);
  await cancelActionDelivery(client, old.rows.map(row => row.id), now);
  const token = randomBytes(32).toString('base64url'); const id = randomUUID(); const outboxId = randomUUID();
  const expires = new Date(now.getTime()+lifetimes[binding.purpose]*3600000);
  await client.query(`INSERT INTO identity_action_tokens
    (id,token_hash,purpose,account_id,account_version,person_id,target_id,recipient_email,expected_version,created_at,expires_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [id, createHash('sha256').update(token).digest(), binding.purpose,
    binding.accountId, binding.accountVersion, binding.personId, binding.targetId, binding.recipientEmail, binding.expectedVersion, now, expires]);
  const recipientHash = actionSubjectHash(config.secrets, 'recipient', binding.recipientEmail);
  const encrypted = encryptOutboxPayload(JSON.stringify({ recipientEmail: binding.recipientEmail, purpose: binding.purpose, locale, token }),
    { outboxId, actionTokenId: id, kind: 'action', recipientHash }, config.secrets);
  await client.query(`INSERT INTO identity_email_outbox
    (id,action_token_id,recipient_hash,key_id,nonce,auth_tag,ciphertext,created_at,available_at,expires_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9)`, [outboxId,id,recipientHash,encrypted.keyId,encrypted.nonce,encrypted.authTag,encrypted.ciphertext,now,expires]);
  // Raw tokens leave this function only inside authenticated delivery ciphertext.
  return { id, expiresAt: expires.toISOString() };
}

export async function consumeAction<T>(client: PoolClient, token: unknown, input: ActionBinding,
  apply: (client: PoolClient) => Promise<T>, now = new Date()): Promise<T> {
  const binding = validate(input, now);
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token) || Buffer.from(token, 'base64url').toString('base64url') !== token) invalid();
  await lockContext(client, binding);
  const row = (await client.query<{ id: string }>(`SELECT id FROM identity_action_tokens
    WHERE token_hash=$1 AND purpose=$2 AND recipient_email=$3 AND expected_version=$4
    AND account_id IS NOT DISTINCT FROM $5::uuid AND account_version IS NOT DISTINCT FROM $6::integer
    AND person_id IS NOT DISTINCT FROM $7::uuid AND target_id IS NOT DISTINCT FROM $8::uuid
    AND created_at <= $9 AND expires_at > $9 AND consumed_at IS NULL AND revoked_at IS NULL FOR UPDATE`,
  [createHash('sha256').update(token).digest(), binding.purpose, binding.recipientEmail, binding.expectedVersion,
    binding.accountId,binding.accountVersion,binding.personId,binding.targetId,now])).rows[0];
  if (!row) invalid();
  // Recheck under the token lock: the row may have changed while waiting for another redemption.
  const consumed = await client.query(`UPDATE identity_action_tokens SET consumed_at=$2
    WHERE id=$1 AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > $2 RETURNING id`, [row.id,now]);
  if (consumed.rowCount !== 1) invalid();
  await cancelActionDelivery(client, [row.id], now);
  return apply(client);
}
