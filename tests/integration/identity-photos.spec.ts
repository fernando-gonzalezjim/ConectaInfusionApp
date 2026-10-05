import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import sharp from 'sharp';
import pg from 'pg';
import {hashPassword} from '../../apps/api/src/modules/identity/passwords.js';
const password='Real photo integration password';
async function account(pool:pg.Pool,role:string){
  const name=`Photo ${role} ${randomUUID().slice(0,8)}`,email=`photo-${randomUUID()}@example.test`;
  const person=(await pool.query('INSERT INTO people(full_name) VALUES ($1) RETURNING id',[name])).rows[0];
  const user=(await pool.query(`INSERT INTO accounts(person_id,email,password_hash,status,confirmation_status,email_verified_at)
    VALUES ($1,$2,$3,'active','verified',now()) RETURNING id`,[person.id,email,await hashPassword(password)])).rows[0];
  await pool.query('INSERT INTO account_roles(account_id,role) VALUES ($1,$2)',[user.id,role]);return {id:user.id,personId:person.id,name,email};
}
async function login(page:Page,port:number,email:string,english:boolean){
  await page.goto(`http://localhost:${port}`);await page.getByLabel('Idioma',{exact:true}).selectOption(english?'en':'es-MX');
  await page.getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true}).click();
  await page.getByLabel(english?'Email':'Correo electrónico',{exact:true}).fill(email);await page.getByLabel(english?'Password':'Contraseña',{exact:true}).fill(password);
  await page.getByRole('dialog').getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
}
for(const [port,english] of [[5173,false],[5174,true]] as const)test(`real photo upload, replacement and private preview on ${port}`,async({page})=>{
  test.setTimeout(60000);const connectionString=process.env.FOUNDATION_TEST_DATABASE_URL;
  if(connectionString!=='postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser')throw new Error('Disposable database required');
  const pool=new pg.Pool({connectionString}),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await pool.query("DELETE FROM identity_throttles WHERE scope IN ('login_ip','action_ip')");
    const user=await account(pool,'customer');await page.setViewportSize({width:360,height:900});await login(page,port,user.email,english);
    await page.getByRole('button',{name:english?'My account':'Mi cuenta',exact:true}).click();await page.getByRole('button',{name:english?'Edit my profile':'Editar mi perfil',exact:true}).click();
    const upload=page.getByLabel(english?'Profile photo':'Foto de perfil',{exact:true}),save=page.getByRole('button',{name:english?'Save photo':'Guardar foto',exact:true});
    await upload.setInputFiles({name:'fake.png',mimeType:'image/png',buffer:Buffer.from('fake')});await save.click();
    await expect(page.getByRole('alert')).toContainText(english?'allowed format':'formato permitido');
    const png=await sharp({create:{width:800,height:600,channels:3,background:'#D7AED1'}}).png().withMetadata().toBuffer();
    await upload.setInputFiles({name:'misleading.txt',mimeType:'text/plain',buffer:png});await save.click();
    await expect(page.getByText(english?'Photo saved.':'Foto guardada.',{exact:true})).toBeVisible();
    const image=page.getByRole('img',{name:english?'Account profile photo':'Foto de perfil de la cuenta'});await expect(image).toBeVisible();
    await expect.poll(()=>image.evaluate(element=>(element as HTMLImageElement).naturalWidth)).toBe(512);
    const first=(await pool.query('SELECT photo_id FROM people WHERE id=$1',[user.personId])).rows[0].photo_id;expect(first).toBeTruthy();
    await upload.setInputFiles({name:'second.png',mimeType:'image/png',buffer:png});await save.click();
    await expect.poll(async()=>(await pool.query('SELECT photo_id FROM people WHERE id=$1',[user.personId])).rows[0].photo_id).not.toBe(first);
    await expect(image).toBeVisible();expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/profile-photo-${port}.png`});
    await page.reload();await page.getByRole('button',{name:english?'My account':'Mi cuenta',exact:true}).click();await page.getByRole('button',{name:english?'Edit my profile':'Editar mi perfil',exact:true}).click();await expect(image).toBeVisible();
    const privatePath=resolve('.local/demo-profile.png').replaceAll('\\','/');
    const denied=await page.request.get(`http://localhost:${port}/@fs/${privatePath}`);expect(denied.status()).toBe(403);
    const caseAlias=await page.request.get(`http://localhost:${port}/@fs/${privatePath.replace('/.local/','/.LOCAL/')}`);expect(caseAlias.status()).toBe(403);
    expect(errors).toEqual([]);
  }finally{await pool.query("DELETE FROM identity_throttles WHERE scope IN ('login_ip','action_ip')");await pool.end();}
});

test('real management photo editing uses account permissions',async({page})=>{
  test.setTimeout(60000);const connectionString=process.env.FOUNDATION_TEST_DATABASE_URL;
  if(connectionString!=='postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser')throw new Error('Disposable database required');
  const pool=new pg.Pool({connectionString});try{
    const actor=await account(pool,'manager'),target=await account(pool,'customer');await login(page,5174,actor.email,true);
    const filtered=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname.endsWith('/accounts')&&url.searchParams.get('role')==='customer'&&response.request().method()==='GET';});
    await page.getByLabel('Filter by role').selectOption('customer');let accountPage=await (await filtered).json();
    const trigger=page.getByRole('button',{name:`View account: ${target.name}`});
    for(let index=0;index<10;index++){
      if(accountPage.accounts.some((entry:{id:string})=>entry.id===target.id)){await expect(trigger).toBeVisible();break;}
      expect(accountPage.nextCursor,'The created customer must be present in a bounded account page').not.toBeNull();
      const next=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname.endsWith('/accounts')&&url.searchParams.get('cursor')===accountPage.nextCursor&&response.request().method()==='GET';});
      await page.getByRole('button',{name:'Next',exact:true}).click();accountPage=await (await next).json();
    }
    await trigger.click();const png=await sharp({create:{width:60,height:60,channels:3,background:'#FFB8A6'}}).png().toBuffer();
    await page.getByLabel('Profile photo',{exact:true}).setInputFiles({name:'management.png',mimeType:'image/png',buffer:png});await page.getByRole('button',{name:'Save photo',exact:true}).click();
    await expect(page.getByText('Photo saved.',{exact:true})).toBeVisible();await expect(page.getByRole('img',{name:'Account profile photo'})).toBeVisible();
    const audit=(await pool.query("SELECT actor_id FROM audit_events WHERE target_id=$1 AND action='account.profile_updated' ORDER BY occurred_at DESC LIMIT 1",[target.id])).rows[0];expect(audit.actor_id).toBe(actor.id);
  }finally{await pool.end();}
});
