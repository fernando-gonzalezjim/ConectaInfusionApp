import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { hashPassword } from '../../apps/api/src/modules/identity/passwords.js';

async function signIn(page: Page, port: number, email: string) {
  await page.goto(`http://localhost:${port}`);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill('Real management test password');
  await page.getByRole('dialog').getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mi cuenta', exact: true })).toBeVisible();
}

for (const role of ['administrator', 'manager', 'reception', 'instructor']) {
  test(`real ${role} has server-controlled management access and shared frontend logout`, async ({ page, context }) => {
    const databaseUrl = process.env.FOUNDATION_TEST_DATABASE_URL;
    if (databaseUrl !== 'postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser') throw new Error('Disposable database required');
    const pool = new pg.Pool({ connectionString: databaseUrl });
    const email = `management-${randomUUID()}@example.test`;
    const privileged = role === 'administrator' || role === 'manager';
    try {
      const person = (await pool.query('INSERT INTO people(full_name) VALUES ($1) RETURNING id', [`Management ${role}`])).rows[0];
      const account = (await pool.query(`INSERT INTO accounts(person_id,email,password_hash,status,confirmation_status,email_verified_at)
        VALUES ($1,$2,$3,'active','verified',now()) RETURNING id`, [person.id, email, await hashPassword('Real management test password')])).rows[0];
      await pool.query('INSERT INTO account_roles(account_id,role) VALUES ($1,$2)', [account.id, role]);
      // Multi-role membership must not grant administrative permission.
      if (role === 'instructor') await pool.query("INSERT INTO account_roles(account_id,role) VALUES ($1,'customer')", [account.id]);
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      const firstPort = role === 'administrator' ? 5173 : 5174;
      await signIn(page, firstPort, email);
      const other = await context.newPage();
      await other.goto(`http://localhost:${firstPort === 5173 ? 5174 : 5173}`);
      await expect(other.getByRole('button', { name: 'Mi cuenta', exact: true })).toBeVisible();
      const management = firstPort === 5174 ? page : other;
      const heading = management.getByRole('heading', { name: 'Administración de cuentas', exact: true });
      if (privileged) await expect(heading).toBeVisible();
      else {
        await expect(management.getByText('Tu cuenta no tiene permisos de administración.', { exact: true })).toBeVisible();
        await expect(heading).toHaveCount(0);
      }
      const direct = await management.evaluate(async () => {
        const response = await fetch('/api/v1/management/access?role=administrator', {
          credentials: 'include', headers: { 'X-Role': 'administrator' }
        });
        return { status: response.status, body: await response.json() };
      });
      expect(direct.status).toBe(privileged ? 200 : 403);
      if (privileged) {
        expect(direct.body.account.id).toBe(account.id);
        await pool.query('DELETE FROM account_roles WHERE account_id=$1 AND role=$2', [account.id, role]);
        await management.evaluate(() => window.dispatchEvent(new Event('focus')));
        await expect(heading).toHaveCount(0);
        await expect(management.getByText('Tu cuenta no tiene permisos de administración.', { exact: true })).toBeVisible();
        expect(await management.evaluate(async () => (await fetch('/api/v1/management/access', { credentials: 'include' })).status)).toBe(403);
      }
      await other.getByRole('button', { name: 'Mi cuenta', exact: true }).click();
      await other.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
      await expect(other.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible();
      await expect(management.getByRole('heading', { name: 'Administración de cuentas', exact: true })).toHaveCount(0);
      expect((await pool.query('SELECT count(*)::int AS n FROM identity_sessions WHERE account_id=$1 AND revoked_at IS NULL', [account.id])).rows[0].n).toBe(0);
      expect(errors).toEqual([]);
    } finally { await pool.end(); }
  });
}
