import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.beforeEach(async({page})=>{
  await page.route('**/api/v1/settings/public',r=>r.fulfill({json:{displayName:'Conecta Infusion',timezone:'America/Mexico_City',currency:'MXN',units:[]}}));
  await page.route('**/api/v1/studio/overview',r=>r.fulfill({json:{classes:[],products:[]}}));
  await page.route('**/api/v1/auth/csrf',r=>r.fulfill({json:{csrfToken:'fixture'}}));
});
for(const role of ['administrator','manager','reception','cafe_staff','instructor','customer'])test(`${role}: invitation permission controls and generic result`,async({page})=>{
  if(role==='manager')await page.setViewportSize({width:320,height:1000});
  const account={id:'actor',personId:'person',email:'actor@example.test',fullName:'Actor',preferredLocale:'en',roles:[role]};
  await page.route('**/api/v1/auth/session',r=>r.fulfill({json:{account,csrfToken:'fixture'}}));
  await page.route('**/api/v1/management/access',r=>r.fulfill({status:403,json:{code:'FORBIDDEN'}}));
  await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  const trigger=page.getByRole('button',{name:'Invite customer',exact:true});
  if(role==='customer'){await expect(trigger).toHaveCount(0);return;}
  await trigger.focus();await page.keyboard.press('Enter');await expect(page.getByLabel('Email',{exact:true})).toBeFocused();
  const privileged=['administrator','manager'].includes(role);
  await expect(page.getByLabel('Waive email confirmation',{exact:true})).toHaveCount(privileged?1:0);
  let body:Record<string,unknown>={};await page.route('**/api/v1/accounts/invitations',r=>{body=r.request().postDataJSON();return r.fulfill({status:202,json:{code:'ACCEPTED',privateProfile:'secret record'}});});
  await page.getByLabel('Email',{exact:true}).fill('invited@example.test');await page.getByLabel('Name',{exact:true}).fill('Invited customer');
  if(privileged){await page.getByLabel('Waive email confirmation',{exact:true}).check();await page.getByLabel('Exemption reason',{exact:true}).fill('Approved exception');}
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  if(role==='manager'){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/invitation-en-320.png'});}
  await page.getByRole('button',{name:'Send invitation',exact:true}).click();await expect(page.getByRole('status')).toContainText('Request received');
  expect(body.waiveConfirmation).toBe(privileged?true:undefined);expect(body.password).toBeUndefined();expect(body.roles).toBeUndefined();
  await expect(page.getByRole('dialog')).not.toContainText('secret record');await expect(page.getByLabel('Email',{exact:true})).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
});
test('closing a pending invitation discards fields and prevents stale completion in a reopened dialog',async({page})=>{
  await page.route('**/api/v1/auth/session',r=>r.fulfill({json:{account:{id:'actor',roles:['instructor'],fullName:'Actor'},csrfToken:'fixture'}}));
  await page.route('**/api/v1/management/access',r=>r.fulfill({status:403,json:{code:'FORBIDDEN'}}));
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let calls=0;
  await page.route('**/api/v1/accounts/invitations',async r=>{calls++;await gate;await r.fulfill({status:202,json:{code:'ACCEPTED'}});});
  await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption('en');await page.getByRole('button',{name:'Invite customer',exact:true}).click();
  await page.getByLabel('Email',{exact:true}).fill('pending@example.test');await page.getByLabel('Name',{exact:true}).fill('Pending customer');
  await page.getByRole('button',{name:'Send invitation',exact:true}).click();await expect(page.getByRole('button',{name:'Sending…'})).toBeDisabled();
  await expect.poll(()=>calls).toBe(1);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Invite customer',exact:true}).click();release();
  await expect(page.getByLabel('Email',{exact:true})).toHaveValue('');await expect(page.getByLabel('Name',{exact:true})).toHaveValue('');
  await expect(page.getByRole('dialog').getByRole('status')).toHaveCount(0);expect(calls).toBe(1);
});
for(const port of [5173,5174])test(`${port}: setup strips URL, requires strong matching passwords and never auto-submits`,async({page})=>{
  let calls=0;await page.route('**/api/v1/auth/setup',r=>{calls++;return r.fulfill({json:{code:'PASSWORD_SET'}});});
  await page.goto(`http://localhost:${port}/auth/action?redirect=https://evil.example#purpose=password_setup&token=`+'x'.repeat(43));
  await expect(page).toHaveURL(`http://localhost:${port}/auth/action`);expect(calls).toBe(0);
  await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  await page.getByLabel('New password',{exact:true}).fill('short');await page.getByLabel('Confirm password',{exact:true}).fill('short');await page.getByRole('button',{name:'Set up password',exact:true}).click();expect(calls).toBe(0);
  await page.getByLabel('New password',{exact:true}).fill('A strong invitation password');await page.getByLabel('Confirm password',{exact:true}).fill('A mismatched invitation password');await page.getByRole('button',{name:'Set up password',exact:true}).click();expect(calls).toBe(0);
  await page.getByLabel('Confirm password',{exact:true}).fill('A strong invitation password');await page.getByRole('button',{name:'Set up password',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Your account is ready');expect(calls).toBe(1);
  await expect(page.getByRole('link',{name:'Sign in',exact:true})).toHaveAttribute('href','/');
  await page.reload();await expect(page.getByRole('alert')).toContainText('supported action');await expect(page.getByLabel('New password',{exact:true})).toHaveCount(0);
});
test('invitation resend is email-only, hides raw errors and blocks after permission loss',async({page})=>{
  await page.route('**/api/v1/auth/session',r=>r.fulfill({json:{account:{id:'actor',roles:['instructor'],fullName:'Actor'},csrfToken:'fixture'}}));
  await page.route('**/api/v1/management/access',r=>r.fulfill({status:403,json:{code:'FORBIDDEN'}}));
  await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption('en');await page.getByRole('button',{name:'Invite customer',exact:true}).click();
  await page.getByRole('button',{name:'Resend invitation',exact:true}).click();await expect(page.getByLabel('Name',{exact:true})).toHaveCount(0);
  await page.route('**/api/v1/accounts/invitations/resend',r=>{expect(r.request().postDataJSON()).toEqual({email:'unknown@example.test'});return r.fulfill({status:429,json:{code:'THROTTLED',raw:'secret'}});});
  await page.getByLabel('Email',{exact:true}).fill('unknown@example.test');await page.getByRole('button',{name:'Resend invitation',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Too many');await expect(page.getByRole('dialog')).not.toContainText('secret');
  await page.route('**/api/v1/accounts/invitations/resend',r=>r.fulfill({status:403,json:{code:'FORBIDDEN'}}));
  await page.getByRole('button',{name:'Resend invitation',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Refresh');await expect(page.getByRole('button',{name:'Resend invitation',exact:true})).toBeDisabled();
});
test('setup handles transient errors, invalid links and replacement while a request is pending',async({page})=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let calls=0;
  await page.route('**/api/v1/auth/setup',async r=>{calls++;if(calls===1)await gate;await r.fulfill({status:calls===2?503:400,json:calls===2?{code:'UNAVAILABLE',raw:'secret'}:{code:'INVALID_ACTION'}});});
  await page.goto('http://localhost:5173/auth/action#purpose=password_setup&token='+'x'.repeat(43));await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  async function fill(){await page.getByLabel('New password',{exact:true}).fill('A strong invitation password');await page.getByLabel('Confirm password',{exact:true}).fill('A strong invitation password');}
  await fill();await page.getByRole('button',{name:'Set up password',exact:true}).click();await expect(page.getByRole('button',{name:'Saving password…'})).toBeDisabled();
  await expect.poll(()=>calls).toBe(1);
  await page.goto('http://localhost:5173/auth/action#purpose=password_setup&token='+'y'.repeat(43));release();await expect(page.getByRole('alert')).toHaveCount(0);
  await fill();await page.getByRole('button',{name:'Set up password',exact:true}).click();await expect(page.getByRole('alert')).toContainText('try again');await expect(page.getByLabel('New password',{exact:true})).toHaveValue('');
  await fill();await page.getByRole('button',{name:'Set up password',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Ask the team');
});
for(const width of [320,768,1024,1440])test(`Spanish setup fits ${width}px and passes axe`,async({page})=>{
  await page.setViewportSize({width,height:1000});await page.goto('http://localhost:5173/auth/action#purpose=password_setup&token='+'x'.repeat(43));
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width===320)await page.screenshot({path:'test-results/setup-es-320.png'});
});
