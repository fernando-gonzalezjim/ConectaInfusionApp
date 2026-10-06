import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const id='11111111-1111-4111-a111-111111111111';
const profileId='22222222-2222-4222-a222-222222222222';
const account={id,personId:id,email:'guardian@example.test',fullName:'Fictional guardian',roles:['customer'],preferredLocale:'es-MX'};
test.beforeEach(async({page})=>{
  page.on('pageerror',error=>{throw error;});
  await page.route('**/api/v1/settings/public',r=>r.fulfill({json:{displayName:'Conecta Infusion',currency:'MXN',timezone:'America/Mexico_City',units:[]}}));
  await page.route('**/api/v1/studio/overview',r=>r.fulfill({json:{classes:[],products:[]}}));
  await page.route('**/api/v1/auth/session',r=>r.fulfill({json:{account,csrfToken:'session-csrf'}}));
});

test('failed child reads stay unknown; refresh recovers without displaying raw errors',async({page})=>{
  let available=false;await page.route('**/api/v1/child-details**',r=>r.fulfill(available?{json:{items:[],nextCursor:null}}:{status:503,json:{raw:'SQL secret'}}));
  await page.goto('http://localhost:5173');await page.getByLabel('Idioma',{exact:true}).selectOption('en');await page.getByRole('button',{name:'Children and dependents',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog.getByRole('alert')).toContainText('could not load');await expect(dialog.getByRole('button',{name:'Save child details',exact:true})).toHaveCount(0);await expect(dialog).not.toContainText('SQL secret');
  available=true;await dialog.getByRole('button',{name:'Refresh children',exact:true}).click();await expect(dialog.getByRole('button',{name:'Save child details',exact:true})).toBeEnabled();
});

test('uncertain create is not retried; pending operation blocks dismissal and recovers deliberately',async({page})=>{
  let writes=0;let release:()=>void=()=>{};const blocked=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/v1/child-details**',async r=>{if(r.request().method()==='GET')return r.fulfill({json:{items:[],nextCursor:null}});writes++;await blocked;return r.fulfill({status:503,json:{raw:'private database'}});});
  await page.goto('http://localhost:5173');await page.getByLabel('Idioma',{exact:true}).selectOption('en');await page.getByRole('button',{name:'Children and dependents',exact:true}).click();const dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'Save child details',exact:true}).click();await dialog.getByLabel("Child's name",{exact:true}).fill('Fictional child');await dialog.getByLabel('Age (text)',{exact:true}).fill('8');await dialog.getByRole('button',{name:'Save details',exact:true}).click();
  await expect.poll(()=>writes).toBe(1);await expect(dialog.getByRole('button',{name:'Close',exact:true})).toBeDisabled();await page.keyboard.press('Escape');await expect(dialog).toBeVisible();
  release();await expect(dialog.getByRole('alert')).toContainText('could not confirm');await expect(dialog.getByRole('button',{name:'Save details',exact:true})).toBeDisabled();expect(writes).toBe(1);await expect(dialog).not.toContainText('private database');
  await dialog.getByRole('button',{name:'Refresh children',exact:true}).click();await expect(dialog.getByRole('button',{name:'Save child details',exact:true})).toBeEnabled();expect(writes).toBe(1);
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'Children and dependents',exact:true})).toBeFocused();
});

test('profile conflicts require fresh reads; access loss clears private data',async({page})=>{
  let revision=0,writes=0,denied=false;const profile={id:profileId,fullName:'Existing child',ageText:'8',preferredLocale:'es-MX',guardians:[{accountId:id,fullName:account.fullName}]};
  await page.route('**/api/v1/child-details**',r=>r.fulfill({json:{items:[],nextCursor:null}}));
  await page.route('**/api/v1/dependents**',r=>{if(r.request().method()==='GET')return r.fulfill(denied?{status:401,json:{code:'UNAUTHENTICATED'}}:{json:{items:[{...profile,version:revision}],nextCursor:null}});writes++;return r.fulfill({status:409,json:{code:'CONFLICT'}});});
  await page.goto('http://localhost:5173');await page.getByLabel('Idioma',{exact:true}).selectOption('en');await page.getByRole('button',{name:'Children and dependents',exact:true}).click();const dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'Dependent profiles',exact:true}).click();await dialog.getByRole('button',{name:/^Edit profile:/}).click();await dialog.getByRole('button',{name:'Save profile',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('details changed');await expect(dialog.getByRole('button',{name:'Save profile',exact:true})).toBeDisabled();expect(writes).toBe(1);
  revision=1;await dialog.getByRole('button',{name:'Refresh children',exact:true}).click();await expect(dialog.getByRole('heading',{name:'Existing child',exact:true})).toBeVisible();
  denied=true;await dialog.getByRole('button',{name:'Refresh children',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByText('Existing child',{exact:true})).toHaveCount(0);
});

test('saved child pagination and linked-detail edits never offer duplicate conversion',async({page})=>{
  const child={id,childName:'Linked child',ageText:'8',dependentPersonId:profileId,version:2};let writes=0;
  await page.route('**/api/v1/child-details**',r=>{if(r.request().method()==='POST'){writes++;expect(r.request().postDataJSON()).toEqual({childName:'Edited details',ageText:'9',expectedVersion:2});return r.fulfill({json:{...child,childName:'Edited details',ageText:'9',version:3}});}const cursor=new URL(r.request().url()).searchParams.get('cursor');return r.fulfill({json:{items:cursor?[{...child,id:profileId,childName:'Second page'}]:[child],nextCursor:cursor?null:id}});});
  await page.goto('http://localhost:5173');await page.getByLabel('Idioma',{exact:true}).selectOption('en');await page.getByRole('button',{name:'Children and dependents',exact:true}).click();const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('button',{name:/^Convert to profile:/})).toHaveCount(0);await dialog.getByRole('button',{name:'Next',exact:true}).click();await expect(dialog.getByRole('heading',{name:'Second page',exact:true})).toBeVisible();await dialog.getByRole('button',{name:'Previous',exact:true}).click();
  await dialog.getByRole('button',{name:/^Edit details:/}).click();await expect(dialog).toContainText('does not change the linked profile');await dialog.getByLabel("Child's name",{exact:true}).fill('Edited details');await dialog.getByLabel('Age (text)',{exact:true}).fill('9');await dialog.getByRole('button',{name:'Save details',exact:true}).click();await expect.poll(()=>writes).toBe(1);
});
for(const locale of ['es-MX','en'])for(const width of [360,1440])test(`${locale} at ${width}: saves child details, converts deliberately and edits authorized profile`,async({page})=>{
  await page.setViewportSize({width,height:900});const en=locale==='en';let child:any=null,profile:any=null,conversions=0;
  await page.route('**/api/v1/child-details**',r=>{
    const request=r.request(),path=new URL(request.url()).pathname;
    if(request.method()==='GET')return r.fulfill({json:{items:child?[child]:[],nextCursor:null}});
    expect(request.headers()['x-csrf-token']).toBe('session-csrf');
    if(path.endsWith('/convert')){conversions++;profile={id:profileId,fullName:child.childName,ageText:child.ageText,preferredLocale:locale,version:0,guardians:[{accountId:id,fullName:account.fullName},{accountId:'33333333-3333-4333-a333-333333333333',fullName:'Second authorized guardian'}]};child={...child,dependentPersonId:profileId,version:child.version+1};return r.fulfill({status:201,json:{child,dependent:profile}});}
    child={id,...request.postDataJSON(),dependentPersonId:null,version:0};return r.fulfill({status:201,json:child});
  });
  await page.route('**/api/v1/dependents**',r=>{if(r.request().method()==='GET')return r.fulfill({json:{items:profile?[profile]:[],nextCursor:null}});expect(r.request().postDataJSON().expectedVersion).toBe(0);profile={...profile,...r.request().postDataJSON(),version:1};return r.fulfill({json:profile});});
  await page.goto('http://localhost:5173');await page.getByLabel('Idioma',{exact:true}).selectOption(locale);
  await page.getByRole('button',{name:en?'Children and dependents':'Menores y dependientes',exact:true}).click();const dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:en?'Save child details':'Guardar datos de un menor',exact:true}).click();
  await dialog.getByLabel(en?"Child's name":'Nombre del menor',{exact:true}).fill('Demo child');await dialog.getByLabel(en?'Age (text)':'Edad (texto)',{exact:true}).fill('8');
  await dialog.getByRole('button',{name:en?'Save details':'Guardar datos',exact:true}).click();await expect(dialog.getByRole('heading',{name:'Demo child',exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:en?/^Convert to profile:/ :/^Convertir a perfil:/}).click();expect(conversions).toBe(0);
  await dialog.getByRole('button',{name:en?'Create profile and become guardian':'Crear perfil y ser tutor',exact:true}).click();await expect.poll(()=>conversions).toBe(1);
  await dialog.getByRole('button',{name:en?'Dependent profiles':'Perfiles de dependientes',exact:true}).click();await expect(dialog.getByText(account.fullName,{exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:en?/^Edit profile:/ :/^Editar perfil:/}).click();await dialog.getByLabel(en?"Child's name":'Nombre del menor',{exact:true}).fill('Edited child');
  await dialog.getByRole('button',{name:en?'Save profile':'Guardar perfil',exact:true}).click();await expect(dialog.getByRole('heading',{name:'Edited child',exact:true})).toBeVisible();
  await expect(dialog).toContainText(en?'Child bookings are not available yet.':'Las reservaciones para menores todavía no están disponibles.');
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(dialog.getByText('Second authorized guardian',{exact:true})).toBeVisible();await page.screenshot({path:`.local/i30-dependent-${locale}-${width}.png`});
});

test('direct dependent creation sends only profile fields and selected locale',async({page})=>{
  let profile:any=null;await page.route('**/api/v1/child-details**',r=>r.fulfill({json:{items:[],nextCursor:null}}));
  await page.route('**/api/v1/dependents**',r=>{if(r.request().method()==='GET')return r.fulfill({json:{items:profile?[profile]:[],nextCursor:null}});expect(r.request().postDataJSON()).toEqual({fullName:'Direct profile',ageText:'10 years',preferredLocale:'en'});profile={id:profileId,...r.request().postDataJSON(),version:0,guardians:[{accountId:id,fullName:account.fullName}]};return r.fulfill({status:201,json:profile});});
  await page.goto('http://localhost:5173');await page.getByLabel('Idioma',{exact:true}).selectOption('en');await page.getByRole('button',{name:'Children and dependents',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Dependent profiles',exact:true}).click();await dialog.getByRole('button',{name:'Create dependent profile',exact:true}).click();
  await dialog.getByLabel("Child's name",{exact:true}).fill('Direct profile');await dialog.getByLabel('Age (text)',{exact:true}).fill('10 years');await dialog.getByLabel('Profile language',{exact:true}).selectOption('en');await dialog.getByRole('button',{name:'Save profile',exact:true}).click();await expect(dialog.getByRole('heading',{name:'Direct profile',exact:true})).toBeVisible();await expect(dialog).toContainText('no email, password or login');
});
