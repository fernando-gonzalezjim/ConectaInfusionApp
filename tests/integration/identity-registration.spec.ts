import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { readIdentityConfig } from '../../apps/api/src/modules/identity/config.js';
import { createEmailOutboxWorker } from '../../apps/api/src/modules/identity/email-outbox.js';
import { actionSubjectHash } from '../../apps/api/src/modules/identity/action-tokens.js';

test.describe.configure({ mode: 'serial' });
for (const locale of ['es-MX','en'] as const) {
  test(`real ${locale} registration receives Mailpit link, confirms deliberately and signs in`, async ({ page, context }) => {
    test.setTimeout(60000);
    const databaseUrl = process.env.FOUNDATION_TEST_DATABASE_URL;
    if (databaseUrl !== 'postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser') throw new Error('Disposable database required');
    const pool = new pg.Pool({ connectionString: databaseUrl }); const email = `register-${randomUUID()}@example.test`;
    const password = 'A real registration test password'; const english = locale === 'en';
    const compose = ['compose','-f','compose.test.yaml','-p','conecta-foundation-tests'];
    const docker = (args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 60000 });
    let started = false;
    try {
      started = true; docker([...compose,'up','-d','--wait','mailpit']);
      const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://localhost:5173'); if (english) await page.getByLabel('Idioma', { exact: true }).selectOption('en');
      await page.getByRole('button', { name: english ? 'Create account' : 'Crear cuenta', exact: true }).click();
      await page.getByLabel(english ? 'Name' : 'Nombre', { exact: true }).fill('Registration browser fixture');
      await page.getByLabel(english ? 'Email' : 'Correo electrónico', { exact: true }).fill(email);
      await page.getByLabel(english ? 'Password' : 'Contraseña', { exact: true }).fill(password);
      await page.getByRole('dialog').getByRole('button', { name: english ? 'Create account' : 'Crear cuenta', exact: true }).click();
      await expect(page.getByRole('status')).toContainText(english ? 'pending account' : 'cuenta pendiente');
      const account = (await pool.query('SELECT id,status FROM accounts WHERE email=$1', [email])).rows[0]; expect(account.status).toBe('pending');
      expect((await context.cookies()).some(c => c.name === 'conecta_session')).toBe(false);
      const config = readIdentityConfig({ NODE_ENV:'test', IDENTITY_ENABLED:'true', IDENTITY_MAIL_TRANSPORT:'mailpit',
        IDENTITY_OUTBOX_ACTIVE_KEY_ID:'integration', IDENTITY_OUTBOX_KEYS:process.env.FOUNDATION_TEST_OUTBOX_KEYS,
        IDENTITY_THROTTLE_KEY:process.env.FOUNDATION_TEST_THROTTLE_KEY, SMTP_HOST:'127.0.0.1', SMTP_PORT:'11025',
        SMTP_FROM:'no-reply@conecta.example.test', IDENTITY_PUBLIC_ORIGIN:'http://localhost:5173', WEB_ORIGINS:'http://localhost:5173,http://localhost:5174' });
      if (!config.enabled) throw new Error('Test mail config required');
      const worker = createEmailOutboxWorker(pool, config);
      try { expect((await worker.runBatch()).sent).toBe(1); } finally { worker.close(); }
      const inbox = await (await fetch('http://127.0.0.1:18025/api/v1/messages')).json();
      const message = inbox.messages.find((m: {To:{Address:string}[]}) => m.To.some(r => r.Address === email)); expect(message).toBeTruthy();
      const captured = await (await fetch(`http://127.0.0.1:18025/api/v1/message/${message.ID}`)).json();
      expect(captured.Subject).toBe('Conecta Infusion: '+(english ? 'Confirm your email' : 'Confirma tu correo'));
      let link = captured.Text.match(/http:\/\/[^\s]+/)[0]; const rawToken = new URLSearchParams(new URL(link).hash.slice(1)).get('token')!;
      await page.goto(link); await expect(page).toHaveURL('http://localhost:5173/auth/action');
      expect((await pool.query('SELECT status FROM accounts WHERE id=$1',[account.id])).rows[0].status).toBe('pending');
      expect(await page.evaluate(() => [...Object.values(localStorage),...Object.values(sessionStorage)].join(' '))).not.toContain(rawToken);
      // Move only this disposable recipient's initial counter past the resend wait, without sleeping.
      await pool.query(`UPDATE identity_throttles SET window_started_at=window_started_at-interval '65 seconds',
        last_attempt_at=last_attempt_at-interval '65 seconds' WHERE scope='resend_identity' AND subject_hash=$1`,
        [actionSubjectHash(config.secrets,'send',JSON.stringify(['email_confirmation',email]))]);
      await page.getByRole('button',{name:english ? 'Resend confirmation':'Reenviar confirmación',exact:true}).click();
      await page.getByLabel(english ? 'Email':'Correo electrónico',{exact:true}).fill(email);
      await page.getByRole('dialog').getByRole('button',{name:english ? 'Resend confirmation':'Reenviar confirmación',exact:true}).click();
      await expect(page.getByRole('status')).toContainText(english ? 'pending account':'cuenta pendiente');
      const resendWorker = createEmailOutboxWorker(pool,config);
      try { expect((await resendWorker.runBatch()).sent).toBe(1); } finally { resendWorker.close(); }
      const resentInbox = await (await fetch('http://127.0.0.1:18025/api/v1/messages')).json();
      const resentMessage = resentInbox.messages.find((m:{ID:string;To:{Address:string}[]})=>m.ID!==message.ID && m.To.some(r=>r.Address===email));
      expect(resentMessage).toBeTruthy();
      const resent = await (await fetch(`http://127.0.0.1:18025/api/v1/message/${resentMessage.ID}`)).json();
      await page.goto(link); await page.getByRole('button',{name:english ? 'Confirm email':'Confirmar correo',exact:true}).click();
      await expect(page.getByRole('alert')).toContainText(english ? 'expired':'venció');
      link = resent.Text.match(/http:\/\/[^\s]+/)[0]; await page.goto(link);
      await page.getByRole('button',{ name:english ? 'Confirm email':'Confirmar correo',exact:true }).click();
      await expect(page.getByRole('status')).toContainText(english ? 'now sign in':'iniciar sesión');
      expect((await context.cookies()).some(c => c.name==='conecta_session')).toBe(false);
      await page.getByRole('link',{ name:english ? 'Sign in':'Iniciar sesión',exact:true }).click();
      await page.getByRole('button',{ name:english ? 'Sign in':'Iniciar sesión',exact:true }).click();
      await page.getByLabel(english ? 'Email':'Correo electrónico',{exact:true}).fill(email);
      await page.getByLabel(english ? 'Password':'Contraseña',{exact:true}).fill(password);
      await page.getByRole('dialog').getByRole('button',{name:english ? 'Sign in':'Iniciar sesión',exact:true}).click();
      await expect(page.getByRole('button',{name:english ? 'My account':'Mi cuenta',exact:true})).toBeVisible();
      await page.goto(link); await page.getByRole('button',{name:english ? 'Confirm email':'Confirmar correo',exact:true}).click();
      await expect(page.getByRole('alert')).toContainText(english ? 'expired':'venció');
      expect(errors).toEqual([]);
    } finally {
      await pool.end();
      if (started) { docker([...compose,'stop','mailpit']); docker([...compose,'rm','-f','mailpit']); docker(['network','rm','conecta-foundation-tests_mailpit_local']); }
    }
  });
}
