import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {authConfig,createAuthAccount,password} from './identity-auth-helpers.mjs';
import {createSessionService} from '../../dist/modules/identity/sessions.js';
import {createAccountService} from '../../dist/modules/identity/accounts.js';
import {createAuditViewService} from '../../dist/modules/identity/audit-view.js';

test('operational audit denies ordinary roles and paginates microsecond/tied rows without raw secrets',async()=>{
  const db=await isolatedDatabase();migrate(db.name);
  try{
    const sessions=await createSessionService(db.pool,authConfig()),accounts=createAccountService(db.pool,sessions),audit=createAuditViewService(accounts);
    for(const role of ['customer','instructor','reception','cafe_staff']){
      const actor=await createAuthAccount(db.pool,`${role}@example.test`,[role]),login=await sessions.login({email:actor.email,password},'127.0.0.1');
      await assert.rejects(audit.list({},login.sessionToken),{message:'FORBIDDEN'});
    }
    const manager=await createAuthAccount(db.pool,'manager@example.test',['manager']),login=await sessions.login({email:manager.email,password},'127.0.0.2');
    const ids=Array.from({length:5},()=>randomUUID());
    for(const [index,id] of ids.entries())await db.pool.query(`INSERT INTO audit_events(id,occurred_at,actor_id,actor_type,action,target_type,target_id,changes,reason,correlation_id)
      VALUES ($1,$2,$3,'staff','account.profile_updated','account',$3,$4,'secret reason not exposed',$5)`,[id,`2026-10-01T12:00:00.00000${index<2?1:index}Z`,manager.accountId,
      JSON.stringify({before:{fullName:'Before',password:'password secret'},after:{fullName:'After',password_hash:'hash secret',sessionToken:'token secret',nested:{private:'nested secret'},roles:['manager']},other:'raw secret'}),randomUUID()]);
    const expected=(await db.pool.query('SELECT id FROM audit_events ORDER BY occurred_at DESC,id DESC')).rows.map(row=>row.id),seen=[];let cursor;
    do{const page=await audit.list({limit:'2',...(cursor?{cursor}:{})},login.sessionToken);seen.push(...page.events.map(event=>event.id));cursor=page.nextCursor;
      const text=JSON.stringify(page);assert.doesNotMatch(text,/secret|password|sessionToken|nested/);assert.deepEqual(page.events[0].changes.after,{fullName:'After',roles:['manager']});
    }while(cursor);
    assert.deepEqual(seen,expected);
    await db.pool.query(`INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,changes,reason,correlation_id)
      VALUES ('actor secret','system','action secret','target secret','target secret',$1,'reason secret',$2)`,[JSON.stringify({before:{password:'secret'},after:{token:'secret'}}),randomUUID()]);
    const unknown=(await audit.list({},login.sessionToken)).events[0];assert.equal(unknown.action,'other');assert.equal(unknown.actorId,null);assert.equal(unknown.targetId,null);
    assert.deepEqual(unknown.changes,{before:null,after:null});assert.doesNotMatch(JSON.stringify(unknown),/secret/);
    for(const query of [{limit:'51'},{limit:'0'},{cursor:'../bad'},{actorId:manager.accountId}])await assert.rejects(audit.list(query,login.sessionToken),{message:'INVALID_REQUEST'});
    await db.pool.query("DELETE FROM account_roles WHERE account_id=$1 AND role='manager'",[manager.accountId]);
    await assert.rejects(audit.list({},login.sessionToken),{message:'FORBIDDEN'});
  }finally{await db.pool.end();}
});

test('audit HTTP is read-only, origin-protected and rechecks revoked privileged sessions',async()=>{
  const db=await isolatedDatabase();migrate(db.name);let server;
  try{
    const config=authConfig(),sessions=await createSessionService(db.pool,config),actor=await createAuthAccount(db.pool,'admin@example.test',['administrator']);
    const login=await sessions.login({email:actor.email,password},'127.0.0.1');
    process.env.IDENTITY_ENABLED='false';process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused';
    const {createApplication}=await import('../../dist/app.js');const app=await createApplication({database:db.pool,identityConfig:config});
    server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${server.address().port}/api/v1/audit`,headers={Origin:'http://localhost:5174',Cookie:`conecta_session=${login.sessionToken}`};
    assert.equal((await fetch(base,{headers:{Origin:headers.Origin}})).status,401);assert.equal((await fetch(base,{headers:{...headers,Origin:'http://foreign.test'}})).status,403);
    const response=await fetch(base,{headers});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal((await fetch(base+'?limit=51',{headers})).status,400);assert.equal((await fetch(base,{method:'POST',headers})).status,404);
    await sessions.logoutAll(login.sessionToken);assert.equal((await fetch(base,{headers})).status,401);
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await db.pool.end();}
});
