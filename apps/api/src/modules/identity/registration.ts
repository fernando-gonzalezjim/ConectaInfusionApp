import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { EnabledIdentityConfig } from './config.js';
import { ActionError, actionSubjectHash, consumeAction, issueAction, normalizeActionRecipient } from './action-tokens.js';
import { appendIdentityAudit } from './audit.js';
import { hashPassword } from './passwords.js';
import { reservePublicAction } from './public-action-limit.js';

export class RegistrationError extends Error {
  constructor(readonly code: 'INVALID_REQUEST' | 'THROTTLED', readonly retryAfterSeconds?: number) { super(code); }
}
function object(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !fields.includes(key))) throw new RegistrationError('INVALID_REQUEST');
  return value as Record<string, unknown>;
}
function email(value: unknown): string {
  try { return normalizeActionRecipient(value as string); }
  catch { throw new RegistrationError('INVALID_REQUEST'); }
}
const accepted = () => ({ code: 'ACCEPTED' as const });
interface PendingAccount { id: string; person_id: string; email: string; session_version: number; preferred_locale: 'es-MX' | 'en' }
function binding(account: PendingAccount) {
  return { purpose: 'email_confirmation' as const, recipientEmail: account.email, accountId: account.id,
    accountVersion: account.session_version, personId: account.person_id, targetId: null, expectedVersion: account.session_version };
}

export function createRegistrationService(pool: Pool, config: EnabledIdentityConfig, options: { now?: () => Date } = {}) {
  const clock = options.now ?? (() => new Date());
  async function transaction<T>(apply: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const result = await apply(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async function pending(client: PoolClient, address: string): Promise<PendingAccount | undefined> {
    const account = (await client.query<PendingAccount>(`SELECT a.id,a.person_id,a.email,a.session_version,p.preferred_locale
      FROM accounts a JOIN people p ON p.id=a.person_id WHERE a.email=$1 AND a.status='pending'
      AND a.confirmation_status='pending' AND a.password_hash IS NOT NULL AND a.development_fixture IS NULL
      AND p.status='active' AND EXISTS (SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role='customer')
      AND NOT EXISTS (SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role<>'customer') FOR UPDATE OF a`, [address])).rows[0];
    return account;
  }
  return {
    async register(value: unknown, ip: string) {
      const input = object(value, ['fullName', 'email', 'password', 'phone', 'preferredLocale']);
      const address = email(input.email);
      if (typeof input.fullName !== 'string' || !input.fullName.trim() || input.fullName.trim().length > 120
        || /[\x00-\x1f\x7f]/.test(input.fullName)
        || (input.phone !== undefined && input.phone !== null && (typeof input.phone !== 'string' || input.phone.length > 40 || /[\x00-\x1f\x7f]/.test(input.phone)))
        || (input.preferredLocale !== undefined && !['es-MX', 'en'].includes(input.preferredLocale as string))) throw new RegistrationError('INVALID_REQUEST');
      const fullName = input.fullName.trim();
      const now = clock(); await reservePublicAction(pool, config, ip, 'registration_ip', now);
      let passwordHash: string;
      try { passwordHash = await hashPassword(input.password); }
      catch (error) { if (error instanceof Error && error.message === 'INVALID_PASSWORD') throw new RegistrationError('INVALID_REQUEST'); throw error; }
      // These identities belong exclusively to the reviewed development bootstrap path.
      if (['admin@conecta.example.test', 'testuser@conecta.example.test'].includes(address)) return accepted();
      await transaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['identity-registration:' + actionSubjectHash(config.secrets, 'registration', address).toString('hex')]);
        if ((await client.query('SELECT id FROM accounts WHERE email=$1', [address])).rowCount) return;
        // Never claim or modify an existing legacy member merely because emails match.
        const personId = randomUUID(); const accountId = randomUUID();
        await client.query('INSERT INTO people(id,full_name,phone,preferred_locale) VALUES ($1,$2,$3,$4)',
          [personId, fullName, input.phone ?? null, input.preferredLocale ?? 'es-MX']);
        const inserted = await client.query(`INSERT INTO accounts(id,person_id,email,password_hash) VALUES ($1,$2,$3,$4)
          ON CONFLICT(email) DO NOTHING RETURNING id`, [accountId, personId, address, passwordHash]);
        if (!inserted.rowCount) { await client.query('DELETE FROM people WHERE id=$1', [personId]); return; }
        await client.query("INSERT INTO account_roles(account_id,role) VALUES ($1,'customer')", [accountId]);
        await issueAction(client, config, binding({ id: accountId, person_id: personId, email: address, session_version: 0,
          preferred_locale: (input.preferredLocale ?? 'es-MX') as 'es-MX' | 'en' }), (input.preferredLocale ?? 'es-MX') as 'es-MX' | 'en', now);
        await appendIdentityAudit(client, { actor: { id: 'self-registration', type: 'system' }, action: 'account.created',
          targetType: 'account', targetId: accountId, before: null, after: { personId, status: 'pending', confirmationStatus: 'pending', roles: ['customer'] },
          reason: 'Customer self-registration pending email confirmation', correlationId: randomUUID() });
      });
      return accepted();
    },
    async resend(value: unknown, ip: string) {
      const input = object(value, ['email']); const address = email(input.email); const now = clock();
      await reservePublicAction(pool, config, ip, 'registration_ip', now);
      try { await transaction(async client => {
        const account = await pending(client, address);
        if (account) await issueAction(client, config, binding(account), account.preferred_locale, now);
      }); } catch (error) { if (!(error instanceof ActionError && error.code === 'THROTTLED')) throw error; }
      // Unknown, active, inactive and recipient-throttled requests share the same public reply.
      return accepted();
    },
    async confirm(value: unknown, ip: string) {
      const input = object(value, ['token']); const now = clock(); await reservePublicAction(pool, config, ip, 'action_ip', now);
      if (typeof input.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.token)) throw new ActionError('INVALID_ACTION');
      await transaction(async client => {
        const link = (await client.query<{ recipient_email: string }>("SELECT recipient_email FROM identity_action_tokens WHERE token_hash=$1 AND purpose='email_confirmation'",
          [createHash('sha256').update(input.token as string).digest()])).rows[0];
        const account = link && await pending(client, link.recipient_email);
        if (!account) throw new ActionError('INVALID_ACTION');
        await consumeAction(client, input.token, binding(account), async locked => {
          await locked.query("UPDATE accounts SET status='active',confirmation_status='verified',email_verified_at=$2,session_version=session_version+1,updated_at=$2 WHERE id=$1", [account.id, now]);
          await appendIdentityAudit(locked, { actor: { id: account.id, type: 'customer' }, action: 'account.profile_updated',
            targetType: 'account', targetId: account.id, before: { status: 'pending', confirmationStatus: 'pending' },
            after: { status: 'active', confirmationStatus: 'verified' }, reason: 'Customer confirmed email ownership', correlationId: randomUUID() });
        }, now);
      });
      return { code: 'CONFIRMED' as const };
    },
  };
}
