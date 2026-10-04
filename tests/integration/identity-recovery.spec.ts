import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { hashPassword } from '../../apps/api/src/modules/identity/passwords.js';
import { readIdentityConfig } from '../../apps/api/src/modules/identity/config.js';
import { createEmailOutboxWorker } from '../../apps/api/src/modules/identity/email-outbox.js';

for (const locale of ['es-MX','en'] as const) {
  test(`real ${locale} recovery email resets a password and revokes both frontend sessions`, async ({page,browser}) => {
    test.setTimeout(60000);
    const databaseUrl=process.env.FOUNDATION_TEST_DATABASE_URL;
    if(databaseUrl!=='postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser')throw new Error('Disposable database required');
    const pool=new pg.Pool({connectionString:databaseUrl});const email=`recovery-${randomUUID()}@example.test`;
    const oldPassword='A previous browser fixture password';const newPassword='A replacement browser fixture password';const english=locale==='en';
    const compose=['compose','-f','compose.test.yaml','-p','conecta-foundation-tests'];const docker=(args:string[])=>execFileSync('docker',args,{stdio:'inherit'});
    const managementContext=await browser.newContext();const recoveryContext=await browser.newContext();let started=false;
    const management=await managementContext.newPage();const recovery=await recoveryContext.newPage();const errors:string[]=[];
    for(const p of [page,management,recovery])p.on('pageerror',e=>errors.push(e.message));
    async function language(p:Page){await p.getByRole('combobox').selectOption(locale);}
    async function signIn(p:Page,port:number,password:string){
      await p.goto(`http://localhost:${port}`);await language(p);await p.getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true}).click();
      await p.getByLabel(english?'Email':'Correo electrónico',{exact:true}).fill(email);await p.getByLabel(english?'Password':'Contraseña',{exact:true}).fill(password);
      await p.getByRole('dialog').getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true}).click();
    }
    try {
      started=true;docker([...compose,'--profile','identity','up','-d','--no-deps','--wait','mailpit']);
      const person=(await pool.query('INSERT INTO people(full_name,preferred_locale) VALUES ($1,$2) RETURNING id',['Recovery browser fixture',locale])).rows[0];
      const account=(await pool.query(`INSERT INTO accounts(person_id,email,password_hash,status,confirmation_status,email_verified_at) VALUES ($1,$2,$3,'active','verified',now()) RETURNING id`,[person.id,email,await hashPassword(oldPassword)])).rows[0];
      await pool.query("INSERT INTO account_roles(account_id,role) VALUES ($1,'manager'),($1,'customer')",[account.id]);
      await signIn(page,5173,oldPassword);await expect(page.getByRole('button',{name:english?'My account':'Mi cuenta',exact:true})).toBeVisible();
      await signIn(management,5174,oldPassword);await expect(management.getByRole('heading',{name:english?'Account administration':'Administración de cuentas',exact:true})).toBeVisible();
      await recovery.goto('http://localhost:5174');await language(recovery);await recovery.getByRole('button',{name:english?'Forgot password':'Olvidé mi contraseña',exact:true}).click();
      await recovery.getByLabel(english?'Email':'Correo electrónico',{exact:true}).fill(email);await recovery.getByRole('button',{name:english?'Send recovery link':'Enviar enlace de recuperación',exact:true}).click();
      await expect(recovery.getByRole('status')).toContainText(english?'eligible account':'recuperar');
      const config=readIdentityConfig({NODE_ENV:'test',IDENTITY_ENABLED:'true',IDENTITY_MAIL_TRANSPORT:'mailpit',IDENTITY_OUTBOX_ACTIVE_KEY_ID:'integration',IDENTITY_OUTBOX_KEYS:process.env.FOUNDATION_TEST_OUTBOX_KEYS,
        IDENTITY_THROTTLE_KEY:process.env.FOUNDATION_TEST_THROTTLE_KEY,SMTP_HOST:'127.0.0.1',SMTP_PORT:'11025',SMTP_FROM:'no-reply@conecta.example.test',IDENTITY_PUBLIC_ORIGIN:'http://localhost:5173',WEB_ORIGINS:'http://localhost:5173,http://localhost:5174'});
      if(!config.enabled)throw new Error('Local mail config required');const worker=createEmailOutboxWorker(pool,config);
      try{expect((await worker.runBatch()).sent).toBe(1);}finally{worker.close();}
      const inbox=await(await fetch('http://127.0.0.1:18025/api/v1/messages')).json();const message=inbox.messages.find((m:{To:{Address:string}[]})=>m.To.some(r=>r.Address===email));expect(message).toBeTruthy();
      const captured=await(await fetch(`http://127.0.0.1:18025/api/v1/message/${message.ID}`)).json();expect(captured.Subject).toBe('Conecta Infusion: '+(english?'Reset your password':'Restablece tu contraseña'));
      const link=captured.Text.match(/http:\/\/[^\s]+/)[0];const token=new URLSearchParams(new URL(link).hash.slice(1)).get('token')!;
      await recovery.goto(link);await language(recovery);await expect(recovery).toHaveURL('http://localhost:5173/auth/action');
      expect((await pool.query('SELECT count(*)::int n FROM identity_sessions WHERE account_id=$1 AND revoked_at IS NULL',[account.id])).rows[0].n).toBe(2);
      expect(await recovery.evaluate(()=>[...Object.values(localStorage),...Object.values(sessionStorage)].join(' '))).not.toContain(token);
      await recovery.getByLabel(english?'New password':'Nueva contraseña',{exact:true}).fill(newPassword);await recovery.getByLabel(english?'Confirm password':'Confirmar contraseña',{exact:true}).fill(newPassword);
      await recovery.getByRole('button',{name:english?'Reset password':'Restablecer contraseña',exact:true}).click();await expect(recovery.getByRole('status')).toContainText(english?'Sign in again':'Inicia sesión');
      expect((await recoveryContext.cookies()).some(c=>c.name==='conecta_session')).toBe(false);
      expect((await pool.query('SELECT count(*)::int n FROM identity_sessions WHERE account_id=$1 AND revoked_at IS NULL',[account.id])).rows[0].n).toBe(0);
      for(const p of [page,management]){
        expect((await p.request.get(new URL('/api/v1/auth/session',p.url()).href)).status()).toBe(401);
        await p.bringToFront();await p.reload();await expect(p.getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true})).toBeVisible();
      }
      await expect(management.getByRole('heading',{name:english?'Account administration':'Administración de cuentas',exact:true})).toHaveCount(0);
      await signIn(page,5173,oldPassword);await expect(page.getByRole('alert')).toContainText(english?'try again':'intenta de nuevo');
      await page.keyboard.press('Escape');await signIn(page,5173,newPassword);await expect(page.getByRole('button',{name:english?'My account':'Mi cuenta',exact:true})).toBeVisible();
      await recovery.goto(link);await recovery.getByLabel(english?'New password':'Nueva contraseña',{exact:true}).fill(newPassword);await recovery.getByLabel(english?'Confirm password':'Confirmar contraseña',{exact:true}).fill(newPassword);await recovery.getByRole('button',{name:english?'Reset password':'Restablecer contraseña',exact:true}).click();
      await expect(recovery.getByRole('alert')).toContainText(english?'expired':'venció');expect(errors).toEqual([]);
    } finally {
      await managementContext.close();await recoveryContext.close();await pool.end();
      if(started){docker([...compose,'stop','mailpit']);docker([...compose,'rm','-f','mailpit']);docker(['network','rm','conecta-foundation-tests_mailpit_local']);}
    }
  });
}
