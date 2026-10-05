import { createHash } from 'node:crypto';
import { Socket } from 'node:net';
import nodemailer from 'nodemailer';
import type { Pool, QueryResultRow } from 'pg';
import type { EnabledIdentityConfig } from './config.js';
import { actionSubjectHash, normalizeActionRecipient, type ActionPurpose } from './action-tokens.js';
import { decryptOutboxPayload } from './outbox-crypto.js';

export interface DeliveryMessage { to: string; subject: string; text: string; messageId: string }
type DeliveryCode = 'SMTP_UNAVAILABLE' | 'DELIVERY_REJECTED' | 'PAYLOAD_INVALID' | 'KEY_UNAVAILABLE';
type TerminalStatus = 'sent' | 'failed' | 'expired' | 'cancelled';
interface OutboxRow {
  id: string; action_token_id: string | null; kind: 'action' | 'security_notification'; recipient_hash: Buffer; key_id: string; nonce: Buffer; auth_tag: Buffer;
  ciphertext: Buffer; attempts: number; claimed_until: Date; expires_at: Date;
}
const subjects: Record<ActionPurpose, [string, string]> = {
  email_confirmation: ['Confirma tu correo', 'Confirm your email'], password_setup: ['Configura tu cuenta', 'Set up your account'],
  password_reset: ['Restablece tu contraseña', 'Reset your password'], email_change: ['Confirma tu nuevo correo', 'Confirm your new email'],
  family_invitation: ['Invitación a un grupo familiar', 'Family group invitation'], family_successor: ['Responsabilidad del grupo', 'Group responsibility'],
  guardian_invitation: ['Invitación para tutor', 'Guardian invitation'], dependent_transition: ['Configura la cuenta independiente', 'Set up the independent account'],
  guardian_reactivation: ['Confirma la tutoría', 'Confirm guardianship']
};
function payloadInvalid(): never { throw new Error('OUTBOX_PAYLOAD_INVALID'); }
function errorCode(error: unknown): DeliveryCode {
  if (error instanceof Error && error.message === 'OUTBOX_KEY_UNAVAILABLE') return 'KEY_UNAVAILABLE';
  if (error instanceof Error && error.message === 'OUTBOX_PAYLOAD_INVALID') return 'PAYLOAD_INVALID';
  if (error && typeof error === 'object' && 'responseCode' in error
    && Number(error.responseCode) >= 500 && Number(error.responseCode) < 600) return 'DELIVERY_REJECTED';
  return 'SMTP_UNAVAILABLE';
}

export function createEmailOutboxWorker(pool: Pool, config: EnabledIdentityConfig, options: {
  now?: () => Date; send?: (message: DeliveryMessage) => Promise<void>;
} = {}) {
  if (!config.enabled) throw new Error('IDENTITY_DISABLED');
  const clock = options.now ?? (() => new Date());
  const query = <Row extends QueryResultRow = QueryResultRow>(sql: string, args: unknown[]) =>
    pool.query<Row>(sql,args).catch(() => { throw new Error('OUTBOX_UNAVAILABLE'); });
  const activeSockets = new Set<Socket>();
  const send = options.send ?? (async (message: DeliveryMessage) => {
    // Own the socket: closing a Nodemailer pool only closes idle connections.
    const socket = new Socket(); activeSockets.add(socket);
    const transport = nodemailer.createTransport({ socket,
      host: config.smtp.host, port: config.smtp.port, secure: config.smtp.secure,
      requireTLS: config.smtp.requireTLS, ignoreTLS: config.smtp.ignoreTLS,
      auth: config.smtp.auth(), tls: { rejectUnauthorized: true },
      connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 5000, dnsTimeout: 5000,
      disableFileAccess: true, disableUrlAccess: true, maxRecipients: 1, logger: false, debug: false, transactionLog: false });
    // Bound the entire send, not just inactivity on an SMTP socket. No protocol/body logging.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const delivered = transport.sendMail({ from: config.smtp.from, ...message });
      const result = await Promise.race([delivered, new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { socket.destroy(); reject(new Error('SMTP_UNAVAILABLE')); }, 20000);
      })]);
      if (!result.accepted.includes(message.to)) throw Object.assign(new Error('DELIVERY_REJECTED'), { responseCode: 550 });
    } finally { if (timer) clearTimeout(timer); socket.destroy(); transport.close(); activeSockets.delete(socket); }
  });
  function now() { const value = clock(); if (!Number.isFinite(value.getTime())) throw new Error('OUTBOX_CLOCK_INVALID'); return value; }

  async function prepare(row: OutboxRow): Promise<DeliveryMessage | null> {
    if (row.kind === 'security_notification') {
      const raw: unknown = JSON.parse(decryptOutboxPayload({ keyId: row.key_id, nonce: row.nonce,
        authTag: row.auth_tag, ciphertext: row.ciphertext }, { outboxId: row.id, actionTokenId: null,
        kind: 'security_notification', recipientHash: row.recipient_hash }, config.secrets));
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) payloadInvalid();
      const payload = raw as Record<string, unknown>;
      if (Object.keys(payload).sort().join(',') !== 'event,locale,recipientEmail' || payload.event !== 'email_changed'
        || !['es-MX', 'en'].includes(payload.locale as string) || typeof payload.recipientEmail !== 'string') payloadInvalid();
      let recipient: string;
      try { recipient = normalizeActionRecipient(payload.recipientEmail as string); } catch { return payloadInvalid(); }
      if (!actionSubjectHash(config.secrets,'recipient',recipient).equals(row.recipient_hash)
        || (config.smtp.transport === 'mailpit' && !/@[^@]+\.test$/.test(recipient))) payloadInvalid();
      const spanish = payload.locale === 'es-MX';
      return { to: recipient, subject: spanish ? 'Conecta Infusion: Tu correo ha cambiado' : 'Conecta Infusion: Your email changed',
        text: spanish ? 'Se confirmó un nuevo correo para tu cuenta. Todas las sesiones se cerraron. Si no solicitaste este cambio, contacta al estudio.'
          : 'Your account email has changed after confirmation. All sessions were signed out. If you did not request this change, contact the studio.',
        messageId: `<${row.id}@conecta.identity>` };
    }
    const current = (await query<{ purpose: ActionPurpose; recipient_email: string; token_hash: Buffer; valid: boolean }>(
      `SELECT t.purpose,t.recipient_email,t.token_hash,
      (t.consumed_at IS NULL AND t.revoked_at IS NULL AND t.created_at <= $2 AND t.expires_at > $2
       AND (t.account_id IS NULL OR (a.id IS NOT NULL AND a.status <> 'inactive' AND p.status='active'
         AND a.session_version=t.account_version AND ($3 OR a.development_fixture IS NULL)))
       AND (t.person_id IS NULL OR q.status='active')
       AND (t.purpose <> 'family_invitation' OR identity_family_invitation_valid(t.target_id,t.id,$3))
       AND (t.purpose <> 'family_successor' OR identity_family_successor_valid(t.target_id,t.id,$3))) AS valid
      FROM identity_action_tokens t LEFT JOIN accounts a ON a.id=t.account_id
      LEFT JOIN people p ON p.id=a.person_id LEFT JOIN people q ON q.id=t.person_id WHERE t.id=$1`,
    [row.action_token_id,now(),config.smtp.transport === 'mailpit'])).rows[0];
    if (!current?.valid) return null;
    const raw: unknown = JSON.parse(decryptOutboxPayload({ keyId: row.key_id, nonce: row.nonce,
      authTag: row.auth_tag, ciphertext: row.ciphertext }, { outboxId: row.id, actionTokenId: row.action_token_id,
      kind: 'action', recipientHash: row.recipient_hash }, config.secrets));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) payloadInvalid();
    const payload = raw as Record<string, unknown>;
    if (Object.keys(payload).sort().join(',') !== 'locale,purpose,recipientEmail,token'
      || payload.purpose !== current.purpose || !Object.hasOwn(subjects,current.purpose)
      || (payload.locale !== 'es-MX' && payload.locale !== 'en') || typeof payload.recipientEmail !== 'string'
      || typeof payload.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(payload.token)
      || Buffer.from(payload.token,'base64url').toString('base64url') !== payload.token
      || !createHash('sha256').update(payload.token).digest().equals(current.token_hash)) payloadInvalid();
    let recipient: string;
    try { recipient = normalizeActionRecipient(payload.recipientEmail); } catch { return payloadInvalid(); }
    if (recipient !== current.recipient_email || !actionSubjectHash(config.secrets,'recipient',recipient).equals(row.recipient_hash)
      || (config.smtp.transport === 'mailpit' && !/@[^@]+\.test$/.test(recipient))) payloadInvalid();
    const link = new URL('/auth/action',config.publicOrigin);
    link.hash = new URLSearchParams({ purpose: current.purpose, token: payload.token }).toString();
    const spanish = payload.locale === 'es-MX';
    return { to: recipient, subject: 'Conecta Infusion: '+subjects[current.purpose][spanish ? 0 : 1],
      text: (spanish ? 'Abre este enlace y confirma la acción en la página. Abrirlo no aplica cambios.'
        : 'Open this link and confirm the action on the page. Opening it does not apply changes.')
        +'\n\n'+link.href+'\n\n'+(spanish ? 'Válido hasta: ' : 'Valid until: ')+row.expires_at.toISOString(),
      messageId: `<${row.id}@conecta.identity>` };
  }
  async function finish(row: OutboxRow, status: TerminalStatus | 'pending', code: DeliveryCode | null) {
    const time = now();
    return (await query(`UPDATE identity_email_outbox SET status=$3,last_error_code=$4,
      available_at=CASE WHEN $3='pending' THEN $5::timestamptz + ($6::integer * interval '1 second') ELSE available_at END,
      terminal_at=CASE WHEN $3='pending' THEN NULL ELSE $5 END,scrubbed_at=CASE WHEN $3='pending' THEN NULL ELSE $5 END,
      key_id=CASE WHEN $3='pending' THEN key_id ELSE NULL END,nonce=CASE WHEN $3='pending' THEN nonce ELSE NULL END,
      auth_tag=CASE WHEN $3='pending' THEN auth_tag ELSE NULL END,ciphertext=CASE WHEN $3='pending' THEN ciphertext ELSE NULL END,
      claimed_until=NULL WHERE id=$1 AND claimed_until=$2 AND status='pending' RETURNING id`,
    [row.id,row.claimed_until,status,code,time,30*2**(row.attempts-1)])).rowCount === 1;
  }
  async function runBatch(limit = 10) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error('OUTBOX_LIMIT_INVALID');
    const counts = { sent: 0, retried: 0, failed: 0, expired: 0, cancelled: 0 };
    const time = now();
    const cleanup = await query<{ status: 'failed' | 'expired' | 'cancelled' }>(`WITH stale AS (
      SELECT o.id, CASE WHEN o.expires_at <= $1 THEN 'expired' WHEN o.attempts >= 5 THEN 'failed' ELSE 'cancelled' END AS terminal_status
      FROM identity_email_outbox o LEFT JOIN identity_action_tokens t ON t.id=o.action_token_id
      LEFT JOIN accounts a ON a.id=t.account_id LEFT JOIN people p ON p.id=a.person_id LEFT JOIN people q ON q.id=t.person_id
      WHERE o.status='pending' AND (o.expires_at <= $1
        OR (o.attempts >= 5 AND (o.claimed_until IS NULL OR o.claimed_until <= $1))
        OR (o.kind='action' AND (t.id IS NULL OR t.consumed_at IS NOT NULL OR t.revoked_at IS NOT NULL OR t.expires_at <= $1
          OR (t.account_id IS NOT NULL AND (a.id IS NULL OR a.status='inactive' OR p.status <> 'active' OR a.session_version <> t.account_version OR (NOT $2 AND a.development_fixture IS NOT NULL)))
          OR (t.person_id IS NOT NULL AND q.status <> 'active'))))
      ORDER BY o.id LIMIT 100 FOR UPDATE OF o SKIP LOCKED)
      UPDATE identity_email_outbox o SET status=stale.terminal_status,terminal_at=$1,scrubbed_at=$1,
      key_id=NULL,nonce=NULL,auth_tag=NULL,ciphertext=NULL,claimed_until=NULL FROM stale WHERE o.id=stale.id RETURNING o.status`,
    [time,config.smtp.transport === 'mailpit']);
    for (const entry of cleanup.rows) counts[entry.status]++;
    for (let n=0; n<limit; n++) {
      const claimedAt = now();
      const row = (await query<OutboxRow>(`WITH candidate AS (
        SELECT id FROM identity_email_outbox WHERE status='pending' AND attempts < 5
        AND available_at <= $1 AND expires_at > $1 AND (claimed_until IS NULL OR claimed_until <= $1)
        ORDER BY available_at,id LIMIT 1 FOR UPDATE SKIP LOCKED)
        UPDATE identity_email_outbox o SET attempts=o.attempts+1,claimed_until=$1::timestamptz+interval '60 seconds'
        FROM candidate WHERE o.id=candidate.id RETURNING o.*`, [claimedAt])).rows[0];
      if (!row) break;
      let message: DeliveryMessage | null;
      try { message = await prepare(row); }
      catch (error) {
        // Leave the lease recoverable when persistence cannot establish token validity.
        if (error instanceof Error && error.message === 'OUTBOX_UNAVAILABLE') throw error;
        const code = errorCode(error);
        // Decryption/JSON validation failures never become SMTP failures or raw log messages.
        const safeCode = code === 'KEY_UNAVAILABLE' ? code : 'PAYLOAD_INVALID';
        const retry = safeCode === 'KEY_UNAVAILABLE' && row.attempts < 5;
        if (await finish(row,retry ? 'pending' : 'failed',safeCode)) counts[retry ? 'retried' : 'failed']++;
        continue;
      }
      if (!message) { if (await finish(row,'cancelled',null)) counts.cancelled++; continue; }
      if (row.expires_at <= now()) { if (await finish(row,'expired',null)) counts.expired++; continue; }
      // Preparation can stall. Renew only an unexpired lease still owned by this attempt.
      const sendAt = now();
      const renewed = (await query<{ claimed_until: Date }>(`UPDATE identity_email_outbox
        SET claimed_until=$3::timestamptz+interval '60 seconds'
        WHERE id=$1 AND status='pending' AND claimed_until=$2 AND claimed_until > $3 AND expires_at > $3
        RETURNING claimed_until`, [row.id,row.claimed_until,sendAt])).rows[0];
      // The renewal response can itself be delayed; retain the full bounded SMTP budget.
      const readyAt = now();
      if (!renewed || row.expires_at <= readyAt || renewed.claimed_until.getTime()-readyAt.getTime() < 20000) continue;
      row.claimed_until = renewed.claimed_until;
      let status: TerminalStatus | 'pending' = 'sent'; let failure: DeliveryCode | null = null;
      try { await send(message); }
      catch (error) {
        const code = errorCode(error); const retry = code === 'SMTP_UNAVAILABLE' && row.attempts < 5;
        status = retry ? 'pending' : 'failed'; failure = code;
      }
      // A failed database acknowledgement must not be misclassified as an SMTP rejection.
      if (await finish(row,status,failure)) counts[status === 'pending' ? 'retried' : status]++;
    }
    return counts;
  }
  return { runBatch, close: () => { for (const socket of activeSockets) socket.destroy(); } };
}
