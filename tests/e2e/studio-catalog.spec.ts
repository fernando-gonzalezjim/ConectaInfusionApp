import {test,expect} from '@playwright/test';
import {es,en} from '../../packages/i18n/src/messages';
const firstId='11111111-1111-4111-8111-111111111111',newId='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const actor={id:firstId,personId:firstId,email:'manager@example.test',fullName:'Manager',preferredLocale:'en',roles:['manager']};
const discipline={id:firstId,nameEs:'Yoga',nameEn:null,descriptionEs:'Yoga',descriptionEn:null,status:'published',version:1};
const facts={disciplineId:firstId,nameEn:null,descriptionEs:'',descriptionEn:null,status:'draft',version:1,audience:'adults',minAge:null,maxAge:null,level:'all',color:'#123456',durationMinutes:55};
test('creating a class beyond the existing cursor never duplicates it when loading the next page',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/v1/settings/public',r=>r.fulfill({json:{displayName:'Conecta Infusion',currency:'MXN',timezone:'America/Mexico_City',units:[]}}));
 await page.route('**/api/v1/auth/session',r=>r.fulfill({json:{account:actor,csrfToken:'fresh'}}));
 await page.route('**/api/v1/management/access',r=>r.fulfill({json:{account:actor,capabilities:{administerIdentity:true}}}));
 await page.route('**/api/v1/accounts?*',r=>r.fulfill({json:{accounts:[],nextCursor:null}}));
 await page.route('**/api/v1/audit?*',r=>r.fulfill({json:{events:[],nextCursor:null}}));
 await page.route('**/api/v1/management/studio/disciplines?*',r=>r.fulfill({json:{items:[discipline],nextCursor:null}}));
 await page.route('**/api/v1/management/studio/instructors?*',r=>r.fulfill({json:{items:[],nextCursor:null}}));
 await page.route('**/api/v1/management/studio/instructors/candidates?*',r=>r.fulfill({json:{items:[],nextCursor:null}}));
 const first={...facts,id:firstId,nameEs:'First class'},created={...facts,id:newId,nameEs:'New cursor class'};let moreCalls=0;
 await page.route('**/api/v1/management/studio/classes?*',r=>{
  const next=new URL(r.request().url()).searchParams.has('cursor');if(next)moreCalls++;
  return r.fulfill({json:{items:next?[created]:[first],nextCursor:next?null:firstId}});
 });
 await page.route('**/api/v1/management/studio/classes',r=>r.fulfill({json:created}));
 await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption('en');
 const region=page.getByRole('region',{name:'Studio classes',exact:true});const add=region.getByRole('button',{name:'New class',exact:true});
 await expect(add).toBeEnabled();await add.click();const form=region.getByRole('form',{name:'Class details',exact:true});
 await form.getByLabel('Spanish name',{exact:true}).fill(created.nameEs);await form.getByRole('button',{name:'Save class',exact:true}).click();await expect(form).toHaveCount(0);
 await expect(region.getByRole('article').filter({hasText:created.nameEs})).toHaveCount(1);
 await region.getByRole('button',{name:'Load more',exact:true}).click();await expect.poll(()=>moreCalls).toBe(1);
 await expect(region.getByRole('button',{name:'Load more',exact:true})).toHaveCount(0);
 await expect(region.getByRole('article').filter({hasText:created.nameEs})).toHaveCount(1);await expect(region.getByRole('article')).toHaveCount(2);expect(errors).toEqual([]);
});

async function publicShell(page:import('@playwright/test').Page){
 await page.route('**/api/v1/settings/public',r=>r.fulfill({json:{displayName:'Conecta Infusion',currency:'MXN',timezone:'America/Mexico_City',units:[]}}));
 await page.route('**/api/v1/auth/session',r=>r.fulfill({status:401,json:{code:'UNAUTHENTICATED'}}));
 await page.route('**/api/v1/studio/overview',r=>r.fulfill({json:{mode:'live',classes:[],products:[]}}));
}
const publicClass={id:newId,discipline:{id:firstId,name:'Disciplina española',description:'Descripción de la disciplina'},name:'Clase española',description:'Descripción española publicada',audience:'children',minAge:6,maxAge:12,level:'intermediate',color:'#654321',durationMinutes:55,instructors:[{id:firstId,publicName:'Nombre aprobado',biography:'Biografía española',photo:null}]};
for(const locale of ['es-MX','en'] as const)test(`${locale} public loading, safe errors, retry, empty selection and fallback detail focus`,async({page})=>{
 const t=locale==='en'?en:es;await publicShell(page);await page.addInitScript(value=>localStorage.setItem('conecta.locale',value),locale);
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let phase:'failure'|'empty'|'published'='failure',detailFails=true;
 await page.route('**/api/v1/studio/catalog/disciplines?*',r=>r.fulfill({json:{items:[publicClass.discipline],nextCursor:null}}));
 await page.route('**/api/v1/studio/catalog/classes?*',async r=>{if(phase==='failure'){await gate;return r.fulfill({status:503,json:{code:'UNAVAILABLE',private:'PRIVATE database text'}});}return r.fulfill({json:{items:phase==='empty'?[]:[publicClass],nextCursor:null}});});
 await page.route(`**/api/v1/studio/catalog/classes/${newId}?*`,r=>r.fulfill(detailFails?{status:503,json:{code:'UNAVAILABLE',private:'PRIVATE detail text'}}:{json:publicClass}));
 await page.goto('http://localhost:5173');const region=page.getByRole('region',{name:t.catalogDiscover,exact:true});
 await expect(region.getByRole('status')).toContainText(t.loading);await expect(region.getByText(t.catalogPublicEmpty,{exact:true})).toHaveCount(0);
 release();await expect(region.getByRole('alert')).toContainText(t.catalogPublicUnavailable);await expect(region).not.toContainText('PRIVATE');
 phase='empty';await region.getByRole('button',{name:t.retry,exact:true}).click();await expect(region.getByText(t.catalogPublicEmpty,{exact:true})).toBeVisible();await expect(region.getByRole('alert')).toHaveCount(0);
 phase='published';await region.getByLabel(t.catalogDiscipline,{exact:true}).selectOption(firstId);
 const article=region.getByRole('article').filter({hasText:'Clase española'});await expect(article).toHaveCount(1);
 const button=article.getByRole('button',{name:t.catalogViewClass,exact:true});await button.focus();await page.keyboard.press('Enter');
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('alert')).toContainText(t.catalogPublicUnavailable);await expect(dialog).not.toContainText('PRIVATE');
 detailFails=false;await dialog.getByRole('button',{name:t.retry,exact:true}).click();await expect(dialog.getByText(publicClass.description,{exact:true})).toBeVisible();await expect(dialog.getByText('Biografía española',{exact:true})).toBeVisible();
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(button).toBeFocused();
});

test('a delayed earlier discipline selection cannot replace newer public classes',async({page})=>{
 await publicShell(page);await page.addInitScript(()=>localStorage.setItem('conecta.locale','en'));
 const secondId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';let release!:()=>void,handled!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;}),done=new Promise<void>(resolve=>{handled=resolve;});let started=false;
 await page.route('**/api/v1/studio/catalog/disciplines?*',r=>r.fulfill({json:{items:[publicClass.discipline,{id:secondId,name:'Second discipline',description:'Second'}],nextCursor:null}}));
 await page.route('**/api/v1/studio/catalog/classes?*',async r=>{const selected=new URL(r.request().url()).searchParams.get('disciplineId');
  if(selected===firstId){started=true;await gate;await r.fulfill({json:{items:[{...publicClass,name:'Stale first discipline'}],nextCursor:null}});handled();return;}
  return r.fulfill({json:{items:selected===secondId?[{...publicClass,name:'Newest second discipline'}]:[],nextCursor:null}});
 });
 await page.goto('http://localhost:5173');const region=page.getByRole('region',{name:'Explore our classes',exact:true}),filter=region.getByLabel('Discipline',{exact:true});
 await expect(region.getByText(en.catalogPublicEmpty,{exact:true})).toBeVisible();await filter.selectOption(firstId);await expect.poll(()=>started).toBe(true);
  await expect(filter.getByRole('option',{name:'Second discipline',exact:true})).toHaveCount(1);
 await filter.selectOption(secondId);await expect(region.getByRole('heading',{name:'Newest second discipline',exact:true})).toBeVisible();release();await done;
 await expect(filter).toHaveValue(secondId);await expect(region.getByRole('heading',{name:'Newest second discipline',exact:true})).toBeVisible();await expect(region.getByText('Stale first discipline',{exact:true})).toHaveCount(0);
});

test('cancel during a delayed discipline refresh restores class creation focus when both lists finish',async({page})=>{
 await page.route('**/api/v1/settings/public',r=>r.fulfill({json:{displayName:'Conecta Infusion',currency:'MXN',timezone:'America/Mexico_City',units:[]}}));
 await page.route('**/api/v1/auth/session',r=>r.fulfill({json:{account:actor,csrfToken:'fresh'}}));
 await page.route('**/api/v1/management/access',r=>r.fulfill({json:{account:actor,capabilities:{administerIdentity:true}}}));
 await page.route('**/api/v1/accounts?*',r=>r.fulfill({json:{accounts:[],nextCursor:null}}));await page.route('**/api/v1/audit?*',r=>r.fulfill({json:{events:[],nextCursor:null}}));
 await page.route('**/api/v1/management/studio/instructors?*',r=>r.fulfill({json:{items:[],nextCursor:null}}));await page.route('**/api/v1/management/studio/instructors/candidates?*',r=>r.fulfill({json:{items:[],nextCursor:null}}));
 await page.route('**/api/v1/management/studio/classes?*',r=>r.fulfill({json:{items:[],nextCursor:null}}));
 let hold=false,release!:()=>void,handled!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),done=new Promise<void>(resolve=>{handled=resolve;});
 await page.route('**/api/v1/management/studio/disciplines?*',async r=>{if(hold)await gate;await r.fulfill({json:{items:[discipline],nextCursor:null}});if(hold)handled();});
 await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption('en');
 const region=page.getByRole('region',{name:'Studio classes',exact:true}),button=region.getByRole('button',{name:'New class',exact:true});
 await expect(button).toBeEnabled();await button.click();const form=region.getByRole('form',{name:'Class details',exact:true});hold=true;
 await region.getByRole('button',{name:'Refresh catalog',exact:true}).click();await expect(form.getByRole('button',{name:'Save class',exact:true})).toBeDisabled();
 await form.getByRole('button',{name:'Cancel',exact:true}).click();await expect(form).toHaveCount(0);await expect(button).toBeDisabled();release();await done;
 await expect(button).toBeEnabled();await expect(button).toBeFocused();
});

test('a portrait read released after logout cannot obtain new session authority or upload',async({page})=>{
 await page.addInitScript(()=>{
  const state=window as unknown as {catalogPortraitReadStarted?:boolean;catalogReleasePortrait?:()=>void;catalogPortraitReadAborted?:boolean};
  FileReader.prototype.readAsDataURL=function(){
   Object.defineProperty(this,'result',{value:'data:image/png;base64,aGVsbG8=',configurable:true});
   state.catalogPortraitReadStarted=true;
   state.catalogReleasePortrait=()=>this.onload?.call(this,new ProgressEvent('load'));
  };
  FileReader.prototype.abort=function(){state.catalogPortraitReadAborted=true;};
 });
 let sessionCalls=0,photoCalls=0,signedOut=false;
 await page.route('**/api/v1/settings/public',r=>r.fulfill({json:{displayName:'Conecta Infusion',currency:'MXN',timezone:'America/Mexico_City',units:[]}}));
 await page.route('**/api/v1/auth/session',r=>{sessionCalls++;return r.fulfill({json:{account:signedOut?{...actor,id:newId,email:'another-manager@example.test'}:actor,csrfToken:signedOut?'new-account-authority':'fresh'}});});
 await page.route('**/api/v1/auth/logout',r=>{signedOut=true;return r.fulfill({status:204});});
 await page.route('**/api/v1/management/access',r=>r.fulfill({json:{account:actor,capabilities:{administerIdentity:true}}}));
 await page.route('**/api/v1/accounts?*',r=>r.fulfill({json:{accounts:[],nextCursor:null}}));await page.route('**/api/v1/audit?*',r=>r.fulfill({json:{events:[],nextCursor:null}}));
 await page.route('**/api/v1/management/studio/disciplines?*',r=>r.fulfill({json:{items:[discipline],nextCursor:null}}));
 await page.route('**/api/v1/management/studio/classes?*',r=>r.fulfill({json:{items:[],nextCursor:null}}));
 const profile={instructorId:firstId,publicName:'Public portrait instructor',biographyEs:null,biographyEn:null,status:'published',version:1,disciplineIds:[firstId],photo:null};
 await page.route('**/api/v1/management/studio/instructors?*',r=>r.fulfill({json:{items:[profile],nextCursor:null}}));
 await page.route('**/api/v1/management/studio/instructors/candidates?*',r=>r.fulfill({json:{items:[],nextCursor:null}}));
 await page.route(`**/api/v1/management/studio/instructors/${firstId}/photo`,r=>{photoCalls++;return r.fulfill({json:{...profile,version:2}});});
 await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption('en');
 const region=page.getByRole('region',{name:'Instructor public information',exact:true});const edit=region.getByRole('button',{name:'Edit public information',exact:true});await expect(edit).toBeEnabled();await edit.click();
 const form=region.getByRole('form',{name:'Instructor public details',exact:true});
 await form.getByLabel('Public photo file',{exact:true}).setInputFiles({name:'fictional.png',mimeType:'image/png',buffer:Buffer.from('read held for account boundary')});
 await form.getByLabel('Spanish alternative text',{exact:true}).fill('Approved fictional portrait');await form.getByRole('button',{name:'Approve public photo',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {catalogPortraitReadStarted?:boolean}).catalogPortraitReadStarted)).toBe(true);
 await page.getByRole('button',{name:'My account',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Sign out',exact:true}).click();
 await expect(region).toHaveCount(0);const beforeRelease=sessionCalls;
 const released=await page.evaluate(async()=>{
  const state=window as unknown as {catalogReleasePortrait?:()=>void;catalogPortraitReadAborted?:boolean};state.catalogReleasePortrait?.();
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));return state.catalogPortraitReadAborted;
 });
 expect(released).toBe(true);expect(photoCalls).toBe(0);expect(sessionCalls).toBe(beforeRelease);
});
