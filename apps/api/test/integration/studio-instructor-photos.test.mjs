import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {randomBytes} from 'node:crypto';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {authConfig,createAuthAccount,password} from './identity-auth-helpers.mjs';
import {createSessionService} from '../../dist/modules/identity/sessions.js';
import {createAccountService} from '../../dist/modules/identity/accounts.js';
import {createInstructorService} from '../../dist/modules/studio/instructors.js';
import {createInstructorPhotoService} from '../../dist/modules/studio/instructor-photos.js';
async function fixture(){
 const db=await isolatedDatabase();migrate(db.name);
 const config=authConfig(),sessions=await createSessionService(db.pool,config,{environment:{NODE_ENV:'test'}}),accounts=createAccountService(db.pool,sessions);
 async function actor(role){const email=role+'@example.test',a=await createAuthAccount(db.pool,email,[role]);return {...a,...await sessions.login({email,password},'127.0.0.1')};}
 const manager=await actor('manager'),instructor=await actor('instructor');
 const instructorId=(await db.pool.query("INSERT INTO instructors(full_name,person_id) VALUES('Private',$1) RETURNING id",[instructor.personId])).rows[0].id;
 const disciplineId=(await db.pool.query("INSERT INTO studio_disciplines(name_es,description_es,status) VALUES('Yoga','Description','published') RETURNING id")).rows[0].id;
 const catalog=createInstructorService(db.pool,accounts);await catalog.create({instructorId,publicName:'Public',disciplineIds:[disciplineId]},manager.sessionToken);
 const photos=createInstructorPhotoService(db.pool,accounts,catalog);
 const data=(await sharp({create:{width:900,height:700,channels:3,background:'#88aa88'}}).png().withMetadata().toBuffer()).toString('base64');
 return {...db,config,sessions,accounts,catalog,photos,manager,instructor,instructorId,disciplineId,data};
}
test('catalog portraits decode optimize strip metadata and stay private until approved publication',async()=>{
 const f=await fixture();try{
  await assert.rejects(f.photos.upload(f.instructorId,{data:f.data,expectedVersion:1,altEs:'Portrait'},f.instructor.sessionToken),{message:'FORBIDDEN'});
  const p=await f.photos.upload(f.instructorId,{data:f.data,expectedVersion:1,altEs:'Retrato aprobado',altEn:'Approved portrait'},f.manager.sessionToken);
  assert.equal(p.version,2);assert.equal(p.photo.altEs,'Retrato aprobado');assert.equal(p.photo.url,`/api/v1/studio/catalog/instructors/${f.instructorId}/photo`);
  await assert.rejects(f.photos.readPublic(f.instructorId),{message:'NOT_FOUND'});
  const bytes=await f.photos.readManagement(f.instructorId,f.manager.sessionToken),meta=await sharp(bytes).metadata();
  assert.equal(meta.format,'webp');assert.ok(meta.width<=512&&meta.height<=512);assert.equal(meta.exif,undefined);assert.equal(meta.icc,undefined);
  await f.catalog.update(f.instructorId,{expectedVersion:2,status:'published'},f.manager.sessionToken);
  assert.deepEqual(await f.photos.readPublic(f.instructorId),bytes);
  await f.pool.query("DELETE FROM account_roles WHERE account_id=$1 AND role='instructor'",[f.instructor.accountId]);
  await assert.rejects(f.photos.readPublic(f.instructorId),{message:'NOT_FOUND'});
  await assert.rejects(f.photos.upload(f.instructorId,{data:f.data,expectedVersion:3,altEs:'Inactive portrait'},f.manager.sessionToken),{message:'CONFLICT'});
  const removed=await f.photos.remove(f.instructorId,{expectedVersion:3},f.manager.sessionToken);assert.equal(removed.photo,null);
  assert.equal((await f.pool.query('SELECT photo_id FROM people WHERE id=$1',[f.instructor.personId])).rows[0].photo_id,null);
 }finally{await f.pool.end();}
});
test('actual HTTP portrait routes guard before parsing and accept bounded images larger than the generic catalog parser',async()=>{
 const f=await fixture();let server;try{
  process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused';process.env.IDENTITY_ENABLED='false';
  const {createApplication}=await import('../../dist/app.js');
  server=(await createApplication({database:f.pool,identityConfig:f.config,environment:{NODE_ENV:'test'}})).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`,path=`/api/v1/management/studio/instructors/${f.instructorId}/photo`;
  const headers={Origin:'http://localhost:5174',Cookie:`conecta_session=${f.manager.sessionToken}`,'X-CSRF-Token':f.manager.csrfToken,'Content-Type':'application/json'};
  const data=(await sharp(randomBytes(200*200*3),{raw:{width:200,height:200,channels:3}}).png().toBuffer()).toString('base64');
  assert.ok(data.length>40*1024);
  const body=JSON.stringify({data,expectedVersion:1,altEs:'Retrato aprobado'});
  const post=(suffix,raw=body,extra={})=>fetch(origin+path+suffix,{method:'POST',headers:{...headers,...extra},body:raw});
  assert.equal((await post('', '{malformed',{Origin:'http://evil.example'})).status,403);
  assert.equal((await post('', '{malformed',{'X-CSRF-Token':''})).status,403);
  const staff=await createAuthAccount(f.pool,'staff-photo@example.test',['reception']),staffLogin=await f.sessions.login({email:staff.email,password},'127.0.0.1');
  const staffHeaders={Cookie:`conecta_session=${staffLogin.sessionToken}`,'X-CSRF-Token':staffLogin.csrfToken};
  assert.equal((await post('',body,staffHeaders)).status,403);
  assert.equal((await fetch(origin+path,{headers:staffHeaders})).status,403);
  const uploaded=await post('');assert.equal(uploaded.status,200);assert.equal(uploaded.headers.get('cache-control'),'no-store');
  const profile=await uploaded.json();assert.equal(profile.version,2);
  const preview=await fetch(origin+path,{headers});assert.equal(preview.status,200);assert.equal(preview.headers.get('content-type'),'image/webp');assert.equal(preview.headers.get('x-content-type-options'),'nosniff');assert.equal(preview.headers.get('cache-control'),'no-store');
  assert.equal((await fetch(origin+profile.photo.url)).status,404);
  await f.catalog.update(f.instructorId,{expectedVersion:2,status:'published'},f.manager.sessionToken);
  const publicImage=await fetch(origin+profile.photo.url);assert.equal(publicImage.status,200);assert.equal(publicImage.headers.get('content-type'),'image/webp');assert.equal(publicImage.headers.get('cache-control'),'no-store');assert.equal(publicImage.headers.get('x-content-type-options'),'nosniff');
  const removed=await post('/remove',JSON.stringify({expectedVersion:3}));assert.equal(removed.status,200);assert.equal((await removed.json()).photo,null);
  assert.equal((await fetch(origin+profile.photo.url)).status,404);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await f.pool.end();}
});
test('catalog portraits reject malformed bytes revisions forged paths and removal rolls back with failed audit',async()=>{
 const f=await fixture();try{
  for(const patch of [{data:'notbase64'},{data:Buffer.from('<svg/>').toString('base64')},{altEs:''},{photoId:f.instructorId},{url:'https://example.test/photo'},{data:'A'.repeat(6990508+4)}])
   await assert.rejects(f.photos.upload(f.instructorId,{data:f.data,expectedVersion:1,altEs:'Portrait',...patch},f.manager.sessionToken),{message:'INVALID_REQUEST'});
  const p=await f.photos.upload(f.instructorId,{data:f.data,expectedVersion:1,altEs:'Portrait'},f.manager.sessionToken);
  await assert.rejects(f.photos.upload(f.instructorId,{data:f.data,expectedVersion:1,altEs:'Stale'},f.manager.sessionToken),{message:'CONFLICT'});
  await f.pool.query("CREATE FUNCTION reject_portrait_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='studio.instructor_photo_removed' THEN RAISE EXCEPTION 'portrait audit failure'; END IF; RETURN NEW; END $$");
  await f.pool.query('CREATE TRIGGER reject_portrait_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_portrait_audit()');
  await assert.rejects(f.photos.remove(f.instructorId,{expectedVersion:2},f.manager.sessionToken),/portrait audit failure/);
  assert.deepEqual(await f.catalog.own(f.instructor.sessionToken),p);
  await f.pool.query('DROP TRIGGER reject_portrait_audit ON audit_events');
  const removed=await f.photos.remove(f.instructorId,{expectedVersion:2},f.manager.sessionToken);assert.equal(removed.version,3);assert.equal(removed.photo,null);
  await assert.rejects(f.photos.readManagement(f.instructorId,f.manager.sessionToken),{message:'NOT_FOUND'});
 }finally{await f.pool.end();}
});
