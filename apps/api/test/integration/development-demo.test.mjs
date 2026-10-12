import test from 'node:test';
import assert from 'node:assert/strict';
import { isolatedDatabase, migrate } from './identity-helpers.mjs';
import { createAuthAccount } from './identity-auth-helpers.mjs';
import { seedDevelopmentDemo, demoPassword } from '../../../../scripts/development-demo.mjs';
import { verifyPassword } from '../../dist/modules/identity/passwords.js';
import { cleanDevelopmentDatabase } from '../../../../scripts/development-clean.mjs';

test('demo seed refuses production/remote configuration before connecting', async () => {
  const pool = { connect() { throw new Error('MUST_NOT_CONNECT'); } };
  await assert.rejects(seedDevelopmentDemo(pool, {NODE_ENV:'production'}), {message:'DEVELOPMENT_FIXTURES_DISABLED'});
  await assert.rejects(seedDevelopmentDemo(pool, {NODE_ENV:'development',IDENTITY_DEV_FIXTURES:'true',DATABASE_URL:'postgresql://host/conecta'}), {message:'UNSAFE_DEVELOPMENT_DATABASE'});
  await assert.rejects(cleanDevelopmentDatabase(pool,{NODE_ENV:'development',IDENTITY_DEV_FIXTURES:'true',DATABASE_URL:'postgresql://localhost/conecta'}),{message:'DEVELOPMENT_RESET_TARGET_REQUIRED'});
});

test('demo seed is atomic, repeat-safe, preserves edits and links fictional bookings to identities', async () => {
  const db = await isolatedDatabase(); migrate(db.name);
  const environment = {NODE_ENV:'development',IDENTITY_DEV_FIXTURES:'true',DATABASE_URL:db.pool.options.connectionString};
  try {
    await assert.rejects(seedDevelopmentDemo(db.pool,environment), {message:'DEVELOPMENT_ADMIN_REQUIRED'});
    await createAuthAccount(db.pool,'operator@example.test',['administrator']);
    const result = await seedDevelopmentDemo(db.pool,environment);
    assert.equal(result.createdAccounts,26);
    assert.equal(result.catalogDisciplines,3);
    assert.equal(result.catalogClasses,6);
    const disciplines=(await db.pool.query('SELECT id,name_es,status,version FROM studio_disciplines ORDER BY name_es')).rows;
    assert.deepEqual(disciplines.filter(row=>row.name_es!=='Demo Wellness').map(({name_es,status,version})=>({name_es,status,version})),[
      {name_es:'Demo Ballet',status:'draft',version:1},{name_es:'Demo Yoga',status:'draft',version:1}
    ]);
    const classes=(await db.pool.query('SELECT id,name_es,audience,level,min_age,max_age,color,duration_minutes,status FROM studio_classes ORDER BY name_es')).rows;
    assert.deepEqual(classes.filter(row=>['Demo Adult Yoga',"Demo Children's Ballet"].includes(row.name_es)).map(({id,...facts})=>facts),[
      {name_es:'Demo Adult Yoga',audience:'adults',level:'all',min_age:null,max_age:null,color:'#336699',duration_minutes:55,status:'draft'},
      {name_es:"Demo Children's Ballet",audience:'children',level:'beginner',min_age:6,max_age:12,color:'#8855AA',duration_minutes:55,status:'draft'}
    ]);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM class_sessions WHERE class_id IS NOT NULL')).rows[0].n,0,'Catalog fixtures must not silently adopt legacy sessions');
    assert.equal((await db.pool.query("SELECT count(*)::int n FROM class_sessions WHERE status='legacy'")).rows[0].n,3);
    await db.pool.query("UPDATE studio_disciplines SET name_es='Manually edited discipline',status='published',version=version+1 WHERE id=$1",[disciplines[0].id]);
    await db.pool.query("UPDATE studio_classes SET name_es='Manually edited class',color='#112233',discipline_id=$2 WHERE id=$1",[classes[0].id,disciplines[1].id]);
    assert.equal(result.catalogInstructors,2);
    assert.deepEqual([...new Set(classes.map(c=>c.level))].sort(),['advanced','all','beginner','intermediate']);
    assert.ok(classes.every(c=>c.duration_minutes===55&&/^#[a-f0-9]{6}$/i.test(c.color)));
    assert.ok(classes.some(c=>c.status==='published'));assert.ok(classes.some(c=>c.status==='archived'));
    const publicInstructor=(await db.pool.query("SELECT instructor_id FROM studio_instructor_profiles WHERE public_name='Demo Public Yoga Teacher'")).rows[0];
    assert.ok(publicInstructor);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM studio_instructor_photos WHERE instructor_id=$1',[publicInstructor.instructor_id])).rows[0].n,1);
    await db.pool.query('DELETE FROM studio_instructor_photos WHERE instructor_id=$1',[publicInstructor.instructor_id]);
    await db.pool.query("UPDATE studio_instructor_profiles SET public_name='Manually approved name',biography_es='Manually reviewed biography',version=version+1 WHERE instructor_id=$1",[publicInstructor.instructor_id]);
    await db.pool.query('DELETE FROM studio_instructor_disciplines WHERE instructor_id=$1',[publicInstructor.instructor_id]);
    assert.equal(result.families,2);assert.equal(result.familyMemberships,3);
    assert.equal(result.dependentProfiles,2);assert.equal(result.guardianRelationships,3);assert.equal(result.savedChildDetails,2);
    const child=(await db.pool.query("SELECT d.person_id,d.created_by_account_id FROM dependent_profiles d JOIN people p ON p.id=d.person_id WHERE p.status='active'")).rows[0];
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM accounts WHERE person_id=$1',[child.person_id])).rows[0].n,0);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM members WHERE person_id=$1',[child.person_id])).rows[0].n,0);
    const additionalGuardian=(await db.pool.query("SELECT id FROM dependent_guardians WHERE dependent_person_id=$1 AND source='accepted_invitation'",[child.person_id])).rows[0].id;
    await db.pool.query("UPDATE people SET full_name='Edited fictional child' WHERE id=$1",[child.person_id]);
    await db.pool.query("UPDATE dependent_profiles SET age_text='9 years',version=version+1 WHERE person_id=$1",[child.person_id]);
    await db.pool.query("UPDATE dependent_guardians SET ended_at=clock_timestamp(),end_reason='self_removed' WHERE id=$1",[additionalGuardian]);
    const savedOnly=(await db.pool.query('SELECT id FROM saved_child_details WHERE dependent_person_id IS NULL')).rows[0].id;
    await db.pool.query("UPDATE saved_child_details SET child_name='Edited saved child',age_text='7 years',version=version+1 WHERE id=$1",[savedOnly]);
    const inactiveChild=(await db.pool.query("SELECT d.person_id FROM dependent_profiles d JOIN people p ON p.id=d.person_id WHERE p.full_name='Demo Inactive Dependent'")).rows[0].person_id;
    await db.pool.query("UPDATE dependent_profiles SET age_text='Edited inactive age',version=version+1 WHERE person_id=$1",[inactiveChild]);
    await seedDevelopmentDemo(db.pool,environment);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM dependent_profiles')).rows[0].n,2);
    assert.equal((await db.pool.query('SELECT age_text FROM dependent_profiles WHERE person_id=$1',[inactiveChild])).rows[0].age_text,'Edited inactive age');
    assert.equal((await db.pool.query('SELECT status FROM people WHERE id=$1',[inactiveChild])).rows[0].status,'inactive');
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM dependent_prior_guardians WHERE dependent_person_id=$1',[inactiveChild])).rows[0].n,1);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM guardian_reactivation_invitations')).rows[0].n,0);
    assert.equal((await db.pool.query('SELECT age_text FROM dependent_profiles WHERE person_id=$1',[child.person_id])).rows[0].age_text,'9 years');
    assert.equal((await db.pool.query('SELECT full_name FROM people WHERE id=$1',[child.person_id])).rows[0].full_name,'Edited fictional child');
    assert.ok((await db.pool.query('SELECT ended_at FROM dependent_guardians WHERE id=$1',[additionalGuardian])).rows[0].ended_at);
    assert.equal((await db.pool.query('SELECT child_name FROM saved_child_details WHERE id=$1',[savedOnly])).rows[0].child_name,'Edited saved child');
    assert.equal((await db.pool.query('SELECT person_id FROM family_memberships WHERE ended_at IS NULL GROUP BY person_id HAVING count(*)>1')).rowCount,0);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM family_memberships WHERE ended_at IS NULL')).rows[0].n,3);
    const unassigned=(await db.pool.query("SELECT p.id FROM people p JOIN accounts a ON a.person_id=p.id WHERE a.email='customer02@demo.conecta.example.test'")).rows[0];
    assert.equal((await db.pool.query('SELECT 1 FROM family_memberships WHERE person_id=$1 AND ended_at IS NULL',[unassigned.id])).rowCount,0,'I24 manual invitation recipient must start without a family');
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM family_invitations')).rows[0].n,0,'Seeding must not send invitations or claim real consent');
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM family_successor_offers')).rows[0].n,0,'Seeding must never choose successor consent');
    const shared=(await db.pool.query("SELECT id,responsible_membership_id FROM families WHERE name='Demo shared family'")).rows[0];
    await db.pool.query("UPDATE families SET name='Manually renamed family',version=version+1 WHERE id=$1",[shared.id]);
    const departed=(await db.pool.query("SELECT id FROM family_memberships WHERE family_id=$1 AND source='accepted_invitation'",[shared.id])).rows[0];
    await db.pool.query('UPDATE families SET responsible_membership_id=$2,version=version+1 WHERE id=$1',[shared.id,departed.id]);
    await seedDevelopmentDemo(db.pool,environment);
    assert.equal((await db.pool.query('SELECT responsible_membership_id FROM families WHERE id=$1',[shared.id])).rows[0].responsible_membership_id,departed.id,'Reseeding preserves manually transferred responsibility');
    // Restore the initial fixture responsible member before testing historical departure.
    await db.pool.query('UPDATE families SET responsible_membership_id=$2,version=version+1 WHERE id=$1',[shared.id,shared.responsible_membership_id]);
    await db.pool.query("UPDATE family_memberships SET ended_at=clock_timestamp(),end_reason='left' WHERE id=$1",[departed.id]);
    const auditCount=(await db.pool.query("SELECT count(*)::int n FROM audit_events WHERE actor_id='development-demo-script'")).rows[0].n;
    assert.ok(auditCount>25,'Existing demo audit events must exercise pagination without fabricating changes');
    const profileCustomer=(await db.pool.query("SELECT id,confirmation_status,email_verified_at,exemption_source FROM accounts WHERE email='customer.profile@demo.conecta.example.test'")).rows[0];
    assert.equal(profileCustomer.confirmation_status,'verified');assert.ok(profileCustomer.email_verified_at);assert.equal(profileCustomer.exemption_source,null);
    await db.pool.query("UPDATE accounts SET email='profile.changed@example.test' WHERE id=$1",[profileCustomer.id]);
    const pending=(await db.pool.query("SELECT status,password_hash FROM accounts WHERE email='customer.pending@demo.conecta.example.test'")).rows[0];
    assert.equal(pending.status,'pending');assert.equal(pending.password_hash,null);
    const inactive=(await db.pool.query("SELECT status,deactivated_at FROM accounts WHERE email='customer.inactive@demo.conecta.example.test'")).rows[0];
    assert.equal(inactive.status,'inactive');assert.ok(inactive.deactivated_at);
    assert.equal((await db.pool.query('SELECT public_name FROM studio_instructor_profiles WHERE instructor_id=$1',[publicInstructor.instructor_id])).rows[0].public_name,'Manually approved name');
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM studio_instructor_disciplines WHERE instructor_id=$1',[publicInstructor.instructor_id])).rows[0].n,0,'Removed manual qualifications must not be reinserted');
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM studio_instructor_photos WHERE instructor_id=$1',[publicInstructor.instructor_id])).rows[0].n,0,'Removed manual portrait must not be restored');
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM bookings')).rows[0].n,23);
    const childClient=await db.pool.connect();await childClient.query('BEGIN');
    try{
      await childClient.query("UPDATE people SET status='inactive' WHERE id=$1",[child.person_id]);
      await childClient.query("UPDATE dependent_guardians SET ended_at=clock_timestamp(),end_reason='dependent_deactivated' WHERE dependent_person_id=$1 AND ended_at IS NULL",[child.person_id]);
      await childClient.query('COMMIT');
    }catch(error){await childClient.query('ROLLBACK');throw error;}finally{childClient.release();}
    await seedDevelopmentDemo(db.pool,environment);
    assert.equal((await db.pool.query('SELECT status FROM people WHERE id=$1',[child.person_id])).rows[0].status,'inactive');
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM dependent_prior_guardians WHERE dependent_person_id=$1',[child.person_id])).rows[0].n,1);
    const full = (await db.pool.query("SELECT s.capacity,count(b.id)::int n FROM class_sessions s JOIN bookings b ON b.class_session_id=s.id WHERE s.title='Demo: Yoga — full class' GROUP BY s.id")).rows[0];
    assert.equal(full.n,16); assert.equal(full.capacity,16);
    const account=(await db.pool.query("SELECT * FROM accounts WHERE email='instructor.yoga@demo.conecta.example.test'")).rows[0];
    assert.equal(await verifyPassword(demoPassword,account.password_hash),true);
    assert.equal(account.confirmation_status,'exempt');
    assert.equal((await db.pool.query('SELECT person_id FROM instructors WHERE person_id=$1',[account.person_id])).rowCount,1);
    await db.pool.query("UPDATE people SET full_name='Edited manually' WHERE id=$1",[account.person_id]);
    const again=await seedDevelopmentDemo(db.pool,environment); assert.equal(again.createdAccounts,0);
    assert.deepEqual((await db.pool.query('SELECT name_es,status,version FROM studio_disciplines WHERE id=$1',[disciplines[0].id])).rows[0],{name_es:'Manually edited discipline',status:'published',version:2});
    assert.deepEqual((await db.pool.query('SELECT name_es,color,discipline_id FROM studio_classes WHERE id=$1',[classes[0].id])).rows[0],{name_es:'Manually edited class',color:'#112233',discipline_id:disciplines[1].id});
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM studio_disciplines')).rows[0].n,3);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM studio_classes')).rows[0].n,6);
    assert.equal((await db.pool.query('SELECT name FROM families WHERE id=$1',[shared.id])).rows[0].name,'Manually renamed family');
    assert.equal((await db.pool.query('SELECT end_reason FROM family_memberships WHERE id=$1',[departed.id])).rows[0].end_reason,'left');
    assert.equal((await db.pool.query("SELECT count(*)::int n FROM audit_events WHERE actor_id='development-demo-script'")).rows[0].n,auditCount);
    assert.equal((await db.pool.query('SELECT email FROM accounts WHERE id=$1',[profileCustomer.id])).rows[0].email,'profile.changed@example.test');
    assert.equal((await db.pool.query('SELECT full_name FROM people WHERE id=$1',[account.person_id])).rows[0].full_name,'Edited manually');
    assert.equal((await db.pool.query('SELECT public_name FROM studio_instructor_profiles WHERE instructor_id=$1',[publicInstructor.instructor_id])).rows[0].public_name,'Manually approved name');
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM studio_instructor_disciplines WHERE instructor_id=$1',[publicInstructor.instructor_id])).rows[0].n,0,'Removed manual qualifications must not be reinserted');
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM bookings')).rows[0].n,23);
    await cleanDevelopmentDatabase(db.pool,environment);
    assert.deepEqual((await db.pool.query("SELECT to_regclass('public.studio_disciplines') disciplines,to_regclass('public.studio_classes') classes")).rows[0],{disciplines:null,classes:null});
    assert.equal((await db.pool.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'")).rows[0].n,0);
    migrate(db.name);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM accounts')).rows[0].n,0);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM studio_disciplines')).rows[0].n,0);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM studio_classes')).rows[0].n,0);
  } finally {await db.pool.end();}
});

test('a conflicting existing customer rolls back the entire seed without claiming their identity', async () => {
  const db=await isolatedDatabase(); migrate(db.name);
  const environment={NODE_ENV:'development',IDENTITY_DEV_FIXTURES:'true',DATABASE_URL:db.pool.options.connectionString};
  try {
    await createAuthAccount(db.pool,'operator@example.test',['administrator']);
    const existing=await createAuthAccount(db.pool,'customer18@demo.conecta.example.test',['customer']);
    await assert.rejects(seedDevelopmentDemo(db.pool,environment),{message:'DEVELOPMENT_DEMO_CONFLICT'});
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM accounts')).rows[0].n,2);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM instructors')).rows[0].n,0);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM audit_events')).rows[0].n,0);
    assert.equal((await db.pool.query('SELECT person_id FROM accounts WHERE id=$1',[existing.accountId])).rows[0].person_id,existing.personId);
  } finally {await db.pool.end();}
});
