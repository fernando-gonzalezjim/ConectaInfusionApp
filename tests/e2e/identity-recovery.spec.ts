import { test,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.beforeEach(async ({page})=>{
  await page.route('**/api/v1/settings/public',r=>r.fulfill({json:{displayName:'Conecta Infusion',timezone:'America/Mexico_City',currency:'MXN',units:[]}}));
  await page.route('**/api/v1/studio/overview',r=>r.fulfill({json:{classes:[],products:[]}}));
  await page.route('**/api/v1/auth/session',r=>r.fulfill({status:401,json:{code:'UNAUTHENTICATED'}}));
  await page.route('**/api/v1/auth/csrf',r=>r.fulfill({json:{csrfToken:'fixture'}}));
});
for(const port of [5173,5174]) test(`${port}: bilingual recovery is keyboard accessible, safe and fits 320px`,async({page})=>{
  await page.setViewportSize({width:320,height:900});await page.goto(`http://localhost:${port}`);
  await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  const trigger=page.getByRole('button',{name:'Forgot password',exact:true});await trigger.focus();await page.keyboard.press('Enter');
  await expect(page.getByLabel('Email',{exact:true})).toBeFocused();
  await page.getByLabel('Email',{exact:true}).fill('fixture@example.test');
  await page.route('**/api/v1/auth/recovery',r=>r.fulfill({status:202,json:{code:'ACCEPTED'}}));
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.getByRole('dialog').getByRole('button',{name:'Send recovery link',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('eligible account');
  await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('reset removes secrets from URLs, requires matching strong passwords, handles failure and rejects unsafe purposes',async({page})=>{
  let calls=0;await page.route('**/api/v1/auth/recovery/reset',r=>{calls++;return r.fulfill({status:calls===1?503:200,json:calls===1?{raw:'private'}:{code:'PASSWORD_RESET'}});});
  await page.goto('http://localhost:5173/auth/action?redirect=https://evil.example#purpose=password_reset&token='+ 'x'.repeat(43));
  await expect(page).toHaveURL('http://localhost:5173/auth/action');expect(calls).toBe(0);
  await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  const password=page.getByLabel('New password',{exact:true});const confirm=page.getByLabel('Confirm password',{exact:true});
  await password.fill('short');await confirm.fill('short');await page.getByRole('button',{name:'Reset password',exact:true}).click();expect(calls).toBe(0);
  await password.fill('A strong replacement password');await confirm.fill('A different replacement password');await page.getByRole('button',{name:'Reset password',exact:true}).click();expect(calls).toBe(0);
  await confirm.fill('A strong replacement password');await page.getByRole('button',{name:'Reset password',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('try again');await expect(password).toHaveValue('');await expect(confirm).toHaveValue('');
  await password.fill('A strong replacement password');await confirm.fill('A strong replacement password');await page.getByRole('button',{name:'Reset password',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Sign in again');await expect(page.getByRole('link',{name:'Sign in',exact:true})).toHaveAttribute('href','/');
  await page.goto('http://localhost:5173/auth/action#purpose=family_invitation&token='+ 'x'.repeat(43));await expect(page.getByRole('alert')).toContainText('supported');expect(calls).toBe(2);
});
test('replacement reset link cancels pending work and cannot inherit an old completion',async({page})=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});const tokens:string[]=[];
  await page.route('**/api/v1/auth/recovery/reset',async r=>{tokens.push(r.request().postDataJSON().token);if(tokens.length===1)await gate;await r.fulfill({json:{code:'PASSWORD_RESET'}});});
  await page.goto('http://localhost:5173/auth/action#purpose=password_reset&token='+ 'x'.repeat(43));await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  async function fill(){await page.getByLabel('New password',{exact:true}).fill('A strong replacement password');await page.getByLabel('Confirm password',{exact:true}).fill('A strong replacement password');}
  await fill();await page.getByRole('button',{name:'Reset password',exact:true}).click();await expect(page.getByRole('button',{name:'Resetting…',exact:true})).toBeDisabled();
  await page.goto('http://localhost:5173/auth/action#purpose=password_reset&token='+ 'y'.repeat(43));release();
  await expect(page).toHaveURL('http://localhost:5173/auth/action');await expect(page.getByLabel('New password',{exact:true})).toHaveValue('');
  await expect(page.getByRole('status')).toHaveCount(0);await fill();await page.getByRole('button',{name:'Reset password',exact:true}).click();await expect(page.getByRole('status')).toContainText('Sign in again');
  expect(tokens).toEqual(['x'.repeat(43),'y'.repeat(43)]);
});
test('invalid reset link offers another request, refresh has no token and recovery throttling stays generic',async({page})=>{
  await page.route('**/api/v1/auth/recovery/reset',r=>r.fulfill({status:400,json:{code:'INVALID_ACTION'}}));
  await page.goto('http://localhost:5174/auth/action#purpose=password_reset&token='+ 'x'.repeat(43));await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  await page.getByLabel('New password',{exact:true}).fill('A strong replacement password');await page.getByLabel('Confirm password',{exact:true}).fill('A strong replacement password');await page.getByRole('button',{name:'Reset password',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('expired');await page.getByRole('button',{name:'Forgot password',exact:true}).click();
  await page.route('**/api/v1/auth/recovery',r=>r.fulfill({status:429,json:{code:'THROTTLED',raw:'private'}}));await page.getByLabel('Email',{exact:true}).fill('fixture@example.test');await page.getByRole('button',{name:'Send recovery link',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Too many');await expect(page.getByRole('dialog')).not.toContainText('private');
  await page.reload();await expect(page.getByLabel('New password',{exact:true})).toHaveCount(0);
});
for(const width of [360,768,1440])test(`reset is accessible and fits ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await page.goto('http://localhost:5173/auth/action#purpose=password_reset&token='+ 'x'.repeat(43));
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width===360)await page.screenshot({path:'test-results/reset-es-360.png'});
});
