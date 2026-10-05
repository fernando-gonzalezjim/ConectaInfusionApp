import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const actorId='11111111-1111-4111-a111-111111111111',targetId='22222222-2222-4222-a222-222222222222';
const actor={id:actorId,personId:actorId,email:'admin@example.test',fullName:'Administrator',preferredLocale:'es-MX',roles:['administrator']};
const target={id:targetId,personId:targetId,email:'customer@example.test',fullName:'Demo Customer',phone:null,photoId:null,preferredLocale:'es-MX',roles:['customer'],status:'active',profileStatus:'active',confirmationStatus:'exempt'};
test.beforeEach(async({page})=>{
  await page.route('**/api/v1/settings/public',r=>r.fulfill({json:{displayName:'Conecta Infusion',currency:'MXN',timezone:'America/Mexico_City',units:[]}}));
  await page.route('**/api/v1/auth/session',r=>r.fulfill({json:{account:actor,csrfToken:'fresh'}}));
  await page.route('**/api/v1/management/access',r=>r.fulfill({json:{account:actor,capabilities:{administerIdentity:true}}}));
  await page.route('**/api/v1/accounts?*',r=>r.fulfill({json:{accounts:[target],nextCursor:null}}));
});
test('management edits approved profile fields and assigns roles with customer retention',async({page})=>{
  await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  await page.getByRole('button',{name:'View account: Demo Customer'}).click();
  await page.getByLabel('Name',{exact:true}).fill('Updated customer');
  let body:unknown;
  await page.route(`**/accounts/${targetId}/profile`,r=>{body=r.request().postDataJSON();return r.fulfill({json:{...target,fullName:'Updated customer'}});});
  await page.getByRole('button',{name:'Save profile',exact:true}).click();
  await expect(page.getByText('Profile saved.',{exact:true})).toBeVisible();
  expect(body).toEqual({fullName:'Updated customer',phone:null,preferredLocale:'es-MX'});
  await expect(page.getByRole('checkbox',{name:'Customer',exact:true})).toBeDisabled();
  await page.getByRole('checkbox',{name:'Instructor',exact:true}).check();
  await page.route(`**/accounts/${targetId}/roles`,r=>{body=r.request().postDataJSON();return r.fulfill({json:{accountId:targetId,roles:['customer','instructor'],staffAttendanceEligible:true}});});
  await page.getByRole('button',{name:'Save roles',exact:true}).click();
  await expect(page.getByText('Roles saved. Changes sign this account out; unchanged roles preserve sessions.',{exact:true})).toBeVisible();
  expect(body).toEqual({roles:['instructor','customer']});
  await expect(page.getByRole('button',{name:/Delete|Deactivate|Reactivate/})).toHaveCount(0);
});
test('conflicts remain visible without exposing details or retrying role changes',async({page})=>{
  await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  await page.getByRole('button',{name:'View account: Demo Customer'}).click();
  await page.getByRole('checkbox',{name:'Instructor',exact:true}).check();
  let calls=0;await page.route(`**/accounts/${targetId}/roles`,r=>{calls++;return r.fulfill({status:409,json:{code:'CONFLICT',private:'database details'}});});
  await page.getByRole('button',{name:'Save roles',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('The roles could not be changed');
  expect(calls).toBe(1);await expect(page.getByText('database details')).toHaveCount(0);
});
test('accessible account controls fit mobile and keyboard focus returns after closing',async({page})=>{
  await page.setViewportSize({width:320,height:1000});await page.goto('http://localhost:5174');
  const trigger=page.getByRole('button',{name:'Ver cuenta: Demo Customer'});await trigger.focus();await page.keyboard.press('Enter');
  await expect(page.getByLabel('Nombre',{exact:true})).toBeFocused();
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/identity-administration-es-mobile.png'});
  await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
});

test('role and status filters reset pagination and previous pages retain their cursor',async({page})=>{
  const queries:string[]=[];
  await page.route('**/api/v1/accounts?*',r=>{
    const url=new URL(r.request().url());queries.push(url.search);
    const second=url.searchParams.has('cursor');
    return r.fulfill({json:{accounts:[{...target,fullName:second?'Second page':'First page'}],nextCursor:second?null:targetId}});
  });
  await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  await expect(page.getByText('First page',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.getByText('Second page',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Previous',exact:true}).click();await expect(page.getByText('First page',{exact:true})).toBeVisible();
  await page.getByLabel('Filter by role').selectOption('instructor');await page.getByLabel('Filter by status').selectOption('active');
  await expect.poll(()=>queries.at(-1)).toContain('role=instructor&status=active');
  expect(queries.at(-1)).not.toContain('cursor=');
});

for(const status of ['pending','inactive'] as const)test(`${status} details are editable but role controls remain unavailable`,async({page})=>{
  await page.route('**/api/v1/accounts?*',r=>r.fulfill({json:{accounts:[{...target,status,profileStatus:status==='inactive'?'inactive':'active',confirmationStatus:status==='pending'?'pending':'exempt'}],nextCursor:null}}));
  await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  await page.getByRole('button',{name:'View account: Demo Customer'}).click();
  await expect(page.getByRole('button',{name:'Save roles',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Save profile',exact:true})).toBeEnabled();
  await expect(page.getByLabel('Email',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Roles can only be changed for active accounts and profiles.')).toBeVisible();
});

for(const role of ['reception','cafe_staff','instructor','customer'])test(`${role} does not browse administration accounts`,async({page})=>{
  const user={...actor,roles:[role,'customer'].filter((item,index,array)=>array.indexOf(item)===index)};
  await page.route('**/api/v1/auth/session',r=>r.fulfill({json:{account:user,csrfToken:'fresh'}}));
  await page.route('**/api/v1/management/access',r=>r.fulfill({status:403,json:{code:'FORBIDDEN'}}));
  let reads=0;await page.route('**/api/v1/accounts?*',r=>{reads++;return r.fulfill({status:403,json:{code:'FORBIDDEN'}});});
  await page.goto('http://localhost:5174');await expect(page.getByText('Tu cuenta no tiene permisos de administración.')).toBeVisible();
  await expect(page.getByRole('button',{name:/Ver cuenta:/})).toHaveCount(0);expect(reads).toBe(0);
});

test('list failures can be retried and empty filters show an honest empty state',async({page})=>{
  let failed=true;await page.route('**/api/v1/accounts?*',r=>failed?r.fulfill({status:503,json:{raw:'private failure'}}):r.fulfill({json:{accounts:[],nextCursor:null}}));
  await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  await expect(page.getByRole('alert')).toContainText('We could not complete the request');failed=false;
  await page.getByRole('button',{name:'Try again',exact:true}).click();await expect(page.getByText('No accounts match these filters.')).toBeVisible();
  await expect(page.getByText('private failure')).toHaveCount(0);
});

for(const code of ['UNAUTHENTICATED','FORBIDDEN'] as const)test(`${code} mutation clears private administration state`,async({page})=>{
  let expired=false;
  await page.route('**/api/v1/auth/session',r=>expired?r.fulfill({status:401,json:{code:'UNAUTHENTICATED'}}):r.fulfill({json:{account:actor,csrfToken:'fresh'}}));
  await page.route(`**/accounts/${targetId}/profile`,r=>{expired=true;return r.fulfill({status:code==='UNAUTHENTICATED'?401:403,json:{code}});});
  await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  await page.getByRole('button',{name:'View account: Demo Customer'}).click();await page.getByRole('button',{name:'Save profile',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Account administration'})).toHaveCount(0);
  await expect(page.getByText('customer@example.test')).toHaveCount(0);
});

test('self role change ends the current UI session; unchanged assignment does not',async({page})=>{
  let expired=false;const own={...target,id:actorId,personId:actorId,roles:['administrator','customer']};
  await page.route('**/api/v1/accounts?*',r=>r.fulfill({json:{accounts:[own],nextCursor:null}}));
  await page.route('**/api/v1/auth/session',r=>expired?r.fulfill({status:401,json:{code:'UNAUTHENTICATED'}}):r.fulfill({json:{account:actor,csrfToken:'fresh'}}));
  await page.route(`**/accounts/${actorId}/roles`,r=>{const roles=r.request().postDataJSON().roles;expired=!roles.includes('administrator');return r.fulfill({json:{accountId:actorId,roles,staffAttendanceEligible:true}});});
  await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  await page.getByRole('button',{name:'View account: Demo Customer'}).click();await page.getByRole('button',{name:'Save roles',exact:true}).click();
  await expect(page.getByText('Roles saved. Changes sign this account out; unchanged roles preserve sessions.')).toBeVisible();
  // Radix hides background content from accessibility while its modal remains open.
  await expect(page.getByRole('heading',{name:'Account administration',includeHidden:true})).toHaveCount(1);
  await page.getByRole('checkbox',{name:'Administrator',exact:true}).uncheck();await page.getByRole('checkbox',{name:'Manager',exact:true}).check();
  await page.getByRole('button',{name:'Save roles',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();await expect(page.getByText('Your session has ended. Sign in again.')).toBeVisible();
});

test('pending mutations prevent closing; confirmed server values survive reopening',async({page})=>{
  let respond:()=>void=()=>{};let calls=0;
  await page.route(`**/accounts/${targetId}/profile`,async r=>{calls++;await new Promise<void>(resolve=>{respond=resolve;});await r.fulfill({json:{...target,fullName:'Stale response'}}).catch(()=>{});});
  await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  const trigger=page.getByRole('button',{name:'View account: Demo Customer'});await trigger.click();await page.getByLabel('Name',{exact:true}).fill('Uncommitted');
  await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect.poll(()=>calls).toBe(1);
  await expect(page.getByRole('button',{name:'Save roles',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Close',exact:true})).toBeDisabled();await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();respond();
  await expect(page.getByText('Profile saved.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'View account: Stale response'}).click();
  await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Stale response');expect(calls).toBe(1);
});

for(const width of [768,1024,1440])test(`account list and detail editor fit ${width}px in English`,async({page})=>{
  await page.setViewportSize({width,height:1000});await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.getByRole('button',{name:'View account: Demo Customer'}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/identity-administration-en-${width}.png`});
});
