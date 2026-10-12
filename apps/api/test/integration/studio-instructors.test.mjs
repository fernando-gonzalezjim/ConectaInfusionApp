import test from 'node:test';
import assert from 'node:assert/strict';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {authConfig,createAuthAccount,password} from './identity-auth-helpers.mjs';
import {createSessionService} from '../../dist/modules/identity/sessions.js';
import {createAccountService} from '../../dist/modules/identity/accounts.js';
import {createInstructorService} from '../../dist/modules/studio/instructors.js';
import {createDisciplineService} from '../../dist/modules/studio/disciplines.js';

async function fixture(){
  const db=await isolatedDatabase();migrate(db.name);
  const sessions=await createSessionService(db.pool,authConfig(),{environment:{NODE_ENV:'test'}});
  const accounts=createAccountService(db.pool,sessions),service=createInstructorService(db.pool,accounts),disciplines=createDisciplineService(accounts);
  async function actor(role,email=`${role}@example.test`){const a=await createAuthAccount(db.pool,email,[role]);return {...a,...await sessions.login({email,password},'127.0.0.1')};}
  const manager=await actor('manager'),instructor=await actor('instructor');
  const instructorId=(await db.pool.query("INSERT INTO instructors(full_name,person_id) VALUES('Private legacy name',$1) RETURNING id",[instructor.personId])).rows[0].id;
  const discipline=await disciplines.create({nameEs:'Yoga',descriptionEs:'Yoga guidance',status:'published'},manager.sessionToken);
  return {...db,sessions,accounts,service,disciplines,actor,manager,instructor,instructorId,discipline};
}
test('instructor catalog explicitly links public facts without adopting private Identity or legacy metadata',async()=>{
  const f=await fixture();try{
    assert.equal(await f.service.own(f.instructor.sessionToken),null);
    assert.equal((await f.service.list({},f.manager.sessionToken)).items.length,0);
    assert.deepEqual((await f.service.candidates({},f.manager.sessionToken)).items,[{instructorId:f.instructorId,name:'Auth fixture'}]);
    const input={instructorId:f.instructorId,publicName:'Approved public name',biographyEs:'Biografía aprobada',status:'published',disciplineIds:[f.discipline.id]};
    const profile=await f.service.create(input,f.manager.sessionToken);
    assert.equal(profile.publicName,input.publicName);assert.equal(profile.photo,null);assert.equal(profile.version,1);
    assert.deepEqual(await f.service.own(f.instructor.sessionToken),profile);
    for(const field of ['email','personId','accountId','photoId','fullName'])assert.ok(!(field in profile));
    assert.equal((await f.pool.query('SELECT full_name FROM instructors WHERE id=$1',[f.instructorId])).rows[0].full_name,'Private legacy name');
    for(const spoof of [{photoId:f.instructorId},{photoUrl:'https://example.test/private.jpg'},{personId:f.manager.personId}])await assert.rejects(f.service.update(f.instructorId,{expectedVersion:1,...spoof},f.manager.sessionToken),{message:'INVALID_REQUEST'});
    for(const malformed of [{status:null},{disciplineIds:null},{disciplineIds:[f.discipline.id,f.discipline.id]},{biographyEs:'Invalid\u0000'}])await assert.rejects(f.service.update(f.instructorId,{expectedVersion:1,...malformed},f.manager.sessionToken),{message:'INVALID_REQUEST'});
    const updated=await f.service.update(f.instructorId,{expectedVersion:1,biographyEn:'Approved English'},f.manager.sessionToken);
    assert.equal(updated.version,2);assert.equal(updated.biographyEn,'Approved English');
    await assert.rejects(f.service.update(f.instructorId,{expectedVersion:1,publicName:'Stale'},f.manager.sessionToken),{message:'CONFLICT'});
    await assert.rejects(f.service.update(f.instructorId,{expectedVersion:2},f.instructor.sessionToken),{message:'FORBIDDEN'});
    assert.equal((await f.pool.query("SELECT count(*)::int n FROM audit_events WHERE action LIKE 'studio.instructor_%'")).rows[0].n,2);
  }finally{await f.pool.end();}
});
test('instructor catalog requires current teaching role, active linked Identity and published qualifications',async()=>{
  const f=await fixture();try{
    const draft=await f.disciplines.create({nameEs:'Draft'},f.manager.sessionToken);
    const input={instructorId:f.instructorId,publicName:'Approved',status:'published',disciplineIds:[draft.id]};
    await assert.rejects(f.service.create(input,f.manager.sessionToken),{message:'CONFLICT'});
    await assert.rejects(f.service.create({...input,disciplineIds:[]},f.manager.sessionToken),{message:'INVALID_REQUEST'});
    await f.pool.query("DELETE FROM account_roles WHERE account_id=$1 AND role='instructor'",[f.instructor.accountId]);
    await assert.rejects(f.service.create({...input,disciplineIds:[f.discipline.id]},f.manager.sessionToken),{message:'CONFLICT'});
    await assert.rejects(f.service.own(f.instructor.sessionToken),{message:'FORBIDDEN'});
    assert.equal((await f.service.candidates({},f.manager.sessionToken)).items.length,0);
    await f.pool.query("INSERT INTO account_roles(account_id,role) VALUES($1,'instructor')",[f.instructor.accountId]);
    await f.pool.query("UPDATE people SET status='inactive' WHERE id=$1",[f.instructor.personId]);
    await assert.rejects(f.service.create({...input,disciplineIds:[f.discipline.id]},f.manager.sessionToken),{message:'CONFLICT'});
    await assert.rejects(f.service.own(f.instructor.sessionToken),{message:'UNAUTHENTICATED'});
    const legacy=(await f.pool.query("INSERT INTO instructors(full_name) VALUES('Unlinked legacy') RETURNING id")).rows[0].id;
    await assert.rejects(f.service.create({...input,instructorId:legacy,disciplineIds:[f.discipline.id]},f.manager.sessionToken),{message:'CONFLICT'});
    for(const role of ['customer','reception','cafe_staff']){
      const a=await f.actor(role);await assert.rejects(f.service.list({},a.sessionToken),{message:'FORBIDDEN'});await assert.rejects(f.service.own(a.sessionToken),{message:'FORBIDDEN'});
    }
  }finally{await f.pool.end();}
});
test('instructor qualification changes preserve future teaching history and audit failures roll back',async()=>{
  const f=await fixture();try{
    const p=await f.service.create({instructorId:f.instructorId,publicName:'Approved',status:'published',disciplineIds:[f.discipline.id]},f.manager.sessionToken);
    const legacy=(await f.pool.query("INSERT INTO class_sessions(title,instructor_id,starts_at,duration_minutes,capacity) VALUES('Legacy history',$1,now()+interval '1 day',60,12) RETURNING id",[f.instructorId])).rows[0].id;
    await assert.rejects(f.service.update(f.instructorId,{expectedVersion:1,status:'archived'},f.manager.sessionToken),{message:'CONFLICT'});
    await assert.rejects(f.service.update(f.instructorId,{expectedVersion:1,status:'draft',disciplineIds:[]},f.manager.sessionToken),{message:'CONFLICT'});
    assert.equal((await f.pool.query('SELECT title,duration_minutes FROM class_sessions WHERE id=$1',[legacy])).rows[0].duration_minutes,60);
    await f.pool.query("CREATE FUNCTION reject_instructor_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='studio.instructor_updated' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END $$");
    await f.pool.query('CREATE TRIGGER reject_instructor_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_instructor_audit()');
    await assert.rejects(f.service.update(f.instructorId,{expectedVersion:1,publicName:'Must roll back'},f.manager.sessionToken),/test audit failure/);
    assert.deepEqual(await f.service.own(f.instructor.sessionToken),p);
  }finally{await f.pool.end();}
});
test('instructor catalog rejects management role revoked after resolve before the transaction',async()=>{
  const f=await fixture();try{
    const service=createInstructorService(f.pool,createAccountService(f.pool,{...f.sessions,resolve:async(...args)=>{
      const c=await f.sessions.resolve(...args);await f.pool.query("DELETE FROM account_roles WHERE account_id=$1 AND role='manager'",[f.manager.accountId]);return c;
    }}));
    await assert.rejects(service.create({instructorId:f.instructorId,publicName:'Unauthorized'},f.manager.sessionToken),{message:'FORBIDDEN'});
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_instructor_profiles')).rows[0].n,0);
  }finally{await f.pool.end();}
});
test('concurrent instructor revisions have exactly one winner and one transactional audit',async()=>{
  const f=await fixture();try{
    const other=await f.actor('manager','other-manager@example.test');
    await f.service.create({instructorId:f.instructorId,publicName:'Original',disciplineIds:[f.discipline.id]},f.manager.sessionToken);
    const results=await Promise.allSettled([
      f.service.update(f.instructorId,{expectedVersion:1,publicName:'First'},f.manager.sessionToken),
      f.service.update(f.instructorId,{expectedVersion:1,publicName:'Second'},other.sessionToken)
    ]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.find(r=>r.status==='rejected').reason.message,'CONFLICT');
    assert.equal((await f.service.own(f.instructor.sessionToken)).version,2);
    assert.equal((await f.pool.query("SELECT count(*)::int n FROM audit_events WHERE action='studio.instructor_updated'")).rows[0].n,1);
  }finally{await f.pool.end();}
});
test('target instructor demotion between identification and management authorization cannot publish stale qualifications',async()=>{
  const f=await fixture();try{
    const service=createInstructorService(f.pool,createAccountService(f.pool,{...f.sessions,resolve:async(...args)=>{
      const c=await f.sessions.resolve(...args);await f.pool.query("DELETE FROM account_roles WHERE account_id=$1 AND role='instructor'",[f.instructor.accountId]);return c;
    }}));
    await assert.rejects(service.create({instructorId:f.instructorId,publicName:'Stale qualification',status:'published',disciplineIds:[f.discipline.id]},f.manager.sessionToken),{message:'CONFLICT'});
    assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_instructor_profiles')).rows[0].n,0);
  }finally{await f.pool.end();}
});
test('a manager teaching their own classes cannot retain catalog authority after management demotion',async()=>{
  const f=await fixture();try{
    await f.pool.query("INSERT INTO account_roles(account_id,role) VALUES($1,'manager')",[f.instructor.accountId]);
    const service=createInstructorService(f.pool,createAccountService(f.pool,{...f.sessions,resolve:async(...args)=>{
      const c=await f.sessions.resolve(...args);await f.pool.query("DELETE FROM account_roles WHERE account_id=$1 AND role='manager'",[f.instructor.accountId]);return c;
    }}));
    await assert.rejects(service.create({instructorId:f.instructorId,publicName:'Self bypass'},f.instructor.sessionToken),{message:'FORBIDDEN'});
  }finally{await f.pool.end();}
});
test('unchanged draft qualifications permit public name and biography maintenance without changing future teaching history',async()=>{
  const f=await fixture();try{
    const profile=await f.service.create({instructorId:f.instructorId,publicName:'Draft teacher',disciplineIds:[f.discipline.id]},f.manager.sessionToken);
    const session=(await f.pool.query("INSERT INTO class_sessions(title,instructor_id,starts_at,duration_minutes,capacity) VALUES('Preserved draft teacher legacy session',$1,now()+interval '1 day',60,12) RETURNING *",[f.instructorId])).rows[0];
    const member=(await f.pool.query("INSERT INTO members(full_name,email) VALUES('Fictional attendee','draft-teacher-attendee@example.test') RETURNING id")).rows[0].id;
    const booking=(await f.pool.query('INSERT INTO bookings(member_id,class_session_id) VALUES($1,$2) RETURNING *',[member,session.id])).rows[0];
    const updated=await f.service.update(f.instructorId,{expectedVersion:profile.version,publicName:'Reviewed draft name',biographyEs:'Reviewed draft biography'},f.manager.sessionToken);
    assert.equal(updated.publicName,'Reviewed draft name');assert.equal(updated.biographyEs,'Reviewed draft biography');assert.equal(updated.status,'draft');assert.deepEqual(updated.disciplineIds,profile.disciplineIds);assert.equal(updated.version,2);
    assert.deepEqual((await f.pool.query('SELECT * FROM class_sessions WHERE id=$1',[session.id])).rows[0],session);
    assert.deepEqual((await f.pool.query('SELECT * FROM bookings WHERE id=$1',[booking.id])).rows[0],booking);
    await assert.rejects(f.service.update(f.instructorId,{expectedVersion:2,status:'archived'},f.manager.sessionToken),{message:'CONFLICT'});
    await assert.rejects(f.service.update(f.instructorId,{expectedVersion:2,disciplineIds:[]},f.manager.sessionToken),{message:'CONFLICT'});
  }finally{await f.pool.end();}
});
