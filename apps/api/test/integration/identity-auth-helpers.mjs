import { randomBytes } from 'node:crypto';
import { readIdentityConfig } from '../../dist/modules/identity/config.js';
import { hashPassword } from '../../dist/modules/identity/passwords.js';

export const password = 'A normal test password with spaces';
export function authConfig() {
  return readIdentityConfig({ IDENTITY_ENABLED: 'true', NODE_ENV: 'test', IDENTITY_MAIL_TRANSPORT: 'mailpit',
    IDENTITY_OUTBOX_ACTIVE_KEY_ID: 'v1', IDENTITY_OUTBOX_KEYS: JSON.stringify({ v1: randomBytes(32).toString('base64') }),
    IDENTITY_THROTTLE_KEY: randomBytes(32).toString('base64'), SMTP_HOST: '127.0.0.1', SMTP_PORT: '11025',
    SMTP_FROM: 'fixture@example.test', WEB_ORIGINS: 'http://localhost:5173,http://localhost:5174', IDENTITY_PUBLIC_ORIGIN: 'http://localhost:5173' });
}
export async function createAuthAccount(pool, email = 'customer@example.test', roles = ['customer']) {
  const personId = (await pool.query("INSERT INTO people(full_name) VALUES ('Auth fixture') RETURNING id")).rows[0].id;
  const accountId = (await pool.query(`INSERT INTO accounts(person_id,email,password_hash,status,confirmation_status,email_verified_at)
    VALUES ($1,$2,$3,'active','verified',now()) RETURNING id`, [personId, email, await hashPassword(password)])).rows[0].id;
  await pool.query('INSERT INTO account_roles(account_id,role) SELECT $1,unnest($2::text[])', [accountId, roles]);
  return { accountId, personId, email };
}
