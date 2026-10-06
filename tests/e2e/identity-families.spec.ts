import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const id='11111111-1111-4111-a111-111111111111';
const account={id,personId:id,email:'customer@example.test',fullName:'Customer',roles:['customer'],preferredLocale:'es-MX'};
const family={id,name:'Conecta family',createdByPersonId:id,responsibleMembershipId:id,status:'active',version:0};
test.beforeEach(async({page})=>{
  await page.route('**/api/v1/settings/public',r=>r.fulfill({json:{displayName:'Conecta Infusion',currency:'MXN',timezone:'America/Mexico_City',units:[]}}));
  await page.route('**/api/v1/studio/overview',r=>r.fulfill({json:{classes:[],products:[]}}));
  await page.route('**/api/v1/auth/session',r=>r.fulfill({json:{account,csrfToken:'session-csrf'}}));
  await page.route('**/api/v1/families/current',r=>r.fulfill({json:{family:null}}));
  await page.route('**/api/v1/families/*/responsibility',r=>r.fulfill({json:{canNominate:false}}));
});
test('customer creates a family and invites without claiming pending membership',async({page})=>{
  await page.goto('http://localhost:5173');await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  await page.getByRole('button',{name:'My family',exact:true}).click();
  await page.getByLabel('Family name',{exact:true}).fill('Conecta family');let created=0,invited=0;
  await page.route('**/api/v1/families',r=>{created++;expect(r.request().postDataJSON()).toEqual({name:'Conecta family'});return r.fulfill({status:201,json:family});});
  await page.getByRole('button',{name:'Create family',exact:true}).click();await expect(page.getByText('Conecta family',{exact:true})).toBeVisible();expect(created).toBe(1);
  await page.route('**/api/v1/families/*/invitations',r=>{invited++;expect(r.request().postDataJSON()).toEqual({email:'member@example.test'});return r.fulfill({status:202,json:{code:'ACCEPTED'}});});
  await page.getByLabel('Member email',{exact:true}).fill('member@example.test');await page.getByRole('button',{name:'Send family invitation',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('accept before joining');expect(invited).toBe(1);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});

test('failed family reads never invent an empty group or expose a create action',async({page})=>{
  await page.route('**/api/v1/families/current',r=>r.fulfill({status:503,json:{code:'UNAVAILABLE',raw:'SQL secret'}}));
  await page.goto('http://localhost:5173');await page.getByLabel('Idioma',{exact:true}).selectOption('en');await page.getByRole('button',{name:'My family',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('could not load');await expect(page.getByRole('button',{name:'Create family',exact:true})).toHaveCount(0);
  await expect(page.getByRole('dialog')).not.toContainText('SQL secret');
});

for(const port of [5173,5174])test(`${port}: family link strips tokens, previews only and accepts deliberately`,async({page})=>{
  let previews=0,accepts=0;const token='x'.repeat(43);
  await page.route('**/api/v1/families/invitations/preview',r=>{previews++;expect(r.request().postDataJSON()).toEqual({token});return r.fulfill({json:{family:{id,name:family.name},expiresAt:'2026-10-11T12:00:00.000Z'}});});
  await page.route('**/api/v1/families/invitations/accept',r=>{accepts++;return r.fulfill({json:family});});
  await page.goto(`http://localhost:${port}/auth/action?redirect=https://evil.example#purpose=family_invitation&token=${token}`);
  await expect(page).toHaveURL(`http://localhost:${port}/auth/action`);await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  expect(previews).toBe(0);expect(accepts).toBe(0);
  await page.getByRole('button',{name:'Review invitation',exact:true}).click();await expect(page.getByText(family.name,{exact:true})).toBeVisible();expect(accepts).toBe(0);
  await expect(page.getByText('Family membership does not allow you to manage dependent profiles.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Accept and join',exact:true}).click();await expect(page.getByRole('status')).toContainText('You joined');expect(previews).toBe(1);expect(accepts).toBe(1);
  expect(await page.evaluate(()=>[...Object.values(localStorage),...Object.values(sessionStorage)].join(' '))).not.toContain(token);
});

test('signed-out and non-customer recipients cannot preview or accept a family invitation',async({page})=>{
  let calls=0;await page.route('**/api/v1/families/invitations/*',r=>{calls++;return r.fulfill({json:{}});});
  await page.route('**/api/v1/auth/session',r=>r.fulfill({status:401,json:{code:'UNAUTHENTICATED'}}));
  await page.goto('http://localhost:5173/auth/action#purpose=family_invitation&token='+'x'.repeat(43));await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Review invitation',exact:true})).toHaveCount(0);expect(calls).toBe(0);
  await page.route('**/api/v1/auth/session',r=>r.fulfill({json:{account:{...account,roles:['instructor']},csrfToken:'session-csrf'}}));
  await page.goto('http://localhost:5173/auth/action#purpose=family_invitation&token='+'y'.repeat(43));
  await expect(page.getByRole('alert')).toContainText('customer access');await expect(page.getByRole('button',{name:'Accept and join',exact:true})).toHaveCount(0);expect(calls).toBe(0);
});

test('invalid/expired invitation and uncertain acceptance hide raw errors and never retry automatically',async({page})=>{
  let attempts=0;await page.route('**/api/v1/families/invitations/preview',r=>r.fulfill({status:400,json:{code:'INVALID_ACTION',raw:'SQL secret'}}));
  await page.goto('http://localhost:5173/auth/action#purpose=family_invitation&token='+'x'.repeat(43));await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  await page.getByRole('button',{name:'Review invitation',exact:true}).click();await expect(page.getByRole('alert')).toContainText('already used');await expect(page.locator('main')).not.toContainText('SQL secret');
  await page.route('**/api/v1/families/invitations/preview',r=>r.fulfill({json:{family:{id,name:family.name},expiresAt:'2026-10-11T12:00:00.000Z'}}));
  await page.route('**/api/v1/families/invitations/accept',r=>{attempts++;return r.fulfill({status:503,json:{code:'UNAVAILABLE',raw:'SQL secret'}});});
  await page.goto('http://localhost:5173/auth/action#purpose=family_invitation&token='+'y'.repeat(43));await page.getByRole('button',{name:'Review invitation',exact:true}).click();
  await page.getByRole('button',{name:'Accept and join',exact:true}).click();await expect(page.getByRole('alert')).toContainText('could not confirm');await expect(page.getByRole('button',{name:'Accept and join',exact:true})).toBeDisabled();expect(attempts).toBe(1);
});

test('management selects the customer family without creating or accepting on their behalf',async({page})=>{
  const manager={...account,roles:['manager']};const record={...account,phone:null,photoId:null,status:'active',profileStatus:'active',confirmationStatus:'verified'};
  await page.route('**/api/v1/auth/session',r=>r.fulfill({json:{account:manager,csrfToken:'session-csrf'}}));
  await page.route('**/api/v1/management/access',r=>r.fulfill({json:{account:manager,capabilities:{administerIdentity:true}}}));
  await page.route('**/api/v1/accounts?*',r=>r.fulfill({json:{accounts:[record],nextCursor:null}}));
  await page.route('**/api/v1/families/for-account/*',r=>r.fulfill({json:{family}}));
  await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  await page.getByRole('button',{name:'Assist family: Customer',exact:true}).click();await expect(page.getByText(family.name,{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Create family',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Accept and join',exact:true})).toHaveCount(0);
  await page.route('**/api/v1/families/*/invitations',r=>r.fulfill({status:202,json:{code:'ACCEPTED'}}));
  await page.getByLabel('Member email',{exact:true}).fill('recipient@example.test');await page.getByRole('button',{name:'Send family invitation',exact:true}).click();await expect(page.getByRole('dialog').getByRole('status')).toContainText('accept before joining');
  await page.keyboard.press('Escape');await page.route('**/api/v1/families/for-account/*',r=>r.fulfill({json:{family:null}}));
  await page.getByRole('button',{name:'Assist family: Customer',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('their own account');await expect(page.getByRole('button',{name:'Create family',exact:true})).toHaveCount(0);
});

for(const width of [320,768,1024,1440])test(`Spanish family invitation fits ${width}px and passes axe`,async({page})=>{
  await page.setViewportSize({width,height:1000});await page.route('**/api/v1/families/invitations/preview',r=>r.fulfill({json:{family:{id,name:'Familia Conecta Infusión'},expiresAt:'2026-10-11T12:00:00.000Z'}}));
  await page.goto('http://localhost:5173/auth/action#purpose=family_invitation&token='+'x'.repeat(43));await page.getByRole('button',{name:'Revisar invitación',exact:true}).click();
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width===320)await page.screenshot({path:'test-results/family-invitation-es-320.png'});
});

 test('fresh session email changes invalidate an existing family preview',async({page})=>{
  let email=account.email;
  await page.route('**/api/v1/auth/session',r=>r.fulfill({json:{account:{...account,email},csrfToken:'session-csrf'}}));
  await page.route('**/api/v1/families/invitations/preview',r=>r.fulfill({json:{family:{id,name:family.name},expiresAt:'2026-10-11T12:00:00.000Z'}}));
  await page.goto('http://localhost:5173/auth/action#purpose=family_invitation&token='+'x'.repeat(43));
  await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  await page.getByRole('button',{name:'Review invitation',exact:true}).click();
  await expect(page.getByRole('button',{name:'Accept and join',exact:true})).toBeVisible();
  email='changed@example.test';
  const refreshed=page.waitForResponse('**/api/v1/auth/session');
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await refreshed;
  await expect(page.getByRole('button',{name:'Accept and join',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Review invitation',exact:true})).toBeVisible();
});
