import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { updateSettings, readPublicSettings } from '../../dist/modules/foundation/settings.js';
import { assertLegacySchemaMatches } from '../../../../scripts/compare-legacy-schema.mjs';

// Fixed isolated test service. Never reads DATABASE_URL or targets developer data.
const admin = new pg.Pool({connectionString:'postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/postgres'});
async function database() {
  const name=`test_${randomUUID().replaceAll('-','')}`;
  await admin.query(`CREATE DATABASE ${name}`);
  return {name,pool:new pg.Pool({connectionString:`postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/${name}`})};
}
function flyway(name, ...args) {
  assert.match(name,/^test_[a-f0-9]+$/);
  return spawnSync('docker',['compose','-f','compose.test.yaml','-p','conecta-foundation-tests','run','--rm','--no-deps','-e',`FLYWAY_URL=jdbc:postgresql://db:5432/${name}`,'flyway',...args],{encoding:'utf8'});
}
const valid={displayName:'Conecta Infusion',country:'MX',currency:'MXN',timezone:'America/Mexico_City',defaultLocale:'es-MX',supportedLocales:['es-MX','en'],defaultCapacity:16};
test('fresh Flyway migration, no-op repeat, settings audit atomicity and checksum validation', async()=>{
  const db=await database();
  try {
    let result=flyway(db.name,'migrate');assert.equal(result.status,0,result.stdout+result.stderr);
    result=flyway(db.name,'migrate');assert.equal(result.status,0,result.stdout+result.stderr);
    result=flyway(db.name,'validate');assert.equal(result.status,0,result.stdout+result.stderr);
    result=flyway(db.name,'info');assert.equal(result.status,0,result.stdout+result.stderr);
    assert.deepEqual((await db.pool.query('SELECT country,currency,timezone,default_locale,default_capacity FROM business_settings')).rows[0],
      {country:'MX',currency:'MXN',timezone:'America/Mexico_City',default_locale:'es-MX',default_capacity:16});
    const settings=await readPublicSettings(db.pool);
    assert.equal(settings.displayName,'Conecta Infusion');assert.equal(settings.defaultCapacity,undefined);assert.equal(settings.units.length,2);
    const context={actor:{id:'test-staff',type:'staff'},reason:'Test adjustment',correlationId:randomUUID()};
    await assert.rejects(updateSettings(db.pool,{...valid,defaultCapacity:0},context), /INVALID_SETTINGS/);
    await assert.rejects(updateSettings(db.pool,{...valid,password:'must-not-be-recorded'},context), /INVALID_SETTINGS/);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM audit_events')).rows[0].n,0);
    await updateSettings(db.pool,{...valid,defaultCapacity:20},context);
    const first=(await db.pool.query('SELECT * FROM audit_events')).rows[0];
    assert.equal(first.changes.after.defaultCapacity,20);
    assert.deepEqual(Object.keys(first.changes.after).sort(),Object.keys(valid).sort());
    await assert.rejects(updateSettings(db.pool,{...valid,defaultCapacity:30},{...context,correlationId:'not-a-uuid'}));
    assert.equal((await db.pool.query('SELECT default_capacity FROM business_settings')).rows[0].default_capacity,20);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM audit_events')).rows[0].n,1);
    await updateSettings(db.pool,valid,{...context,correlationId:randomUUID(),correctionOf:first.id});
    assert.equal((await db.pool.query('SELECT correction_of FROM audit_events WHERE correction_of=$1',[first.id])).rowCount,1);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM audit_events')).rows[0].n,2);
    await assert.rejects(db.pool.query('DELETE FROM audit_events'));
    await assert.rejects(db.pool.query("UPDATE audit_events SET reason='rewritten'"));
    await assert.rejects(db.pool.query('TRUNCATE audit_events'));
    assert.equal((await db.pool.query('SELECT changes FROM audit_events WHERE id=$1',[first.id])).rows[0].changes.after.defaultCapacity,20);
    // Isolated metadata tamper simulates a checksum mismatch without editing source migrations.
    await db.pool.query('UPDATE flyway_schema_history SET checksum=0 WHERE version=$1',['1']);
    result=flyway(db.name,'validate');
    assert.notEqual(result.status,0);
    assert.match(result.stdout+result.stderr,/checksum mismatch/i);
  } finally { await db.pool.end(); }
});
test('legacy database requires explicit baseline and preserves rows',async()=>{
  const db=await database();
  const reference=await database();
  try {
    await reference.pool.query(await readFile('database/migrations/V1__initial.sql','utf8'));
    await db.pool.query(await readFile('database/001_initial.sql','utf8'));
    await db.pool.query("CREATE TABLE schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()); INSERT INTO schema_migrations(name) VALUES ('001_initial.sql')");
    await db.pool.query("INSERT INTO members(full_name,email) VALUES ('Legacy customer','legacy@example.test')");
    assert.notEqual(flyway(db.name,'migrate').status,0);
    await assertLegacySchemaMatches(db.pool,reference.pool);
    await db.pool.query('ALTER TABLE members ADD COLUMN unexpected text');
    await assert.rejects(assertLegacySchemaMatches(db.pool,reference.pool), /Stop: do not baseline/);
    await db.pool.query('ALTER TABLE members DROP COLUMN unexpected');
    await assertLegacySchemaMatches(db.pool,reference.pool);
    const result=flyway(db.name,'-baselineVersion=1','baseline');assert.equal(result.status,0,result.stdout+result.stderr);
    assert.equal(flyway(db.name,'migrate').status,0);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM members')).rows[0].n,1);
    assert.equal((await db.pool.query('SELECT name FROM schema_migrations')).rows[0].name,'001_initial.sql');
  } finally {await db.pool.end();await reference.pool.end();}
});
test('failed V2 rolls back its earlier DDL and leaves prior history intact',async()=>{
  const db=await database();
  try {
    const initial=flyway(db.name,'-target=1','migrate');
    assert.equal(initial.status,0,initial.stdout+initial.stderr);
    // Conflict occurs after V2 creates business_units. No migration files are modified.
    await db.pool.query('CREATE TABLE business_settings (legacy_marker text)');
    const failed=flyway(db.name,'migrate');
    assert.notEqual(failed.status,0);
    assert.match(failed.stdout+failed.stderr,/already exists/i);
    assert.equal((await db.pool.query("SELECT to_regclass('public.business_units') AS name")).rows[0].name,null);
    assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM flyway_schema_history WHERE version='2'")).rows[0].n,0);
    assert.equal((await db.pool.query("SELECT success FROM flyway_schema_history WHERE version='1'")).rows[0].success,true);
  } finally {await db.pool.end();}
});
test.after(async()=>{await admin.end();});
