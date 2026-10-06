import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {hashPassword} from '../../apps/api/src/modules/identity/passwords.js';

for(const locale of ['es-MX','en'])test(`real ${locale} privileged audit browsing preserves stored history`,async({page})=>{
  const connectionString=process.env.FOUNDATION_TEST_DATABASE_URL;
  if(connectionString!=='postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser')throw new Error('Disposable database required');
  const pool=new pg.Pool({connectionString}),english=locale==='en';
  try {
    const email=`audit-${randomUUID()}@example.test`,password='Real audit test password';
    const person=(await pool.query("INSERT INTO people(full_name) VALUES ('Audit manager') RETURNING id")).rows[0];
    const account=(await pool.query("INSERT INTO accounts(person_id,email,password_hash,status,confirmation_status,email_verified_at) VALUES ($1,$2,$3,'active','verified',now()) RETURNING id",[person.id,email,await hashPassword(password)])).rows[0];
    await pool.query("INSERT INTO account_roles(account_id,role) VALUES ($1,'manager')",[account.id]);
    const count=(await pool.query('SELECT count(*)::int n FROM audit_events')).rows[0].n;expect(count).toBeGreaterThan(25);
    await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption(locale);
    await page.getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true}).click();
    await page.getByLabel(english?'Email':'Correo electrónico',{exact:true}).fill(email);
    await page.getByLabel(english?'Password':'Contraseña',{exact:true}).fill(password);
    await page.getByRole('dialog').getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true}).click();
    const region=page.getByRole('region',{name:english?'Operational history':'Historial operativo'});
    await region.getByRole('button',{name:english?'View history':'Ver historial',exact:true}).click();
    await expect(region.locator('ol > li')).toHaveCount(25);
    await region.getByRole('button',{name:english?'Next':'Siguiente',exact:true}).click();
    await expect(region.locator('ol > li').first()).toBeVisible();
    await region.getByRole('button',{name:english?'Previous':'Anterior',exact:true}).click();
    await expect(region.locator('ol > li')).toHaveCount(25);
    expect((await pool.query('SELECT count(*)::int n FROM audit_events')).rows[0].n).toBe(count);
    const response=await page.request.get('http://localhost:3001/api/v1/audit?limit=1',{headers:{Origin:'http://localhost:5174'}});
    expect(response.status()).toBe(200);expect(response.headers()['cache-control']).toBe('no-store');
    expect((await response.json()).events).toHaveLength(1);
  }finally{await pool.end();}
});
