import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {isolatedDatabase,migrate} from './identity-helpers.mjs';
import {createAuthAccount} from './identity-auth-helpers.mjs';

async function transaction(pool,work){const client=await pool.connect();try{await client.query('BEGIN');const value=await work(client);await client.query('COMMIT');return value;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
async function dependent(pool,creator){const personId=randomUUID();await transaction(pool,async client=>{
  await client.query("INSERT INTO people(id,full_name) VALUES ($1,'Fictional child')",[personId]);
  await client.query("INSERT INTO dependent_profiles(person_id,age_text,created_by_account_id) VALUES ($1,'8 years',$2)",[personId,creator.accountId]);
  await client.query("INSERT INTO dependent_guardians(dependent_person_id,guardian_account_id,source,accepted_by_account_id) VALUES ($1,$2,'creation',$2)",[personId,creator.accountId]);
});return personId;}
async function addGuardian(pool,personId,guardian){const relationshipId=randomUUID();return transaction(pool,async client=>{
  await client.query("INSERT INTO guardian_consent_exceptions(relationship_id,reason) VALUES ($1,'development_fixture')",[relationshipId]);
  return (await client.query("INSERT INTO dependent_guardians(id,dependent_person_id,guardian_account_id,source,accepted_by_account_id,accepted_invitation_id) VALUES ($1,$2,$3,'accepted_invitation',$3,$4) RETURNING id",[relationshipId,personId,guardian.accountId,randomUUID()])).rows[0].id;
});}

test('dependent identity has no login/email; multiple guardians preserve consent history and active-guardian invariant',async()=>{
  const db=await isolatedDatabase();migrate(db.name);
  try{
    const parent=await createAuthAccount(db.pool,'parent@example.test'),other=await createAuthAccount(db.pool,'other@example.test');
    const personId=await dependent(db.pool,parent);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM accounts WHERE person_id=$1',[personId])).rows[0].n,0);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM members WHERE person_id=$1',[personId])).rows[0].n,0,'Never invent a legacy member email for a dependent');
    const guardianId=await addGuardian(db.pool,personId,other);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM dependent_guardians WHERE dependent_person_id=$1 AND ended_at IS NULL',[personId])).rows[0].n,2);
    await assert.rejects(db.pool.query("INSERT INTO accounts(person_id,email) VALUES ($1,'invented-child@example.test')",[personId]));
    await assert.rejects(db.pool.query("UPDATE dependent_guardians SET accepted_by_account_id=$2 WHERE id=$1",[guardianId,parent.accountId]));
    await assert.rejects(db.pool.query('DELETE FROM dependent_guardians WHERE id=$1',[guardianId]));
    await assert.rejects(db.pool.query('TRUNCATE dependent_guardians'));
    await db.pool.query("UPDATE dependent_guardians SET ended_at=clock_timestamp(),end_reason='self_removed' WHERE id=$1",[guardianId]);
    await assert.rejects(db.pool.query('UPDATE dependent_guardians SET ended_at=NULL,end_reason=NULL WHERE id=$1',[guardianId]));
    await assert.rejects(db.pool.query("UPDATE dependent_guardians SET ended_at=clock_timestamp(),end_reason='removed' WHERE dependent_person_id=$1 AND ended_at IS NULL",[personId]));
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM dependent_guardians WHERE dependent_person_id=$1 AND ended_at IS NULL',[personId])).rows[0].n,1);
    await assert.rejects(db.pool.query('DELETE FROM account_roles WHERE account_id=$1 AND role=\'customer\'',[parent.accountId]));
    await assert.rejects(db.pool.query("UPDATE accounts SET status='inactive',deactivated_at=clock_timestamp() WHERE id=$1",[parent.accountId]));
    await assert.rejects(db.pool.query('DELETE FROM dependent_profiles WHERE person_id=$1',[personId]));
    const replacement=await addGuardian(db.pool,personId,other);
    const initial=(await db.pool.query("SELECT id FROM dependent_guardians WHERE dependent_person_id=$1 AND source='creation'",[personId])).rows[0].id;
    const removals=await Promise.allSettled([initial,replacement].map(id=>transaction(db.pool,client=>client.query("UPDATE dependent_guardians SET ended_at=clock_timestamp(),end_reason='self_removed' WHERE id=$1",[id]))));
    assert.equal(removals.filter(result=>result.status==='fulfilled').length,1,'Concurrent changes must not remove both active guardians');
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM dependent_guardians WHERE dependent_person_id=$1 AND ended_at IS NULL',[personId])).rows[0].n,1);
  }finally{await db.pool.end();}
});

test('deactivation captures only immediately preceding guardians; prior provenance cannot be rewritten or manufactured from old relationships',async()=>{
  const db=await isolatedDatabase();migrate(db.name);
  try{
    const parent=await createAuthAccount(db.pool,'parent@example.test'),former=await createAuthAccount(db.pool,'former@example.test'),current=await createAuthAccount(db.pool,'current@example.test');
    const personId=await dependent(db.pool,parent),formerId=await addGuardian(db.pool,personId,former),currentId=await addGuardian(db.pool,personId,current);
    await db.pool.query("UPDATE dependent_guardians SET ended_at=clock_timestamp(),end_reason='removed' WHERE id=$1",[formerId]);
    await transaction(db.pool,async client=>{
      await client.query("UPDATE people SET status='inactive' WHERE id=$1",[personId]);
      await client.query("UPDATE dependent_guardians SET ended_at=clock_timestamp(),end_reason='dependent_deactivated' WHERE dependent_person_id=$1 AND ended_at IS NULL",[personId]);
    });
    const prior=(await db.pool.query('SELECT guardian_relationship_id FROM dependent_prior_guardians WHERE dependent_person_id=$1 ORDER BY guardian_relationship_id',[personId])).rows;
    assert.equal(prior.length,2);assert.ok(prior.some(row=>row.guardian_relationship_id===currentId));assert.ok(!prior.some(row=>row.guardian_relationship_id===formerId));
    await assert.rejects(db.pool.query('INSERT INTO dependent_prior_guardians(dependent_person_id,deactivation_sequence,guardian_relationship_id) VALUES ($1,1,$2)',[personId,formerId]));
    await assert.rejects(db.pool.query('DELETE FROM dependent_prior_guardians WHERE dependent_person_id=$1',[personId]));
    await assert.rejects(db.pool.query('UPDATE dependent_deactivations SET deactivated_at=clock_timestamp() WHERE dependent_person_id=$1',[personId]));
    const unrelated=await createAuthAccount(db.pool,'unrelated@example.test');
    const fabricated=await transaction(db.pool,async client=>{const relationshipId=randomUUID();
      await client.query("INSERT INTO guardian_consent_exceptions(relationship_id,reason) VALUES ($1,'development_fixture')",[relationshipId]);
      return (await client.query("INSERT INTO dependent_guardians(id,dependent_person_id,guardian_account_id,source,accepted_by_account_id,accepted_invitation_id,authorized_at) SELECT $4,$1,$2,'accepted_invitation',$2,$3,deactivated_at-interval '1 millisecond' FROM dependent_deactivations WHERE dependent_person_id=$1 AND deactivation_sequence=1 RETURNING id",[personId,unrelated.accountId,randomUUID(),relationshipId])).rows[0].id;
    });
    await assert.rejects(db.pool.query('INSERT INTO dependent_prior_guardians(dependent_person_id,deactivation_sequence,guardian_relationship_id) VALUES ($1,1,$2)',[personId,fabricated]),{message:'Prior guardians are written only by the dependent status snapshot trigger'});
    await db.pool.query("UPDATE dependent_guardians SET ended_at=clock_timestamp(),end_reason='removed' WHERE id=$1",[fabricated]);
    await assert.rejects(db.pool.query("UPDATE people SET status='active' WHERE id=$1",[personId]),'No active dependent without an active current guardian');
    assert.equal((await db.pool.query('SELECT deactivation_sequence FROM dependent_profiles WHERE person_id=$1',[personId])).rows[0].deactivation_sequence,1);
  }finally{await db.pool.end();}
});

test('saved child details preserve owner, optional profile link and immutable booking attendee/actor snapshots',async()=>{
  const db=await isolatedDatabase();migrate(db.name);
  try{
    const parent=await createAuthAccount(db.pool,'parent@example.test'),other=await createAuthAccount(db.pool,'other@example.test');
    const personId=await dependent(db.pool,parent);
    const saved=(await db.pool.query("INSERT INTO saved_child_details(owner_account_id,child_name,age_text) VALUES ($1,'Reusable child','7 years') RETURNING id",[parent.accountId])).rows[0].id;
    const member=(await db.pool.query("INSERT INTO members(full_name,email,person_id) VALUES ('Parent',$1,$2) RETURNING id",[parent.email,parent.personId])).rows[0].id;
    const instructor=(await db.pool.query("INSERT INTO instructors(full_name) VALUES ('Fictional teacher') RETURNING id")).rows[0].id;
    const session=(await db.pool.query("INSERT INTO class_sessions(title,instructor_id,starts_at,duration_minutes,capacity) VALUES ('Yoga Kids',$1,now()+interval '1 day',60,16) RETURNING id",[instructor])).rows[0].id;
    const booking=(await db.pool.query("INSERT INTO bookings(member_id,class_session_id,acting_account_id,saved_child_details_id,child_name_snapshot,child_age_snapshot) VALUES ($1,$2,$3,$4,'Reusable child','7 years') RETURNING id",[member,session,parent.accountId,saved])).rows[0].id;
    await db.pool.query("UPDATE saved_child_details SET child_name='New name',age_text='8 years',dependent_person_id=$2,version=version+1 WHERE id=$1",[saved,personId]);
    const snapshot=(await db.pool.query('SELECT acting_account_id,attendee_person_id,saved_child_details_id,child_name_snapshot,child_age_snapshot FROM bookings WHERE id=$1',[booking])).rows[0];
    assert.equal(snapshot.acting_account_id,parent.accountId);assert.equal(snapshot.attendee_person_id,null);assert.equal(snapshot.child_name_snapshot,'Reusable child');assert.equal(snapshot.child_age_snapshot,'7 years');
    assert.equal((await db.pool.query('SELECT dependent_person_id FROM saved_child_details WHERE id=$1',[snapshot.saved_child_details_id])).rows[0].dependent_person_id,personId);
    await assert.rejects(db.pool.query('UPDATE saved_child_details SET owner_account_id=$2,version=version+1 WHERE id=$1',[saved,other.accountId]));
    await assert.rejects(db.pool.query('UPDATE saved_child_details SET dependent_person_id=NULL,version=version+1 WHERE id=$1',[saved]));
    await assert.rejects(db.pool.query("UPDATE bookings SET child_name_snapshot='Rewritten history' WHERE id=$1",[booking]));
    await assert.rejects(db.pool.query('UPDATE bookings SET acting_account_id=$2 WHERE id=$1',[booking,other.accountId]));
    await assert.rejects(db.pool.query('DELETE FROM bookings WHERE id=$1',[booking]));
    await assert.rejects(db.pool.query('TRUNCATE bookings'));
    await db.pool.query("UPDATE bookings SET status='cancelled' WHERE id=$1",[booking]);
    await assert.rejects(db.pool.query("INSERT INTO saved_child_details(owner_account_id,child_name,age_text) VALUES ($1,'Valid','')",[parent.accountId]));
  }finally{await db.pool.end();}
});

test('V10 preserves populated V9 identities/bookings, repeats, and conflicting DDL rolls back all dependent schema changes',async()=>{
  const db=await isolatedDatabase();migrate(db.name,'-target=9');
  try{
    const parent=await createAuthAccount(db.pool,'existing@example.test');
    const member=(await db.pool.query("INSERT INTO members(full_name,email,person_id) VALUES ('Existing parent',$1,$2) RETURNING id",[parent.email,parent.personId])).rows[0].id;
    const instructor=(await db.pool.query("INSERT INTO instructors(full_name) VALUES ('Existing instructor') RETURNING id")).rows[0].id;
    const session=(await db.pool.query("INSERT INTO class_sessions(title,instructor_id,starts_at,duration_minutes,capacity) VALUES ('Existing class',$1,now(),60,16) RETURNING id",[instructor])).rows[0].id;
    const booking=(await db.pool.query('INSERT INTO bookings(member_id,class_session_id) VALUES ($1,$2) RETURNING *',[member,session])).rows[0];
    await db.pool.query('CREATE TABLE saved_child_details (id integer)');
    const failed=spawnSync('docker',['compose','-f','compose.test.yaml','-p','conecta-foundation-tests','run','--rm','--no-deps','-e',`FLYWAY_URL=jdbc:postgresql://db:5432/${db.name}`,'flyway','migrate'],{encoding:'utf8'});
    assert.notEqual(failed.status,0);assert.equal((await db.pool.query("SELECT to_regclass('dependent_profiles') AS name")).rows[0].name,null);
    await db.pool.query('DROP TABLE saved_child_details');migrate(db.name);migrate(db.name);
    assert.equal((await db.pool.query('SELECT person_id FROM accounts WHERE id=$1',[parent.accountId])).rows[0].person_id,parent.personId);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM dependent_profiles')).rows[0].n,0);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM saved_child_details')).rows[0].n,0);
    assert.equal((await db.pool.query('SELECT count(*)::int n FROM identity_email_outbox')).rows[0].n,0);
    const migrated=(await db.pool.query('SELECT * FROM bookings WHERE id=$1',[booking.id])).rows[0];
    for(const [key,value] of Object.entries(booking))assert.deepEqual(migrated[key],value);
    for(const key of ['acting_account_id','attendee_person_id','saved_child_details_id','child_name_snapshot','child_age_snapshot'])assert.equal(migrated[key],null,'Migration must not claim historical actors or attendees');
    await assert.rejects(db.pool.query("UPDATE bookings SET acting_account_id=$2,child_name_snapshot='Invented attendee',child_age_snapshot='8 years' WHERE id=$1",[booking.id,parent.accountId]),'Old booking identity must not be retroactively claimed');
    await dependent(db.pool,parent);
  }finally{await db.pool.end();}
});
