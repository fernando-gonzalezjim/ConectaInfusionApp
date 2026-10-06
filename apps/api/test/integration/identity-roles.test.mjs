import test from 'node:test';
import assert from 'node:assert/strict';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {authConfig,createAuthAccount,password} from './identity-auth-helpers.mjs';
import {createSessionService} from '../../dist/modules/identity/sessions.js';
import {createRoleService} from '../../dist/modules/identity/roles.js';
async function fixture(){const db=await isolatedDatabase();migrate(db.name);const config=authConfig();const sessions=await createSessionService(db.pool,config,{environment:{NODE_ENV:'test'}});return {...db,config,sessions,roles:createRoleService(db.pool,sessions)};}
test('roles require management, preserve customer access, revoke sessions and audit atomically',async()=>{
 const f=await fixture();try{
  const admin=await createAuthAccount(f.pool,'admin@example.test',['administrator']);const target=await createAuthAccount(f.pool);
  const a=await f.sessions.login({email:admin.email,password},'127.0.0.1');const t=await f.sessions.login({email:target.email,password},'127.0.0.1');
  await assert.rejects(f.roles.change(admin.accountId,{roles:['administrator']},t.sessionToken),{message:'FORBIDDEN'});
  for(const input of [{roles:['owner']},{roles:['manager','manager']},{roles:[]},{roles:['manager'],password:'forged'},{roles:'manager'}])await assert.rejects(f.roles.change(target.accountId,input,a.sessionToken),{message:'INVALID_REQUEST'});
  const changed=await f.roles.change(target.accountId,{roles:['instructor']},a.sessionToken);assert.deepEqual(changed.roles,['customer','instructor']);assert.equal(changed.staffAttendanceEligible,true);
  await assert.rejects(f.sessions.resolve(t.sessionToken),{message:'UNAUTHENTICATED'});
  const active=await f.sessions.login({email:target.email,password},'127.0.0.1');
  const removed=await f.roles.change(target.accountId,{roles:['customer']},a.sessionToken);assert.deepEqual(removed.roles,['customer']);assert.equal(removed.staffAttendanceEligible,false);
  await assert.rejects(f.sessions.resolve(active.sessionToken),{message:'UNAUTHENTICATED'});
  assert.deepEqual((await f.sessions.login({email:target.email,password},'127.0.0.1')).account.roles,['customer']);
  const audit=(await f.pool.query("SELECT * FROM audit_events WHERE action='account.roles_changed' ORDER BY occurred_at")).rows;assert.equal(audit.length,2);assert.equal(audit[0].actor_id,admin.accountId);assert.deepEqual(audit[0].changes.after.roles,['customer','instructor']);
 }finally{await f.pool.end();}
});
test('concurrent management self-demotions preserve one active administrator and reject the final removal',async()=>{
 const f=await fixture();try{
  const first=await createAuthAccount(f.pool,'first@example.test',['administrator']);const second=await createAuthAccount(f.pool,'second@example.test',['manager']);
  const a=await f.sessions.login({email:first.email,password},'127.0.0.1');const b=await f.sessions.login({email:second.email,password},'127.0.0.1');
  const results=await Promise.allSettled([f.roles.change(first.accountId,{roles:['customer']},a.sessionToken),f.roles.change(second.accountId,{roles:['customer']},b.sessionToken)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.message,'CONFLICT');
  assert.equal((await f.pool.query("SELECT count(DISTINCT a.id)::int n FROM accounts a JOIN people p ON p.id=a.person_id JOIN account_roles r ON r.account_id=a.id WHERE a.status='active' AND p.status='active' AND r.role IN ('administrator','manager')")).rows[0].n,1);
 }finally{await f.pool.end();}
});
test('role integrations and audit failures leave roles, sessions and version unchanged',async()=>{
 const f=await fixture();try{
  const admin=await createAuthAccount(f.pool,'admin@example.test',['manager']);const target=await createAuthAccount(f.pool,'staff@example.test',['customer','instructor']);
  const a=await f.sessions.login({email:admin.email,password},'127.0.0.1');const t=await f.sessions.login({email:target.email,password},'127.0.0.1');
  await f.pool.query('INSERT INTO instructors(full_name,person_id) VALUES ($1,$2)',['Linked teacher',target.personId]);
  await assert.rejects(f.roles.change(target.accountId,{roles:['customer']},a.sessionToken),{message:'CONFLICT'});await f.sessions.resolve(t.sessionToken);
  let called=false;const coordinated=createRoleService(f.pool,f.sessions,{coordinateEligibilityLoss:async(client,change)=>{called=true;assert.equal(change.accountId,target.accountId);await client.query("UPDATE people SET phone='coordinator' WHERE id=$1",[target.personId]);}});
  await f.pool.query(`CREATE FUNCTION reject_role_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit failure'; END $$;CREATE TRIGGER reject_role_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_role_audit()`);
  await assert.rejects(coordinated.change(target.accountId,{roles:['customer']},a.sessionToken));assert.equal(called,true);await f.sessions.resolve(t.sessionToken);
  assert.equal((await f.pool.query('SELECT phone FROM people WHERE id=$1',[target.personId])).rows[0].phone,null);
  assert.deepEqual((await f.pool.query('SELECT role FROM account_roles WHERE account_id=$1 ORDER BY role',[target.accountId])).rows.map(r=>r.role),['customer','instructor']);
 }finally{await f.pool.end();}
});
test('role HTTP requires session CSRF, rejects pending targets and returns conflict without exposing details',async()=>{
 const f=await fixture();let server;try{
  const admin=await createAuthAccount(f.pool,'admin@example.test',['administrator']);const customer=await createAuthAccount(f.pool);
  const a=await f.sessions.login({email:admin.email,password},'127.0.0.1');const c=await f.sessions.login({email:customer.email,password},'127.0.0.1');
  process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused';process.env.IDENTITY_ENABLED='false';
  const {createApplication}=await import('../../dist/app.js');server=(await createApplication({database:f.pool,identityConfig:f.config,environment:{NODE_ENV:'test'}})).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api/v1/accounts`;const headers={Origin:'http://localhost:5174',Cookie:`conecta_session=${a.sessionToken}`,'X-CSRF-Token':a.csrfToken,'Content-Type':'application/json'};
  const post=(id,body,extra={})=>fetch(`${base}/${id}/roles`,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
  assert.equal((await post(customer.accountId,{roles:['instructor']},{Origin:'http://evil.example'})).status,403);
  assert.equal((await post(customer.accountId,{roles:['instructor']},{'X-CSRF-Token':''})).status,403);
  assert.equal((await post(admin.accountId,{roles:['customer']},{Cookie:`conecta_session=${c.sessionToken}`,'X-CSRF-Token':c.csrfToken})).status,403);
  for(const role of ['reception','cafe_staff','instructor']){
   const staff=await createAuthAccount(f.pool,`${role}@example.test`,[role]);const login=await f.sessions.login({email:staff.email,password},'127.0.0.2');
   const own={Cookie:`conecta_session=${login.sessionToken}`,'X-CSRF-Token':login.csrfToken};
   assert.equal((await post(staff.accountId,{roles:['manager']},own)).status,403);
   assert.equal((await post(customer.accountId,{roles:['manager']},own)).status,403);
  }
  const conflict=await post(admin.accountId,{roles:['customer']});assert.equal(conflict.status,409);assert.deepEqual(await conflict.json(),{code:'CONFLICT'});
  const original=(await f.pool.query('SELECT assigned_at,assigned_by FROM account_roles WHERE account_id=$1',[customer.accountId])).rows[0];
  const changed=await post(customer.accountId,{roles:['instructor']});assert.equal(changed.status,200);assert.equal(changed.headers.get('cache-control'),'no-store');assert.deepEqual((await changed.json()).roles,['customer','instructor']);
  assert.deepEqual((await f.pool.query("SELECT assigned_at,assigned_by FROM account_roles WHERE account_id=$1 AND role='customer'",[customer.accountId])).rows[0],original);
  const version=(await f.pool.query('SELECT session_version FROM accounts WHERE id=$1',[customer.accountId])).rows[0].session_version;
  await post(customer.accountId,{roles:['instructor']});assert.equal((await f.pool.query('SELECT session_version FROM accounts WHERE id=$1',[customer.accountId])).rows[0].session_version,version);
  await f.pool.query("UPDATE accounts SET status='pending' WHERE id=$1",[customer.accountId]);assert.equal((await post(customer.accountId,{roles:['manager']})).status,409);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await f.pool.end();}
});
test('last-administrator protection counts opted-in local fixtures but never copied production fixtures',async()=>{
 const f=await fixture();try{
  const environment={NODE_ENV:'development',IDENTITY_DEV_FIXTURES:'true',DATABASE_URL:f.pool.options.connectionString};
  const {generateFirstAdminSql}=await import('../../dist/modules/identity/bootstrap.js');await f.pool.query(await generateFirstAdminSql({development:true,operator:'isolated-test',environment}));
  const manager=await createAuthAccount(f.pool,'manager@example.test',['manager']);
  const sessions=await createSessionService(f.pool,f.config,{environment});const roles=createRoleService(f.pool,sessions,{environment});
  const m=await sessions.login({email:manager.email,password},'127.0.0.1');await roles.change(manager.accountId,{roles:['customer']},m.sessionToken);
  const admin=await sessions.login({email:'admin@conecta.example.test',password:'admin'},'127.0.0.2');await roles.change(manager.accountId,{roles:['manager']},admin.sessionToken);
  const production={NODE_ENV:'production'};const secureSessions=await createSessionService(f.pool,f.config,{environment:production});
  const current=await secureSessions.login({email:manager.email,password},'127.0.0.3');
  await assert.rejects(createRoleService(f.pool,secureSessions,{environment:production}).change(manager.accountId,{roles:['customer']},current.sessionToken),{message:'CONFLICT'});
 }finally{await f.pool.end();}
});
test('role changes recheck revoked management authority and reject invalid remaining admin credentials',async()=>{
 const f=await fixture();try{
  const admin=await createAuthAccount(f.pool,'admin@example.test',['manager']);const customer=await createAuthAccount(f.pool);
  const a=await f.sessions.login({email:admin.email,password},'127.0.0.1');
  const stale=createRoleService(f.pool,{...f.sessions,resolve:async(...args)=>{const context=await f.sessions.resolve(...args);await f.pool.query("UPDATE account_roles SET role='customer' WHERE account_id=$1",[admin.accountId]);return context;}});
  await assert.rejects(stale.change(customer.accountId,{roles:['manager']},a.sessionToken),{message:'FORBIDDEN'});
  await f.pool.query("UPDATE account_roles SET role='manager' WHERE account_id=$1",[admin.accountId]);
  const broken=await createAuthAccount(f.pool,'broken@example.test',['administrator']);await f.pool.query("UPDATE accounts SET password_hash='$argon2id$broken' WHERE id=$1",[broken.accountId]);
  await assert.rejects(f.roles.change(admin.accountId,{roles:['customer']},a.sessionToken),{message:'CONFLICT'});
 }finally{await f.pool.end();}
});
test('concurrent cross-demotions wait at a PostgreSQL barrier, retain one manager and reject stale actor access',async()=>{
 const f=await fixture();const blocker=await f.pool.connect();try{
  const first=await createAuthAccount(f.pool,'first@example.test',['administrator']);const second=await createAuthAccount(f.pool,'second@example.test',['manager']);
  const a=await f.sessions.login({email:first.email,password},'127.0.0.1');const b=await f.sessions.login({email:second.email,password},'127.0.0.1');
  await blocker.query('BEGIN');await blocker.query("SELECT pg_advisory_xact_lock(hashtextextended('identity-active-administration',0))");
  let arrived=0,release;const waiting=new Promise(resolve=>{release=resolve;});
  const wrapped={connect:async()=>{const client=await f.pool.connect();return {release:()=>client.release(),query:(...args)=>{
   const result=client.query(...args);if(typeof args[0]==='string'&&args[0].includes('pg_advisory_xact_lock')&&++arrived===2)release();return result;
  }};}};
  const roles=createRoleService(wrapped,f.sessions);
  const pending=Promise.allSettled([roles.change(second.accountId,{roles:['customer']},a.sessionToken),roles.change(first.accountId,{roles:['customer']},b.sessionToken)]);
  await waiting;await blocker.query('COMMIT');const results=await pending;
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.message,'UNAUTHENTICATED');
  assert.equal((await f.pool.query("SELECT count(DISTINCT a.id)::int n FROM accounts a JOIN account_roles r ON r.account_id=a.id WHERE a.status='active' AND r.role IN ('administrator','manager')")).rows[0].n,1);
  const survivor=results[0].status==='fulfilled'?a:b;const removed=results[0].status==='fulfilled'?b:a;
  await f.sessions.resolve(survivor.sessionToken);await assert.rejects(f.sessions.resolve(removed.sessionToken),{message:'UNAUTHENTICATED'});
 }finally{await blocker.query('ROLLBACK');blocker.release();await f.pool.end();}
});
