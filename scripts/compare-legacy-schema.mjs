import { isDeepStrictEqual } from 'node:util';

// Read-only comparison against a disposable database initialized from V1.
// Ignore migration history only; retain unexpected application objects as drift.
export async function schemaSnapshot(pool) {
  const tables = `SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')
    AND c.relname NOT IN ('schema_migrations','flyway_schema_history')`;
  const queries = {
    relations: `SELECT c.relname, c.relkind, c.relrowsecurity FROM pg_class c
      WHERE c.oid IN (${tables}) ORDER BY c.relname`,
    columns: `SELECT c.relname, a.attname, a.attnum, format_type(a.atttypid,a.atttypmod) AS type,
      a.attnotnull, a.attidentity, a.attgenerated, pg_get_expr(d.adbin,d.adrelid) AS default_value
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE c.oid IN (${tables}) AND a.attnum>0 AND NOT a.attisdropped
      ORDER BY c.relname,a.attnum`,
    constraints: `SELECT c.relname, k.conname, pg_get_constraintdef(k.oid) AS definition
      FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
      WHERE c.oid IN (${tables}) ORDER BY c.relname,k.conname`,
    indexes: `SELECT c.relname, pg_get_indexdef(i.indexrelid) AS definition
      FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid
      WHERE c.oid IN (${tables}) ORDER BY c.relname,definition`,
    triggers: `SELECT c.relname, pg_get_triggerdef(t.oid) AS definition
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE c.oid IN (${tables}) AND NOT t.tgisinternal ORDER BY c.relname,definition`
  };
  const snapshot = {};
  for (const [key, sql] of Object.entries(queries)) snapshot[key] = (await pool.query(sql)).rows;
  return snapshot;
}

export async function assertLegacySchemaMatches(candidate, reference) {
  const actual = await schemaSnapshot(candidate);
  const expected = await schemaSnapshot(reference);
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error('Legacy schema differs from V1. Stop: do not baseline this database.');
  }
  return actual;
}
