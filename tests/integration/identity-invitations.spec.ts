import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {hashPassword} from '../../apps/api/src/modules/identity/passwords.js';
import {readIdentityConfig} from '../../apps/api/src/modules/identity/config.js';
import {createEmailOutboxWorker} from '../../apps/api/src/modules/identity/email-outbox.js';

for(const locale of ['es-MX','en'] as const)for(const role of ['instructor','manager'])test(`real ${locale} ${role} invitation activates through inbox without auto-login`,async({page,browser})=>{
  test.setTimeout(60000);
  const connectionString=process.env.FOUNDATION_TEST_DATABASE_URL;
  if(connectionString!=='postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser')throw new Error('Disposable database required');
  const pool=new pg.Pool({connectionString});const english=locale==='en';const exempt=role==='manager';
  const actorEmail=`actor-${randomUUID()}@example.test`;const email=`invited-${randomUUID()}@example.test`;const password='A real invitation browser password';
  const recipientContext=await browser.newContext();const recipient=await recipientContext.newPage();const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));recipient.on('pageerror',e=>errors.push(e.message));
  const compose=['compose','-f','compose.test.yaml','-p','conecta-foundation-tests'];const docker=(args:string[])=>execFileSync('docker',args,{stdio:'inherit'});let started=false;
  try {
    started=true;docker([...compose,'--profile','identity','up','-d','--no-deps','--wait','mailpit']);
    const person=(await pool.query('INSERT INTO people(full_name) VALUES ($1) RETURNING id',['Invitation actor'])).rows[0];
    const actor=(await pool.query("INSERT INTO accounts(person_id,email,password_hash,status,confirmation_status,email_verified_at) VALUES ($1,$2,$3,'active','verified',now()) RETURNING id",[person.id,actorEmail,await hashPassword(password)])).rows[0];
    await pool.query('INSERT INTO account_roles(account_id,role) VALUES ($1,$2)',[actor.id,role]);
    await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption(locale);
    await page.getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true}).click();
    await page.getByLabel(english?'Email':'Correo electrónico',{exact:true}).fill(actorEmail);await page.getByLabel(english?'Password':'Contraseña',{exact:true}).fill(password);
    await page.getByRole('dialog').getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true}).click();
    await page.getByRole('button',{name:english?'Invite customer':'Invitar cliente',exact:true}).click();
    await page.getByLabel(english?'Email':'Correo electrónico',{exact:true}).fill(email);await page.getByLabel(english?'Name':'Nombre',{exact:true}).fill('Invitation customer');
    await page.getByLabel(english?'Account language':'Idioma de tu cuenta',{exact:true}).selectOption(locale);
    if(exempt){await page.getByLabel(english?'Waive email confirmation':'Eximir la confirmación del correo',{exact:true}).check();await page.getByLabel(english?'Exemption reason':'Motivo de la exención',{exact:true}).fill('Approved browser exception');}
    else await expect(page.getByLabel(english?'Waive email confirmation':'Eximir la confirmación del correo',{exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:english?'Send invitation':'Enviar invitación',exact:true}).click();await expect(page.getByRole('status')).toContainText(english?'Request received':'Solicitud recibida');
    const pending=(await pool.query('SELECT * FROM accounts WHERE email=$1',[email])).rows[0];expect(pending.status).toBe('pending');expect(pending.password_hash).toBeNull();
    const config=readIdentityConfig({NODE_ENV:'test',IDENTITY_ENABLED:'true',IDENTITY_MAIL_TRANSPORT:'mailpit',IDENTITY_OUTBOX_ACTIVE_KEY_ID:'integration',IDENTITY_OUTBOX_KEYS:process.env.FOUNDATION_TEST_OUTBOX_KEYS,
      IDENTITY_THROTTLE_KEY:process.env.FOUNDATION_TEST_THROTTLE_KEY,SMTP_HOST:'127.0.0.1',SMTP_PORT:'11025',SMTP_FROM:'no-reply@conecta.example.test',IDENTITY_PUBLIC_ORIGIN:'http://localhost:5173',WEB_ORIGINS:'http://localhost:5173,http://localhost:5174'});
    if(!config.enabled)throw new Error('Test email configuration required');const worker=createEmailOutboxWorker(pool,config);
    try{expect((await worker.runBatch()).sent).toBe(1);}finally{worker.close();}
    const inbox=await(await fetch('http://127.0.0.1:18025/api/v1/messages')).json();const message=inbox.messages.find((m:{To:{Address:string}[]})=>m.To.some(r=>r.Address===email));expect(message).toBeTruthy();
    const captured=await(await fetch(`http://127.0.0.1:18025/api/v1/message/${message.ID}`)).json();expect(captured.Subject).toBe('Conecta Infusion: '+(english?'Set up your account':'Configura tu cuenta'));
    const link=captured.Text.match(/http:\/\/[^\s]+/)[0];const token=new URLSearchParams(new URL(link).hash.slice(1)).get('token')!;
    await recipient.goto(link);await recipient.getByRole('combobox').selectOption(locale);await expect(recipient).toHaveURL('http://localhost:5173/auth/action');
    expect((await pool.query('SELECT consumed_at FROM identity_action_tokens WHERE account_id=$1',[pending.id])).rows[0].consumed_at).toBeNull();
    expect(await recipient.evaluate(()=>[...Object.values(localStorage),...Object.values(sessionStorage)].join(' '))).not.toContain(token);
    await recipient.getByLabel(english?'New password':'Nueva contraseña',{exact:true}).fill(password);await recipient.getByLabel(english?'Confirm password':'Confirmar contraseña',{exact:true}).fill(password);
    await recipient.getByRole('button',{name:english?'Set up password':'Configurar contraseña',exact:true}).click();await expect(recipient.getByRole('status')).toContainText(english?'Your account is ready':'Tu cuenta está lista');
    expect((await recipientContext.cookies()).some(c=>c.name==='conecta_session')).toBe(false);
    const saved=(await pool.query('SELECT * FROM accounts WHERE id=$1',[pending.id])).rows[0];expect(saved.status).toBe('active');expect(saved.confirmation_status).toBe(exempt?'exempt':'verified');expect(saved.email_verified_at===null).toBe(exempt);expect(saved.exemption_actor_id).toBe(exempt?actor.id:null);
    await recipient.getByRole('link',{name:english?'Sign in':'Iniciar sesión',exact:true}).click();await recipient.getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true}).click();
    await recipient.getByLabel(english?'Email':'Correo electrónico',{exact:true}).fill(email);await recipient.getByLabel(english?'Password':'Contraseña',{exact:true}).fill(password);await recipient.getByRole('dialog').getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true}).click();await expect(recipient.getByRole('button',{name:english?'My account':'Mi cuenta',exact:true})).toBeVisible();
    await recipient.goto(link);await recipient.getByLabel(english?'New password':'Nueva contraseña',{exact:true}).fill(password);await recipient.getByLabel(english?'Confirm password':'Confirmar contraseña',{exact:true}).fill(password);await recipient.getByRole('button',{name:english?'Set up password':'Configurar contraseña',exact:true}).click();await expect(recipient.getByRole('alert')).toContainText(english?'Ask the team':'Pide al equipo');
    expect(errors).toEqual([]);
  } finally {await recipientContext.close();await pool.end();if(started){docker([...compose,'stop','mailpit']);docker([...compose,'rm','-f','mailpit']);docker(['network','rm','conecta-foundation-tests_mailpit_local']);}}
});
