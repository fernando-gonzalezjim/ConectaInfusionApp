import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const id='11111111-1111-4111-a111-111111111111';
const row={id,occurredAt:'2026-10-04T12:00:00.000001Z',actorType:'staff',actorId:id,actorName:'Demo Manager',action:'account.profile_updated',targetType:'account',targetId:id,targetName:'Demo Customer',businessUnit:null,correctionOf:null,changes:{before:{fullName:'Before'},after:{fullName:'After',password:'private secret'}}};
async function setup(page:import('@playwright/test').Page,role:string){
  const account={id,personId:id,email:'demo@example.test',fullName:'Demo Manager',roles:[role],preferredLocale:'es-MX'};
  await page.route('**/settings/public',r=>r.fulfill({json:{displayName:'Conecta Infusion',currency:'MXN',timezone:'America/Mexico_City',units:[],supportedLocales:['es-MX','en'],defaultLocale:'es-MX'}}));
  await page.route('**/auth/session',r=>r.fulfill({json:{account,csrfToken:'session-csrf',authenticatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()}}));
  await page.route('**/management/access',r=>r.fulfill(role==='manager'?{json:{account,capabilities:{administerIdentity:true}}}:{status:403,json:{code:'FORBIDDEN'}}));
  await page.route('**/accounts?*',r=>r.fulfill({json:{accounts:[],nextCursor:null}}));
}
for(const [english,width] of [[false,360],[false,768],[true,1440]] as const)test(`bilingual audit pagination, details and recovery at ${width}`,async({page})=>{
  await setup(page,'manager');await page.setViewportSize({width,height:1000});let fail=false,calls=0;
  await page.route('**/audit?*',r=>{calls++;return r.fulfill(fail?{status:503,json:{code:'UNAVAILABLE',private:'server secret'}}:{json:{events:[{...row,targetName:r.request().url().includes('cursor=')?'Second Customer':'Demo Customer'}],nextCursor:r.request().url().includes('cursor=')?null:'next_page'}});});
  await page.goto('http://localhost:5174');if(english)await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  const region=page.getByRole('region',{name:english?'Operational history':'Historial operativo'});await expect(region).toBeVisible();expect(calls).toBe(0);
  await region.getByRole('button',{name:english?'View history':'Ver historial',exact:true}).click();await expect(region.getByText('Demo Customer',{exact:true})).toBeVisible();
  await region.locator('summary').click();await expect(region.getByRole('definition').filter({hasText:/^After$/})).toBeVisible();await expect(page.getByText('private secret')).toHaveCount(0);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await region.screenshot({path:`test-results/identity-audit-${width}.png`});
  await region.getByRole('button',{name:english?'Next':'Siguiente',exact:true}).click();await expect(region.getByText('Second Customer',{exact:true})).toBeVisible();
  fail=true;await region.getByRole('button',{name:english?'Refresh history':'Actualizar historial'}).click();await expect(region.getByRole('alert')).toContainText(english?'Could not load':'No pudimos cargar');
  fail=false;await region.getByRole('button',{name:english?'Try again':'Intentar de nuevo',exact:true}).click();await expect(region.getByText('Demo Customer',{exact:true})).toBeVisible();
});
test('ordinary staff cannot open the operational audit',async({page})=>{await setup(page,'instructor');await page.goto('http://localhost:5174');await expect(page.getByText(/Tu cuenta no tiene/)).toBeVisible();await expect(page.getByRole('heading',{name:'Historial operativo'})).toHaveCount(0);});
for(const english of [false,true])test(`lifecycle and dependent deactivation audit labels in ${english?'English':'Spanish'}`,async({page})=>{
  await setup(page,'manager');await page.route('**/audit?*',r=>r.fulfill({json:{events:[{...row,action:'identity.lifecycle_applied',targetType:'lifecycle_operation',changes:{before:null,after:{personId:id}}},{...row,id:'22222222-2222-4222-a222-222222222222',action:'dependent.deactivated',targetType:'dependent',changes:{before:{personId:id},after:{personId:id}}}],nextCursor:null}}));
  await page.goto('http://localhost:5174');if(english)await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  const region=page.getByRole('region',{name:english?'Operational history':'Historial operativo'});await region.getByRole('button',{name:english?'View history':'Ver historial',exact:true}).click();
  await expect(region.getByText(english?'Lifecycle operation completed':'Operación de ciclo de vida completada',{exact:true})).toBeVisible();await expect(region.getByText(english?'Dependent profile deactivated':'Perfil dependiente desactivado',{exact:true})).toBeVisible();
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});

for(const english of [false,true])test(`guardian reactivation audit labels in ${english?'English':'Spanish'}`,async({page})=>{
  await setup(page,'manager');await page.route('**/audit?*',r=>r.fulfill({json:{events:['dependent.reactivation_invited','dependent.reactivation_accepted','dependent.reactivated'].map((action,index)=>({...row,id:`22222222-2222-4222-a222-22222222222${index}`,action,targetType:'dependent',changes:{before:null,after:{personId:id}}})),nextCursor:null}}));
  await page.goto('http://localhost:5174');if(english)await page.getByLabel('Idioma',{exact:true}).selectOption('en');
  const region=page.getByRole('region',{name:english?'Operational history':'Historial operativo'});await region.getByRole('button',{name:english?'View history':'Ver historial',exact:true}).click();
  for(const label of english?['Guardian renewal requested','Guardian renewal accepted','Dependent profile reactivated']:['Renovaci\u00f3n de tutor\u00eda solicitada','Renovaci\u00f3n de tutor\u00eda aceptada','Perfil dependiente reactivado'])await expect(region.getByText(label,{exact:true})).toBeVisible();
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});
