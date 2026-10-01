import { readFile } from 'node:fs/promises';
import { pool } from './db.js';

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(72401931)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const name = '001_initial.sql';
    const applied = await client.query('SELECT name FROM schema_migrations WHERE name = $1', [name]);
    if (applied.rowCount === 0) {
      const sql = await readFile(new URL('../../../database/001_initial.sql', import.meta.url), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
      console.log(`Applied ${name}`);
    } else console.log('Database is up to date');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

try { await migrate(); }
catch { console.error('Database migration failed. Check PostgreSQL, DATABASE_URL, and whether the initial schema was previously applied outside the migration runner.'); process.exitCode = 1; }
finally { await pool.end(); }
