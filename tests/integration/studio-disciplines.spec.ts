import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {hashPassword} from '../../apps/api/src/modules/identity/passwords.js';

for(const locale of ['es-MX','en'])test(`real ${locale} manager creates and edits published disciplines with accessible responsive forms`,async({page})=>{
  test.setTimeout(60000);
  const connectionString=process.env.FOUNDATION_TEST_DATABASE_URL;
  if(connectionString!=='postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser')throw new Error('Disposable database required');
  const pool=new pg.Pool({connectionString}),english=locale==='en';
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    const email=`studio-manager-${randomUUID()}@example.test`,password='Real catalog test password';
    const person=(await pool.query("INSERT INTO people(full_name) VALUES ('Catalog manager') RETURNING id")).rows[0];
    const account=(await pool.query(`INSERT INTO accounts(person_id,email,password_hash,status,confirmation_status,email_verified_at)
      VALUES ($1,$2,$3,'active','verified',now()) RETURNING id`,[person.id,email,await hashPassword(password)])).rows[0];
    await pool.query("INSERT INTO account_roles(account_id,role) VALUES ($1,'manager')",[account.id]);
    await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption(locale);
    await page.getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true}).click();
    await page.getByLabel(english?'Email':'Correo electrónico',{exact:true}).fill(email);
    await page.getByLabel(english?'Password':'Contraseña',{exact:true}).fill(password);
    await page.getByRole('dialog').getByRole('button',{name:english?'Sign in':'Iniciar sesión',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const region=page.getByRole('region',{name:english?'Studio disciplines':'Disciplinas del estudio',exact:true});
    await expect(region).toBeVisible();
    const create=region.getByRole('button',{name:english?'New discipline':'Nueva disciplina',exact:true});
    await expect(create).toBeEnabled();
    await create.focus();await page.keyboard.press('Enter');
    const form=region.getByRole('form',{name:english?'Discipline details':'Detalles de la disciplina',exact:true});
    await expect(form).toBeVisible();
    const name=`Disciplina ficticia ${randomUUID().slice(0,8)}`;
    const nameField=form.getByLabel(english?'Spanish name':'Nombre en español',{exact:true});
    await nameField.focus();await page.keyboard.type(name);
    await page.keyboard.press('Tab');
    await expect(form.getByLabel(english?'English name':'Nombre en inglés',{exact:true})).toBeFocused();
    await form.getByLabel(english?'English name':'Nombre en inglés',{exact:true}).fill(`English ${name}`);
    await form.getByLabel(english?'Spanish description':'Descripción en español',{exact:true}).fill('Descripción de una disciplina ficticia para verificación.');
    await form.getByLabel(english?'English description':'Descripción en inglés',{exact:true}).fill('Fictional discipline description for verification.');
    await form.getByLabel(english?'Status':'Estado',{exact:true}).selectOption('published');
    for(const width of [320,768,1440]){
      await page.setViewportSize({width,height:900});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
    expect((await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
    await page.screenshot({path:`.local/studio-disciplines-${locale}.png`,fullPage:true});
    await form.getByRole('button',{name:english?'Save discipline':'Guardar disciplina',exact:true}).click();
    await expect(form).toHaveCount(0);
    await expect(create).toBeFocused();
    const created=(await pool.query('SELECT id,name_es,name_en,status,version FROM studio_disciplines WHERE name_es=$1',[name])).rows[0];
    expect(created).toMatchObject({name_es:name,name_en:`English ${name}`,status:'published',version:1});
    const item=region.getByRole('article').filter({hasText:name});
    await expect(item).toHaveCount(1);
    const edit=item.getByRole('button',{name:english?'Edit discipline':'Editar disciplina',exact:true});
    await edit.focus();await page.keyboard.press('Enter');
    // A refresh begun before saving cannot overwrite a later successful edit.
    let releaseRead:()=>void=()=>{};
    const readGate=new Promise<void>(resolve=>{releaseRead=resolve;});
    let finishRead:()=>void=()=>{};
    const readHandled=new Promise<void>(resolve=>{finishRead=resolve;});
    const listPath='**/api/v1/management/studio/disciplines?*';
    const holdRead=async(route:import('@playwright/test').Route)=>{const response=await route.fetch();await readGate;await route.fulfill({response});finishRead();};
    await page.route(listPath,holdRead);
    await region.getByRole('button',{name:english?'Refresh disciplines':'Actualizar disciplinas',exact:true}).click();
    await expect(form.getByRole('button',{name:english?'Save discipline':'Guardar disciplina',exact:true})).toBeDisabled();
    await form.getByRole('button',{name:english?'Cancel':'Cancelar',exact:true}).click();
    await expect(form).toHaveCount(0);
    releaseRead();await readHandled;await page.unroute(listPath,holdRead);
    await expect(edit).toBeEnabled();await expect(edit).toBeFocused();
    await edit.click();
    await expect(form.getByRole('button',{name:english?'Save discipline':'Guardar disciplina',exact:true})).toBeEnabled();
    await expect(form).toBeVisible();
    await nameField.fill(`${name} updated`);
    await form.getByRole('button',{name:english?'Save discipline':'Guardar disciplina',exact:true}).click();
    await expect(form).toHaveCount(0);
    expect((await pool.query('SELECT name_es,status,version FROM studio_disciplines WHERE id=$1',[created.id])).rows[0]).toEqual({name_es:`${name} updated`,status:'published',version:2});
    expect((await pool.query("SELECT action,actor_id,target_type,business_unit FROM audit_events WHERE target_id=$1 AND action LIKE 'studio.discipline_%' ORDER BY occurred_at",[created.id])).rows).toEqual([
      {action:'studio.discipline_created',actor_id:account.id,target_type:'discipline',business_unit:'studio'},
      {action:'studio.discipline_updated',actor_id:account.id,target_type:'discipline',business_unit:'studio'}
    ]);
    await create.click();await expect(form).toBeVisible();
    await form.getByRole('button',{name:english?'Cancel':'Cancelar',exact:true}).click();
    await expect(form).toHaveCount(0);
    expect((await pool.query('SELECT count(*)::int n FROM studio_disciplines WHERE name_es=$1',[`${name} updated`])).rows[0].n).toBe(1);
    expect(errors).toEqual([]);
  }finally{await pool.end();}
});
