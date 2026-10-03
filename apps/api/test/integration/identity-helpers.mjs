import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

// Fixed disposable service only. Never read DATABASE_URL or use developer databases.
export async function isolatedDatabase() {
  const admin = new pg.Pool({ connectionString: 'postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/postgres' });
  const name = `test_${randomUUID().replaceAll('-', '')}`;
  try { await admin.query(`CREATE DATABASE ${name}`); }
  finally { await admin.end(); }
  const pool = new pg.Pool({ connectionString: `postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/${name}` });
  return { name, pool };
}

export function migrate(name, ...options) {
  assert.match(name, /^test_[a-f0-9]+$/);
  const result = spawnSync('docker', [
    'compose', '-f', 'compose.test.yaml', '-p', 'conecta-foundation-tests',
    'run', '--rm', '--no-deps', '-e', `FLYWAY_URL=jdbc:postgresql://db:5432/${name}`,
    'flyway', ...options, 'migrate',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
}
