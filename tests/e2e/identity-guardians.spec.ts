import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const id='11111111-1111-4111-a111-111111111111',childId='22222222-2222-4222-a222-222222222222';
const account={id,personId:id,email:'guardian@example.test',fullName:'Guardian',roles:['customer'],preferredLocale:'es-MX'};
test.beforeEach(async({page})=>{
  page.on('pageerror',error=>{throw error;});
  await page.route('**/api/v1/settings/public',r=>r.fulfill({json:{displayName:'Conecta Infusion',currency:'MXN',timezone:'America/Mexico_City',units:[]}}));
  await page.route('**/api/v1/studio/overview',r=>r.fulfill({json:{classes:[],products:[]}}));
  await page.route('**/api/v1/auth/session',r=>r.fulfill({json:{account,csrfToken:'safe-csrf'}}));
});
for(const locale of ['es-MX','en'])for(const width of [360,1440])test(`${locale} ${width}: guardian link strips secrets and requires separate preview and acceptance`,async({page})=>{
  const en=locale==='en',token='x'.repeat(43);let previews=0,accepts=0;await page.setViewportSize({width,height:900});
  await page.route('**/api/v1/dependents/guardian-invitations/preview',r=>{previews++;expect(r.request().headers()['x-csrf-token']).toBe('safe-csrf');expect(r.request().postDataJSON()).toEqual({token});return r.fulfill({json:{dependent:{id:childId,fullName:'Consent child'},expiresAt:'2026-10-12T12:00:00.000Z'}});});
  await page.route('**/api/v1/dependents/guardian-invitations/accept',r=>{accepts++;return r.fulfill({json:{dependentId:childId}});});
  await page.goto('http://localhost:5173/auth/action?discard=secret#purpose=guardian_invitation&token='+token);await expect(page).toHaveURL('http://localhost:5173/auth/action');await page.getByLabel('Idioma',{exact:true}).selectOption(locale);
  expect(previews).toBe(0);expect(accepts).toBe(0);await page.getByRole('button',{name:en?'Review guardian invitation':'Revisar invitación de tutor',exact:true}).click();await expect(page.getByRole('heading',{name:'Consent child',exact:true})).toBeVisible();expect(accepts).toBe(0);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(locale==='es-MX'&&width===360||locale==='en'&&width===1440)await page.screenshot({path:`test-results/guardian-${locale}-${width}.png`});
  await page.getByRole('button',{name:en?'Accept and become guardian':'Aceptar y ser tutor',exact:true}).click();await expect(page.getByRole('status')).toContainText(en?'accepted guardianship':'Aceptaste ser tutor');expect(accepts).toBe(1);
  expect(await page.evaluate(()=>[...Object.values(localStorage),...Object.values(sessionStorage)].join(' '))).not.toContain(token);
});
test('guardian issuance leaves current authorized guardians unchanged and protects pending nested dialogs',async({page})=>{
  await page.route('**/api/v1/child-details**',r=>r.fulfill({json:{items:[],nextCursor:null}}));
  await page.route('**/api/v1/dependents?*',r=>r.fulfill({json:{items:[{id:childId,fullName:'Child',ageText:'8',preferredLocale:'es-MX',version:0,guardians:[{accountId:id,fullName:'Existing guardian'}]}],nextCursor:null}}));
  let finish!:()=>void;const gate=new Promise<void>(resolve=>{finish=resolve;});let sends=0;
  await page.route('**/api/v1/dependents/*/guardian-invitations',async r=>{sends++;expect(r.request().postDataJSON()).toEqual({email:'recipient@example.test'});await gate;await r.fulfill({status:202,json:{code:'ACCEPTED'}});});
  await page.goto('http://localhost:5173');await page.getByLabel('Idioma',{exact:true}).selectOption('en');await page.getByRole('button',{name:'Children and dependents',exact:true}).click();await page.getByRole('button',{name:'Dependent profiles',exact:true}).click();await page.getByRole('button',{name:'Invite guardian: Child',exact:true}).click();
  await page.getByLabel('Guardian email',{exact:true}).fill('recipient@example.test');await page.getByRole('button',{name:'Send guardian invitation',exact:true}).click();await expect.poll(()=>sends).toBe(1);await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Sending invitation…',exact:true})).toBeVisible();finish();
  await expect(page.getByRole('status')).toContainText('must accept by email');await page.keyboard.press('Escape');await expect(page.getByText('Existing guardian',{exact:true})).toBeVisible();await expect(page.getByText('recipient@example.test',{exact:true})).toHaveCount(0);
});
test('guardian invitation handles wrong account and uncertain acceptance without retrying or leaking errors',async({page})=>{
  let writes=0;await page.route('**/api/v1/dependents/guardian-invitations/preview',r=>r.fulfill({status:400,json:{code:'INVALID_ACTION',raw:'SQL secret'}}));
  await page.goto('http://localhost:5174/auth/action#purpose=guardian_invitation&token='+'x'.repeat(43));await page.getByLabel('Idioma',{exact:true}).selectOption('en');await page.getByRole('button',{name:'Review guardian invitation',exact:true}).click();await expect(page.getByRole('alert')).toContainText('already used');await expect(page.locator('main')).not.toContainText('SQL secret');
  await page.route('**/api/v1/dependents/guardian-invitations/preview',r=>r.fulfill({json:{dependent:{id:childId,fullName:'Child'},expiresAt:'2026-10-12T12:00:00.000Z'}}));
  await page.route('**/api/v1/dependents/guardian-invitations/accept',r=>{writes++;return r.fulfill({status:503,json:{code:'UNAVAILABLE',raw:'SQL secret'}});});
  await page.goto('http://localhost:5174/auth/action#purpose=guardian_invitation&token='+'y'.repeat(43));await page.getByRole('button',{name:'Review guardian invitation',exact:true}).click();await page.getByRole('button',{name:'Accept and become guardian',exact:true}).click();await expect(page.getByRole('alert')).toContainText('could not confirm');await expect(page.getByRole('button',{name:'Accept and become guardian',exact:true})).toBeDisabled();expect(writes).toBe(1);
});
test('signed-out and staff-only recipients get no guardian actions',async({page})=>{
  let calls=0;await page.route('**/api/v1/dependents/guardian-invitations/*',r=>{calls++;return r.fulfill({json:{}});});await page.route('**/api/v1/auth/session',r=>r.fulfill({status:401,json:{code:'UNAUTHENTICATED'}}));
  await page.goto('http://localhost:5173/auth/action#purpose=guardian_invitation&token='+'x'.repeat(43));await page.getByLabel('Idioma',{exact:true}).selectOption('en');await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Review guardian invitation',exact:true})).toHaveCount(0);
  await page.route('**/api/v1/auth/session',r=>r.fulfill({json:{account:{...account,roles:['instructor']},csrfToken:'safe'}}));await page.goto('http://localhost:5173/auth/action#purpose=guardian_invitation&token='+'y'.repeat(43));await expect(page.getByRole('alert')).toContainText('customer access');expect(calls).toBe(0);
});
test('management assists an existing dependent without receiving its editable profile',async({page})=>{
  const manager={...account,roles:['manager']},record={...account,phone:null,photoId:null,status:'active',profileStatus:'active',confirmationStatus:'verified'};
  await page.route('**/api/v1/auth/session',r=>r.fulfill({json:{account:manager,csrfToken:'safe-csrf'}}));await page.route('**/api/v1/management/access',r=>r.fulfill({json:{account:manager,capabilities:{administerIdentity:true}}}));await page.route('**/api/v1/accounts?*',r=>r.fulfill({json:{accounts:[record],nextCursor:null}}));
  await page.route('**/api/v1/dependents/guardian-invitations/for-account/*',r=>r.fulfill({json:{items:[{id:childId,fullName:'Managed child'}],nextCursor:null}}));let sends=0;await page.route('**/api/v1/dependents/*/guardian-invitations',r=>{sends++;return r.fulfill({status:202,json:{code:'ACCEPTED'}});});
  await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption('en');await page.getByRole('button',{name:'Assist with guardians',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Dependent',{exact:true}).selectOption(childId);await dialog.getByLabel('Guardian email',{exact:true}).fill('recipient@example.test');await dialog.getByRole('button',{name:'Send guardian invitation',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('must accept');expect(sends).toBe(1);await expect(dialog.getByLabel('Age (text)',{exact:true})).toHaveCount(0);expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});
