import {test,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';
import {hashPassword} from '../../apps/api/src/modules/identity/passwords.js';

const password='Real administration test password';
async function createAccount(pool:pg.Pool,name:string,roles:string[]){
  const email=`administration-${randomUUID()}@example.test`;
  const person=(await pool.query('INSERT INTO people(full_name) VALUES ($1) RETURNING id',[name])).rows[0];
  const account=(await pool.query(`INSERT INTO accounts(person_id,email,password_hash,status,confirmation_status,email_verified_at)
    VALUES ($1,$2,$3,'active','verified',now()) RETURNING id`,[person.id,email,await hashPassword(password)])).rows[0];
  await pool.query('INSERT INTO account_roles(account_id,role) SELECT $1,unnest($2::text[])',[account.id,roles]);
  return {id:account.id,personId:person.id,email};
}
async function signIn(page:Page,port:number,email:string,english:boolean){
  await page.goto(`http://localhost:${port}`);await page.getByLabel('Idioma',{exact:true}).selectOption(english?'en':'es-MX');
  await page.getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true}).click();
  await page.getByLabel(english?'Email':'Correo electrónico',{exact:true}).fill(email);
  await page.getByLabel(english?'Password':'Contraseña',{exact:true}).fill(password);
  await page.getByRole('dialog').getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

for(const locale of ['es-MX','en'])test(`real ${locale} account editing, role assignment and browser revocation`,async({page,browser})=>{
  test.setTimeout(60000);
  const connectionString=process.env.FOUNDATION_TEST_DATABASE_URL;
  if(connectionString!=='postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser')throw new Error('Disposable database required');
  const pool=new pg.Pool({connectionString});const english=locale==='en';
  const recipientContext=await browser.newContext();const recipient=await recipientContext.newPage();const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));recipient.on('pageerror',error=>errors.push(error.message));
  try {
    const actorName=`Operator ${randomUUID().slice(0,8)}`,targetName=`Customer ${randomUUID().slice(0,8)}`;
    const actor=await createAccount(pool,actorName,[english?'administrator':'manager']);
    const target=await createAccount(pool,targetName,['customer']);
    // Use the same seed as local manual verification, including pending/inactive records.
    await promisify(execFile)(process.execPath,['scripts/development-demo.mjs','--development'],{
      env:{...process.env,NODE_ENV:'development',IDENTITY_DEV_FIXTURES:'true',DATABASE_URL:connectionString}
    });
    await signIn(page,5174,actor.email,english);await signIn(recipient,5173,target.email,english);
    await page.getByLabel(english?'Filter by role':'Filtrar por rol').selectOption('customer');
    await page.getByLabel(english?'Filter by status':'Filtrar por estado').selectOption('active');
    const trigger=page.getByRole('button',{name:`${english?'View account':'Ver cuenta'}: ${targetName}`});
    // Browser database contains earlier scenario accounts; traverse bounded pages instead of assuming first page.
    for(let attempt=0;attempt<5 && await trigger.count()===0;attempt++){
      await expect(page.getByText(english?'Loading accounts…':'Cargando cuentas…')).toHaveCount(0);
      if(await trigger.count())break;
      await page.getByRole('button',{name:english?'Next':'Siguiente',exact:true}).click();
    }
    await trigger.click();await page.getByLabel(english?'Name':'Nombre',{exact:true}).fill(`${targetName} Updated`);
    await page.getByLabel(english?'Phone (optional)':'Teléfono (opcional)').fill('5550101010');
    await page.getByRole('button',{name:english?'Save profile':'Guardar datos',exact:true}).click();
    await expect(page.getByRole('status')).toHaveText(english?'Profile saved.':'Datos guardados.');
    const saved=(await pool.query('SELECT full_name,phone FROM people WHERE id=$1',[target.personId])).rows[0];
    expect(saved).toEqual({full_name:`${targetName} Updated`,phone:'5550101010'});
    await page.getByRole('checkbox',{name:'Instructor',exact:true}).check();
    await page.getByRole('button',{name:english?'Save roles':'Guardar roles',exact:true}).click();
    await expect(page.getByRole('status')).toContainText(english?'Roles saved.':'Roles guardados.');
    expect((await pool.query('SELECT role FROM account_roles WHERE account_id=$1 ORDER BY role',[target.id])).rows.map(row=>row.role)).toEqual(['customer','instructor']);
    expect((await pool.query('SELECT count(*)::int n FROM identity_sessions WHERE account_id=$1 AND revoked_at IS NULL',[target.id])).rows[0].n).toBe(0);
    await recipient.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await expect(recipient.getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true})).toBeVisible();
    // Removing the newly assigned instructor role conflicts with seeded legacy obligations.
    await page.getByRole('checkbox',{name:'Instructor',exact:true}).uncheck();
    await page.getByRole('button',{name:english?'Save roles':'Guardar roles',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText(english?'The roles could not be changed':'No se pudieron cambiar los roles');
    expect((await pool.query("SELECT count(*)::int n FROM account_roles WHERE account_id=$1 AND role='instructor'",[target.id])).rows[0].n).toBe(1);
    await page.keyboard.press('Escape');
    await page.getByLabel(english?'Filter by role':'Filtrar por rol').selectOption(english?'administrator':'manager');
    const own=page.getByRole('button',{name:`${english?'View account':'Ver cuenta'}: ${actorName}`});await own.click();
    await page.getByRole('checkbox',{name:english?'Customer':'Cliente',exact:true}).check();
    await page.getByRole('button',{name:english?'Save roles':'Guardar roles',exact:true}).click();
    await expect(page.getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:english?'Account administration':'Administración de cuentas'})).toHaveCount(0);
    expect((await pool.query('SELECT count(*)::int n FROM identity_sessions WHERE account_id=$1 AND revoked_at IS NULL',[actor.id])).rows[0].n).toBe(0);
    expect(errors).toEqual([]);
  }finally{await recipientContext.close();await pool.end();}
});
