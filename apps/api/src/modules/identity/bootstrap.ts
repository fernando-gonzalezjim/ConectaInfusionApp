import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { appendIdentityAudit } from './audit.js';
import { hashPassword, hashDevelopmentFixturePassword, verifyPassword } from './passwords.js';

const bootstrapLock = 84467004;
const adminEmail = 'admin@conecta.example.test';
const userEmail = 'testuser@conecta.example.test';

export function developmentDatabaseUrl(environment: NodeJS.ProcessEnv = process.env): URL {
  if (environment.NODE_ENV !== 'development' || environment.IDENTITY_DEV_FIXTURES !== 'true') throw new Error('DEVELOPMENT_FIXTURES_DISABLED');
  let url: URL;
  try { url = new URL(environment.DATABASE_URL ?? ''); }
  catch { throw new Error('UNSAFE_DEVELOPMENT_DATABASE'); }
  const database = url.pathname.slice(1);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.search || url.hash || !/^(conecta|conecta_dev|foundation_browser|test_[a-f0-9]{32})$/.test(database)) {
    throw new Error('UNSAFE_DEVELOPMENT_DATABASE');
  }
  return url;
}

function text(value: unknown, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || value.includes('\0')) throw new Error('INVALID_BOOTSTRAP_INPUT');
  return value;
}
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

export async function generateFirstAdminSql(input: {
  development?: boolean; email?: string; name?: string; operator: string;
  password?: string; environment?: NodeJS.ProcessEnv;
}): Promise<string> {
  const operator = text(input.operator, 120);
  const env = input.environment ?? process.env;
  const target = input.development ? developmentDatabaseUrl(env).pathname.slice(1) : null;
  if (input.development && (input.email !== undefined || input.name !== undefined || input.password !== undefined)) throw new Error('INVALID_DEVELOPMENT_FIXTURE');
  const email = input.development ? adminEmail : text(input.email, 320).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) throw new Error('INVALID_BOOTSTRAP_INPUT');
  // Reserved local identities may never be generated as untagged normal accounts.
  if (!input.development && [adminEmail, userEmail].includes(email)) throw new Error('INVALID_DEVELOPMENT_FIXTURE');
  const name = input.development ? 'admin' : text(input.name, 120);
  const hash = input.development ? await hashDevelopmentFixturePassword('admin', env) : await hashPassword(input.password);
  const personId = randomUUID(), accountId = randomUUID();
  const after = { fullName: name, email, personId, status: 'active', roles: ['administrator'], confirmationStatus: 'exempt', exemptionSource: 'manual_bootstrap' };
  return `-- Operator-reviewed first-admin SQL. Never execute from application startup/migrations.
BEGIN;
SET LOCAL standard_conforming_strings = on;
SELECT pg_advisory_xact_lock(${bootstrapLock});
DO $identity_bootstrap$
BEGIN
  ${target ? `IF current_database() <> ${literal(target)} THEN RAISE EXCEPTION 'DEVELOPMENT_DATABASE_MISMATCH'; END IF;` : ''}
  IF EXISTS (SELECT 1 FROM account_roles WHERE role IN ('administrator','manager')) THEN
    RAISE EXCEPTION 'FIRST_ADMIN_ALREADY_EXISTS';
  END IF;
END;
$identity_bootstrap$;
INSERT INTO people(id,full_name) VALUES (${literal(personId)},${literal(name)});
INSERT INTO accounts(id,person_id,email,password_hash,status,confirmation_status,exemption_source,exemption_reason,exemption_at,development_fixture)
VALUES (${literal(accountId)},${literal(personId)},${literal(email)},${literal(hash)},'active','exempt','manual_bootstrap','First administrator inserted manually by operator',now(),${input.development ? "'admin'" : 'NULL'});
INSERT INTO account_roles(account_id,role,assigned_by) VALUES (${literal(accountId)},'administrator',${literal(accountId)});
INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,changes,reason,correlation_id)
VALUES (${literal(operator)},'system','account.created','account',${literal(accountId)},${literal(JSON.stringify({ before: null, after }))}::jsonb,'First administrator inserted manually by operator',${literal(randomUUID())});
COMMIT;
`;
}

// Operator command only. No route/startup caller, auto-first-admin creation or generic short-password option.
export async function createDevelopmentTestUser(
  pool: Pool, adminPassword: unknown, environment: NodeJS.ProcessEnv = process.env,
): Promise<{ status: 'created' | 'already_exists'; accountId: string }> {
  const url = developmentDatabaseUrl(environment);
  if (pool.options.connectionString !== environment.DATABASE_URL) throw new Error('DEVELOPMENT_DATABASE_MISMATCH');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [bootstrapLock]);
    const actual = (await client.query<{ name: string }>('SELECT current_database() AS name')).rows[0];
    if (actual?.name !== url.pathname.slice(1)) throw new Error('DEVELOPMENT_DATABASE_MISMATCH');
    const admin = (await client.query<{ id: string; password_hash: string }>(`SELECT a.id,a.password_hash
      FROM accounts a JOIN people p ON p.id=a.person_id
      WHERE a.email=$1 AND a.development_fixture='admin' AND a.status='active' AND p.status='active'
        AND a.confirmation_status='exempt' AND a.exemption_source='manual_bootstrap'
        AND EXISTS (SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role IN ('administrator','manager'))
      FOR UPDATE OF a,p`, [adminEmail])).rows[0];
    if (!admin || !await verifyPassword(adminPassword, admin.password_hash)) throw new Error('DEVELOPMENT_ADMIN_REQUIRED');
    const existing = (await client.query(`SELECT a.*,p.status AS person_status,
      ARRAY(SELECT r.role FROM account_roles r WHERE r.account_id=a.id ORDER BY r.role) AS roles
      FROM accounts a JOIN people p ON p.id=a.person_id WHERE a.email=$1 FOR UPDATE OF a,p`, [userEmail])).rows[0];
    if (existing) {
      if (existing.development_fixture !== 'testuser' || existing.status !== 'active' || existing.person_status !== 'active'
        || existing.confirmation_status !== 'exempt' || existing.exemption_source !== 'management'
        || existing.exemption_actor_id !== admin.id || JSON.stringify(existing.roles) !== '["customer"]'
        || !await verifyPassword('testuser', existing.password_hash)) throw new Error('DEVELOPMENT_FIXTURE_CONFLICT');
      await client.query('COMMIT');
      return { status: 'already_exists', accountId: existing.id };
    }
    const hash = await hashDevelopmentFixturePassword('testuser', environment);
    const personId = randomUUID(), accountId = randomUUID();
    await client.query('INSERT INTO people(id,full_name) VALUES ($1,$2)', [personId, 'testuser']);
    await client.query(`INSERT INTO accounts(id,person_id,email,password_hash,status,confirmation_status,
      exemption_source,exemption_actor_id,exemption_reason,exemption_at,development_fixture)
      VALUES ($1,$2,$3,$4,'active','exempt','management',$5,'Opt-in local development fixture',now(),'testuser')`,
    [accountId, personId, userEmail, hash, admin.id]);
    await client.query("INSERT INTO account_roles(account_id,role,assigned_by) VALUES ($1,'customer',$2)", [accountId, admin.id]);
    await appendIdentityAudit(client, { actor: { id: admin.id, type: 'staff' }, action: 'account.created',
      targetType: 'account', targetId: accountId, before: null,
      after: { fullName: 'testuser', email: userEmail, personId, status: 'active', roles: ['customer'], confirmationStatus: 'exempt', exemptionSource: 'management' },
      reason: 'Opt-in local development fixture', correlationId: randomUUID() });
    await client.query('COMMIT');
    return { status: 'created', accountId };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
