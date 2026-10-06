import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,rm,unlink,writeFile,utimes} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {authConfig,createAuthAccount,password} from './identity-auth-helpers.mjs';
import {createSessionService} from '../../dist/modules/identity/sessions.js';
import {createAccountService} from '../../dist/modules/identity/accounts.js';
import {createPhotoService} from '../../dist/modules/identity/photos.js';

test('private photos enforce ownership, management rights, audited replacement and rollback cleanup',async()=>{
  const db=await isolatedDatabase();migrate(db.name);const directory=await mkdtemp(join(tmpdir(),'conecta-photo-test-'));
  try{
    const config=authConfig(),sessions=await createSessionService(db.pool,config),accounts=createAccountService(db.pool,sessions);
    const photos=createPhotoService(db.pool,sessions,accounts,directory);
    const customer=await createAuthAccount(db.pool),staff=await createAuthAccount(db.pool,'staff@example.test',['instructor']);
    const manager=await createAuthAccount(db.pool,'manager@example.test',['manager']);
    const login=async account=>sessions.login({email:account.email,password},'127.0.0.1');
    const own=await login(customer),employee=await login(staff),admin=await login(manager);
    const input={data:(await sharp({create:{width:900,height:600,channels:3,background:'#D7AED1'}}).png().withMetadata().toBuffer()).toString('base64')};
    await assert.rejects(photos.read(undefined,own.sessionToken),{message:'NOT_FOUND'});
    await assert.rejects(photos.upload(customer.accountId,input,employee.sessionToken),{message:'FORBIDDEN'});
    assert.deepEqual(await readdir(directory),[]);
    const first=await photos.upload(undefined,input,own.sessionToken);
    assert.match(first.photoId,/^[a-f0-9-]{36}$/);assert.deepEqual(await readdir(directory),[first.photoId+'.webp']);
    const output=await photos.read(undefined,own.sessionToken),metadata=await sharp(output).metadata();
    assert.equal(metadata.width,512);assert.equal(metadata.height,341);assert.equal(metadata.exif,undefined);
    await assert.rejects(photos.read(customer.accountId,employee.sessionToken),{message:'FORBIDDEN'});
    assert.deepEqual(await photos.read(customer.accountId,admin.sessionToken),output);
    const second=await photos.upload(customer.accountId,input,admin.sessionToken);
    assert.notEqual(first.photoId,second.photoId);assert.deepEqual(await readdir(directory),[second.photoId+'.webp']);
    const audit=(await db.pool.query("SELECT actor_id,changes FROM audit_events WHERE action='account.profile_updated' ORDER BY occurred_at DESC LIMIT 1")).rows[0];
    assert.equal(audit.actor_id,manager.accountId);assert.equal(audit.changes.after.photoId,second.photoId);
    await db.pool.query(`CREATE FUNCTION reject_photo_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='account.profile_updated' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_photo_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_photo_audit()`);
    await assert.rejects(photos.upload(undefined,input,own.sessionToken));
    assert.equal((await accounts.readOwn(own.sessionToken,customer.accountId)).photoId,second.photoId);assert.deepEqual(await readdir(directory),[second.photoId+'.webp']);
    assert.deepEqual(await readFile(join(directory,second.photoId+'.webp')),output);
    await db.pool.query('DROP TRIGGER reject_photo_audit ON audit_events');
    let arrivals=0,release;const barrier=new Promise(resolve=>{release=resolve;});
    const synchronized=createPhotoService(db.pool,sessions,{...accounts,replacePhoto:async(...args)=>{
      arrivals++;if(arrivals===2)release();await barrier;return accounts.replacePhoto(...args);
    }},directory);
    await Promise.all([synchronized.upload(undefined,input,own.sessionToken),synchronized.upload(undefined,input,own.sessionToken)]);
    assert.equal(arrivals,2);
    const final=(await accounts.readOwn(own.sessionToken,customer.accountId)).photoId;assert.deepEqual(await readdir(directory),[final+'.webp']);
    for(const invalid of [{...input,filename:'../../evil.webp'},{data:'https://example.test/photo.png'},{data:'!!!!'}, {data:Buffer.from('<svg/>').toString('base64')}])
      await assert.rejects(photos.upload(undefined,invalid,own.sessionToken),{message:'INVALID_REQUEST'});
    assert.deepEqual(await readdir(directory),[final+'.webp']);
    let attempts=0;
    const retrying=createPhotoService(db.pool,sessions,accounts,directory,{unlink:async path=>{
      attempts++;if(attempts<3)throw Object.assign(new Error('temporary open handle'),{code:'EPERM'});await unlink(path);
    }});
    const retried=await retrying.upload(undefined,input,own.sessionToken);assert.equal(attempts,3);assert.deepEqual(await readdir(directory),[retried.photoId+'.webp']);
    const orphan=randomUUID(),staged=randomUUID();await writeFile(join(directory,orphan+'.webp'),output);await writeFile(join(directory,staged+'.webp'),output);
    const yesterday=new Date(Date.now()-48*60*60*1000);await utimes(join(directory,orphan+'.webp'),yesterday,yesterday);await utimes(join(directory,retried.photoId+'.webp'),yesterday,yesterday);
    await photos.reconcile();assert.deepEqual((await readdir(directory)).sort(),[retried.photoId+'.webp',staged+'.webp'].sort());
    let reads=0;
    const racing=createPhotoService(db.pool,sessions,{...accounts,readAuthorized:async(...args)=>{
      const snapshot=await accounts.readAuthorized(...args);reads++;
      if(reads===1)await photos.upload(undefined,input,own.sessionToken);return snapshot;
    }},directory);
    assert.deepEqual(await racing.read(undefined,own.sessionToken),output);assert.equal(reads,2);
    await photos.upload(undefined,input,employee.sessionToken); // Staff can manage their own photo.
    await assert.rejects(photos.read(undefined,'bad'),{message:'UNAUTHENTICATED'});
    assert.throws(()=>createPhotoService(db.pool,sessions,accounts,'public'),{message:'PHOTO_DIRECTORY_INVALID'});
    await assert.rejects(createPhotoService(db.pool,sessions,accounts).upload(undefined,input,own.sessionToken),{message:'PHOTO_STORAGE_UNAVAILABLE'});
  }finally{await db.pool.end();await rm(directory,{recursive:true,force:true});}
});

test('photo HTTP guards precede its bounded parser and serve only authorized static WebP',async()=>{
  const db=await isolatedDatabase();migrate(db.name);const directory=await mkdtemp(join(tmpdir(),'conecta-photo-http-'));let server;
  try{
    const config=authConfig(),account=await createAuthAccount(db.pool),sessions=await createSessionService(db.pool,config);
    const login=await sessions.login({email:account.email,password},'127.0.0.1');
    process.env.IDENTITY_ENABLED='false';process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused';
    const {createApplication}=await import('../../dist/app.js');
    const app=await createApplication({database:db.pool,identityConfig:config,environment:{IDENTITY_PHOTO_DIRECTORY:directory}});
    server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${server.address().port}/api/v1`,headers={Origin:'http://localhost:5173',Cookie:`conecta_session=${login.sessionToken}`,'X-CSRF-Token':login.csrfToken,'Content-Type':'application/json'};
    const data=(await sharp({create:{width:40,height:40,channels:3,background:'#ABC'}}).png().toBuffer()).toString('base64');
    const post=(body,extra={})=>fetch(base+'/me/photo',{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
    assert.equal((await post({data},{Origin:'http://evil.test'})).status,403);
    assert.equal((await post({data},{'X-CSRF-Token':'bad'})).status,403);
    assert.equal((await post({data},{'Content-Type':'image/png'})).status,403);
    assert.equal((await post({data:'x'.repeat(7*1024*1024)})).status,413);
    assert.equal((await post({data:Buffer.from('not a PNG').toString('base64')})).status,400);
    const saved=await post({data});assert.equal(saved.status,200);assert.equal(saved.headers.get('cache-control'),'no-store');
    const read=await fetch(base+'/me/photo',{headers});assert.equal(read.status,200);assert.equal(read.headers.get('content-type'),'image/webp');
    assert.equal(read.headers.get('x-content-type-options'),'nosniff');assert.equal(read.headers.get('cache-control'),'no-store');
    assert.equal((await fetch(base+'/me/photo',{headers:{Origin:headers.Origin}})).status,401);
    assert.equal((await fetch(base+'/photos/'+(await saved.json()).photoId,{headers})).status,404);
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await db.pool.end();await rm(directory,{recursive:true,force:true});}
});
