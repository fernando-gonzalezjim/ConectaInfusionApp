import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const load = () => import('../dist/modules/identity/config.js');
function environment() {
  return { IDENTITY_ENABLED: 'true', NODE_ENV: 'development', IDENTITY_MAIL_TRANSPORT: 'mailpit',
    IDENTITY_OUTBOX_ACTIVE_KEY_ID: 'v1', IDENTITY_OUTBOX_KEYS: JSON.stringify({ v1: randomBytes(32).toString('base64') }),
    IDENTITY_THROTTLE_KEY: randomBytes(32).toString('base64'),
    IDENTITY_PUBLIC_ORIGIN: 'http://localhost:5173', WEB_ORIGINS: 'http://localhost:5173,http://localhost:5174',
    SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_FROM: 'no-reply@conecta.example.test' };
}

test('Identity defaults disabled; explicitly enabled config requires secrets and a loopback inbox', async () => {
  const { readIdentityConfig } = await load();
  assert.deepEqual(readIdentityConfig({}), { enabled: false });
  assert.deepEqual(readIdentityConfig({ IDENTITY_ENABLED: 'false' }), { enabled: false });
  assert.throws(() => readIdentityConfig({ IDENTITY_ENABLED: 'yes' }), /IDENTITY_CONFIG_INVALID/);
  const env = environment();
  const config = readIdentityConfig(env);
  assert.equal(config.enabled, true);
  assert.equal(config.smtp.host, '127.0.0.1');
  assert.equal(config.smtp.transport, 'mailpit');
  assert.equal(config.smtp.ignoreTLS, true);
  assert.equal(config.publicOrigin, 'http://localhost:5173');
  assert.deepEqual(config.webOrigins, ['http://localhost:5173', 'http://localhost:5174']);
  assert.equal(Object.isFrozen(config.webOrigins), true);
  assert.equal(config.secrets.activeKeyId, 'v1');
  assert.equal(config.secrets.outboxKey('v1').length, 32);
  assert.equal(config.secrets.outboxKey('missing'), undefined);
  const copy = config.secrets.outboxKey('v1'); copy.fill(0);
  assert.notDeepEqual(copy, config.secrets.outboxKey('v1'));
  assert.equal(JSON.stringify(config).includes(JSON.parse(env.IDENTITY_OUTBOX_KEYS).v1), false);
  assert.equal(JSON.stringify(config).includes(env.IDENTITY_THROTTLE_KEY), false);
});

test('invalid and weak keys, unsafe SMTP, inconsistent origins and malformed values fail without secret disclosure', async () => {
  const { readIdentityConfig } = await load();
  const mutations = [
    { NODE_ENV: undefined }, { NODE_ENV: 'unknown' }, { IDENTITY_OUTBOX_KEYS: undefined },
    { IDENTITY_OUTBOX_KEYS: 'not-json-private-value' }, { IDENTITY_OUTBOX_KEYS: '[]' },
    { IDENTITY_OUTBOX_KEYS: JSON.stringify({ v1: Buffer.alloc(32).toString('base64') }) },
    { IDENTITY_OUTBOX_KEYS: JSON.stringify({ v1: randomBytes(16).toString('base64') }) },
    { IDENTITY_OUTBOX_ACTIVE_KEY_ID: 'missing' }, { IDENTITY_THROTTLE_KEY: 'replace-me' },
    { SMTP_HOST: 'smtp.real-provider.example' }, { SMTP_PORT: '25' }, { SMTP_PORT: '1025junk' },
    { SMTP_FROM: 'name\nBcc: other@example.test' }, { SMTP_USER: 'unexpected' },
    { IDENTITY_PUBLIC_ORIGIN: 'http://localhost:5173/path' },
    { IDENTITY_PUBLIC_ORIGIN: 'http://attacker.example' },
    { WEB_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5174' },
    { WEB_ORIGINS: '*' }, { IDENTITY_MAIL_TRANSPORT: 'smtp' },
    { NODE_ENV: 'production' }, { NODE_ENV: 'staging' },
  ];
  for (const change of mutations) {
    assert.throws(() => readIdentityConfig({ ...environment(), ...change }), error => {
      assert.equal(error.message, 'IDENTITY_CONFIG_INVALID'); return true;
    });
  }
  const env = environment(); env.IDENTITY_THROTTLE_KEY = JSON.parse(env.IDENTITY_OUTBOX_KEYS).v1;
  assert.throws(() => readIdentityConfig(env), /IDENTITY_CONFIG_INVALID/);
});

test('production configuration requires same-host HTTPS, authenticated TLS SMTP and supports retained rotation keys', async () => {
  const { readIdentityConfig } = await load();
  const env = { ...environment(), NODE_ENV: 'production', IDENTITY_MAIL_TRANSPORT: 'smtp',
    IDENTITY_PUBLIC_ORIGIN: 'https://studio.example.test', WEB_ORIGINS: 'https://studio.example.test',
    SMTP_HOST: 'smtp.provider.example.test', SMTP_PORT: '587', SMTP_TLS_MODE: 'starttls',
    SMTP_USER: 'service', SMTP_PASSWORD: 'private-smtp-password', SMTP_FROM: 'no-reply@studio.example.test' };
  const older = randomBytes(32).toString('base64');
  env.IDENTITY_OUTBOX_KEYS = JSON.stringify({ ...JSON.parse(env.IDENTITY_OUTBOX_KEYS), old: older });
  const config = readIdentityConfig(env);
  assert.equal(config.smtp.requireTLS, true);
  assert.equal(config.smtp.rejectUnauthorized, true);
  assert.equal(config.smtp.auth().pass, env.SMTP_PASSWORD);
  assert.equal(JSON.stringify(config).includes(env.SMTP_PASSWORD), false);
  assert.equal(config.secrets.outboxKey('old').toString('base64'), older);
  for (const change of [{ SMTP_PASSWORD: undefined }, { SMTP_TLS_MODE: 'none' }, { SMTP_HOST: '127.0.0.1' },
    { IDENTITY_PUBLIC_ORIGIN: 'http://studio.example.test' }, { SMTP_PORT: '465' }]) {
    assert.throws(() => readIdentityConfig({ ...env, ...change }), /IDENTITY_CONFIG_INVALID/);
  }
  assert.equal(readIdentityConfig({ ...env, SMTP_PORT: '465', SMTP_TLS_MODE: 'implicit' }).smtp.secure, true);
});

test('enabled Identity with invalid secrets stops the API before listening and exposes no secret value', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../dist/server.js', import.meta.url))], {
    encoding: 'utf8', timeout: 2000,
    env: { ...process.env, ...environment(), DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/unused',
      IDENTITY_OUTBOX_KEYS: 'private-invalid-key-marker', PORT: '0' },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /IDENTITY_CONFIG_INVALID/);
  assert.equal(result.stderr.includes('private-invalid-key-marker'), false);
  assert.equal(result.stdout.includes('API listening'), false);
});
