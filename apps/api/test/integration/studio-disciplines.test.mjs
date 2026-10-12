import test from 'node:test';
import assert from 'node:assert/strict';
import { isolatedDatabase, migrate } from './identity-helpers.mjs';
import { authConfig, createAuthAccount, password } from './identity-auth-helpers.mjs';
import { createSessionService } from '../../dist/modules/identity/sessions.js';
import { createAccountService } from '../../dist/modules/identity/accounts.js';
import { createDisciplineService } from '../../dist/modules/studio/disciplines.js';
import {createIdentityLifecycleComposition} from '../../dist/composition/identity-lifecycle.js';
import {randomUUID} from 'node:crypto';

test('known V15 relations do not substitute for lifecycle coordinators and unknown relations remain blocked',async()=>{
  const f=await fixture();const client=await f.pool.connect();
  try{
    const actor=await f.actor('manager');
    const request={actorAccountId:actor.accountId,personIds:[actor.personId],operation:'account-deactivation',identityRevision:'schema-regression'};
    await client.query('BEGIN');
    const missing=await createIdentityLifecycleComposition().preview(client,request);
    assert.equal(missing.status,'blocked');assert.ok(missing.reasons.includes('INTEGRATION_REQUIRED'));
    assert.ok(!missing.reasons.includes('UNKNOWN_SCHEMA'));
    const adapters=['credits-bookings','studio-catalog','instructor-payroll'].map(domain=>({domain,tables:domain==='studio-catalog'
      ?['studio_disciplines','studio_classes','studio_legacy_session_reconciliation']:[],handlesLegacy:true,
      inspect:async()=>({status:'ready',revision:'test-only',assurances:{atomic:true,audit:true,preservesHistory:true}}),
      apply:async()=>({status:'applied',revision:'test-only'})}));
    assert.equal((await createIdentityLifecycleComposition(adapters).preview(client,request)).status,'ready');
    await client.query(`CREATE TABLE unknown_${randomUUID().replaceAll('-','')} (id integer)`);
    const unknown=await createIdentityLifecycleComposition(adapters).preview(client,request);
    assert.deepEqual(unknown,{status:'blocked',reasons:['UNKNOWN_SCHEMA']});
  }finally{await client.query('ROLLBACK');client.release();await f.pool.end();}
});

async function fixture() {
  const db=await isolatedDatabase(); migrate(db.name);
  const config=authConfig();
  const sessions=await createSessionService(db.pool,config,{environment:{NODE_ENV:'test'}});
  const disciplines=createDisciplineService(createAccountService(db.pool,sessions));
  async function actor(role,email=`${role}@example.test`) {
    const account=await createAuthAccount(db.pool,email,[role]);
    return {...account,...await sessions.login({email,password},'127.0.0.1')};
  }
  return {...db,config,sessions,disciplines,actor};
}

test('a discipline mutation queued on the catalog lock cannot write after session expiry',async()=>{
  const f=await fixture();const holder=await f.pool.connect();let queued;
  try{
    const actor=await f.actor('manager');
    const session=await f.sessions.resolve(actor.sessionToken);
    await holder.query('BEGIN');
    await holder.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['studio-catalog:publication']);
    await f.pool.query(`WITH boundary AS (SELECT clock_timestamp()+interval '1 second' AS expiry)
      UPDATE identity_sessions SET expires_at=boundary.expiry,created_at=boundary.expiry-interval '168 hours',
        authenticated_at=boundary.expiry-interval '1 hour' FROM boundary WHERE id=$1`,[session.sessionId]);
    let authorized;const gate=new Promise(resolve=>{authorized=resolve;});
    const administration=createAccountService(f.pool,f.sessions);
    const service=createDisciplineService({withManagementRead:(token,work)=>administration.withManagementRead(token,(client,context)=>{
      authorized(context);return work(client,context);
    })});
    queued=service.create({nameEs:'Expired while queued'},actor.sessionToken).then(value=>({value}),error=>({error}));
    const context=await gate;
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,Date.parse(context.expiresAt)-Date.now()+50)));
    await holder.query('COMMIT');
    assert.equal((await queued).error?.message,'UNAUTHENTICATED');
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_disciplines')).rows[0].n,0);
    assert.equal((await f.pool.query("SELECT count(*)::int n FROM audit_events WHERE action='studio.discipline_created'")).rows[0].n,0);
  }finally{
    await holder.query('ROLLBACK');holder.release();
    if(queued)await queued;await f.pool.end();
  }
});

test('discipline maintenance accepts management only, validates fields and keeps bounded bilingual listing',async()=>{
  const f=await fixture();try{
    const admin=await f.actor('administrator');const manager=await f.actor('manager');
    const created=await f.disciplines.create({nameEs:' Yoga ',nameEn:'Yoga',descriptionEs:'Descripción publicada',status:'published'},admin.sessionToken);
    assert.equal(created.nameEs,'Yoga');assert.equal(created.version,1);assert.equal(created.status,'published');
    const draft=await f.disciplines.create({nameEs:'Ballet'},manager.sessionToken);
    assert.equal(draft.nameEn,null);assert.equal(draft.descriptionEn,null);assert.equal(draft.status,'draft');
    const first=await f.disciplines.list({limit:'1'},admin.sessionToken);
    assert.equal(first.items.length,1);assert.ok(first.nextCursor);
    const next=await f.disciplines.list({limit:'1',cursor:first.nextCursor},admin.sessionToken);
    assert.equal(next.items.length,1);assert.equal(next.nextCursor,null);assert.notEqual(next.items[0].id,first.items[0].id);
    for(const query of [{limit:'0'},{limit:'51'},{cursor:'invalid'},{status:'unknown'},{role:'manager'}]){
      await assert.rejects(f.disciplines.list(query,admin.sessionToken),{message:'INVALID_REQUEST'});
    }
    for(const role of ['customer','reception','cafe_staff','instructor']){
      const actor=await f.actor(role);
      await assert.rejects(f.disciplines.list({},actor.sessionToken),{message:'FORBIDDEN'});
      await assert.rejects(f.disciplines.create({nameEs:'Forged'},actor.sessionToken),{message:'FORBIDDEN'});
      await assert.rejects(f.disciplines.update(created.id,{nameEs:'Forged',expectedVersion:1},actor.sessionToken),{message:'FORBIDDEN'});
    }
    for(const input of [{nameEs:''},{nameEs:'Yoga',actorId:admin.accountId},{nameEs:'Yoga',roles:['manager']},
      {nameEs:'Yoga',status:'archived'},{nameEs:'Yoga',status:'published'}, {nameEs:'Yoga',nameEn:123}, {nameEs:'Yoga\u0000'}]){
      await assert.rejects(f.disciplines.create(input,admin.sessionToken),{message:'INVALID_REQUEST'});
    }
    for(const input of [{nameEs:'No revision'}, {expectedVersion:0,nameEs:'Invalid'},
      {expectedVersion:1,nameEs:'Forged',priceMinor:1},{expectedVersion:1,reason:'x'.repeat(501),nameEs:'Invalid'}]){
      await assert.rejects(f.disciplines.update(created.id,input,admin.sessionToken),{message:'INVALID_REQUEST'});
    }
    const audit=(await f.pool.query("SELECT actor_id,actor_type,business_unit,target_type,target_id FROM audit_events WHERE action='studio.discipline_created' AND target_id=$1",[created.id])).rows[0];
    assert.deepEqual(audit,{actor_id:admin.accountId,actor_type:'staff',business_unit:'studio',target_type:'discipline',target_id:created.id});
    const staleActor=createDisciplineService(createAccountService(f.pool,{...f.sessions,resolve:async(...args)=>{
      const context=await f.sessions.resolve(...args);
      await f.pool.query("DELETE FROM account_roles WHERE account_id=$1 AND role='administrator'",[admin.accountId]);
      return context;
    }}));
    await assert.rejects(staleActor.create({nameEs:'Resolved authority was revoked'},admin.sessionToken),{message:'FORBIDDEN'});
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_disciplines')).rows[0].n,2);
  }finally{await f.pool.end();}
});

test('discipline updates reject stale concurrent revisions and roll back when audit insertion fails',async()=>{
  const f=await fixture();try{
    const a=await f.actor('administrator');const b=await f.actor('manager');
    const created=await f.disciplines.create({nameEs:'Yoga'},a.sessionToken);
    const results=await Promise.allSettled([
      f.disciplines.update(created.id,{nameEs:'First edit',expectedVersion:1},a.sessionToken),
      f.disciplines.update(created.id,{nameEs:'Second edit',expectedVersion:1},b.sessionToken)
    ]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.find(r=>r.status==='rejected').reason.message,'CONFLICT');
    const before=(await f.pool.query('SELECT * FROM studio_disciplines WHERE id=$1',[created.id])).rows[0];
    assert.equal(before.version,2);
    await assert.rejects(f.disciplines.update(created.id,{nameEs:'Stale',expectedVersion:1},a.sessionToken),{message:'CONFLICT'});
    assert.equal((await f.pool.query("SELECT count(*)::int n FROM audit_events WHERE action='studio.discipline_updated' AND target_id=$1",[created.id])).rows[0].n,1);
    await f.pool.query(`CREATE FUNCTION reject_studio_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.action LIKE 'studio.discipline_%' THEN RAISE EXCEPTION 'forced audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_studio_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_studio_audit()`);
    await assert.rejects(f.disciplines.update(created.id,{nameEs:'Must roll back',expectedVersion:2},a.sessionToken));
    await assert.rejects(f.disciplines.create({nameEs:'Must not persist'},a.sessionToken));
    assert.deepEqual((await f.pool.query('SELECT * FROM studio_disciplines WHERE id=$1',[created.id])).rows[0],before);
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_disciplines')).rows[0].n,1);
  }finally{await f.pool.end();}
});

test('discipline archive requires explicit resolution of future noncancelled sessions and preserves history',async()=>{
  const f=await fixture();try{
    const a=await f.actor('manager');const created=await f.disciplines.create({nameEs:'Yoga'},a.sessionToken);
    const klass=(await f.pool.query(`INSERT INTO studio_classes(discipline_id,name_es,audience,level,color)
      VALUES ($1,'Fictional class','adults','all','#336699') RETURNING id`,[created.id])).rows[0].id;
    const session=(await f.pool.query(`INSERT INTO class_sessions(title,class_id,status,starts_at,duration_minutes,capacity)
      VALUES ('Future draft',$1,'draft',now()+interval '1 year',55,16) RETURNING id`,[klass])).rows[0].id;
    await assert.rejects(f.disciplines.update(created.id,{status:'archived',expectedVersion:1},a.sessionToken),{message:'CONFLICT'});
    assert.equal((await f.pool.query('SELECT version FROM studio_disciplines WHERE id=$1',[created.id])).rows[0].version,1);
    await f.pool.query("UPDATE class_sessions SET status='cancelled' WHERE id=$1",[session]);
    const archived=await f.disciplines.update(created.id,{status:'archived',expectedVersion:1,reason:'Future session explicitly cancelled'},a.sessionToken);
    assert.equal(archived.status,'archived');assert.equal(archived.version,2);
    assert.equal((await f.pool.query('SELECT class_id,status FROM class_sessions WHERE id=$1',[session])).rows[0].status,'cancelled');
  }finally{await f.pool.end();}
});

test('discipline HTTP routes enforce Origin, CSRF, roles and private responses before mutation',async()=>{
  const f=await fixture();let server;try{
    const a=await f.actor('administrator');const customer=await f.actor('customer');
    process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused';process.env.IDENTITY_ENABLED='false';
    const {createApplication}=await import('../../dist/app.js');
    server=(await createApplication({database:f.pool,identityConfig:f.config,environment:{NODE_ENV:'test'}})).listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${server.address().port}/api/v1/management/studio/disciplines`;
    const headers={Origin:'http://localhost:5174',Cookie:`conecta_session=${a.sessionToken}`,'X-CSRF-Token':a.csrfToken,'Content-Type':'application/json'};
    const post=(path,input,extra={})=>fetch(base+path,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(input)});
    assert.equal((await fetch(base)).status,401);
    assert.equal((await post('',{nameEs:'Denied'},{Origin:'http://evil.example'})).status,403);
    assert.equal((await post('',{nameEs:'Denied'},{'X-CSRF-Token':''})).status,403);
    const customerHeaders={Cookie:`conecta_session=${customer.sessionToken}`,'X-CSRF-Token':customer.csrfToken};
    assert.equal((await post('',{nameEs:'Denied'},customerHeaders)).status,403);
    assert.equal((await fetch(base,{headers:{...headers,...customerHeaders}})).status,403);
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_disciplines')).rows[0].n,0);
    const response=await post('',{nameEs:'Yoga'});assert.equal(response.status,201);assert.equal(response.headers.get('cache-control'),'no-store');
    const created=await response.json();
    const changed=await post(`/${created.id}`,{nameEs:'Updated yoga',expectedVersion:1});assert.equal(changed.status,200);assert.equal((await changed.json()).version,2);
    const stale=await post(`/${created.id}`,{nameEs:'Stale',expectedVersion:1});assert.equal(stale.status,409);assert.deepEqual(await stale.json(),{code:'CONFLICT'});
    const list=await fetch(base,{headers});assert.equal(list.status,200);assert.equal(list.headers.get('cache-control'),'no-store');assert.equal((await list.json()).items[0].nameEs,'Updated yoga');
    await f.pool.query("DELETE FROM account_roles WHERE account_id=$1 AND role='administrator'",[a.accountId]);
    assert.equal((await post('',{nameEs:'After demotion'})).status,403);
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await f.pool.end();}
});
