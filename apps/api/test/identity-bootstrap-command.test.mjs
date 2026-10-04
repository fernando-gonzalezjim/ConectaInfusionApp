import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { runBootstrapCommand } from '../../../scripts/identity-bootstrap.mjs';
import { developmentDatabaseUrl, generateFirstAdminSql } from '../dist/modules/identity/bootstrap.js';

const dev = { NODE_ENV: 'development', IDENTITY_DEV_FIXTURES: 'true', DATABASE_URL: 'postgresql://dev:local@127.0.0.1:5432/conecta' };

test('development target checks reject nonlocal, unknown and connection-override URLs', () => {
  for (const DATABASE_URL of ['postgresql://dev:local@production.example/conecta', 'postgresql://dev:local@localhost/production',
    'postgresql://dev:local@localhost/conecta?host=production.example', 'postgresql://dev:local@localhost/conecta#override', 'not-a-url']) {
    assert.throws(() => developmentDatabaseUrl({ ...dev, DATABASE_URL }), /UNSAFE_DEVELOPMENT_DATABASE/);
  }
  for (const NODE_ENV of ['production', 'staging', '', undefined]) {
    assert.throws(() => developmentDatabaseUrl({ ...dev, NODE_ENV }), /DEVELOPMENT_FIXTURES_DISABLED/);
  }
  assert.throws(() => developmentDatabaseUrl({ ...dev, IDENTITY_DEV_FIXTURES: 'false' }), /DEVELOPMENT_FIXTURES_DISABLED/);
  assert.equal(developmentDatabaseUrl(dev).hostname, '127.0.0.1');
});

test('SQL output is exclusive, contains no plaintext password and is never printed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'conecta-bootstrap-'));
  const path = join(directory, 'admin.sql');
  const messages = [];
  try {
    const password = 'A private operator password for tests';
    const args = ['admin-sql', '--email', 'owner@example.test', '--name', 'Local owner', '--operator', 'operator', '--output', path];
    const dependencies = { environment: dev, readPassword: async () => password, log: message => messages.push(message) };
    await runBootstrapCommand(args, dependencies);
    const sql = await readFile(path, 'utf8');
    assert.ok(sql.includes('$argon2id$'));
    assert.equal(sql.includes(password), false);
    assert.equal(messages.join('\n').includes('$argon2id$'), false);
    assert.equal(messages.join('\n').includes(password), false);
    await assert.rejects(runBootstrapCommand(args, dependencies), { code: 'EEXIST' });
    assert.equal(await readFile(path, 'utf8'), sql);
  } finally {
    assert.equal(dirname(directory), resolve(tmpdir()));
    assert.match(basename(directory), /^conecta-bootstrap-/);
    await rm(directory, { recursive: true, force: true });
  }
});

test('CLI rejects password arguments and fixture overrides before reading credentials', async () => {
  const dependencies = { environment: dev, readPassword: async () => { throw new Error('MUST_NOT_PROMPT'); }, log: () => {} };
  for (const args of [['admin-sql', '--password', 'secret'], ['testuser'], ['unknown'], ['admin-sql', '--output'],
    ['admin-sql', '--output', 'one', '--output', 'two'], ['testuser', '--development', '--email', 'other@example.test']]) {
    await assert.rejects(runBootstrapCommand(args, dependencies), /INVALID_BOOTSTRAP_COMMAND/);
  }
  await assert.rejects(generateFirstAdminSql({ development: true, operator: 'operator', email: 'other@example.test', environment: dev }), /INVALID_DEVELOPMENT_FIXTURE/);
  await assert.rejects(generateFirstAdminSql({ email: 'admin@conecta.example.test', name: 'admin', operator: 'operator', password: 'A sufficiently strong password' }), /INVALID_DEVELOPMENT_FIXTURE/);
});
