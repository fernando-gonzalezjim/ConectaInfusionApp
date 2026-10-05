import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {createAuthAccount,authConfig,password} from './identity-auth-helpers.mjs';
import {createSessionService} from '../../dist/modules/identity/sessions.js';
import {createChildDetailsService} from '../../dist/modules/identity/child-details.js';
import {createFamilyInTransaction,joinFamilyInTransaction} from '../../dist/modules/identity/families.js';
async function fixture(){const db=await isolatedDatabase();migrate(db.name);const config=authConfig(),sessions=await createSessionService(db.pool,config);
  async function account(email,roles=['customer']){const value=await createAuthAccount(db.pool,email,roles),login=await sessions.login({email,password},'127.0.0.1');return {...value,token:login.sessionToken,csrf:login.csrfToken};}
  return {...db,config,sessions,account,service:createChildDetailsService(db.pool,sessions)};}

test('dependent profiles enforce current guardians, preserve no-login identity and audit changes atomically',async()=>{
  const f=await fixture();try{
    const parent=await f.account('parent@example.test'),other=await f.account('other@example.test'),manager=await f.account('manager@example.test',['manager']);
    const familyClient=await f.pool.connect();try{await familyClient.query('BEGIN');const context={actor:{id:'controlled-fixture',type:'system'},reason:'Synthetic family membership without guardianship',correlationId:randomUUID()};const family=await createFamilyInTransaction(familyClient,{name:'Shared pool',creatorPersonId:parent.personId},context);await joinFamilyInTransaction(familyClient,{familyId:family.id,personId:other.personId,expectedVersion:0,acceptance:{invitationId:randomUUID(),acceptedByPersonId:other.personId,acceptedAt:new Date()}},context);await familyClient.query('COMMIT');}catch(error){await familyClient.query('ROLLBACK');throw error;}finally{familyClient.release();}
    const child=await f.service.createDependent({fullName:'Fictional child',ageText:'8 años'},parent.token);
    assert.equal(child.guardians.length,1);assert.equal(child.guardians[0].accountId,parent.accountId);
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM accounts WHERE person_id=$1',[child.id])).rows[0].n,0);
    assert.equal((await f.service.listDependents({},parent.token)).items.length,1);
    for(const actor of [other,manager])await assert.rejects(f.service.getDependent(child.id,actor.token));
    const fixtureClient=await f.pool.connect();try{await fixtureClient.query('BEGIN');const relationshipId=randomUUID();
      await fixtureClient.query("INSERT INTO guardian_consent_exceptions(relationship_id,reason) VALUES ($1,'development_fixture')",[relationshipId]);
      await fixtureClient.query("INSERT INTO dependent_guardians(id,dependent_person_id,guardian_account_id,source,accepted_by_account_id,accepted_invitation_id) VALUES ($1,$2,$3,'accepted_invitation',$3,$4)",[relationshipId,child.id,other.accountId,randomUUID()]);await fixtureClient.query('COMMIT');
    }catch(error){await fixtureClient.query('ROLLBACK');throw error;}finally{fixtureClient.release();}
    const updated=await f.service.updateDependent(child.id,{fullName:'Edited child',ageText:'9 años',preferredLocale:'en',expectedVersion:0},other.token);
    assert.equal(updated.version,1);assert.equal(updated.guardians.length,2);
    await assert.rejects(f.service.updateDependent(child.id,{fullName:'Stale',ageText:'8',expectedVersion:0},parent.token),{message:'CONFLICT'});
    await assert.rejects(f.service.createDependent({fullName:'Injected',ageText:'8',guardianAccountId:other.accountId},parent.token),{message:'INVALID_REQUEST'});
    await f.pool.query("CREATE FUNCTION reject_child_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='dependent.profile_updated' THEN RAISE EXCEPTION 'controlled audit failure'; END IF; RETURN NEW; END $$");
    await f.pool.query('CREATE TRIGGER reject_child_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_child_audit()');
    await assert.rejects(f.service.updateDependent(child.id,{fullName:'Rollback',ageText:'10',expectedVersion:1},parent.token),{message:'controlled audit failure'});
    assert.equal((await f.service.getDependent(child.id,parent.token)).fullName,'Edited child');
    await f.pool.query('DROP TRIGGER reject_child_audit ON audit_events');
    await f.pool.query("UPDATE dependent_guardians SET ended_at=clock_timestamp(),end_reason='self_removed' WHERE dependent_person_id=$1 AND guardian_account_id=$2",[child.id,other.accountId]);
    await assert.rejects(f.service.getDependent(child.id,other.token));
    assert.equal((await f.service.listDependents({},other.token)).items.length,0);
    await f.service.createDependent({fullName:'Second fictional child',ageText:'10'},parent.token);
    const firstPage=await f.service.listDependents({limit:'1'},parent.token);
    assert.equal(firstPage.items.length,1);assert.ok(firstPage.nextCursor);
    const secondPage=await f.service.listDependents({limit:'1',cursor:firstPage.nextCursor},parent.token);
    assert.equal(secondPage.items.length,1);assert.equal(secondPage.nextCursor,null);assert.notEqual(firstPage.items[0].id,secondPage.items[0].id);
  }finally{await f.pool.end();}
});

test('owned reusable child details convert once without changing booking snapshots, account actor or original identity',async()=>{
  const f=await fixture();try{
    const parent=await f.account('parent@example.test'),outsider=await f.account('outsider@example.test');
    const saved=await f.service.createChild({childName:'Reusable child',ageText:'7 years'},parent.token);
    assert.equal(saved.dependentPersonId,null);assert.equal((await f.service.listChildren({},parent.token)).items.length,1);
    await assert.rejects(f.service.getChild(saved.id,outsider.token));
    const edited=await f.service.updateChild(saved.id,{childName:'Edited saved child',ageText:'8 years',expectedVersion:0},parent.token);
    const member=(await f.pool.query("INSERT INTO members(full_name,email,person_id) VALUES ('Parent',$1,$2) RETURNING id",[parent.email,parent.personId])).rows[0].id;
    const teacher=(await f.pool.query("INSERT INTO instructors(full_name) VALUES ('Fictional teacher') RETURNING id")).rows[0].id;
    const session=(await f.pool.query("INSERT INTO class_sessions(title,instructor_id,starts_at,duration_minutes,capacity) VALUES ('Yoga Kids',$1,now(),60,16) RETURNING id",[teacher])).rows[0].id;
    const booking=(await f.pool.query('INSERT INTO bookings(member_id,class_session_id,acting_account_id,saved_child_details_id,child_name_snapshot,child_age_snapshot) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',[member,session,parent.accountId,saved.id,edited.childName,edited.ageText])).rows[0];
    const results=await Promise.allSettled([1,2].map(()=>f.service.convertChild(saved.id,{expectedVersion:edited.version},parent.token)));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.message,'CONFLICT');
    const converted=results.find(r=>r.status==='fulfilled').value;
    assert.equal(converted.child.dependentPersonId,converted.dependent.id);assert.equal(converted.dependent.fullName,edited.childName);
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM dependent_profiles')).rows[0].n,1);
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM accounts WHERE person_id=$1',[converted.dependent.id])).rows[0].n,0);
    assert.deepEqual((await f.pool.query('SELECT * FROM bookings WHERE id=$1',[booking.id])).rows[0],booking,'Conversion preserves original acting account, attendee snapshot and booking history');
    await assert.rejects(f.service.convertChild(saved.id,{expectedVersion:converted.child.version},parent.token),{message:'CONFLICT'});
    await assert.rejects(f.service.updateChild(saved.id,{childName:'Bad',ageText:'8',expectedVersion:converted.child.version,ownerAccountId:outsider.accountId},parent.token),{message:'INVALID_REQUEST'});
    const events=(await f.pool.query("SELECT actor_id,action,changes FROM audit_events WHERE action LIKE 'child_details.%'")).rows;
    assert.equal(events.length,3);assert.ok(events.every(row=>row.actor_id===parent.accountId));
    assert.ok(events.every(row=>!JSON.stringify(row.changes).includes('Edited saved child')),'Audit contains references/versions, not child text');
    await assert.rejects(f.service.listChildren({limit:'51'},parent.token),{message:'INVALID_REQUEST'});
    const unconverted=await f.service.createChild({childName:'Rollback child',ageText:'9'},parent.token);
    const peopleBefore=(await f.pool.query('SELECT count(*)::int n FROM people')).rows[0].n;
    await f.pool.query("CREATE FUNCTION reject_conversion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='child_details.converted' THEN RAISE EXCEPTION 'controlled conversion audit failure'; END IF; RETURN NEW; END $$");
    await f.pool.query('CREATE TRIGGER reject_conversion BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_conversion()');
    await assert.rejects(f.service.convertChild(unconverted.id,{expectedVersion:0},parent.token),{message:'controlled conversion audit failure'});
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM people')).rows[0].n,peopleBefore);
    assert.deepEqual(await f.service.getChild(unconverted.id,parent.token),unconverted);
  }finally{await f.pool.end();}
});

test('dependent HTTP uses private Origin/session/CSRF guards, bounded JSON, safe DTOs and owner-only conversion',async()=>{
  const f=await fixture();let server;const previous=process.env.DATABASE_URL;try{
    const parent=await f.account('parent@example.test'),outsider=await f.account('outsider@example.test');
    process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/unused';const {createApplication}=await import('../../dist/app.js');
    server=(await createApplication({database:f.pool,identityConfig:f.config,environment:{NODE_ENV:'test'}})).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
    const base=`http://127.0.0.1:${server.address().port}/api/v1`,Origin='http://localhost:5173';
    const post=(path,body,actor=parent,extra={})=>fetch(base+path,{method:'POST',headers:{Origin,'Content-Type':'application/json',Cookie:`conecta_session=${actor.token}`,'X-CSRF-Token':actor.csrf,...extra},body:JSON.stringify(body)});
    for(const path of ['/dependents','/child-details']){
      assert.equal((await post(path,{},parent,{Origin:'https://evil.example'})).status,403);
      assert.equal((await post(path,{},parent,{'X-CSRF-Token':''})).status,403);
      assert.equal((await post(path,{},parent,{Cookie:''})).status,401);
      assert.equal((await post(path,{fullName:'x'.repeat(3000)})).status,413);
      assert.equal((await post(path,{childName:'Child',ageText:'8',email:'invented@example.test'})).status,400);
      assert.equal((await fetch(base+path,{headers:{Origin}})).status,401);
    }
    const created=await post('/child-details',{childName:'HTTP child',ageText:'8 años'});assert.equal(created.status,201);assert.equal(created.headers.get('cache-control'),'no-store');const saved=await created.json();
    assert.deepEqual(Object.keys(saved).sort(),['ageText','childName','dependentPersonId','id','version']);
    assert.equal((await post(`/child-details/${saved.id}/convert`,{expectedVersion:0},outsider)).status,404);
    const converted=await post(`/child-details/${saved.id}/convert`,{expectedVersion:0});assert.equal(converted.status,201);const child=(await converted.json()).dependent;
    assert.equal((await fetch(base+`/dependents/${child.id}`,{headers:{Origin,Cookie:`conecta_session=${outsider.token}`}})).status,404);
    assert.equal((await post(`/dependents/${child.id}`,{fullName:'Unauthorized',ageText:'9',expectedVersion:0},outsider)).status,404);
    assert.equal((await post(`/dependents/${child.id}`,{fullName:'Updated',ageText:'9',expectedVersion:0})).status,200);
    assert.equal((await post(`/dependents/${child.id}`,{fullName:'Stale',ageText:'9',expectedVersion:0})).status,409);
    assert.equal((await fetch(base+`/dependents/${child.id}`,{method:'DELETE',headers:{Origin,Cookie:`conecta_session=${parent.token}`}})).status,404);
    const manager=await f.account('auditmanager@example.test',['manager']);
    await f.pool.query(`INSERT INTO audit_events(actor_id,actor_type,action,target_type,target_id,changes,reason,correlation_id) VALUES ($1,'customer','dependent.profile_updated','dependent',$2,$3,'Controlled projection test',$4)`,[parent.accountId,child.id,JSON.stringify({before:null,after:{personId:child.id,version:1,fullName:'Private child',childName:'Private child',ageText:'9',token:'secret'}}),randomUUID()]);
    const history=await fetch(base+'/audit',{headers:{Origin,Cookie:`conecta_session=${manager.token}`}});assert.equal(history.status,200);
    const events=(await history.json()).events.filter(row=>row.targetType==='dependent'||row.targetType==='child_details');
    assert.ok(events.length>=4);assert.ok(events.every(row=>row.targetName===null));
    assert.ok(events.every(row=>Object.keys(row.changes.after??{}).every(key=>['personId','version'].includes(key))));
    await f.sessions.logout(parent.token);assert.equal((await post('/child-details',{childName:'Denied',ageText:'9'})).status,401);
  }finally{process.env.DATABASE_URL=previous;if(previous===undefined)delete process.env.DATABASE_URL;if(server)await new Promise(r=>server.close(r));await f.pool.end();}
});
