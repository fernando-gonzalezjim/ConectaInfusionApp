import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { IdentityConfig } from './config.js';
import { developmentDatabaseUrl } from './bootstrap.js';
import { hashPassword, isSupportedPasswordHash, verifyPassword } from './passwords.js';
import { reserveLoginAttempt } from './login-throttle.js';
import type { IdentityRole, PublicAccount } from '@conecta/contracts';

export type { IdentityRole, PublicAccount } from '@conecta/contracts';
export interface SessionContext {
  account: PublicAccount; sessionId: string; sessionVersion: number;
  authenticatedAt: string; expiresAt: string; csrfToken: string;
}
export interface LoginResult { account: PublicAccount; sessionToken: string; csrfToken: string; expiresAt: string }
export interface SessionService {
  login(input: unknown, ip: string): Promise<LoginResult>;
  resolve(token: unknown, requiredRoles?: readonly IdentityRole[]): Promise<SessionContext>;
  logout(token: unknown): Promise<void>;
  logoutAll(token: unknown): Promise<void>;
}
export class AuthError extends Error {
  constructor(readonly code: 'INVALID_REQUEST' | 'INVALID_CREDENTIALS' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'IDENTITY_DISABLED') { super(code); }
}
interface AccountRow {
  id: string; person_id: string; email: string; password_hash: string | null;
  status: string; confirmation_status: string; session_version: number; development_fixture: string | null;
  person_status: string; full_name: string; preferred_locale: 'es-MX' | 'en'; roles: IdentityRole[];
}
interface SessionRow extends AccountRow {
  session_id: string; csrf_hash: Buffer; authenticated_at: Date; expires_at: Date;
}
const accountColumns = `a.id,a.person_id,a.email,a.password_hash,a.status,a.confirmation_status,a.session_version,a.development_fixture,
  p.status AS person_status,p.full_name,p.preferred_locale,
  ARRAY(SELECT r.role FROM account_roles r WHERE r.account_id=a.id ORDER BY r.role) AS roles`;
const digest = (value: string) => createHash('sha256').update(value).digest();
const csrfFor = (token: string) => createHash('sha256').update('identity-csrf-v1\0').update(token).digest('base64url');
function sessionToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
    && Buffer.from(value, 'base64url').toString('base64url') === value;
}
function accountDto(row: AccountRow): PublicAccount {
  return { id: row.id, personId: row.person_id, email: row.email, fullName: row.full_name,
    preferredLocale: row.preferred_locale, roles: [...row.roles] };
}
function loginInput(value: unknown): { email: string; password: string; rememberMe: boolean } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AuthError('INVALID_REQUEST');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['email', 'password', 'rememberMe'].includes(key))
    || typeof input.email !== 'string' || input.email.length > 320
    || typeof input.password !== 'string' || input.password.length > 256
    || (input.rememberMe !== undefined && typeof input.rememberMe !== 'boolean')) throw new AuthError('INVALID_REQUEST');
  const email = input.email.trim().toLowerCase();
  const characters = [...input.password];
  if (!/^[^\s@]+@[^\s@]+$/.test(email) || email.includes('\0') || characters.length < 1 || characters.length > 128
    || characters.some(character => { const point = character.codePointAt(0)!; return point >= 0xd800 && point <= 0xdfff; })) {
    throw new AuthError('INVALID_REQUEST');
  }
  return { email, password: input.password, rememberMe: input.rememberMe === true };
}

// Backend only. HTTP mounting, Origin/CSRF and shared browser DTO/client integration are I07.
export async function createSessionService(pool: Pool, config: IdentityConfig, options: {
  now?: () => Date; environment?: NodeJS.ProcessEnv;
} = {}): Promise<SessionService> {
  if (!config.enabled) throw new AuthError('IDENTITY_DISABLED');
  const environment = { ...(options.environment ?? process.env) };
  const clock = () => {
    const value = new Date((options.now?.() ?? new Date()).getTime());
    if (!Number.isFinite(value.getTime())) throw new Error('INVALID_AUTH_CLOCK');
    return value;
  };
  // Unknown/ineligible accounts still perform one bounded native verification; never log this secret/hash.
  const dummyHash = await hashPassword(randomBytes(32).toString('base64'));
  async function eligible(row: AccountRow | undefined, db: Pool | PoolClient): Promise<boolean> {
    if (!row || row.status !== 'active' || row.person_status !== 'active'
      || !['verified', 'exempt'].includes(row.confirmation_status) || !isSupportedPasswordHash(row.password_hash)) return false;
    const reserved = ['admin@conecta.example.test', 'testuser@conecta.example.test'].includes(row.email);
    if (!row.development_fixture) return !reserved;
    try {
      const target = developmentDatabaseUrl(environment);
      if (pool.options.connectionString !== environment.DATABASE_URL
        || row.email !== `${row.development_fixture}@conecta.example.test`) return false;
      const result = await db.query<{ name: string }>('SELECT current_database() AS name');
      return result.rows[0]?.name === target.pathname.slice(1);
    } catch (error) {
      // Configuration denials are authentication denials; database failures must remain infrastructure failures.
      if (error instanceof Error && ['DEVELOPMENT_FIXTURES_DISABLED', 'UNSAFE_DEVELOPMENT_DATABASE'].includes(error.message)) return false;
      throw error;
    }
  }
  async function readSession(db: Pool | PoolClient, token: string): Promise<SessionContext> {
    const now = clock();
    const result = await db.query<SessionRow>(`SELECT ${accountColumns},s.id AS session_id,s.csrf_hash,s.authenticated_at,s.expires_at
      FROM identity_sessions s JOIN accounts a ON a.id=s.account_id JOIN people p ON p.id=a.person_id
      WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.created_at <= $2 AND s.authenticated_at <= $2
        AND s.expires_at > $2 AND s.session_version=a.session_version`, [digest(token), now]);
    const row = result.rows[0];
    if (!row || !await eligible(row, db) || row.expires_at <= clock()) throw new AuthError('UNAUTHENTICATED');
    const csrfToken = csrfFor(token);
    const csrfHash = digest(csrfToken);
    if (row.csrf_hash.length !== csrfHash.length || !timingSafeEqual(row.csrf_hash, csrfHash)) throw new AuthError('UNAUTHENTICATED');
    return { account: accountDto(row), sessionId: row.session_id, sessionVersion: row.session_version,
      authenticatedAt: row.authenticated_at.toISOString(), expiresAt: row.expires_at.toISOString(), csrfToken };
  }
  return {
    async login(value, ip) {
      const input = loginInput(value);
      await reserveLoginAttempt(pool, config.secrets, input.email, ip, clock());
      const result = await pool.query<AccountRow>(`SELECT ${accountColumns} FROM accounts a JOIN people p ON p.id=a.person_id WHERE a.email=$1`, [input.email]);
      const snapshot = result.rows[0];
      const allowed = Boolean(snapshot && await eligible(snapshot, pool)
        && (snapshot.development_fixture !== null || [...input.password].length >= 15));
      const matched = await verifyPassword(input.password, allowed && snapshot ? snapshot.password_hash : dummyHash);
      if (!allowed || !matched || !snapshot) throw new AuthError('INVALID_CREDENTIALS');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Lock order: account then person; credential/version changes during hashing cannot issue a stale session.
        await client.query('/* identity-login-lock */ SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [snapshot.id]);
        const locked = await client.query<AccountRow>(`SELECT ${accountColumns}
          FROM accounts a JOIN people p ON p.id=a.person_id WHERE a.id=$1 FOR UPDATE OF p`, [snapshot.id]);
        const current = locked.rows[0];
        if (!current || current.password_hash !== snapshot.password_hash || current.session_version !== snapshot.session_version
          || !await eligible(current, client)) throw new AuthError('INVALID_CREDENTIALS');
        const token = randomBytes(32).toString('base64url');
        const csrfToken = csrfFor(token);
        const created = clock();
        const expires = new Date(created.getTime() + (input.rememberMe ? 30 : 7) * 86400000);
        await client.query(`INSERT INTO identity_sessions(account_id,token_hash,csrf_hash,session_version,remember_me,created_at,authenticated_at,expires_at)
          VALUES ($1,$2,$3,$4,$5,$6,$6,$7)`, [current.id, digest(token), digest(csrfToken), current.session_version, input.rememberMe, created, expires]);
        await client.query('COMMIT');
        return { account: accountDto(current), sessionToken: token, csrfToken, expiresAt: expires.toISOString() };
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    async resolve(token, requiredRoles = []) {
      if (!sessionToken(token)) throw new AuthError('UNAUTHENTICATED');
      const context = await readSession(pool, token);
      if (requiredRoles.length > 0 && !requiredRoles.some(role => context.account.roles.includes(role))) throw new AuthError('FORBIDDEN');
      return context;
    },
    async logout(token) {
      if (!sessionToken(token)) return;
      await pool.query('UPDATE identity_sessions SET revoked_at=$2 WHERE token_hash=$1 AND revoked_at IS NULL', [digest(token), clock()]);
    },
    async logoutAll(token) {
      if (!sessionToken(token)) throw new AuthError('UNAUTHENTICATED');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Serialize with login and future account security mutations, then re-check the current session.
        await client.query(`SELECT a.id FROM accounts a JOIN identity_sessions s ON s.account_id=a.id
          WHERE s.token_hash=$1 FOR UPDATE OF a`, [digest(token)]);
        const context = await readSession(client, token);
        await client.query('UPDATE accounts SET session_version=session_version+1,updated_at=$2 WHERE id=$1', [context.account.id, clock()]);
        await client.query('UPDATE identity_sessions SET revoked_at=$2 WHERE account_id=$1 AND revoked_at IS NULL', [context.account.id, clock()]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
  };
}
