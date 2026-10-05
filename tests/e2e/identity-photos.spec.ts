import {test,expect} from '@playwright/test';
const id='11111111-1111-4111-a111-111111111111';
test('photo upload blocks dismissal, rejects oversized files locally and safely reports failures',async({page})=>{
  const profile={id,personId:id,email:'photo@example.test',fullName:'Photo Customer',preferredLocale:'es-MX',roles:['customer'],phone:null,photoId:null,status:'active',profileStatus:'active',confirmationStatus:'verified'};
  await page.route('**/api/v1/settings/public',r=>r.fulfill({json:{displayName:'Conecta Infusion',currency:'MXN',timezone:'America/Mexico_City',units:[],supportedLocales:['es-MX','en'],defaultLocale:'es-MX'}}));
  await page.route('**/api/v1/studio/overview',r=>r.fulfill({json:{classes:[],products:[]}}));
  await page.route('**/auth/session',r=>r.fulfill({json:{account:profile,csrfToken:'session-csrf',authenticatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()}}));
  await page.route('**/api/v1/me',r=>r.fulfill({json:profile}));
  await page.goto('http://localhost:5173');await page.getByLabel('Idioma',{exact:true}).selectOption('en');await page.getByRole('button',{name:'My account',exact:true}).click();await page.getByRole('button',{name:'Edit my profile',exact:true}).click();
  const input=page.getByLabel('Profile photo',{exact:true}),save=page.getByRole('button',{name:'Save photo',exact:true});
  let calls=0,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/v1/me/photo',async r=>{calls++;await gate;await r.fulfill({status:503,json:{code:'UNAVAILABLE',private:'private filesystem path'}});});
  await input.setInputFiles({name:'large.png',mimeType:'image/png',buffer:Buffer.alloc(5*1024*1024+1)});await save.click();await expect(page.getByRole('alert')).toContainText('allowed format');expect(calls).toBe(0);
  await input.setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('test')});await save.click();await expect.poll(()=>calls).toBe(1);
  await expect(page.getByRole('button',{name:'Close',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Save profile',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();release();await expect(page.getByRole('alert')).toContainText('Reopen the profile');expect(calls).toBe(1);await expect(page.getByText('private filesystem path')).toHaveCount(0);
});
