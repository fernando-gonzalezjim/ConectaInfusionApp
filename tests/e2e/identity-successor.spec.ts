import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const id='11111111-1111-4111-a111-111111111111';
const account={id,personId:id,email:'customer@example.test',fullName:'Customer',roles:['customer'],preferredLocale:'es-MX'};
const family={id,name:'Conecta family',createdByPersonId:id,responsibleMembershipId:id,status:'active',version:2};
test.beforeEach(async({page})=>{
  await page.route('**/api/v1/settings/public',r=>r.fulfill({json:{displayName:'Conecta Infusion',currency:'MXN',timezone:'America/Mexico_City',units:[]}}));
  await page.route('**/api/v1/studio/overview',r=>r.fulfill({json:{classes:[],products:[]}}));
  await page.route('**/api/v1/auth/session',r=>r.fulfill({json:{account,csrfToken:'session-csrf'}}));
  await page.route('**/api/v1/families/current',r=>r.fulfill({json:{family}}));
  await page.route('**/api/v1/families/*/responsibility',r=>r.fulfill({json:{canNominate:true}}));
  await page.route('**/api/v1/families/successor-offers/preview',r=>r.fulfill({json:{family:{id,name:family.name},expiresAt:'2026-10-11T12:00:00.000Z'}}));
});
test('responsible member offers without claiming transfer; pending mutation blocks other writes and dismissal',async({page})=>{
  let release!:()=>void;const gate=new Promise<void>(r=>release=r);let offers=0;
  await page.route('**/api/v1/families/*/successor-offers',async r=>{offers++;expect(r.request().postDataJSON()).toEqual({email:'member@example.test'});await gate;await r.fulfill({status:202,json:{code:'ACCEPTED'}});});
  await page.goto('http://localhost:5173');await page.getByLabel('Idioma',{exact:true}).selectOption('en');await page.getByRole('button',{name:'My family',exact:true}).click();
  await page.getByLabel('Successor member email',{exact:true}).fill('member@example.test');await page.getByRole('button',{name:'Offer responsibility',exact:true}).click();
  await expect(page.getByRole('button',{name:'Send family invitation',exact:true})).toBeDisabled();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();
  release();await expect(page.getByRole('dialog').getByRole('status')).toContainText('Responsibility has not changed');expect(offers).toBe(1);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});
test('ordinary members cannot nominate and failed authority reads never show a nomination form',async({page})=>{
  await page.route('**/api/v1/families/*/responsibility',r=>r.fulfill({json:{canNominate:false}}));await page.goto('http://localhost:5173');await page.getByLabel('Idioma',{exact:true}).selectOption('en');await page.getByRole('button',{name:'My family',exact:true}).click();
  await expect(page.getByText('Only the current responsible member or administration and management can offer responsibility.',{exact:true})).toBeVisible();await expect(page.getByLabel('Successor member email',{exact:true})).toHaveCount(0);
  await page.keyboard.press('Escape');await page.route('**/api/v1/families/*/responsibility',r=>r.fulfill({status:503,json:{code:'UNAVAILABLE',raw:'SQL secret'}}));await page.getByRole('button',{name:'My family',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();await expect(page.getByLabel('Successor member email',{exact:true})).toHaveCount(0);await expect(page.getByRole('dialog')).not.toContainText('SQL secret');
});
for(const port of [5173,5174])for(const decision of ['accept','decline'])test(`${port}: explicit successor ${decision} clears token and preserves distinct completion`,async({page})=>{
  let decisions=0;await page.route('**/api/v1/families/successor-offers/'+decision,r=>{decisions++;return r.fulfill({json:family});});
  await page.goto(`http://localhost:${port}/auth/action?token=unsafe#purpose=family_successor&token=`+'x'.repeat(43));await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  await expect(page).toHaveURL(`http://localhost:${port}/auth/action`);await expect(page.getByRole('heading',{name:'Group responsibility',exact:true})).toBeVisible();expect(decisions).toBe(0);
  await expect(page.getByRole('button',{name:'Accept responsibility',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Review invitation',exact:true}).click();await expect(page.getByText(family.name,{exact:true})).toBeVisible();expect(decisions).toBe(0);
  await page.getByRole('button',{name:decision==='accept'?'Accept responsibility':'Decline offer',exact:true}).click();
  await expect(page.getByRole('status')).toContainText(decision==='accept'?'You accepted group responsibility':'You declined the offer');expect(decisions).toBe(1);
  expect(await page.evaluate(()=>[...Object.values(localStorage),...Object.values(sessionStorage)].join(' '))).not.toContain('x'.repeat(43));
});
for(const decision of ['accept','decline'])test(`uncertain successor ${decision} blocks both decisions without retry`,async({page})=>{
  let attempts=0;await page.route('**/api/v1/families/successor-offers/'+decision,r=>{attempts++;return r.fulfill({status:503,json:{code:'UNAVAILABLE'}});});
  await page.goto('http://localhost:5173/auth/action#purpose=family_successor&token='+'x'.repeat(43));await page.getByLabel('Idioma',{exact:true}).selectOption('en');await page.getByRole('button',{name:'Review invitation',exact:true}).click();
  await page.getByRole('button',{name:decision==='accept'?'Accept responsibility':'Decline offer',exact:true}).click();await expect(page.getByRole('alert')).toContainText('could not confirm');
  await expect(page.getByRole('button',{name:'Accept responsibility',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Decline offer',exact:true})).toBeDisabled();expect(attempts).toBe(1);
});
for(const width of [320,768,1024,1440])test(`Spanish successor consent fits ${width}px and passes axe`,async({page})=>{
  await page.setViewportSize({width,height:1100});await page.goto('http://localhost:5173/auth/action#purpose=family_successor&token='+'x'.repeat(43));await page.getByRole('button',{name:'Revisar invitación',exact:true}).click();
  await expect(page.getByRole('button',{name:'Aceptar responsabilidad',exact:true})).toBeVisible();expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(width===320)await page.screenshot({path:'test-results/successor-es-320.png'});
});
