import test from 'node:test';
import assert from 'node:assert/strict';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {authConfig,createAuthAccount,password} from './identity-auth-helpers.mjs';
import {createSessionService} from '../../dist/modules/identity/sessions.js';
import {createAccountService} from '../../dist/modules/identity/accounts.js';

async function fixture(){
  const db=await isolatedDatabase();migrate(db.name);const config=authConfig();
  const sessions=await createSessionService(db.pool,config,{environment:{NODE_ENV:'test'}});
  return {...db,config,sessions,accounts:createAccountService(db.pool,sessions)};
}
test('account actor/target matrix enforces privileged listings and own-only ordinary profile edits',async()=>{
  const f=await fixture();
  try{
    const targets=[];
    for(const role of ['administrator','manager','reception','cafe_staff','instructor','customer'])
      targets.push({...await createAuthAccount(f.pool,`${role}@example.test`,[role]),role});
    for(const actor of targets){
      const login=await f.sessions.login({email:actor.email,password},'127.0.0.1');const privileged=['administrator','manager'].includes(actor.role);
      if(privileged){const result=await f.accounts.list({},login.sessionToken);assert.equal(result.accounts.length,6);assert.equal(result.nextCursor,null);}
      else await assert.rejects(f.accounts.list({},login.sessionToken),{message:'FORBIDDEN'});
      for(const target of targets){
        if(privileged||target.accountId===actor.accountId){
          const saved=await f.accounts.update(target.accountId,{fullName:`Updated ${actor.role}`,phone:null,preferredLocale:'en'},login.sessionToken);
          assert.equal(saved.fullName,`Updated ${actor.role}`);assert.equal(saved.email,target.email);assert.deepEqual(saved.roles,[target.role]);
          assert.equal(JSON.stringify(saved).includes('password_hash'),false);
        }else await assert.rejects(f.accounts.update(target.accountId,{fullName:'Denied'},login.sessionToken),{message:'FORBIDDEN'});
      }
      for(const field of ['roles','email','password','passwordHash','confirmationStatus','status','personId','photoId','payRate','ownershipId'])
        await assert.rejects(f.accounts.update(actor.accountId,{[field]:'forged'},login.sessionToken),{message:'INVALID_REQUEST'});
      await assert.rejects(f.accounts.update('00000000-0000-4000-8000-000000000000',{fullName:'Hidden'},login.sessionToken),{message:privileged?'NOT_FOUND':'FORBIDDEN'});
    }
  }finally{await f.pool.end();}
});
test('account pagination, filters and validation remain bounded and preserve inactive records',async()=>{
  const f=await fixture();
  try{
    const actor=await createAuthAccount(f.pool,'manager@example.test',['manager']);
    const login=await f.sessions.login({email:actor.email,password},'127.0.0.1');
    const first=await createAuthAccount(f.pool,'first@example.test',['instructor','customer']);
    const second=await createAuthAccount(f.pool,'second@example.test',['customer']);
    await f.pool.query("UPDATE accounts SET status='inactive',deactivated_at=now() WHERE id=$1",[second.accountId]);
    const ids=[];let cursor;
    do{const result=await f.accounts.list({limit:'1',...(cursor?{cursor}:{})},login.sessionToken);assert.equal(result.accounts.length,1);ids.push(result.accounts[0].id);cursor=result.nextCursor;}while(cursor);
    assert.equal(new Set(ids).size,3);
    assert.deepEqual((await f.accounts.list({role:'customer',status:'inactive'},login.sessionToken)).accounts.map(a=>a.id),[second.accountId]);
    assert.deepEqual((await f.accounts.list({role:'instructor'},login.sessionToken)).accounts.map(a=>a.id),[first.accountId]);
    const edited=await f.accounts.update(second.accountId,{fullName:'Corrected inactive'},login.sessionToken);assert.equal(edited.status,'inactive');
    for(const query of [{limit:'51'},{limit:'0'},{limit:['1','2']},{cursor:'invalid'},{role:'owner'},{status:'deleted'},{search:'private'}])await assert.rejects(f.accounts.list(query,login.sessionToken),{message:'INVALID_REQUEST'});
    for(const input of [{},{fullName:'  '},{fullName:'x'.repeat(121)},{phone:'x'.repeat(41)},{fullName:'bad\nname'},{phone:'bad\u0000'},{preferredLocale:'fr'},null,[]])await assert.rejects(f.accounts.update(actor.accountId,input,login.sessionToken),{message:'INVALID_REQUEST'});
    await assert.rejects(f.accounts.update('../other',{fullName:'Invalid'},login.sessionToken),{message:'INVALID_REQUEST'});
  }finally{await f.pool.end();}
});

test('account HTTP protects profile writes with session CSRF, bounds parsing and never exposes secrets',async()=>{
  const f=await fixture();let server;
  try{
    const actor=await createAuthAccount(f.pool,'manager@example.test',['manager']);const target=await createAuthAccount(f.pool);
    const login=await f.sessions.login({email:actor.email,password},'127.0.0.1');
    process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused';process.env.IDENTITY_ENABLED='false';
    const {createApplication}=await import('../../dist/app.js');
    server=(await createApplication({database:f.pool,identityConfig:f.config,environment:{NODE_ENV:'test'}})).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${server.address().port}/api/v1/accounts`;const Origin='http://localhost:5174';
    const headers={Origin,Cookie:`conecta_session=${login.sessionToken}`,'X-CSRF-Token':login.csrfToken,'Content-Type':'application/json'};
    const post=(body,extra={})=>fetch(`${base}/${target.accountId}/profile`,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
    assert.equal((await fetch(base,{headers:{Origin}})).status,401);
    assert.equal((await fetch(base,{headers:{...headers,Origin:'http://evil.example'}})).status,403);
    const listed=await fetch(base+'?limit=1&role=customer',{headers});assert.equal(listed.status,200);assert.equal(listed.headers.get('cache-control'),'no-store');
    const result=await listed.json();assert.equal(result.accounts.length,1);
    for(const field of ['password_hash','passwordHash','session_version','exemption_reason','exemption_actor_id','token_hash'])assert.equal(JSON.stringify(result).includes(field),false);
    assert.equal((await post({fullName:'Denied'}, {'X-CSRF-Token':''})).status,403);
    assert.equal((await post({fullName:'Denied'},{Origin:'http://evil.example'})).status,403);
    assert.equal((await post({fullName:'x'.repeat(3000)})).status,413);
    assert.equal((await post({roles:['administrator']})).status,400);
    const saved=await post({fullName:'HTTP edit'});assert.equal(saved.status,200);assert.equal((await saved.json()).fullName,'HTTP edit');
    assert.equal((await fetch(`${base}/${target.accountId}/profile`,{headers})).status,404);
    const customer=await f.sessions.login({email:target.email,password},'127.0.0.1');
    const own=await post({phone:'123'},{Cookie:`conecta_session=${customer.sessionToken}`,'X-CSRF-Token':customer.csrfToken});assert.equal(own.status,200);
    assert.equal((await fetch(base,{headers:{...headers,Cookie:`conecta_session=${customer.sessionToken}`}})).status,403);
    const query=f.pool.query;
    f.pool.query=async()=>{throw new Error('private connection details');};
    try{
      const unavailable=await fetch(base,{headers});assert.equal(unavailable.status,503);
      assert.deepEqual(await unavailable.json(),{code:'UNAVAILABLE'});
    }finally{f.pool.query=query;}
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await f.pool.end();}
});

test('account authorization is fresh; audit failures roll back profile changes and preserve credentials',async()=>{
  const f=await fixture();
  try{
    const actor=await createAuthAccount(f.pool,'manager@example.test',['manager']);const target=await createAuthAccount(f.pool);
    const login=await f.sessions.login({email:actor.email,password},'127.0.0.1');
    const before=(await f.pool.query('SELECT * FROM accounts WHERE id=$1',[target.accountId])).rows[0];
    const stale=createAccountService(f.pool,{...f.sessions,resolve:async(...args)=>{const context=await f.sessions.resolve(...args);await f.pool.query("UPDATE account_roles SET role='customer' WHERE account_id=$1",[actor.accountId]);return context;}});
    await assert.rejects(stale.update(target.accountId,{fullName:'Stale access'},login.sessionToken),{message:'FORBIDDEN'});
    await f.pool.query("UPDATE account_roles SET role='manager' WHERE account_id=$1",[actor.accountId]);
    await assert.rejects(stale.list({},login.sessionToken),{message:'FORBIDDEN'});
    await f.pool.query("UPDATE account_roles SET role='manager' WHERE account_id=$1",[actor.accountId]);
    await f.pool.query(`CREATE FUNCTION reject_profile_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END $$;
      CREATE TRIGGER reject_profile_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_profile_audit()`);
    await assert.rejects(f.accounts.update(target.accountId,{fullName:'Rollback'},login.sessionToken));
    assert.equal((await f.pool.query('SELECT full_name FROM people WHERE id=$1',[target.personId])).rows[0].full_name,'Auth fixture');
    await f.pool.query('DROP TRIGGER reject_profile_audit ON audit_events');
    await f.accounts.update(target.accountId,{fullName:' Audited name ',phone:'123',preferredLocale:'en'},login.sessionToken);
    assert.deepEqual((await f.pool.query('SELECT * FROM accounts WHERE id=$1',[target.accountId])).rows[0],before);
    const event=(await f.pool.query("SELECT * FROM audit_events WHERE action='account.profile_updated'")).rows[0];assert.equal(event.actor_id,actor.accountId);assert.equal(event.actor_type,'staff');
    assert.deepEqual(event.changes.after,{fullName:'Audited name',phone:'123',preferredLocale:'en'});
    assert.equal(JSON.stringify(event).includes(before.password_hash),false);
    await f.sessions.logout(login.sessionToken);await assert.rejects(f.accounts.list({},login.sessionToken),{message:'UNAUTHENTICATED'});
  }finally{await f.pool.end();}
});

test('cross-management updates serialize without deadlock and expired locked sessions cannot write',async()=>{
  const f=await fixture();
  try{
    const first=await createAuthAccount(f.pool,'first-manager@example.test',['manager']);const second=await createAuthAccount(f.pool,'second-manager@example.test',['manager']);
    const a=await f.sessions.login({email:first.email,password},'127.0.0.1');const b=await f.sessions.login({email:second.email,password},'127.0.0.1');
    const results=await Promise.all([f.accounts.update(second.accountId,{fullName:'Second updated'},a.sessionToken),f.accounts.update(first.accountId,{fullName:'First updated'},b.sessionToken)]);
    assert.equal(results.length,2);
    const expired=createAccountService(f.pool,f.sessions,{now:()=>new Date(Date.now()+8*86400000)});
    await assert.rejects(expired.update(second.accountId,{fullName:'Expired access'},a.sessionToken),{message:'UNAUTHENTICATED'});
    assert.equal((await f.pool.query('SELECT full_name FROM people WHERE id=$1',[second.personId])).rows[0].full_name,'Second updated');
    const unavailable=createAccountService({connect:async()=>{throw new Error('private database failure');}},f.sessions);
    await assert.rejects(unavailable.list({},a.sessionToken),{message:'private database failure'});
  }finally{await f.pool.end();}
});
