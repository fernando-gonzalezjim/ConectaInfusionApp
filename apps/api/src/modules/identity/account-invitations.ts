import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { EnabledIdentityConfig } from './config.js';
import { ActionError, actionSubjectHash, consumeAction, issueAction, normalizeActionRecipient } from './action-tokens.js';
import { appendIdentityAudit } from './audit.js';
import { hashPassword } from './passwords.js';
import { reservePublicAction } from './public-action-limit.js';
import { AuthError, type IdentityRole, type SessionContext, type SessionService } from './sessions.js';

const personnel: readonly IdentityRole[] = ['administrator', 'manager', 'reception', 'cafe_staff', 'instructor'];
interface PendingAccount {
  id: string; person_id: string; email: string; session_version: number;
  preferred_locale: 'es-MX' | 'en'; confirmation_status: 'pending' | 'exempt';
}
function object(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !fields.includes(key))) throw new AuthError('INVALID_REQUEST');
  return value as Record<string, unknown>;
}
function address(value: unknown): string {
  try { return normalizeActionRecipient(value as string); } catch { throw new AuthError('INVALID_REQUEST'); }
}
function binding(account: PendingAccount) {
  return { purpose: 'password_setup' as const, recipientEmail: account.email, accountId: account.id,
    accountVersion: account.session_version, personId: account.person_id, targetId: null, expectedVersion: account.session_version };
}

export function createAccountInvitationService(pool: Pool, config: EnabledIdentityConfig, sessions: SessionService,
  options: { now?: () => Date } = {}) {
  const clock = options.now ?? (() => new Date());
  async function transaction<T>(apply: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const result = await apply(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async function actor(client: PoolClient, context: SessionContext): Promise<string[]> {
    // Recheck authorization under locks, rather than trusting roles captured before the transaction.
    const account = (await client.query<{ person_id: string; session_version: number }>(`SELECT person_id,session_version
      FROM accounts WHERE id=$1 AND status='active' AND confirmation_status IN ('verified','exempt') FOR UPDATE`, [context.account.id])).rows[0];
    if (!account || account.session_version !== context.sessionVersion) throw new AuthError('UNAUTHENTICATED');
    const person = await client.query("SELECT id FROM people WHERE id=$1 AND status='active' FOR UPDATE", [account.person_id]);
    const session = await client.query<{ expires_at: Date }>(`SELECT expires_at FROM identity_sessions WHERE id=$1 AND account_id=$2
      AND session_version=$3 AND revoked_at IS NULL FOR UPDATE`, [context.sessionId, context.account.id, context.sessionVersion]);
    if (!person.rowCount || !session.rowCount) throw new AuthError('UNAUTHENTICATED');
    const roles = (await client.query<{ role: string }>('SELECT role FROM account_roles WHERE account_id=$1 FOR SHARE', [context.account.id])).rows.map(row => row.role);
    if (session.rows[0]!.expires_at.getTime() <= clock().getTime()) throw new AuthError('UNAUTHENTICATED');
    if (!roles.some(role => personnel.includes(role as IdentityRole))) throw new AuthError('FORBIDDEN');
    return roles;
  }
  async function pending(client: PoolClient, email: string): Promise<PendingAccount | undefined> {
    return (await client.query<PendingAccount>(`SELECT a.id,a.person_id,a.email,a.session_version,a.confirmation_status,p.preferred_locale
      FROM accounts a JOIN people p ON p.id=a.person_id WHERE a.email=$1 AND a.status='pending'
      AND a.password_hash IS NULL AND a.development_fixture IS NULL AND p.status='active'
      AND a.confirmation_status IN ('pending','exempt')
      AND EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role='customer')
      AND NOT EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role<>'customer') FOR UPDATE OF a`, [email])).rows[0];
  }
  return {
    async invite(value: unknown, sessionToken: unknown, ip: string) {
      const context = await sessions.resolve(sessionToken, personnel);
      const input = object(value, ['email', 'fullName', 'phone', 'preferredLocale', 'waiveConfirmation', 'reason']);
      const email = address(input.email);
      if (typeof input.fullName !== 'string' || !input.fullName.trim() || input.fullName.trim().length > 120
        || /[\x00-\x1f\x7f]/.test(input.fullName)
        || (input.phone !== undefined && input.phone !== null && (typeof input.phone !== 'string' || input.phone.length > 40 || /[\x00-\x1f\x7f]/.test(input.phone)))
        || (input.preferredLocale !== undefined && !['es-MX', 'en'].includes(input.preferredLocale as string))
        || (input.waiveConfirmation !== undefined && typeof input.waiveConfirmation !== 'boolean')
        || (input.waiveConfirmation === true ? typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length > 500 : input.reason !== undefined))
        throw new AuthError('INVALID_REQUEST');
      const fullName = input.fullName.trim(); const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
      const now = clock();
      await reservePublicAction(pool, config, ip, 'registration_ip', now);
      await transaction(async client => {
        const roles = await actor(client, context);
        if (input.waiveConfirmation === true && !roles.some(role => ['administrator', 'manager'].includes(role))) throw new AuthError('FORBIDDEN');
        // Shares the public-registration address mutex; never claim or overwrite an existing identity.
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          ['identity-registration:' + actionSubjectHash(config.secrets, 'registration', email).toString('hex')]);
        await actor(client, context);
        if (['admin@conecta.example.test', 'testuser@conecta.example.test'].includes(email)
          || (await client.query('SELECT id FROM accounts WHERE email=$1', [email])).rowCount) return;
        const locale = (input.preferredLocale ?? 'es-MX') as 'es-MX' | 'en';
        const personId = (await client.query<{ id: string }>('INSERT INTO people(full_name,phone,preferred_locale) VALUES ($1,$2,$3) RETURNING id',
          [fullName, input.phone ?? null, locale])).rows[0]!.id;
        const exempt = input.waiveConfirmation === true;
        const account = (await client.query<PendingAccount>(`INSERT INTO accounts(person_id,email,status,confirmation_status,
          exemption_source,exemption_actor_id,exemption_reason,exemption_at) VALUES ($1,$2,'pending',$3,$4,$5,$6,$7)
          RETURNING id,person_id,email,session_version,confirmation_status`, [personId, email, exempt ? 'exempt' : 'pending',
          exempt ? 'management' : null, exempt ? context.account.id : null, exempt ? reason : null, exempt ? clock() : null])).rows[0]!;
        account.preferred_locale = locale;
        await client.query("INSERT INTO account_roles(account_id,role,assigned_by) VALUES ($1,'customer',$2)", [account.id, context.account.id]);
        await issueAction(client, config, binding(account), locale, clock());
        const audit = { actor: { id: context.account.id, type: 'staff' as const }, targetType: 'account' as const,
          targetId: account.id, before: null, correlationId: randomUUID() };
        await appendIdentityAudit(client, { ...audit, action: 'account.created',
          after: { personId, fullName, email, roles: ['customer'], status: 'pending', confirmationStatus: account.confirmation_status }, reason: 'Customer invited by personnel' });
        if (exempt) await appendIdentityAudit(client, { ...audit, action: 'account.confirmation_exempted',
          after: { confirmationStatus: 'exempt', exemptionSource: 'management' }, reason });
      });
      return { code: 'ACCEPTED' as const };
    },
    async resend(value: unknown, sessionToken: unknown, ip: string) {
      const context = await sessions.resolve(sessionToken, personnel);
      const input = object(value, ['email']); const email = address(input.email); const now = clock();
      await reservePublicAction(pool, config, ip, 'registration_ip', now);
      try { await transaction(async client => {
        // Match administration's account lock order when an existing invitation is resent.
        // Eligibility is checked again after locking; this lookup grants no authorization.
        const target = (await client.query<{ id: string }>('SELECT id FROM accounts WHERE email=$1', [email])).rows[0];
        await client.query('SELECT id FROM accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
          [[...new Set([context.account.id, ...(target ? [target.id] : [])])]]);
        await actor(client, context);
        const account = await pending(client, email);
        if (account) {
          await client.query('SELECT id FROM people WHERE id=$1 FOR UPDATE', [account.person_id]);
          await actor(client, context);
          await issueAction(client, config, binding(account), account.preferred_locale, clock());
        }
      }); } catch (error) { if (!(error instanceof ActionError && error.code === 'THROTTLED')) throw error; }
      return { code: 'ACCEPTED' as const };
    },
    async setup(value: unknown, ip: string) {
      const input = object(value, ['token', 'password']); const now = clock();
      await reservePublicAction(pool, config, ip, 'action_ip', now);
      if (typeof input.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.token)) throw new ActionError('INVALID_ACTION');
      const token = input.token; let passwordHash: string;
      try { passwordHash = await hashPassword(input.password); }
      catch (error) { if (error instanceof Error && error.message === 'INVALID_PASSWORD') throw new AuthError('INVALID_REQUEST'); throw error; }
      await transaction(async client => {
        const link = (await client.query<{ recipient_email: string }>("SELECT recipient_email FROM identity_action_tokens WHERE token_hash=$1 AND purpose='password_setup'",
          [createHash('sha256').update(token).digest()])).rows[0];
        const account = link && await pending(client, link.recipient_email);
        if (!account) throw new ActionError('INVALID_ACTION');
        // Acquire all redemption locks before taking the time used for the expiry decision.
        await client.query('SELECT id FROM people WHERE id=$1 FOR UPDATE', [account.person_id]);
        await client.query('SELECT id FROM identity_action_tokens WHERE token_hash=$1 FOR UPDATE', [createHash('sha256').update(token).digest()]);
        const redeemedAt = clock();
        await consumeAction(client, token, binding(account), async locked => {
          const verified = account.confirmation_status === 'pending';
          await locked.query(`UPDATE accounts SET password_hash=$2,status='active',confirmation_status=$3,email_verified_at=$4,
            session_version=session_version+1,updated_at=$5 WHERE id=$1`, [account.id, passwordHash, verified ? 'verified' : 'exempt', verified ? redeemedAt : null, redeemedAt]);
          await locked.query('UPDATE identity_sessions SET revoked_at=$2 WHERE account_id=$1 AND revoked_at IS NULL', [account.id, redeemedAt]);
          await appendIdentityAudit(locked, { actor: { id: 'customer-invitation', type: 'system' }, action: 'account.password_set',
            targetType: 'account', targetId: account.id, before: { status: 'pending', confirmationStatus: account.confirmation_status },
            after: { status: 'active', confirmationStatus: verified ? 'verified' : 'exempt' },
            reason: 'Customer password set through single-use invitation link', correlationId: randomUUID() });
        }, redeemedAt);
      });
      return { code: 'PASSWORD_SET' as const };
    },
  };
}
