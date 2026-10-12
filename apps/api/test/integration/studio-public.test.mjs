import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {createPublicCatalogService} from '../../dist/modules/studio/public-read.js';
import {createPublicCatalogRouter} from '../../dist/modules/studio/public-routes.js';
import {createAuthAccount} from './identity-auth-helpers.mjs';

test('public catalog uses the published parent chain, bounded pagination and field-level Spanish fallback',async()=>{
 const db=await isolatedDatabase();migrate(db.name);
 try{
  const d=(await db.pool.query(`INSERT INTO studio_disciplines(name_es,name_en,description_es,status) VALUES ('Yoga','Yoga EN','Español','published') RETURNING id`)).rows[0].id;
  const hidden=(await db.pool.query(`INSERT INTO studio_disciplines(name_es,status) VALUES ('Private','draft') RETURNING id`)).rows[0].id;
  const ids=[];
  for(const [parent,status] of [[d,'published'],[d,'published'],[d,'draft'],[hidden,'published']])ids.push((await db.pool.query(`INSERT INTO studio_classes(discipline_id,name_es,description_es,audience,level,color,status) VALUES($1,'Clase','Descripción','adults','all','#123456',$2) RETURNING id`,[parent,status])).rows[0].id);
  const service=createPublicCatalogService(db.pool);
  const list=await service.listClasses({locale:'en',limit:'1'});
  assert.equal(list.items.length,1);assert.ok(list.nextCursor);assert.equal(list.items[0].name,'Clase');assert.equal(list.items[0].discipline.name,'Yoga EN');
  assert.deepEqual(list.items[0].instructors,[]);assert.equal(list.items[0].durationMinutes,55);
  const next=await service.listClasses({cursor:list.nextCursor,limit:'1'});assert.equal(next.items.length,1);assert.equal(next.nextCursor,null);
  assert.equal((await service.listDisciplines({locale:'en'})).items[0].description,'Español');
  await assert.rejects(service.classDetail(ids[2],{}),{message:'NOT_FOUND'});await assert.rejects(service.classDetail(ids[3],{}),{message:'NOT_FOUND'});
  for(const query of [{limit:'51'},{limit:'0'},{locale:'es'},{cursor:'bad'},{status:'draft'},{disciplineId:'bad'}])await assert.rejects(service.listClasses(query),{message:'INVALID_REQUEST'});
  await db.pool.query(`UPDATE studio_disciplines SET status='archived' WHERE id=$1`,[d]);
  assert.equal((await service.listClasses({})).items.length,0);await assert.rejects(service.discipline(d,{}),{message:'NOT_FOUND'});
 }finally{await db.pool.end();}
});

test('public instructor facts require explicit publication, qualification and current active instructor identity',async()=>{
 const db=await isolatedDatabase();migrate(db.name);
 try{
  const d=(await db.pool.query(`INSERT INTO studio_disciplines(name_es,description_es,status) VALUES ('Yoga','Published','published') RETURNING id`)).rows[0].id;
  const c=(await db.pool.query(`INSERT INTO studio_classes(discipline_id,name_es,description_es,audience,level,color,status) VALUES($1,'Yoga','Published','adults','all','#123456','published') RETURNING id`,[d])).rows[0].id;
  const actor=await createAuthAccount(db.pool,'private-instructor@example.test',['instructor']);
  await db.pool.query(`UPDATE people SET full_name='PRIVATE legal name',phone='PRIVATE phone',photo_id=gen_random_uuid() WHERE id=$1`,[actor.personId]);
  const instructor=(await db.pool.query(`INSERT INTO instructors(full_name,person_id) VALUES ('PRIVATE legacy name',$1) RETURNING id`,[actor.personId])).rows[0].id;
  await db.pool.query(`INSERT INTO studio_instructor_profiles(instructor_id,public_name,biography_es,status) VALUES($1,'Approved public name','Biografía aprobada','draft')`,[instructor]);
  const service=createPublicCatalogService(db.pool);
  const read=()=>service.classDetail(c,{locale:'en'});
  assert.deepEqual((await read()).instructors,[]);
  await db.pool.query(`UPDATE studio_instructor_profiles SET status='published' WHERE instructor_id=$1`,[instructor]);
  assert.deepEqual((await read()).instructors,[]);
  await db.pool.query(`INSERT INTO studio_instructor_disciplines(instructor_id,discipline_id) VALUES($1,$2)`,[instructor,d]);
  const expected=[{id:instructor,publicName:'Approved public name',biography:'Biografía aprobada',photo:null}];
  assert.deepEqual((await read()).instructors,expected);
  assert.doesNotMatch(JSON.stringify(await read()),/PRIVATE|private-instructor|accountId|personId|photo_id|version/);
  await db.pool.query(`UPDATE studio_instructor_profiles SET biography_es=NULL WHERE instructor_id=$1`,[instructor]);
  assert.equal((await read()).instructors[0].biography,null);
  await db.pool.query(`INSERT INTO studio_instructor_photos(instructor_id,data,alt_es) VALUES($1,$2,'Retrato público aprobado')`,[instructor,Buffer.from('PRIVATE binary storage bytes')]);
  const withPhoto=await read();
  assert.deepEqual(withPhoto.instructors[0].photo,{url:`/api/v1/studio/catalog/instructors/${instructor}/photo`,alt:'Retrato público aprobado'});
  assert.doesNotMatch(JSON.stringify(withPhoto),/PRIVATE|bytea|updated_at|alt_es|content_type/);
  await db.pool.query(`DELETE FROM account_roles WHERE account_id=$1 AND role='instructor'`,[actor.accountId]);
  assert.deepEqual((await read()).instructors,[]);
  await db.pool.query(`INSERT INTO account_roles(account_id,role) VALUES($1,'instructor')`,[actor.accountId]);
  await db.pool.query(`UPDATE people SET status='inactive' WHERE id=$1`,[actor.personId]);assert.deepEqual((await read()).instructors,[]);
  await db.pool.query(`UPDATE people SET status='active' WHERE id=$1`,[actor.personId]);
  await db.pool.query(`UPDATE accounts SET status='inactive',deactivated_at=now() WHERE id=$1`,[actor.accountId]);assert.deepEqual((await read()).instructors,[]);
  await db.pool.query(`UPDATE accounts SET status='active',deactivated_at=NULL WHERE id=$1`,[actor.accountId]);
  await db.pool.query(`UPDATE studio_instructor_profiles SET status='archived' WHERE instructor_id=$1`,[instructor]);assert.deepEqual((await read()).instructors,[]);
 }finally{await db.pool.end();}
});

test('public routes need no identity, hide draft IDs, and prevent cached publication visibility',async()=>{
 const db=await isolatedDatabase();migrate(db.name);const app=express();app.use('/catalog',createPublicCatalogRouter(createPublicCatalogService(db.pool)));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}/catalog`;
 try{
  const list=await fetch(`${base}/classes`);assert.equal(list.status,200);assert.equal(list.headers.get('cache-control'),'no-store');assert.deepEqual(await list.json(),{items:[],nextCursor:null});
  const missing=await fetch(`${base}/classes/00000000-0000-4000-8000-000000000000`);assert.equal(missing.status,404);assert.deepEqual(await missing.json(),{code:'NOT_FOUND'});
  const invalid=await fetch(`${base}/classes?locale=en&locale=es-MX`);assert.equal(invalid.status,400);
 }finally{await new Promise(resolve=>server.close(resolve));await db.pool.end();}
});
