import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { EnabledIdentityConfig } from './config.js';
import { ActionError, consumeAction, issueAction, normalizeActionRecipient } from './action-tokens.js';
import { appendIdentityAudit } from './audit.js';
import { developmentDatabaseUrl } from './bootstrap.js';
import { hashPassword, isSupportedPasswordHash } from './passwords.js';
import { AuthError } from './sessions.js';
import { reservePublicAction } from './public-action-limit.js';

interface RecoveryAccount {
  id: string; person_id: string; email: string; session_version: number;
  preferred_locale: 'es-MX' | 'en'; development_fixture: string | null; password_hash: string | null;
}
function object(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !fields.includes(key))) throw new AuthError('INVALID_REQUEST');
  return value as Record<string, unknown>;
}
function binding(account: RecoveryAccount) {
  return { purpose: 'password_reset' as const, recipientEmail: account.email, accountId: account.id,
    accountVersion: account.session_version, personId: account.person_id, targetId: null, expectedVersion: account.session_version };
}

export function createRecoveryService(pool: Pool, config: EnabledIdentityConfig, options: {
  now?: () => Date; environment?: NodeJS.ProcessEnv;
} = {}) {
  const environment = options.environment ?? process.env;
  const clock = options.now ?? (() => new Date());
  async function transaction<T>(apply: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const result = await apply(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async function active(client: PoolClient, address: string): Promise<RecoveryAccount | undefined> {
    const account = (await client.query<RecoveryAccount>(`SELECT a.id,a.person_id,a.email,a.session_version,
      a.development_fixture,a.password_hash,p.preferred_locale FROM accounts a JOIN people p ON p.id=a.person_id
      WHERE a.email=$1 AND a.status='active' AND p.status='active' AND a.confirmation_status IN ('verified','exempt')
      FOR UPDATE OF a`, [address])).rows[0];
    if (!account || !isSupportedPasswordHash(account.password_hash)) return undefined;
    if (account.development_fixture) {
      // Same local fixture boundary as login: copied fixture accounts must not gain production recovery.
      try {
        const target = developmentDatabaseUrl(environment);
        if (pool.options.connectionString !== environment.DATABASE_URL
          || account.email !== `${account.development_fixture}@conecta.example.test`) return undefined;
        const current = (await client.query<{ name: string }>('SELECT current_database() AS name')).rows[0];
        if (current?.name !== target.pathname.slice(1)) return undefined;
      } catch (error) {
        if (error instanceof Error && ['DEVELOPMENT_FIXTURES_DISABLED', 'UNSAFE_DEVELOPMENT_DATABASE'].includes(error.message)) return undefined;
        throw error;
      }
    } else if (['admin@conecta.example.test', 'testuser@conecta.example.test'].includes(address)) return undefined;
    return account;
  }
  return {
    async request(value: unknown, ip: string) {
      const input = object(value, ['email']); let address: string;
      try { address = normalizeActionRecipient(input.email as string); }
      catch { throw new AuthError('INVALID_REQUEST'); }
      const now = clock(); await reservePublicAction(pool, config, ip, 'recovery_ip', now);
      try { await transaction(async client => {
        const account = await active(client, address);
        if (account) await issueAction(client, config, binding(account), account.preferred_locale, now);
      }); } catch (error) { if (!(error instanceof ActionError && error.code === 'THROTTLED')) throw error; }
      return { code: 'ACCEPTED' as const };
    },
    async reset(value: unknown, ip: string) {
      const input = object(value, ['token', 'password']); const now = clock();
      await reservePublicAction(pool, config, ip, 'action_ip', now);
      if (typeof input.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.token)) throw new ActionError('INVALID_ACTION');
      const token = input.token;
      let passwordHash: string;
      try { passwordHash = await hashPassword(input.password); }
      catch (error) { if (error instanceof Error && error.message === 'INVALID_PASSWORD') throw new AuthError('INVALID_REQUEST'); throw error; }
      await transaction(async client => {
        const link = (await client.query<{ recipient_email: string }>("SELECT recipient_email FROM identity_action_tokens WHERE token_hash=$1 AND purpose='password_reset'",
          [createHash('sha256').update(token).digest()])).rows[0];
        const account = link && await active(client, link.recipient_email);
        if (!account) throw new ActionError('INVALID_ACTION');
        await consumeAction(client, token, binding(account), async locked => {
          await locked.query('UPDATE accounts SET password_hash=$2,session_version=session_version+1,updated_at=$3 WHERE id=$1', [account.id, passwordHash, now]);
          await locked.query('UPDATE identity_sessions SET revoked_at=$2 WHERE account_id=$1 AND revoked_at IS NULL', [account.id, now]);
          await appendIdentityAudit(locked, { actor: { id: 'password-recovery', type: 'system' }, action: 'account.password_set',
            targetType: 'account', targetId: account.id, before: null, after: null,
            reason: 'Account password recovered through single-use email link; all sessions revoked', correlationId: randomUUID() });
        }, now);
      });
      return { code: 'PASSWORD_RESET' as const };
    },
  };
}
