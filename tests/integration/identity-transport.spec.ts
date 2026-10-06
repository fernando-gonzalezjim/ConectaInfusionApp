import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { hashPassword } from '../../apps/api/src/modules/identity/passwords.js';

const clientUrl = '/@fs/' + resolve('packages/api-client/src/index.ts').replaceAll('\\', '/');
const password = 'Browser transport test password';

test('real browser client shares host-only login across both proxies and logout revokes the shared session', async ({ page, context }) => {
  const databaseUrl = process.env.FOUNDATION_TEST_DATABASE_URL;
  if (databaseUrl !== 'postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser') throw new Error('Disposable database required');
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const email = `transport-${randomUUID()}@example.test`;
  try {
    const person = (await pool.query("INSERT INTO people(full_name) VALUES ('Browser transport fixture') RETURNING id")).rows[0];
    const account = (await pool.query(`INSERT INTO accounts(person_id,email,password_hash,status,confirmation_status,email_verified_at)
      VALUES ($1,$2,$3,'active','verified',now()) RETURNING id`, [person.id, email, await hashPassword(password)])).rows[0];
    await pool.query("INSERT INTO account_roles(account_id,role) VALUES ($1,'customer')", [account.id]);
    await page.goto('http://localhost:5173');
    const login = await page.evaluate(async ({ clientUrl, email, password }) => {
      const { createApiClient } = await import(/* @vite-ignore */ clientUrl);
      const result = await createApiClient().login({ email, password });
      return { id: result.account.id, roles: result.account.roles };
    }, { clientUrl, email, password });
    expect(login).toEqual({ id: account.id, roles: ['customer'] });
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(cookie => cookie.name === 'conecta_session');
    expect(sessionCookie?.httpOnly).toBe(true); expect(sessionCookie?.sameSite).toBe('Lax');
    expect(sessionCookie?.domain).toBe('localhost'); expect(sessionCookie?.path).toBe('/');
    expect(cookies.some(cookie => cookie.name === 'conecta_csrf')).toBe(false);
    expect(await page.evaluate(() => document.cookie.includes('conecta_session'))).toBe(false);
    await page.goto('http://localhost:5174');
    const session = await page.evaluate(async clientUrl => {
      const { createApiClient } = await import(/* @vite-ignore */ clientUrl);
      return (await createApiClient().getSession()).account;
    }, clientUrl);
    expect(session.id).toBe(account.id); expect(session.roles).toEqual(['customer']);
    // Browser automatically supplies Origin; the missing-CSRF request cannot revoke access.
    expect(await page.evaluate(async () => (await fetch('/api/v1/auth/logout-all', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status)).toBe(403);
    // Also exercise actual credential-aware CORS rather than only the same-origin Vite proxies.
    expect(await page.evaluate(async () => (await fetch('http://localhost:3001/api/v1/auth/session', {
      credentials: 'include' })).status)).toBe(200);
    await page.evaluate(async clientUrl => {
      const { createApiClient } = await import(/* @vite-ignore */ clientUrl);
      await createApiClient().logoutAll();
    }, clientUrl);
    expect((await context.cookies()).some(cookie => cookie.name === 'conecta_session')).toBe(false);
    await page.goto('http://localhost:5173');
    expect(await page.evaluate(async clientUrl => {
      const { createApiClient } = await import(/* @vite-ignore */ clientUrl);
      try { await createApiClient().getSession(); return 'unexpected'; }
      catch (error) { return (error as { code: string }).code; }
    }, clientUrl)).toBe('UNAUTHENTICATED');
  } finally { await pool.end(); }
});
