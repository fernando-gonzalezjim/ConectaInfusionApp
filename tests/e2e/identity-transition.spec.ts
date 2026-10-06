import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const raw='a'.repeat(43),password='An independent account password';
for(const locale of ['es-MX','en'])for(const port of [5173,5174])test(`${locale} ${port}: transition requires explicit email and password confirmation`,async({page})=>{
  const en=locale==='en';let writes=0;
  page.on('pageerror',error=>{throw error;});await page.setViewportSize({width:360,height:900});
  await page.route('**/api/v1/auth/csrf',r=>r.fulfill({json:{csrfToken:'safe-csrf'}}));
  await page.route('**/api/v1/dependents/transitions/complete',r=>{writes++;expect(r.request().headers()['x-csrf-token']).toBe('safe-csrf');expect(r.request().postDataJSON()).toEqual({token:raw,email:'child@example.test',password});return r.fulfill({json:{code:'TRANSITIONED'}});});
  await page.goto(`http://localhost:${port}/auth/action#purpose=dependent_transition&token=${raw}`);await page.getByLabel('Idioma',{exact:true}).selectOption(locale);
  expect(page.url()).not.toContain(raw);expect(writes).toBe(0);
  await expect(page.getByRole('heading',{name:en?'Independent account':'Cuenta independiente'})).toBeVisible();
  await page.getByLabel(en?'Email':'Correo electrónico',{exact:true}).fill('child@example.test');await page.getByLabel(en?'New password':'Nueva contraseña',{exact:true}).fill(password);await page.getByLabel(en?'Confirm password':'Confirmar contraseña',{exact:true}).fill(password);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:en?'Confirm email and create independent account':'Confirmar correo y crear cuenta independiente',exact:true}).click();await expect(page.getByRole('status')).toContainText(en?'Independent account created':'Cuenta independiente creada');expect(writes).toBe(1);
});

test('uncertain completion clears passwords and prevents another write',async({page})=>{
  let writes=0;await page.route('**/api/v1/auth/csrf',r=>r.fulfill({json:{csrfToken:'safe-csrf'}}));await page.route('**/api/v1/dependents/transitions/complete',r=>{writes++;return r.fulfill({status:503,json:{code:'UNAVAILABLE',secret:'SQL secret'}});});
  await page.goto(`http://localhost:5173/auth/action#purpose=dependent_transition&token=${raw}`);await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  await page.getByLabel('Email',{exact:true}).fill('child@example.test');await page.getByLabel('New password',{exact:true}).fill(password);await page.getByLabel('Confirm password',{exact:true}).fill(password);await page.getByRole('button',{name:'Confirm email and create independent account',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('could not confirm');await expect(page.getByLabel('New password',{exact:true})).toHaveValue('');await expect(page.getByRole('button',{name:'Confirm email and create independent account',exact:true})).toBeDisabled();expect(writes).toBe(1);await expect(page.locator('body')).not.toContainText('SQL secret');
});
