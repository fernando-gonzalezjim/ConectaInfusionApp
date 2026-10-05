import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const id='11111111-1111-4111-a111-111111111111';
const profile={id,personId:id,email:'customer@example.test',fullName:'Demo Customer',preferredLocale:'es-MX',roles:['customer'],phone:'555',photoId:null,status:'active',profileStatus:'active',confirmationStatus:'verified'};
test.beforeEach(async({page})=>{
  await page.route('**/api/v1/settings/public',r=>r.fulfill({json:{displayName:'Conecta Infusion',currency:'MXN',timezone:'America/Mexico_City',units:[],supportedLocales:['es-MX','en'],defaultLocale:'es-MX'}}));
  await page.route('**/api/v1/studio/overview',r=>r.fulfill({json:{classes:[],products:[]}}));
  await page.route('**/api/v1/management/access',r=>r.fulfill({status:403,json:{code:'FORBIDDEN'}}));
  await page.route('**/api/v1/auth/session',r=>r.fulfill({json:{account:profile,csrfToken:'session-csrf',authenticatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()}}));
  await page.route('**/api/v1/me',r=>r.fulfill({json:profile}));
});
for(const port of [5173,5174])test(`${port} own profile edits and separate email request are accessible`,async({page})=>{
  await page.goto(`http://localhost:${port}`);await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  await page.getByRole('button',{name:'My account',exact:true}).click();
  await page.getByRole('button',{name:'Edit my profile',exact:true}).click();
  await page.getByLabel('Name',{exact:true}).fill('Changed Customer');let saved:unknown;
  await page.route('**/api/v1/me',r=>{saved=r.request().postDataJSON();return r.fulfill({json:{...profile,fullName:'Changed Customer'}});});
  await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.getByText('Profile saved.',{exact:true})).toBeVisible();
  expect(saved).toEqual({fullName:'Changed Customer',phone:'555',preferredLocale:'es-MX'});
  let request:unknown;await page.route('**/auth/email-change',r=>{request=r.request().postDataJSON();return r.fulfill({status:202,json:{code:'ACCEPTED'}});});
  await page.getByLabel('New email',{exact:true}).fill('new@example.test');await page.getByRole('button',{name:'Send confirmation',exact:true}).click();
  await expect(page.getByText(/Your current email stays active/)).toBeVisible();expect(request).toEqual({email:'new@example.test'});
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});
test('recent authentication, conflict and network errors stay safe without automatic retry',async({page})=>{
  await page.goto('http://localhost:5173');await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  await page.getByRole('button',{name:'My account',exact:true}).click();await page.getByRole('button',{name:'Edit my profile',exact:true}).click();
  for(const [status,code,text] of [[403,'RECENT_AUTH_REQUIRED','Sign out and sign in again'],[409,'CONFLICT','This email cannot be used'],[503,'UNAVAILABLE','Refresh your profile']] as const){
    let calls=0;await page.route('**/auth/email-change',r=>{calls++;return r.fulfill({status,json:{code,private:'SQL secret'}});});
    await page.getByLabel('New email',{exact:true}).fill('new@example.test');await page.getByRole('button',{name:'Send confirmation',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText(text);expect(calls).toBe(1);await expect(page.getByText('SQL secret')).toHaveCount(0);
  }
});
test('email change action never confirms on GET, clears fragment and needs explicit confirmation',async({page})=>{
  let calls=0;await page.route('**/auth/csrf',r=>r.fulfill({json:{csrfToken:'anonymous-csrf'}}));
  await page.route('**/auth/email-change/confirmation',r=>{calls++;expect(r.request().method()).toBe('POST');return r.fulfill({json:{code:'EMAIL_CHANGED'}});});
  await page.goto('http://localhost:5173/auth/action#purpose=email_change&token='+'A'.repeat(43));
  await expect(page.getByRole('heading',{name:'Confirma tu nuevo correo'})).toBeVisible();expect(calls).toBe(0);expect(new URL(page.url()).hash).toBe('');
  await page.getByRole('button',{name:'Confirma tu nuevo correo',exact:true}).click();await expect(page.getByRole('status')).toContainText('sesión');expect(calls).toBe(1);
});
test('Spanish profile fits mobile, blocks dismissal during a save and restores confirmed values',async({page})=>{
  await page.setViewportSize({width:320,height:1000});await page.goto('http://localhost:5173');
  await page.getByRole('button',{name:'Mi cuenta',exact:true}).click();await page.getByRole('button',{name:'Editar mi perfil',exact:true}).click();
  await page.getByLabel('Nombre',{exact:true}).fill('Confirmed name');
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let calls=0;
  await page.route('**/api/v1/me',async r=>{if(r.request().method()==='POST'){calls++;await gate;}await r.fulfill({json:{...profile,fullName:'Confirmed name'}});});
  await page.getByRole('button',{name:'Guardar datos',exact:true}).click();await expect.poll(()=>calls).toBe(1);
  await expect(page.getByRole('button',{name:'Cerrar',exact:true})).toBeDisabled();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();
  release();await expect(page.getByRole('status')).toHaveText('Datos guardados.');
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/self-profile-es-320.png'});
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Mi cuenta',exact:true}).click();await page.getByRole('button',{name:'Editar mi perfil',exact:true}).click();
  await expect(page.getByLabel('Nombre',{exact:true})).toHaveValue('Confirmed name');
});
