import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, hashDevelopmentFixturePassword } from '../dist/modules/identity/passwords.js';

test('normal passwords enforce code-point bounds without trimming or normalizing', async () => {
  for (const value of [null, 123, 'short', 'a'.repeat(129), '\ud800'.repeat(15)]) {
    await assert.rejects(hashPassword(value), /INVALID_PASSWORD/);
  }
  const password = `  Mixed unicode ñ🙂 ${'a'.repeat(100)}  `;
  const hash = await hashPassword(password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword(password.trim(), hash), false);
  assert.equal(await verifyPassword(`${password}!`, hash), false);
  const composed = 'á'.repeat(15);
  assert.equal(await verifyPassword(composed.normalize('NFD'), await hashPassword(composed)), false);
  assert.equal(await verifyPassword('🙂'.repeat(128), await hashPassword('🙂'.repeat(128))), true);
});

test('hashing uses random salts and the selected named Argon2id parameters', async () => {
  const first = await hashPassword('Valid password for hashing');
  const second = await hashPassword('Valid password for hashing');
  assert.notEqual(first, second);
  const [, algorithm, version, parameters] = first.split('$');
  assert.equal(algorithm, 'argon2id');
  assert.equal(version, 'v=19');
  assert.deepEqual(parameters.split(',').sort(), ['m=19456', 'p=1', 't=2']);
});

test('fixture short passwords require the exact development opt-in and fixture identity', async () => {
  for (const environment of ['production', 'staging', '', undefined]) {
    await assert.rejects(hashDevelopmentFixturePassword('admin', { NODE_ENV: environment, IDENTITY_DEV_FIXTURES: 'true' }), /DEVELOPMENT_FIXTURES_DISABLED/);
  }
  await assert.rejects(hashDevelopmentFixturePassword('admin', { NODE_ENV: 'development' }), /DEVELOPMENT_FIXTURES_DISABLED/);
  await assert.rejects(hashDevelopmentFixturePassword('someone', { NODE_ENV: 'development', IDENTITY_DEV_FIXTURES: 'true' }), /INVALID_DEVELOPMENT_FIXTURE/);
  for (const name of ['admin', 'testuser']) {
    const hash = await hashDevelopmentFixturePassword(name, { NODE_ENV: 'development', IDENTITY_DEV_FIXTURES: 'true' });
    assert.equal(await verifyPassword(name, hash), true);
    assert.equal(await verifyPassword('wrong', hash), false);
    await assert.rejects(hashPassword(name), /INVALID_PASSWORD/);
  }
});

test('verification rejects malformed or excessive input and unsafe PHC costs', async () => {
  const hash = await hashPassword('Normal password for verification');
  for (const password of [null, undefined, '', 'a'.repeat(129), '\ud800']) {
    assert.equal(await verifyPassword(password, hash), false);
  }
  for (const badHash of [null, 'plaintext', '$argon2id$bad', hash.replace('m=19456', 'm=999999999'),
    hash.replace('t=2', 't=9999'), hash.replace('p=1', 'p=999'), hash.replace('m=19456', 'm=1'),
    hash.replace('m=19456', 'm=19456,m=19456')]) {
    assert.equal(await verifyPassword('Normal password for verification', badHash), false);
  }
});

test('parallel password work is bounded and recovers after overload', async () => {
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => hashPassword('Concurrency check password')));
  assert.ok(results.some(result => result.status === 'fulfilled'));
  assert.ok(results.some(result => result.status === 'rejected' && result.reason.message === 'PASSWORD_WORK_BUSY'));
  assert.equal(await verifyPassword('Later valid password', await hashPassword('Later valid password')), true);
});
