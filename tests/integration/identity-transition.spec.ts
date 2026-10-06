import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {hashPassword} from '../../apps/api/src/modules/identity/passwords.js';
import {readIdentityConfig} from '../../apps/api/src/modules/identity/config.js';
import {createEmailOutboxWorker} from '../../apps/api/src/modules/identity/email-outbox.js';

test('real inbox transition preserves the person and ends guardian access',async({page,browser})=>{
  test.setTimeout(60000);const connectionString=process.env.FOUNDATION_TEST_DATABASE_URL;
  if(connectionString!=='postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser')throw new Error('Disposable database required');
  const pool=new pg.Pool({connectionString}),password='Real independent account password',email=`parent-${randomUUID()}@example.test`,recipientEmail=`independent-${randomUUID()}@example.test`,childName=`Independent child ${randomUUID()}`;
  const recipientContext=await browser.newContext(),recipient=await recipientContext.newPage();let started=false;
  for(const target of [page,recipient])target.on('pageerror',error=>{throw error;});
  try{
    await pool.query("DELETE FROM identity_throttles WHERE scope IN ('login_ip','action_ip')");
    execFileSync('docker',['compose','-f','compose.test.yaml','-p','conecta-foundation-tests','--profile','identity','up','-d','--no-deps','--wait','mailpit'],{stdio:'inherit'});started=true;
    const person=(await pool.query("INSERT INTO people(full_name,preferred_locale) VALUES ('Transition parent','en') RETURNING id")).rows[0];
    const account=(await pool.query("INSERT INTO accounts(person_id,email,password_hash,status,confirmation_status,email_verified_at) VALUES ($1,$2,$3,'active','verified',now()) RETURNING id",[person.id,email,await hashPassword(password)])).rows[0];await pool.query("INSERT INTO account_roles(account_id,role) VALUES ($1,'customer')",[account.id]);
    await page.goto('http://localhost:5173');await page.getByLabel('Idioma',{exact:true}).selectOption('en');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('dialog').getByRole('button',{name:'Sign in',exact:true}).click();
    await page.getByRole('button',{name:'Children and dependents',exact:true}).click();await page.getByRole('button',{name:'Dependent profiles',exact:true}).click();await page.getByRole('button',{name:'Create dependent profile',exact:true}).click();await page.getByLabel("Child's name",{exact:true}).fill(childName);await page.getByLabel('Age (text)',{exact:true}).fill('7');await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.getByRole('heading',{name:childName,exact:true})).toBeVisible();
    const child=(await pool.query('SELECT person_id FROM dependent_profiles WHERE created_by_account_id=$1',[account.id])).rows[0].person_id;
    await page.getByRole('button',{name:'Independent account',exact:true}).click();const dialog=page.getByRole('dialog').last();await dialog.getByLabel('Email',{exact:true}).fill(recipientEmail);await dialog.getByRole('button',{name:'Send request',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('Request received');
    const config=readIdentityConfig({NODE_ENV:'test',IDENTITY_ENABLED:'true',IDENTITY_MAIL_TRANSPORT:'mailpit',IDENTITY_OUTBOX_ACTIVE_KEY_ID:'integration',IDENTITY_OUTBOX_KEYS:process.env.FOUNDATION_TEST_OUTBOX_KEYS,IDENTITY_THROTTLE_KEY:process.env.FOUNDATION_TEST_THROTTLE_KEY,SMTP_HOST:'127.0.0.1',SMTP_PORT:'11025',SMTP_FROM:'no-reply@conecta.example.test',IDENTITY_PUBLIC_ORIGIN:'http://localhost:5173',WEB_ORIGINS:'http://localhost:5173,http://localhost:5174'});
    if(!config.enabled)throw new Error('Test inbox required');const worker=createEmailOutboxWorker(pool,config);try{expect((await worker.runBatch()).sent).toBe(1);}finally{worker.close();}
    const inbox=await(await fetch('http://127.0.0.1:18025/api/v1/messages')).json(),message=inbox.messages.find((m:{To:{Address:string}[]})=>m.To.some(r=>r.Address===recipientEmail));expect(message).toBeTruthy();
    const mail=await(await fetch(`http://127.0.0.1:18025/api/v1/message/${message.ID}`)).json();expect(mail.Text).not.toContain(childName);const link=mail.Text.match(/http:\/\/[^\s]+/)[0];
    await recipient.goto(link);await recipient.getByLabel('Idioma',{exact:true}).selectOption('en');expect(recipient.url()).not.toContain('#');expect((await pool.query('SELECT 1 FROM accounts WHERE person_id=$1',[child])).rowCount).toBe(0);
    await recipient.getByLabel('Email',{exact:true}).fill(recipientEmail);await recipient.getByLabel('New password',{exact:true}).fill(password);await recipient.getByLabel('Confirm password',{exact:true}).fill(password);await recipient.getByRole('button',{name:'Confirm email and create independent account',exact:true}).click();await expect(recipient.getByRole('status')).toContainText('Independent account created');
    expect((await page.request.get(`http://localhost:5173/api/v1/dependents/${child}`)).status()).toBe(404);expect((await pool.query('SELECT person_id,confirmation_status FROM accounts WHERE email=$1',[recipientEmail])).rows).toEqual([{person_id:child,confirmation_status:'verified'}]);
    expect((await pool.query('SELECT end_reason FROM dependent_guardians WHERE dependent_person_id=$1',[child])).rows).toEqual([{end_reason:'transitioned'}]);
  }finally{
    await recipientContext.close();await pool.query("DELETE FROM identity_throttles WHERE scope IN ('login_ip','action_ip')");await pool.end();if(started)execFileSync('docker',['compose','-f','compose.test.yaml','-p','conecta-foundation-tests','stop','mailpit'],{stdio:'inherit'});
  }
});
