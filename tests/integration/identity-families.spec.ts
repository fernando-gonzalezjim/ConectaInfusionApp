import {test,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {hashPassword} from '../../apps/api/src/modules/identity/passwords.js';
import {readIdentityConfig} from '../../apps/api/src/modules/identity/config.js';
import {createEmailOutboxWorker} from '../../apps/api/src/modules/identity/email-outbox.js';

for(const locale of ['es-MX','en'] as const)test(`real ${locale} family creation, management assistance and successor inbox consent`,async({page,browser})=>{
  test.setTimeout(60000);const connectionString=process.env.FOUNDATION_TEST_DATABASE_URL;
  if(connectionString!=='postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser')throw new Error('Disposable database required');
  const pool=new pg.Pool({connectionString}),english=locale==='en',password='A real family browser password';
  const compose=['compose','-f','compose.test.yaml','-p','conecta-foundation-tests'],docker=(args:string[])=>execFileSync('docker',args,{stdio:'inherit'});
  const managerContext=await browser.newContext(),recipientContext=await browser.newContext(),managerPage=await managerContext.newPage(),recipient=await recipientContext.newPage();
  const errors:string[]=[];for(const target of [page,managerPage,recipient])target.on('pageerror',error=>errors.push(error.message));let started=false;
  async function fixture(name:string,roles:string[]){const email=`family-${randomUUID()}@example.test`;
    const person=(await pool.query('INSERT INTO people(full_name,preferred_locale) VALUES ($1,$2) RETURNING id',[name,locale])).rows[0];
    const account=(await pool.query("INSERT INTO accounts(person_id,email,password_hash,status,confirmation_status,email_verified_at) VALUES ($1,$2,$3,'active','verified',now()) RETURNING id",[person.id,email,await hashPassword(password)])).rows[0];
    await pool.query('INSERT INTO account_roles(account_id,role) SELECT $1,unnest($2::text[])',[account.id,roles]);return {accountId:account.id,personId:person.id,email,name};}
  async function signIn(target:Page,email:string){await target.getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true}).click();
    await target.getByLabel(english?'Email':'Correo electrónico',{exact:true}).fill(email);await target.getByLabel(english?'Password':'Contraseña',{exact:true}).fill(password);
    await target.getByRole('dialog').getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true}).click();await expect(target.getByRole('button',{name:english?'My account':'Mi cuenta',exact:true})).toBeVisible();}
  try{
    started=true;docker([...compose,'--profile','identity','up','-d','--no-deps','--wait','mailpit']);
    const owner=await fixture(`Family owner ${locale} ${randomUUID()}`,['customer']),invited=await fixture('Family invited customer',['customer']);
    const assisted=await fixture('Family assisted customer',['customer']),manager=await fixture('Family manager',['manager']);
    const familyName=`Family ${locale} ${randomUUID()}`;
    await page.goto('http://localhost:5173');await page.getByLabel('Idioma',{exact:true}).selectOption(locale);await signIn(page,owner.email);
    await page.getByRole('button',{name:english?'My family':'Mi familia',exact:true}).click();
    await page.getByLabel(english?'Family name':'Nombre de la familia',{exact:true}).fill(familyName);await page.getByRole('button',{name:english?'Create family':'Crear familia',exact:true}).click();
    await expect(page.getByText(familyName,{exact:true})).toBeVisible();const family=(await pool.query('SELECT id FROM families WHERE created_by_person_id=$1',[owner.personId])).rows[0];
    await page.getByLabel(english?'Member email':'Correo del integrante',{exact:true}).fill(invited.email);await page.getByRole('button',{name:english?'Send family invitation':'Enviar invitación familiar',exact:true}).click();
    await expect(page.getByRole('dialog').getByRole('status')).toContainText(english?'accept before joining':'aceptarla antes de unirse');
    await managerPage.goto('http://localhost:5174');await managerPage.getByLabel('Idioma',{exact:true}).selectOption(locale);await signIn(managerPage,manager.email);
    await managerPage.getByLabel(english?'Filter by role':'Filtrar por rol',{exact:true}).selectOption('customer');
    const firstPage=managerPage.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/v1/accounts'&&url.searchParams.get('role')==='customer'&&url.searchParams.get('status')==='active';});
    await managerPage.getByLabel(english?'Filter by status':'Filtrar por estado',{exact:true}).selectOption('active');
    let accountsPage=await(await firstPage).json();
    while(!accountsPage.accounts.some((record:{id:string})=>record.id===owner.accountId)){
      expect(accountsPage.nextCursor).toBeTruthy();const cursor=accountsPage.nextCursor;
      const nextPage=managerPage.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/v1/accounts'&&url.searchParams.get('role')==='customer'&&url.searchParams.get('status')==='active'&&url.searchParams.get('cursor')===cursor;});
      await managerPage.getByRole('button',{name:english?'Next':'Siguiente',exact:true}).click();accountsPage=await(await nextPage).json();
    }
    const row=managerPage.getByRole('listitem').filter({has:managerPage.getByRole('heading',{name:owner.name,exact:true})});
    await row.getByRole('button',{name:`${english?'Assist family':'Ayudar con familia'}: ${owner.name}`,exact:true}).click();await expect(managerPage.getByText(familyName,{exact:true})).toBeVisible();
    await expect(managerPage.getByRole('button',{name:english?'Create family':'Crear familia',exact:true})).toHaveCount(0);
    await managerPage.getByLabel(english?'Member email':'Correo del integrante',{exact:true}).fill(assisted.email);await managerPage.getByRole('button',{name:english?'Send family invitation':'Enviar invitación familiar',exact:true}).click();
    await expect(managerPage.getByRole('dialog').getByRole('status')).toContainText(english?'accept before joining':'aceptarla antes de unirse');
    expect((await pool.query('SELECT 1 FROM family_memberships WHERE person_id=ANY($1::uuid[])',[ [invited.personId,assisted.personId] ])).rowCount).toBe(0);
    const config=readIdentityConfig({NODE_ENV:'test',IDENTITY_ENABLED:'true',IDENTITY_MAIL_TRANSPORT:'mailpit',IDENTITY_OUTBOX_ACTIVE_KEY_ID:'integration',IDENTITY_OUTBOX_KEYS:process.env.FOUNDATION_TEST_OUTBOX_KEYS,
      IDENTITY_THROTTLE_KEY:process.env.FOUNDATION_TEST_THROTTLE_KEY,SMTP_HOST:'127.0.0.1',SMTP_PORT:'11025',SMTP_FROM:'no-reply@conecta.example.test',IDENTITY_PUBLIC_ORIGIN:'http://localhost:5173',WEB_ORIGINS:'http://localhost:5173,http://localhost:5174'});
    if(!config.enabled)throw new Error('Test email configuration required');const worker=createEmailOutboxWorker(pool,config);
    try{expect((await worker.runBatch()).sent).toBe(2);}finally{worker.close();}
    const inbox=await(await fetch('http://127.0.0.1:18025/api/v1/messages')).json();const message=inbox.messages.find((m:{To:{Address:string}[]})=>m.To.some(r=>r.Address===invited.email));expect(message).toBeTruthy();
    const captured=await(await fetch(`http://127.0.0.1:18025/api/v1/message/${message.ID}`)).json();expect(captured.Subject).toBe('Conecta Infusion: '+(english?'Family group invitation':'Invitación a un grupo familiar'));
    const link=captured.Text.match(/http:\/\/[^\s]+/)[0];expect(new URL(link).origin).toBe('http://localhost:5173');
    await recipient.goto(link);await recipient.getByLabel('Idioma',{exact:true}).selectOption(locale);await expect(recipient).toHaveURL('http://localhost:5173/auth/action');
    await expect(recipient.getByRole('button',{name:english?'Review invitation':'Revisar invitación',exact:true})).toHaveCount(0);await signIn(recipient,invited.email);
    expect((await recipient.request.get(`http://localhost:5173/api/v1/families/${family.id}`)).status()).toBe(403);
    expect((await recipient.request.get(`http://localhost:5173/api/v1/families/for-account/${owner.accountId}`)).status()).toBe(403);
    await recipient.getByRole('button',{name:english?'Review invitation':'Revisar invitación',exact:true}).click();await expect(recipient.getByText(familyName,{exact:true})).toBeVisible();
    expect((await pool.query('SELECT 1 FROM family_memberships WHERE person_id=$1',[invited.personId])).rowCount).toBe(0);
    await recipient.getByRole('button',{name:english?'Accept and join':'Aceptar y unirme',exact:true}).click();await expect(recipient.getByRole('status')).toContainText(english?'You joined':'Te uniste');
    const membership=(await pool.query('SELECT * FROM family_memberships WHERE person_id=$1',[invited.personId])).rows[0];expect(membership.accepted_by_person_id).toBe(invited.personId);expect(membership.family_id).toBe(family.id);
    expect((await pool.query('SELECT 1 FROM family_memberships WHERE person_id=$1',[assisted.personId])).rowCount).toBe(0);
    expect((await pool.query('SELECT role FROM account_roles WHERE account_id=$1',[invited.accountId])).rows.map(r=>r.role)).toEqual(['customer']);
    await recipient.getByRole('link',{name:english?'Back to home':'Volver al inicio',exact:true}).click();await recipient.getByRole('button',{name:english?'My family':'Mi familia',exact:true}).click();await expect(recipient.getByText(familyName,{exact:true})).toBeVisible();
    await recipient.goto(link);await recipient.getByRole('button',{name:english?'Review invitation':'Revisar invitación',exact:true}).click();await expect(recipient.getByRole('alert')).toContainText(english?'already used':'ya fue utilizada');
    expect((await pool.query('SELECT count(*)::int n FROM family_memberships WHERE person_id=$1',[invited.personId])).rows[0].n).toBe(1);
    async function deliverOffer(email:string){
      const sender=createEmailOutboxWorker(pool,config);try{expect((await sender.runBatch()).sent).toBe(1);}finally{sender.close();}
      const messages=await(await fetch('http://127.0.0.1:18025/api/v1/messages')).json();
      const subject='Conecta Infusion: '+(english?'Group responsibility':'Responsabilidad del grupo');
      const offer=messages.messages.find((m:{Subject:string;To:{Address:string}[]})=>m.Subject===subject&&m.To.some(r=>r.Address===email));expect(offer).toBeTruthy();
      const capturedOffer=await(await fetch(`http://127.0.0.1:18025/api/v1/message/${offer.ID}`)).json();return capturedOffer.Text.match(/http:\/\/[^\s]+/)[0];
    }
    // Existing independent members provide successor consent; pending offers never
    // grant responsibility and an accepted offer never changes creator identity.
    await page.getByLabel(english?'Successor member email':'Correo del integrante sucesor',{exact:true}).fill(invited.email);
    await page.getByRole('button',{name:english?'Offer responsibility':'Ofrecer responsabilidad',exact:true}).click();
    await expect(page.getByRole('dialog').getByRole('status').filter({hasText:english?'Responsibility has not changed':'responsabilidad todavía no cambia'})).toBeVisible();
    const before=(await pool.query('SELECT * FROM families WHERE id=$1',[family.id])).rows[0];const successorLink=await deliverOffer(invited.email);
    await recipient.goto(successorLink);await recipient.getByRole('button',{name:english?'Review invitation':'Revisar invitación',exact:true}).click();
    expect((await pool.query('SELECT responsible_membership_id FROM families WHERE id=$1',[family.id])).rows[0].responsible_membership_id).toBe(before.responsible_membership_id);
    await recipient.getByRole('button',{name:english?'Accept responsibility':'Aceptar responsabilidad',exact:true}).click();
    await expect(recipient.getByRole('status')).toContainText(english?'You accepted group responsibility':'Aceptaste la responsabilidad');
    const transferred=(await pool.query('SELECT * FROM families WHERE id=$1',[family.id])).rows[0];expect(transferred.responsible_membership_id).toBe(membership.id);expect(transferred.created_by_person_id).toBe(owner.personId);
    await page.getByRole('button',{name:english?'Refresh family':'Actualizar familia',exact:true}).click();
    await expect(page.getByLabel(english?'Successor member email':'Correo del integrante sucesor',{exact:true})).toHaveCount(0);
    // Management may assist another offer; the intended remaining member can decline.
    await managerPage.getByLabel(english?'Successor member email':'Correo del integrante sucesor',{exact:true}).fill(owner.email);
    await managerPage.getByRole('button',{name:english?'Offer responsibility':'Ofrecer responsabilidad',exact:true}).click();
    await expect(managerPage.getByRole('dialog').getByRole('status').filter({hasText:english?'Responsibility has not changed':'responsabilidad todavía no cambia'})).toBeVisible();
    const declinedLink=await deliverOffer(owner.email);await page.goto(declinedLink);await page.getByRole('button',{name:english?'Review invitation':'Revisar invitación',exact:true}).click();
    await page.getByRole('button',{name:english?'Decline offer':'Rechazar oferta',exact:true}).click();await expect(page.getByRole('status')).toContainText(english?'You declined the offer':'Rechazaste la oferta');
    expect((await pool.query('SELECT responsible_membership_id FROM families WHERE id=$1',[family.id])).rows[0].responsible_membership_id).toBe(membership.id);
    await page.goto(declinedLink);await page.getByRole('button',{name:english?'Review invitation':'Revisar invitación',exact:true}).click();await expect(page.getByRole('alert')).toContainText(english?'already used':'ya fue utilizada');
    expect((await pool.query('SELECT count(*)::int n FROM family_memberships WHERE family_id=$1 AND ended_at IS NULL',[family.id])).rows[0].n).toBe(2);
    expect((await pool.query("SELECT count(*)::int n FROM audit_events WHERE target_id=$1 AND action LIKE 'family.responsibility_%'",[family.id])).rows[0].n).toBe(4);
    expect(errors).toEqual([]);
  }finally{await managerContext.close();await recipientContext.close();await pool.end();if(started){docker([...compose,'stop','mailpit']);docker([...compose,'rm','-f','mailpit']);docker(['network','rm','conecta-foundation-tests_mailpit_local']);}}
});
