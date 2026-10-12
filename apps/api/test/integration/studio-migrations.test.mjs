import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { isolatedDatabase, migrate } from './identity-helpers.mjs';

async function catalog(pool) {
  const discipline = (await pool.query("INSERT INTO studio_disciplines(name_es) VALUES ('Yoga ficticio') RETURNING *")).rows[0];
  const klass = (await pool.query(`INSERT INTO studio_classes(discipline_id,name_es,audience,level,color)
    VALUES ($1,'Yoga para adultos','adults','all','#336699') RETURNING *`, [discipline.id])).rows[0];
  return { discipline, klass };
}

test('fresh and repeated catalog migrations support bilingual drafts without creating catalog content', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name);
    migrate(db.name);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM studio_disciplines')).rows[0].n, 0);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM studio_classes')).rows[0].n, 0);
    const { discipline, klass } = await catalog(db.pool);
    assert.equal(discipline.status, 'draft');
    assert.equal(discipline.version, 1);
    assert.equal(discipline.name_en, null);
    assert.equal(discipline.description_es, '');
    assert.equal(klass.status, 'draft');
    assert.equal(klass.version, 1);
    assert.equal(klass.duration_minutes, 55);
    assert.equal(klass.name_en, null);
    const draft = (await db.pool.query(`INSERT INTO class_sessions(title,class_id,status,starts_at,duration_minutes,capacity)
      VALUES ('Draft session',$1,'draft','2030-01-01T10:00:00Z',55,16) RETURNING *`, [klass.id])).rows[0];
    assert.equal(draft.instructor_id, null);
    assert.equal(draft.version, 1);
    await db.pool.query("UPDATE class_sessions SET status='cancelled' WHERE id=$1", [draft.id]);
  } finally { await db.pool.end(); }
});

test('catalog constraints reject invalid ages, duration, color, states, versions and foreign keys', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name);
    const { discipline, klass } = await catalog(db.pool);
    for (const patch of ["status='invented'", 'version=0']) {
      await assert.rejects(db.pool.query(`UPDATE studio_disciplines SET ${patch} WHERE id=$1`, [discipline.id]), { code: '23514' });
    }
    for (const patch of ["audience='teens'", "level='expert'", "status='invented'", 'version=0',
      'duration_minutes=60', "color='red'", "color='#12345G'", "audience='children',min_age=-1",
      "audience='children',max_age=-1", "audience='children',min_age=12,max_age=6", 'min_age=18', 'max_age=99']) {
      await assert.rejects(db.pool.query(`UPDATE studio_classes SET ${patch} WHERE id=$1`, [klass.id]), { code: '23514' });
    }
    await db.pool.query("UPDATE studio_classes SET audience='children',min_age=0,max_age=0,name_en='Children yoga' WHERE id=$1", [klass.id]);
    await db.pool.query('UPDATE studio_classes SET min_age=NULL,max_age=NULL WHERE id=$1', [klass.id]);
    await assert.rejects(db.pool.query('UPDATE studio_classes SET discipline_id=$1 WHERE id=$2', [randomUUID(), klass.id]), { code: '23503' });
    await assert.rejects(db.pool.query('DELETE FROM studio_disciplines WHERE id=$1', [discipline.id]), { code: '23503' });
    const instructor = (await db.pool.query("INSERT INTO instructors(full_name) VALUES ('Fictional teacher') RETURNING id")).rows[0].id;
    const insert = `INSERT INTO class_sessions(title,class_id,status,instructor_id,starts_at,duration_minutes,capacity)
      VALUES ('Fictional session',$1,$2,$3,'2030-01-01T10:00:00Z',$4,16)`;
    for (const values of [[klass.id,'published',null,55], [klass.id,'draft',null,60],
      [klass.id,'published',instructor,60], [null,'legacy',null,60], [klass.id,'invented',instructor,55]]) {
      await assert.rejects(db.pool.query(insert, values), { code: '23514' });
    }
    await assert.rejects(db.pool.query(insert, [randomUUID(),'draft',null,55]), { code: '23503' });
    await assert.rejects(db.pool.query(insert, [klass.id,'published',randomUUID(),55]), { code: '23503' });
    await db.pool.query(insert, [klass.id,'published',instructor,55]);
    await assert.rejects(db.pool.query('UPDATE class_sessions SET version=0 WHERE class_id=$1', [klass.id]), { code: '23514' });
    await assert.rejects(db.pool.query('DELETE FROM studio_classes WHERE id=$1', [klass.id]), { code: '23503' });
  } finally { await db.pool.end(); }
});

test('catalog migration preserves populated legacy sessions and booking history without automatic adoption', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name, '-target=14');
    const instructor = (await db.pool.query("INSERT INTO instructors(full_name) VALUES ('Legacy teacher') RETURNING id")).rows[0].id;
    const member = (await db.pool.query("INSERT INTO members(full_name,email) VALUES ('Legacy customer','catalog-legacy@example.test') RETURNING id")).rows[0].id;
    const session = (await db.pool.query(`INSERT INTO class_sessions(title,instructor_id,starts_at,duration_minutes,capacity)
      VALUES ('Legacy 90 minute class',$1,'2020-01-01T10:00:00Z',90,20) RETURNING *`, [instructor])).rows[0];
    const booking = (await db.pool.query("INSERT INTO bookings(member_id,class_session_id,status) VALUES ($1,$2,'attended') RETURNING *", [member, session.id])).rows[0];
    migrate(db.name);
    migrate(db.name);
    const preserved = (await db.pool.query('SELECT * FROM class_sessions WHERE id=$1', [session.id])).rows[0];
    for (const key of Object.keys(session)) assert.deepEqual(preserved[key], session[key], key);
    assert.equal(preserved.class_id, null);
    assert.equal(preserved.status, 'legacy');
    assert.deepEqual((await db.pool.query('SELECT * FROM bookings WHERE id=$1', [booking.id])).rows[0], booking);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM studio_classes')).rows[0].n, 0);
    await assert.rejects(db.pool.query('UPDATE class_sessions SET instructor_id=NULL WHERE id=$1', [session.id]), { code: '23514' });
  } finally { await db.pool.end(); }
});

test('failed V15 migration rolls back additive catalog DDL and preserves legacy data', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name, '-target=14');
    const instructor = (await db.pool.query("INSERT INTO instructors(full_name) VALUES ('Preserved teacher') RETURNING id")).rows[0].id;
    const session = (await db.pool.query(`INSERT INTO class_sessions(title,instructor_id,starts_at,duration_minutes,capacity)
      VALUES ('Preserved session',$1,'2020-01-01T10:00:00Z',60,16) RETURNING *`, [instructor])).rows[0];
    await db.pool.query('CREATE TABLE studio_classes (legacy_marker text)');
    assert.throws(() => migrate(db.name), /already exists/i);
    assert.equal((await db.pool.query("SELECT to_regclass('public.studio_disciplines') AS name")).rows[0].name, null);
    assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM flyway_schema_history WHERE version='15'")).rows[0].n, 0);
    assert.deepEqual((await db.pool.query('SELECT * FROM class_sessions WHERE id=$1', [session.id])).rows[0], session);
  } finally { await db.pool.end(); }
});
