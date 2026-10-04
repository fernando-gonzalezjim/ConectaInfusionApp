import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { runDeliveryCommand } from '../../../scripts/identity-delivery.mjs';

const env = { NODE_ENV: 'test', IDENTITY_ENABLED: 'true', IDENTITY_MAIL_TRANSPORT: 'mailpit',
  IDENTITY_OUTBOX_ACTIVE_KEY_ID: 'v1', IDENTITY_OUTBOX_KEYS: JSON.stringify({ v1: randomBytes(32).toString('base64') }),
  IDENTITY_THROTTLE_KEY: randomBytes(32).toString('base64'), SMTP_HOST: '127.0.0.1', SMTP_PORT: '11025',
  SMTP_FROM: 'fixture@example.test', WEB_ORIGINS: 'http://localhost:5173,http://localhost:5174',
  IDENTITY_PUBLIC_ORIGIN: 'http://localhost:5173', DATABASE_URL: 'postgresql://fixture:private@127.0.0.1:55432/foundation_browser' };

test('delivery command rejects unknown flags, disabled Identity and unsafe targets before opening a database', async () => {
  const neverConnect = () => assert.fail('must not connect');
  for (const args of [['--watch'], ['--token', 'private'], ['--once', '--once']]) {
    await assert.rejects(runDeliveryCommand(args, { environment: env, createPool: neverConnect }), /INVALID_DELIVERY_COMMAND/);
  }
  await assert.rejects(runDeliveryCommand([], { environment: { ...env, IDENTITY_ENABLED: 'false' }, createPool: neverConnect }), /IDENTITY_DISABLED/);
  for (const DATABASE_URL of ['postgresql://fixture:private@production.example/conecta',
    'postgresql://fixture:private@localhost/conecta?host=production.example', 'not-a-url']) {
    await assert.rejects(runDeliveryCommand([], { environment: { ...env, DATABASE_URL }, createPool: neverConnect }), /UNSAFE_DELIVERY_DATABASE/);
  }
});

test('delivery command runs one bounded batch, prints only counts and closes worker/database on failure', async () => {
  const output = []; let ended = 0; let closed = 0;
  const dependencies = { environment: env, log: message => output.push(message),
    createPool: () => ({ on() {}, end: async () => { ended++; } }),
    createWorker: () => ({ runBatch: async limit => { assert.equal(limit, 10); return { sent: 1, retried: 0, failed: 0, expired: 0, cancelled: 0 }; }, close: () => { closed++; } }) };
  await runDeliveryCommand(['--once'], dependencies);
  assert.deepEqual(output, ['Identity delivery: sent=1 retried=0 failed=0 expired=0 cancelled=0']);
  dependencies.createWorker = () => ({ runBatch: async () => { throw new Error('private SMTP password and token'); }, close: () => { closed++; } });
  await assert.rejects(runDeliveryCommand([], dependencies), /IDENTITY_DELIVERY_UNAVAILABLE/);
  assert.equal(ended, 2); assert.equal(closed, 2); assert.equal(output.join('\n').includes('private'), false);
});
