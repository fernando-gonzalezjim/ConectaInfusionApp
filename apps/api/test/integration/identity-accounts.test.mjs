import test from 'node:test';
import assert from 'node:assert/strict';
import { isolatedDatabase, migrate } from './identity-helpers.mjs';

test('identity migrations create no accounts and support no-login people and multiple roles', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name);
    migrate(db.name);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM accounts')).rows[0].n, 0);
    const person = (await db.pool.query("INSERT INTO people(full_name) VALUES ('Dependent without email') RETURNING id")).rows[0].id;
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM accounts WHERE person_id=$1', [person])).rows[0].n, 0);
    const account = (await db.pool.query('INSERT INTO accounts(person_id,email) VALUES ($1,$2) RETURNING id', [person, 'person@example.test'])).rows[0].id;
    await db.pool.query("INSERT INTO account_roles(account_id,role) VALUES ($1,'customer'),($1,'instructor')", [account]);
    await assert.rejects(db.pool.query("INSERT INTO account_roles(account_id,role) VALUES ($1,'invented')", [account]), { code: '23514' });
    await assert.rejects(db.pool.query("INSERT INTO account_roles(account_id,role) VALUES ($1,'customer')", [account]), { code: '23505' });
    await assert.rejects(db.pool.query('INSERT INTO accounts(person_id,email) VALUES ($1,$2)', [person, 'other@example.test']), { code: '23505' });
    const other = (await db.pool.query("INSERT INTO people(full_name) VALUES ('Other person') RETURNING id")).rows[0].id;
    await assert.rejects(db.pool.query('INSERT INTO accounts(person_id,email) VALUES ($1,$2)', [other, 'person@example.test']), { code: '23505' });
    await assert.rejects(db.pool.query('INSERT INTO accounts(person_id,email) VALUES ($1,$2)', [other, ' Person@EXAMPLE.test ']), { code: '23514' });
    await assert.rejects(db.pool.query("UPDATE accounts SET status='active' WHERE id=$1", [account]), { code: '23514' });
    await assert.rejects(db.pool.query('UPDATE accounts SET password_hash=$1 WHERE id=$2', ['plaintext', account]), { code: '23514' });
    await assert.rejects(db.pool.query("UPDATE accounts SET confirmation_status='exempt' WHERE id=$1", [account]), { code: '23514' });
    await assert.rejects(db.pool.query('DELETE FROM people WHERE id=$1', [person]), { code: '23503' });
  } finally { await db.pool.end(); }
});

test('populated legacy migration preserves IDs and history and reports collisions without claiming identities', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name, '-target=2');
    const instructor = (await db.pool.query("INSERT INTO instructors(full_name) VALUES ('Legacy teacher') RETURNING id")).rows[0].id;
    const member = (await db.pool.query("INSERT INTO members(full_name,email) VALUES ('Legacy customer',' legacy@example.test ') RETURNING id")).rows[0].id;
    await db.pool.query("INSERT INTO members(full_name,email) VALUES ('Email collision','legacy@example.test')");
    const session = (await db.pool.query("INSERT INTO class_sessions(title,instructor_id,starts_at,duration_minutes,capacity) VALUES ('Legacy class',$1,now(),60,16) RETURNING id", [instructor])).rows[0].id;
    const booking = (await db.pool.query('INSERT INTO bookings(member_id,class_session_id) VALUES ($1,$2) RETURNING id', [member, session])).rows[0].id;
    const sale = (await db.pool.query('INSERT INTO sales(member_id) VALUES ($1) RETURNING id', [member])).rows[0].id;
    migrate(db.name);
    const { readLegacyIdentityReconciliation } = await import('../../dist/modules/identity/accounts.js');
    const report = await readLegacyIdentityReconciliation(db.pool);
    assert.equal(report.members.length, 2);
    assert.ok(report.members.every(row => row.requiresReview && row.issues.includes('normalized_email_collision')));
    assert.equal(report.instructors[0].personId, null);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM accounts')).rows[0].n, 0);
    assert.deepEqual((await db.pool.query('SELECT member_id,class_session_id FROM bookings WHERE id=$1', [booking])).rows[0], { member_id: member, class_session_id: session });
    assert.equal((await db.pool.query('SELECT member_id FROM sales WHERE id=$1', [sale])).rows[0].member_id, member);
    const accountPerson = (await db.pool.query("INSERT INTO people(full_name) VALUES ('Separate account owner') RETURNING id")).rows[0].id;
    await db.pool.query('INSERT INTO accounts(person_id,email) VALUES ($1,$2)', [accountPerson, 'legacy@example.test']);
    const needsReview = await readLegacyIdentityReconciliation(db.pool);
    assert.ok(needsReview.members.every(row => row.issues.includes('existing_account_requires_ownership_review')));
    // An explicit reviewed mapping preserves both domain IDs; no name/email auto-merge.
    const person = (await db.pool.query("INSERT INTO people(full_name) VALUES ('Reviewed identity') RETURNING id")).rows[0].id;
    await db.pool.query('UPDATE members SET person_id=$1 WHERE id=$2', [person, member]);
    await db.pool.query('UPDATE instructors SET person_id=$1 WHERE id=$2', [person, instructor]);
    await assert.rejects(db.pool.query('UPDATE members SET person_id=$1 WHERE id<>$2', [person, member]), { code: '23505' });
    await assert.rejects(db.pool.query('DELETE FROM people WHERE id=$1', [person]), { code: '23503' });
    const linked = await readLegacyIdentityReconciliation(db.pool);
    assert.equal(linked.members.find(row => row.id === member).personId, person);
    assert.ok(linked.members.find(row => row.id === member).issues.includes('linked_person_conflicts_with_matching_account'));
  } finally { await db.pool.end(); }
});

test('failed identity migration rolls back new DDL without changing legacy rows', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name, '-target=2');
    const member = (await db.pool.query("INSERT INTO members(full_name,email) VALUES ('Preserved','preserved@example.test') RETURNING id")).rows[0].id;
    await db.pool.query('CREATE TABLE accounts (legacy_marker text)');
    assert.throws(() => migrate(db.name), /already exists/i);
    assert.equal((await db.pool.query("SELECT to_regclass('public.people') AS name")).rows[0].name, null);
    assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM flyway_schema_history WHERE version='3'")).rows[0].n, 0);
    assert.equal((await db.pool.query('SELECT full_name FROM members WHERE id=$1', [member])).rows[0].full_name, 'Preserved');
  } finally { await db.pool.end(); }
});
