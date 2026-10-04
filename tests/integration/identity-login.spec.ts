import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { hashPassword } from '../../apps/api/src/modules/identity/passwords.js';

for (const role of ['administrator', 'customer']) {
  test(`customer UI signs in a real local ${role}, restores the session and signs out`, async ({ page, context }) => {
    const databaseUrl = process.env.FOUNDATION_TEST_DATABASE_URL;
    if (databaseUrl !== 'postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser') throw new Error('Disposable database required');
    const pool = new pg.Pool({ connectionString: databaseUrl });
    const email = `login-${randomUUID()}@example.test`; const password = 'Real local UI test password';
    const rememberMe = role === 'customer';
    try {
      const person = (await pool.query('INSERT INTO people(full_name) VALUES ($1) RETURNING id', [`UI ${role} fixture`])).rows[0];
      const account = (await pool.query(`INSERT INTO accounts(person_id,email,password_hash,status,confirmation_status,email_verified_at)
        VALUES ($1,$2,$3,'active','verified',now()) RETURNING id`, [person.id, email, await hashPassword(password)])).rows[0];
      await pool.query('INSERT INTO account_roles(account_id,role) VALUES ($1,$2)', [account.id, role]);
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://localhost:5173');
      await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
      await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
      await page.getByLabel('Contraseña', { exact: true }).fill(password);
      if (rememberMe) await page.getByLabel('Recordarme').check();
      await page.getByRole('dialog').getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Mi cuenta', exact: true })).toBeVisible();
      const stored = (await pool.query(`SELECT remember_me,extract(epoch FROM expires_at-created_at)::int AS lifetime
        FROM identity_sessions WHERE account_id=$1`, [account.id])).rows;
      expect(stored).toEqual([{ remember_me: rememberMe, lifetime: (rememberMe ? 30 : 7) * 86400 }]);
      const cookie = (await context.cookies()).find(cookie => cookie.name === 'conecta_session');
      expect(cookie?.httpOnly).toBe(true); expect(cookie?.sameSite).toBe('Lax');
      await page.reload();
      await page.getByRole('button', { name: 'Mi cuenta', exact: true }).click();
      await expect(page.getByRole('dialog')).toContainText(email);
      await expect(page.getByRole('dialog')).toContainText(`UI ${role} fixture`);
      await page.keyboard.press('Escape');
      await page.getByLabel('Idioma', { exact: true }).selectOption('en');
      await page.getByRole('button', { name: 'My account', exact: true }).click();
      await page.getByRole('button', { name: rememberMe ? 'Sign out on all devices' : 'Sign out', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
      expect((await context.cookies()).some(cookie => cookie.name === 'conecta_session')).toBe(false);
      expect((await pool.query('SELECT count(*)::int AS n FROM identity_sessions WHERE account_id=$1 AND revoked_at IS NULL', [account.id])).rows[0].n).toBe(0);
      expect(await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)].some(value => value.includes('conecta_session') || value.includes('csrfToken')))).toBe(false);
      expect(errors).toEqual([]);
    } finally { await pool.end(); }
  });
}
