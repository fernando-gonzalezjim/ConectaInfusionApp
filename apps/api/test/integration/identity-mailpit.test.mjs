import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { createServer } from 'node:net';
import { readIdentityConfig } from '../../dist/modules/identity/config.js';
import { issueAction } from '../../dist/modules/identity/action-tokens.js';
import { createEmailOutboxWorker } from '../../dist/modules/identity/email-outbox.js';
import { isolatedDatabase, migrate } from './identity-helpers.mjs';
import { createAuthAccount } from './identity-auth-helpers.mjs';

const compose = ['compose', '-f', 'compose.test.yaml', '-p', 'conecta-foundation-tests'];
function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}
test('Mailpit captures local SMTP and recovers encrypted action delivery after an actual connection outage', async () => {
  for (const file of ['compose.yaml', 'compose.test.yaml']) {
    const model = JSON.parse(docker(['compose', '-f', file, '--profile', 'identity', 'config', '--format', 'json']));
    const service = model.services.mailpit;
    assert.ok(service, 'I05 must define a local inbox service');
    assert.equal(service.image, 'axllent/mailpit:v1.31.4');
    assert.equal(service.ports.length, 2);
    assert.ok(service.ports.every(port => port.host_ip === '127.0.0.1'));
    assert.equal(service.environment.MP_DISABLE_VERSION_CHECK, 'true');
    assert.equal(service.environment.MP_SMTP_RELAY_CONFIG, undefined);
    assert.equal(service.environment.MP_SMTP_RELAY_ALL, undefined);
    assert.ok(Object.keys(service.networks).every(network => model.networks[network].driver === 'bridge'));
    // Compose's JSON model retains the escaped dollar; the container receives one regex end anchor.
    assert.equal(service.environment.MP_SMTP_ALLOWED_RECIPIENTS.replaceAll('$$', '$'), '@[^@]+\\.test$');
  }
  let started = false;
  let database;
  const transport = nodemailer.createTransport({
    host: '127.0.0.1', port: 11025, secure: false, ignoreTLS: true,
    connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 5000,
    logger: false, debug: false,
  });
  try {
    started = true; docker([...compose, 'up', '-d', '--wait', '--wait-timeout', '60', 'mailpit']);
    const config = readIdentityConfig({ IDENTITY_ENABLED: 'true', NODE_ENV: 'test', IDENTITY_MAIL_TRANSPORT: 'mailpit',
      IDENTITY_OUTBOX_ACTIVE_KEY_ID: 'v1', IDENTITY_OUTBOX_KEYS: JSON.stringify({ v1: randomBytes(32).toString('base64') }),
      IDENTITY_THROTTLE_KEY: randomBytes(32).toString('base64'),
      WEB_ORIGINS: 'http://localhost:5173,http://localhost:5174', IDENTITY_PUBLIC_ORIGIN: 'http://localhost:5173',
      SMTP_HOST: '127.0.0.1', SMTP_PORT: '11025', SMTP_FROM: 'no-reply@conecta.example.test' });
    assert.equal(config.smtp.port, 11025);
    await transport.verify();
    const subject = `I05 local inbox ${randomUUID()}`;
    const body = 'Dummy local-only message. No action link or real customer data.';
    const sent = await transport.sendMail({ from: config.smtp.from, to: 'fixture@conecta.example.test', subject, text: body });
    assert.deepEqual(sent.accepted, ['fixture@conecta.example.test']);
    let message;
    for (let attempt = 0; attempt < 20; attempt++) {
      const response = await fetch('http://127.0.0.1:18025/api/v1/messages', { signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 200);
      message = (await response.json()).messages.find(item => item.Subject === subject);
      if (message) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(message, 'SMTP message must appear in the real local inbox');
    const response = await fetch(`http://127.0.0.1:18025/api/v1/message/${message.ID}`, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200);
    const saved = await response.json();
    assert.equal(saved.Subject, subject);
    assert.equal(saved.To[0].Address, 'fixture@conecta.example.test');
    assert.equal(saved.Text.trim(), body);
    await assert.rejects(transport.sendMail({ from: config.smtp.from, to: 'fixture@real.invalid', subject, text: body }), { code: 'EENVELOPE' });

    database = await isolatedDatabase(); migrate(database.name);
    const account = await createAuthAccount(database.pool, `delivery-${randomUUID()}@example.test`);
    let now = new Date(); const client = await database.pool.connect(); let action;
    try {
      await client.query('BEGIN');
      action = await issueAction(client, config, { purpose: 'email_confirmation', recipientEmail: account.email,
        accountId: account.accountId, accountVersion: 0, personId: account.personId, targetId: null, expectedVersion: 0 }, 'es-MX', now);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    const reservation = createServer(); reservation.listen(0, '127.0.0.1');
    await new Promise(resolve => reservation.once('listening', resolve)); const closedPort = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    const unavailable = createEmailOutboxWorker(database.pool, { ...config, smtp: { ...config.smtp, port: closedPort } }, { now: () => now });
    try { assert.equal((await unavailable.runBatch()).retried, 1); } finally { unavailable.close(); }
    let delivery = (await database.pool.query('SELECT * FROM identity_email_outbox WHERE action_token_id=$1', [action.id])).rows[0];
    assert.equal(delivery.status, 'pending'); assert.equal(delivery.attempts, 1); assert.equal(delivery.last_error_code, 'SMTP_UNAVAILABLE');
    assert.ok(delivery.ciphertext); now = delivery.available_at;
    const worker = createEmailOutboxWorker(database.pool, config, { now: () => now });
    try { assert.equal((await worker.runBatch()).sent, 1); } finally { worker.close(); }
    delivery = (await database.pool.query('SELECT * FROM identity_email_outbox WHERE action_token_id=$1', [action.id])).rows[0];
    assert.equal(delivery.status, 'sent'); assert.equal(delivery.attempts, 2);
    for (const field of ['ciphertext', 'nonce', 'auth_tag', 'key_id', 'claimed_until']) assert.equal(delivery[field], null);
    const inbox = await fetch('http://127.0.0.1:18025/api/v1/messages');
    const captured = (await inbox.json()).messages.find(item => item.To.some(recipient => recipient.Address === account.email));
    assert.ok(captured, 'Real worker delivery must reach Mailpit after retry');
    const delivered = await (await fetch(`http://127.0.0.1:18025/api/v1/message/${captured.ID}`)).json();
    assert.equal(delivered.To[0].Address, account.email); assert.match(delivered.Subject, /Confirma tu correo/);
    const actionLink = new URL(delivered.Text.match(/http:\/\/[^\s]+/)[0]);
    assert.equal(actionLink.origin, config.publicOrigin); assert.equal(actionLink.search, '');
    const fragment = new URLSearchParams(actionLink.hash.slice(1)); assert.equal(fragment.get('purpose'), 'email_confirmation');
    assert.equal(fragment.get('token').length, 43);
    // Receiving/opening the link is not redemption and cannot activate or change this account.
    assert.equal((await database.pool.query('SELECT consumed_at FROM identity_action_tokens WHERE id=$1', [action.id])).rows[0].consumed_at, null);
  } finally {
    if (database) await database.pool.end();
    transport.close();
    if (started) {
      docker([...compose, 'stop', 'mailpit']);
      docker([...compose, 'rm', '-f', 'mailpit']);
      const networks = docker(['network', 'ls', '--filter', 'label=com.docker.compose.project=conecta-foundation-tests',
        '--filter', 'label=com.docker.compose.network=mailpit_local', '--format', '{{.Name}}']).trim().split(/\r?\n/);
      if (networks.includes('conecta-foundation-tests_mailpit_local')) {
        docker(['network', 'rm', 'conecta-foundation-tests_mailpit_local']);
      }
    }
  }
});
