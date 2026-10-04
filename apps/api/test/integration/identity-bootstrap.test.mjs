import test from 'node:test';
import assert from 'node:assert/strict';
import { isolatedDatabase, migrate } from './identity-helpers.mjs';

const load = () => import('../../dist/modules/identity/bootstrap.js');
function environment(name) {
  return { NODE_ENV: 'development', IDENTITY_DEV_FIXTURES: 'true',
    DATABASE_URL: `postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/${name}` };
}

test('first admin is manually inserted from reviewed SQL; fixture creation is audited and repeat-safe', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name);
    const { generateFirstAdminSql, createDevelopmentTestUser } = await load();
    const env = environment(db.name);
    const sql = await generateFirstAdminSql({ development: true, operator: 'test-operator', environment: env });
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM accounts')).rows[0].n, 0);
    await assert.rejects(createDevelopmentTestUser(db.pool, 'admin', env), /DEVELOPMENT_ADMIN_REQUIRED/);
    // Explicit operator application is simulated only in this disposable database.
    await db.pool.query(sql);
    const admin = (await db.pool.query('SELECT * FROM accounts')).rows[0];
    assert.equal(admin.email, 'admin@conecta.example.test');
    assert.equal(admin.confirmation_status, 'exempt');
    assert.equal(admin.email_verified_at, null);
    assert.equal(admin.exemption_source, 'manual_bootstrap');
    const { verifyPassword } = await import('../../dist/modules/identity/passwords.js');
    assert.equal(await verifyPassword('admin', admin.password_hash), true);
    await assert.rejects(createDevelopmentTestUser(db.pool, 'wrong', env), /DEVELOPMENT_ADMIN_REQUIRED/);
    await db.pool.query('DELETE FROM account_roles WHERE account_id=$1', [admin.id]);
    await assert.rejects(createDevelopmentTestUser(db.pool, 'admin', env), /DEVELOPMENT_ADMIN_REQUIRED/);
    await db.pool.query("INSERT INTO account_roles(account_id,role) VALUES ($1,'administrator')", [admin.id]);
    await db.pool.query("UPDATE people SET status='inactive' WHERE id=$1", [admin.person_id]);
    await assert.rejects(createDevelopmentTestUser(db.pool, 'admin', env), /DEVELOPMENT_ADMIN_REQUIRED/);
    await db.pool.query("UPDATE people SET status='active' WHERE id=$1", [admin.person_id]);
    const created = await createDevelopmentTestUser(db.pool, 'admin', env);
    assert.equal(created.status, 'created');
    const user = (await db.pool.query("SELECT * FROM accounts WHERE email='testuser@conecta.example.test'")).rows[0];
    assert.equal(user.exemption_actor_id, admin.id);
    assert.equal(user.development_fixture, 'testuser');
    assert.equal(await verifyPassword('testuser', user.password_hash), true);
    const before = (await db.pool.query('SELECT count(*)::int AS n FROM audit_events')).rows[0].n;
    assert.deepEqual(await createDevelopmentTestUser(db.pool, 'admin', env), { status: 'already_exists', accountId: user.id });
    assert.equal((await db.pool.query('SELECT password_hash FROM accounts WHERE id=$1', [user.id])).rows[0].password_hash, user.password_hash);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM audit_events')).rows[0].n, before);
    const audit = (await db.pool.query('SELECT actor_id,changes FROM audit_events WHERE target_id=$1', [user.id])).rows[0];
    assert.equal(audit.actor_id, admin.id);
    assert.equal(audit.changes.after.confirmationStatus, 'exempt');
    assert.equal(JSON.stringify(audit).includes(user.password_hash), false);
    await db.pool.query('UPDATE accounts SET development_fixture=NULL WHERE id=$1', [user.id]);
    await assert.rejects(createDevelopmentTestUser(db.pool, 'admin', env), /DEVELOPMENT_FIXTURE_CONFLICT/);
    assert.equal((await db.pool.query('SELECT password_hash FROM accounts WHERE id=$1', [user.id])).rows[0].password_hash, user.password_hash);
    await db.pool.query("UPDATE accounts SET development_fixture='testuser' WHERE id=$1", [user.id]);
    await db.pool.query("UPDATE accounts SET status='inactive',deactivated_at=now() WHERE id=$1", [user.id]);
    await assert.rejects(createDevelopmentTestUser(db.pool, 'admin', env), /DEVELOPMENT_FIXTURE_CONFLICT/);
    const replay = await db.pool.connect();
    try {
      await assert.rejects(replay.query(sql), /FIRST_ADMIN_ALREADY_EXISTS/);
      await replay.query('ROLLBACK');
    } finally { replay.release(); }
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM accounts')).rows[0].n, 2);
  } finally { await db.pool.end(); }
});

test('regular manual admin SQL escapes data and enforces normal password policy', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name);
    const { generateFirstAdminSql } = await load();
    const name = "Owner '$identity_bootstrap$ \\ ; DROP TABLE accounts; --";
    await assert.rejects(generateFirstAdminSql({ email: 'owner@example.test', name, operator: 'operator', password: 'admin' }), /INVALID_PASSWORD/);
    const sql = await generateFirstAdminSql({ email: 'owner@example.test', name, operator: 'operator', password: 'Owner independently chooses this password' });
    await db.pool.query(sql);
    assert.equal((await db.pool.query('SELECT full_name FROM people')).rows[0].full_name, name);
    const admin = (await db.pool.query('SELECT development_fixture,email_verified_at,exemption_source FROM accounts')).rows[0];
    assert.deepEqual(admin, { development_fixture: null, email_verified_at: null, exemption_source: 'manual_bootstrap' });
  } finally { await db.pool.end(); }
});

test('fixture helper rejects conflicting identities, target mismatch and rolls back when audit fails', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name);
    const { generateFirstAdminSql, createDevelopmentTestUser } = await load();
    const env = environment(db.name);
    await db.pool.query(await generateFirstAdminSql({ development: true, operator: 'operator', environment: env }));
    await assert.rejects(createDevelopmentTestUser(db.pool, 'admin', { ...env, DATABASE_URL: env.DATABASE_URL.replace(db.name, 'conecta') }), /DEVELOPMENT_DATABASE_MISMATCH/);
    const client = await db.pool.connect();
    try {
      const person = (await client.query("INSERT INTO people(full_name) VALUES ('Real customer') RETURNING id")).rows[0].id;
      await client.query('INSERT INTO accounts(person_id,email) VALUES ($1,$2)', [person, 'testuser@conecta.example.test']);
      await assert.rejects(createDevelopmentTestUser(db.pool, 'admin', env), /DEVELOPMENT_FIXTURE_CONFLICT/);
      await client.query('DELETE FROM accounts WHERE person_id=$1', [person]);
      await client.query('DELETE FROM people WHERE id=$1', [person]);
      // Keep append-only protection; add an isolated insert failure to prove atomicity.
      await client.query("CREATE FUNCTION test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_AUDIT_REJECTED'; END $$");
      await client.query('CREATE TRIGGER test_audit_reject BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION test_reject_audit()');
      await assert.rejects(createDevelopmentTestUser(db.pool, 'admin', env), /TEST_AUDIT_REJECTED/);
      assert.equal((await client.query('SELECT count(*)::int AS n FROM accounts')).rows[0].n, 1);
      assert.equal((await client.query('SELECT count(*)::int AS n FROM people')).rows[0].n, 1);
    } finally { client.release(); }
  } finally { await db.pool.end(); }
});
