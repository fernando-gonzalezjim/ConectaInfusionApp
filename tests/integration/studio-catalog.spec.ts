import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import {hashPassword} from '../../apps/api/src/modules/identity/passwords.js';
import {es,en} from '../../packages/i18n/src/messages';

const password='Real catalog batch verification password';
async function actor(pool:pg.Pool,role:string){
 const email=`catalog-${role}-${randomUUID()}@example.test`;
 const person=(await pool.query("INSERT INTO people(full_name,phone) VALUES ('Private catalog identity','PRIVATE phone') RETURNING id")).rows[0].id;
 const account=(await pool.query(`INSERT INTO accounts(person_id,email,password_hash,status,confirmation_status,email_verified_at)
 VALUES($1,$2,$3,'active','verified',now()) RETURNING id`,[person,email,await hashPassword(password)])).rows[0].id;
 await pool.query('INSERT INTO account_roles(account_id,role) VALUES($1,$2)',[account,role]);
 return {email,person,account};
}
async function login(page:Page,email:string,locale:'es-MX'|'en'){
 const text=locale==='en'?en:es;
 await page.goto('http://localhost:5174');await page.getByLabel('Idioma',{exact:true}).selectOption(locale);
 await page.getByRole('button',{name:text.signIn,exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel(text.email,{exact:true}).fill(email);
 await dialog.getByLabel(text.password,{exact:true}).fill(password);await dialog.getByRole('button',{name:text.signIn,exact:true}).click();
 await expect(dialog).toHaveCount(0);
}
async function accessible(page:Page){
 for(const width of [320,768,1440]){await page.setViewportSize({width,height:1000});
  const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth).slice(0,12).map(e=>({tag:e.tagName,text:e.textContent?.slice(0,100),className:e.className,right:e.getBoundingClientRect().right}))}));
  expect(layout.scrollWidth,JSON.stringify(layout)).toBeLessThanOrEqual(layout.width);
 }
 expect((await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
}

for(const locale of ['es-MX','en'] as const)test(`real ${locale} catalog publication, discovery, staff color and own instructor read`,async({page,browser})=>{
 test.setTimeout(90000);
 const connectionString=process.env.FOUNDATION_TEST_DATABASE_URL;
 if(connectionString!=='postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser')throw new Error('Disposable browser database required');
 const pool=new pg.Pool({connectionString}),text=locale==='en'?en:es;
 const contexts:import('@playwright/test').BrowserContext[]=[];const errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  const manager=await actor(pool,'manager'),instructor=await actor(pool,'instructor'),staff=await actor(pool,'reception');
  const instructorId=(await pool.query(`INSERT INTO instructors(full_name,person_id) VALUES('PRIVATE legacy instructor',$1) RETURNING id`,[instructor.person])).rows[0].id;
  const suffix=randomUUID().slice(0,8),disciplineName=`Disciplina de prueba ${suffix}`,className=`Clase infantil ${suffix}`,publicName=`Instructor público ${suffix}`;
  const disciplineId=(await pool.query(`INSERT INTO studio_disciplines(name_es,description_es,status) VALUES($1,'Disciplina publicada de prueba','published') RETURNING id`,[disciplineName])).rows[0].id;
  await login(page,manager.email,locale);
  const csrf=await page.evaluate(async()=>{const response=await fetch('/api/v1/auth/session');return (await response.json()).csrfToken as string;});
  const rejectedOrigin=await page.request.post('http://localhost:5174/api/v1/management/studio/classes',{headers:{Origin:'https://untrusted.example.test','X-CSRF-Token':csrf},data:{disciplineId,nameEs:'Forged origin',audience:'adults',level:'all'}});
  expect(rejectedOrigin.status()).toBe(403);
  const classes=page.getByRole('region',{name:text.catalogClasses,exact:true}),create=classes.getByRole('button',{name:text.catalogNewClass,exact:true});
  await expect(create).toBeEnabled();await create.focus();await page.keyboard.press('Enter');
  const form=classes.getByRole('form',{name:text.catalogClassForm,exact:true});
  const name=form.getByLabel(text.studioNameEs,{exact:true});await expect(name).toBeFocused();await page.keyboard.type(className);await page.keyboard.press('Tab');
  await expect(form.getByLabel(text.studioNameEn,{exact:true})).toBeFocused();
  await form.getByLabel(text.catalogDiscipline,{exact:true}).selectOption(disciplineId);
  await form.getByLabel(text.studioDescriptionEs,{exact:true}).fill('Descripción española publicada para niños.');
  await form.getByLabel(text.catalogAudience,{exact:true}).selectOption('children');
  await form.getByLabel(text.catalogMinAge,{exact:true}).fill('6');await form.getByLabel(text.catalogMaxAge,{exact:true}).fill('12');
  await form.getByLabel(text.catalogLevel,{exact:true}).selectOption('intermediate');await form.getByLabel(text.studioStatus,{exact:true}).selectOption('published');
  await accessible(page);await form.getByRole('button',{name:text.catalogSaveClass,exact:true}).click();
  await expect(form).toHaveCount(0);await expect(create).toBeFocused();
  const created=(await pool.query('SELECT * FROM studio_classes WHERE name_es=$1',[className])).rows[0];
  expect(created).toMatchObject({discipline_id:disciplineId,audience:'children',min_age:6,max_age:12,level:'intermediate',duration_minutes:55,status:'published',version:1});expect(created.color).toMatch(/^#[0-9a-f]{6}$/i);
  const classArticle=classes.getByRole('article').filter({hasText:className});await classArticle.getByRole('button',{name:text.catalogEditClass,exact:true}).click();
  await expect(form.getByLabel(text.catalogColor,{exact:true})).toHaveValue(created.color);
  await form.getByRole('button',{name:text.studioCancel,exact:true}).click();
  const instructors=page.getByRole('region',{name:text.catalogInstructors,exact:true}),add=instructors.getByRole('button',{name:text.catalogNewInstructor,exact:true});
  await expect(add).toBeEnabled();await add.focus();await page.keyboard.press('Enter');
  const publicForm=instructors.getByRole('form',{name:text.catalogInstructorForm,exact:true});
  await publicForm.getByLabel(text.catalogInstructor,{exact:true}).selectOption(instructorId);
  await publicForm.getByLabel(text.catalogPublicName,{exact:true}).fill(publicName);
  await publicForm.getByLabel(text.catalogBiographyEs,{exact:true}).fill('Biografía pública aprobada en español.');
  await publicForm.getByRole('checkbox',{name:disciplineName,exact:true}).check();await publicForm.getByLabel(text.studioStatus,{exact:true}).selectOption('published');
  await publicForm.getByRole('button',{name:text.catalogSaveInstructor,exact:true}).click();await expect(publicForm).toHaveCount(0);await expect(add).toBeFocused();
  expect((await pool.query('SELECT public_name,biography_es,status,version FROM studio_instructor_profiles WHERE instructor_id=$1',[instructorId])).rows[0]).toEqual({public_name:publicName,biography_es:'Biografía pública aprobada en español.',status:'published',version:1});
  expect((await pool.query('SELECT discipline_id FROM studio_instructor_disciplines WHERE instructor_id=$1',[instructorId])).rows).toEqual([{discipline_id:disciplineId}]);
  const instructorArticle=instructors.getByRole('article').filter({hasText:publicName});
  await instructorArticle.getByRole('button',{name:text.catalogEditInstructor,exact:true}).click();
  const portrait=await sharp({create:{width:24,height:24,channels:3,background:'#7c4a9e'}}).png().toBuffer();
  await publicForm.getByLabel(text.catalogPortraitFile,{exact:true}).setInputFiles({name:'fictional-catalog-portrait.png',mimeType:'image/png',buffer:portrait});
  await publicForm.getByLabel(text.catalogAltEs,{exact:true}).fill('Retrato ficticio aprobado del instructor');
  await publicForm.getByRole('button',{name:text.catalogApprovePortrait,exact:true}).click();
  await expect(publicForm.getByText(`${text.catalogPortraitApproved}: Retrato ficticio aprobado del instructor`,{exact:true})).toBeVisible();
  expect((await pool.query('SELECT version FROM studio_instructor_profiles WHERE instructor_id=$1',[instructorId])).rows[0].version).toBe(2);
  await publicForm.getByRole('button',{name:text.studioCancel,exact:true}).click();
  const publicContext=await browser.newContext();contexts.push(publicContext);const customer=await publicContext.newPage();customer.on('pageerror',e=>errors.push(e.message));
  await customer.goto('http://localhost:5173');await customer.getByLabel('Idioma',{exact:true}).selectOption(locale);
  const discovery=customer.getByRole('region',{name:text.catalogDiscover,exact:true});await expect(discovery).toBeVisible();
  await discovery.getByLabel(text.catalogDiscipline,{exact:true}).selectOption(disciplineId);
  const publicClass=discovery.getByRole('article').filter({hasText:className});await expect(publicClass).toHaveCount(1);
  await publicClass.getByRole('button',{name:text.catalogViewClass,exact:true}).click();
  const detail=customer.getByRole('dialog');await expect(detail.getByText('Descripción española publicada para niños.',{exact:true})).toBeVisible();
  await expect(detail.getByText(publicName,{exact:true})).toBeVisible();await expect(detail.getByText('Biografía pública aprobada en español.',{exact:true})).toBeVisible();
  const image=detail.getByRole('img',{name:'Retrato ficticio aprobado del instructor',exact:true});await expect(image).toBeVisible();
  await expect.poll(()=>image.evaluate(element=>(element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(detail).not.toContainText(instructor.email);await expect(detail).not.toContainText('PRIVATE');
  expect((await new AxeBuilder({page:customer}).include('[role="dialog"]').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
  await customer.keyboard.press('Escape');await expect(detail).toHaveCount(0);await expect(publicClass.getByRole('button',{name:text.catalogViewClass,exact:true})).toBeFocused();await accessible(customer);
  await instructorArticle.getByRole('button',{name:text.catalogEditInstructor,exact:true}).click();
  await publicForm.getByRole('button',{name:text.catalogRemovePortrait,exact:true}).click();
  await expect(publicForm.getByRole('button',{name:text.catalogRemovePortrait,exact:true})).toHaveCount(0);
  await publicForm.getByRole('button',{name:text.studioCancel,exact:true}).click();
  const removed=await customer.request.get(`http://localhost:5173/api/v1/studio/catalog/instructors/${instructorId}/photo`);expect(removed.status()).toBe(404);expect(await removed.json()).toEqual({code:'NOT_FOUND'});
  await publicClass.getByRole('button',{name:text.catalogViewClass,exact:true}).click();await expect(detail.getByText(publicName,{exact:true})).toBeVisible();await expect(detail.getByRole('img')).toHaveCount(0);await customer.keyboard.press('Escape');
  const staffContext=await browser.newContext();contexts.push(staffContext);const staffPage=await staffContext.newPage();staffPage.on('pageerror',e=>errors.push(e.message));await login(staffPage,staff.email,locale);
  const colors=staffPage.getByRole('region',{name:text.catalogStaffColors,exact:true});await expect(colors).toBeVisible();
  await expect(staffPage.getByRole('button',{name:text.catalogNewClass,exact:true})).toHaveCount(0);await expect(staffPage.getByRole('button',{name:text.catalogNewInstructor,exact:true})).toHaveCount(0);
  const colorArticle=colors.getByRole('article').filter({hasText:className});await colorArticle.getByLabel(text.catalogColor,{exact:true}).fill('#abcdef');await colorArticle.getByRole('button',{name:text.catalogSaveColor,exact:true}).click();
  await expect.poll(async()=>(await pool.query('SELECT color FROM studio_classes WHERE id=$1',[created.id])).rows[0].color).toBe('#abcdef');
  expect((await pool.query('SELECT audience,min_age,max_age,level,version FROM studio_classes WHERE id=$1',[created.id])).rows[0]).toEqual({audience:'children',min_age:6,max_age:12,level:'intermediate',version:2});
  const smuggled=await staffPage.evaluate(async classId=>{const session=await(await fetch('/api/v1/auth/session')).json();const response=await fetch(`/api/v1/management/studio/classes/${classId}/color`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrfToken},body:JSON.stringify({color:'#654321',expectedVersion:2,nameEs:'Forged staff edit'})});return {status:response.status,body:await response.json()};},created.id);
  expect(smuggled).toEqual({status:400,body:{code:'INVALID_REQUEST'}});
  expect((await pool.query('SELECT name_es,color,version FROM studio_classes WHERE id=$1',[created.id])).rows[0]).toEqual({name_es:className,color:'#abcdef',version:2});
  const ownContext=await browser.newContext();contexts.push(ownContext);const ownPage=await ownContext.newPage();ownPage.on('pageerror',e=>errors.push(e.message));await login(ownPage,instructor.email,locale);
  const own=ownPage.getByRole('region',{name:text.catalogOwnInstructor,exact:true});await expect(own).toContainText(publicName);await expect(own.getByRole('textbox')).toHaveCount(0);await expect(own.getByRole('button',{name:text.catalogSaveInstructor,exact:true})).toHaveCount(0);
  await accessible(staffPage);await accessible(ownPage);await customer.screenshot({path:`.local/studio-catalog-${locale}.png`,fullPage:true});expect(errors).toEqual([]);
 }finally{for(const context of contexts)await context.close();await pool.end();}
});
