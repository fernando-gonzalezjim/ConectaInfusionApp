import {test,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {hashPassword} from '../../apps/api/src/modules/identity/passwords.js';
import {readIdentityConfig} from '../../apps/api/src/modules/identity/config.js';
import {createEmailOutboxWorker} from '../../apps/api/src/modules/identity/email-outbox.js';

for(const locale of ['es-MX','en'] as const)test(`real ${locale} own profile and confirmed email change with prior-address notification`,async({page,browser})=>{
  test.setTimeout(60000);
  const connectionString=process.env.FOUNDATION_TEST_DATABASE_URL;
  if(connectionString!=='postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser')throw new Error('Disposable database required');
  const pool=new pg.Pool({connectionString}),email=`profile-${randomUUID()}@example.test`,nextEmail=`changed-${randomUUID()}@example.test`;
  const password='Browser profile test password',english=locale==='en';
  const otherContext=await browser.newContext(),actionContext=await browser.newContext(),other=await otherContext.newPage(),action=await actionContext.newPage();
  const compose=['compose','-f','compose.test.yaml','-p','conecta-foundation-tests'],docker=(args:string[])=>execFileSync('docker',args,{stdio:'inherit'});let started=false;
  const errors:string[]=[];for(const p of [page,other,action])p.on('pageerror',error=>errors.push(error.message));
  async function language(p:Page){await p.locator('header').getByRole('combobox').selectOption(locale);}
  async function login(p:Page,port:number,address:string){
    await p.goto(`http://localhost:${port}`);await language(p);await p.getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true}).click();
    await p.getByLabel(english?'Email':'Correo electrónico',{exact:true}).fill(address);await p.getByLabel(english?'Password':'Contraseña',{exact:true}).fill(password);
    await p.getByRole('dialog').getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true}).click();
  }
  try{
    // This suite shares a peer IP across unrelated fictional accounts. Isolate fixture budgets;
    // production limits and their persistence/concurrency coverage remain unchanged in backend tests.
    await pool.query("DELETE FROM identity_throttles WHERE scope IN ('login_ip','action_ip')");
    started=true;docker([...compose,'--profile','identity','up','-d','--no-deps','--wait','mailpit']);
    const person=(await pool.query('INSERT INTO people(full_name,preferred_locale) VALUES ($1,$2) RETURNING id',['Profile browser customer',locale])).rows[0];
    const account=(await pool.query(`INSERT INTO accounts(person_id,email,password_hash,status,confirmation_status,email_verified_at)
      VALUES ($1,$2,$3,'active','verified',now()) RETURNING id`,[person.id,email,await hashPassword(password)])).rows[0];
    await pool.query("INSERT INTO account_roles(account_id,role) VALUES ($1,'customer')",[account.id]);
    await login(page,5173,email);await expect(page.getByRole('dialog')).toHaveCount(0);
    await login(other,5174,email);await expect(other.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button',{name:english?'My account':'Mi cuenta',exact:true}).click();
    await page.getByRole('button',{name:english?'Edit my profile':'Editar mi perfil',exact:true}).click();
    await page.getByLabel(english?'Name':'Nombre',{exact:true}).fill('Profile updated');
    await page.getByLabel(english?'Phone (optional)':'Teléfono (opcional)').fill('5550103030');
    await page.getByRole('button',{name:english?'Save profile':'Guardar datos',exact:true}).click();
    await expect(page.getByRole('status')).toHaveText(english?'Profile saved.':'Datos guardados.');
    expect((await pool.query('SELECT full_name,phone FROM people WHERE id=$1',[person.id])).rows[0]).toEqual({full_name:'Profile updated',phone:'5550103030'});
    await page.getByLabel(english?'New email':'Nuevo correo',{exact:true}).fill(nextEmail);
    await page.getByRole('button',{name:english?'Send confirmation':'Enviar confirmación',exact:true}).click();
    await expect(page.getByRole('status')).toContainText(english?'Your current email stays active':'Tu correo actual sigue activo');
    expect((await pool.query('SELECT email FROM accounts WHERE id=$1',[account.id])).rows[0].email).toBe(email);
    const config=readIdentityConfig({NODE_ENV:'test',IDENTITY_ENABLED:'true',IDENTITY_MAIL_TRANSPORT:'mailpit',IDENTITY_OUTBOX_ACTIVE_KEY_ID:'integration',IDENTITY_OUTBOX_KEYS:process.env.FOUNDATION_TEST_OUTBOX_KEYS,
      IDENTITY_THROTTLE_KEY:process.env.FOUNDATION_TEST_THROTTLE_KEY,SMTP_HOST:'127.0.0.1',SMTP_PORT:'11025',SMTP_FROM:'no-reply@conecta.example.test',IDENTITY_PUBLIC_ORIGIN:'http://localhost:5173',WEB_ORIGINS:'http://localhost:5173,http://localhost:5174'});
    if(!config.enabled)throw new Error('Local mail config required');const worker=createEmailOutboxWorker(pool,config);
    try{
      expect((await worker.runBatch()).sent).toBe(1);
      const inbox=await(await fetch('http://127.0.0.1:18025/api/v1/messages')).json();
      const message=inbox.messages.find((item:{To:{Address:string}[]})=>item.To.some(to=>to.Address===nextEmail));expect(message).toBeTruthy();
      const captured=await(await fetch(`http://127.0.0.1:18025/api/v1/message/${message.ID}`)).json();
      const link=captured.Text.match(/http:\/\/[^\s]+/)[0];
      await action.goto(link);await language(action);expect(new URL(action.url()).hash).toBe('');
      expect((await pool.query('SELECT count(*)::int n FROM identity_sessions WHERE account_id=$1 AND revoked_at IS NULL',[account.id])).rows[0].n).toBe(2);
      await action.getByRole('button',{name:english?'Confirm your new email':'Confirma tu nuevo correo',exact:true}).click();
      await expect(action.getByRole('status')).toContainText(english?'all sessions':'todas las sesiones');
      expect((await pool.query('SELECT email,person_id FROM accounts WHERE id=$1',[account.id])).rows[0]).toEqual({email:nextEmail,person_id:person.id});
      expect((await pool.query('SELECT count(*)::int n FROM identity_sessions WHERE account_id=$1 AND revoked_at IS NULL',[account.id])).rows[0].n).toBe(0);
      expect((await worker.runBatch()).sent).toBe(1);
      const notifications=await(await fetch('http://127.0.0.1:18025/api/v1/messages')).json();
      expect(notifications.messages.some((item:{To:{Address:string}[]})=>item.To.some(to=>to.Address===email))).toBe(true);
      for(const p of [page,other]){await p.reload();await expect(p.getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true})).toBeVisible();}
      await login(page,5173,email);await expect(page.getByRole('alert')).toContainText(english?'try again':'intenta de nuevo');
      await page.keyboard.press('Escape');await login(page,5173,nextEmail);await expect(page.getByRole('dialog')).toHaveCount(0);
      await action.goto(link);await action.getByRole('button',{name:english?'Confirm your new email':'Confirma tu nuevo correo',exact:true}).click();
      await expect(action.getByRole('alert')).toContainText(english?'expired':'venció');expect(errors).toEqual([]);
    }finally{worker.close();}
  }finally{
    await otherContext.close();await actionContext.close();
    await pool.query("DELETE FROM identity_throttles WHERE scope IN ('login_ip','action_ip')");
    await pool.end();
    if(started){docker([...compose,'stop','mailpit']);docker([...compose,'rm','-f','mailpit']);docker(['network','rm','conecta-foundation-tests_mailpit_local']);}
  }
});
