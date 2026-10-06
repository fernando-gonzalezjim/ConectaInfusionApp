import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { isolatedDatabase, migrate } from './identity-helpers.mjs';
import { authConfig, createAuthAccount } from './identity-auth-helpers.mjs';
import { issueAction } from '../../dist/modules/identity/action-tokens.js';
import { createEmailOutboxWorker } from '../../dist/modules/identity/email-outbox.js';

async function queue(pool, config, account, purpose, now, commit = true) {
  const client = await pool.connect(); await client.query('BEGIN');
  try {
    const action = await issueAction(client, config, { purpose, recipientEmail: account.email,
      accountId: account.accountId, accountVersion: 0, personId: account.personId, targetId: null, expectedVersion: 0 }, 'en', now);
    if (!commit) return { action, client };
    await client.query('COMMIT'); client.release(); return action;
  } catch (error) { await client.query('ROLLBACK'); client.release(); throw error; }
}
const row = async (pool, id) => (await pool.query('SELECT * FROM identity_email_outbox WHERE action_token_id=$1', [id])).rows[0];
function scrubbed(value, status) {
  assert.equal(value.status, status); for (const key of ['key_id', 'nonce', 'auth_tag', 'ciphertext', 'claimed_until']) assert.equal(value[key], null);
  assert.ok(value.terminal_at); assert.ok(value.scrubbed_at);
}

test('outbox sends only committed valid actions, claims once across workers and scrubs success/invalid/expired payloads', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); const config = authConfig(); const account = await createAuthAccount(db.pool); let now = new Date(); const messages = [];
    const options = { now: () => now, send: async message => { messages.push(message); } };
    const one = createEmailOutboxWorker(db.pool, config, options); const two = createEmailOutboxWorker(db.pool, config, options);
    const pending = await queue(db.pool, config, account, 'password_setup', now, false);
    try { await one.runBatch(); assert.equal(messages.length, 0); await pending.client.query('COMMIT'); }
    finally { pending.client.release(); }
    await Promise.all([one.runBatch(), two.runBatch()]); assert.equal(messages.length, 1);
    assert.equal(messages[0].to, account.email); assert.match(messages[0].subject, /account/i);
    const link = new URL(messages[0].text.match(/http:\/\/[^\s]+/)[0]);
    assert.equal(link.origin, config.publicOrigin); assert.equal(link.pathname, '/auth/action'); assert.equal(link.search, '');
    assert.equal(new URLSearchParams(link.hash.slice(1)).get('purpose'), 'password_setup');
    assert.equal(new URLSearchParams(link.hash.slice(1)).get('token').length, 43);
    scrubbed(await row(db.pool, pending.action.id), 'sent');
    const tampered = await queue(db.pool, config, account, 'email_confirmation', now);
    await db.pool.query("UPDATE identity_email_outbox SET auth_tag=decode(repeat('00',16),'hex') WHERE action_token_id=$1", [tampered.id]);
    await one.runBatch(); scrubbed(await row(db.pool, tampered.id), 'failed');
    assert.equal((await row(db.pool, tampered.id)).last_error_code, 'PAYLOAD_INVALID');
    const expired = await queue(db.pool, config, account, 'password_reset', now);
    now = new Date(expired.expiresAt); await one.runBatch(); scrubbed(await row(db.pool, expired.id), 'expired');
    const inactive = await queue(db.pool, config, account, 'email_change', now);
    await db.pool.query('UPDATE accounts SET session_version=1 WHERE id=$1', [account.accountId]);
    await one.runBatch(); scrubbed(await row(db.pool, inactive.id), 'cancelled'); assert.equal(messages.length, 1);
    assert.equal((await db.pool.query('SELECT consumed_at FROM identity_action_tokens WHERE id=$1', [pending.action.id])).rows[0].consumed_at, null);
    one.close(); two.close();
  } finally { await db.pool.end(); }
});

test('SMTP outages use bounded backoff, exhausted/rejected/key failures scrub secrets, and abandoned claims recover safely', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); const config = authConfig(); const account = await createAuthAccount(db.pool); let now = new Date(); let attempts = 0; let reject = false;
    const worker = createEmailOutboxWorker(db.pool, config, { now: () => now, send: async () => {
      attempts++; if (reject) throw Object.assign(new Error('private recipient and link'), { responseCode: 550 });
      throw new Error('private SMTP credentials and token');
    } });
    const action = await queue(db.pool, config, account, 'password_setup', now);
    for (let n=1; n<=5; n++) {
      await worker.runBatch(); const saved = await row(db.pool, action.id); assert.equal(saved.attempts, n);
      assert.equal(saved.last_error_code, 'SMTP_UNAVAILABLE');
      if (n<5) {
        assert.equal(saved.status, 'pending'); assert.equal(saved.available_at-now, 30000*2**(n-1));
        await worker.runBatch(); assert.equal(attempts, n); now = saved.available_at;
      } else scrubbed(saved, 'failed');
    }
    reject = true; const rejected = await queue(db.pool, config, account, 'email_confirmation', now);
    await worker.runBatch(); scrubbed(await row(db.pool, rejected.id), 'failed');
    assert.equal((await row(db.pool, rejected.id)).last_error_code, 'DELIVERY_REJECTED');
    const unavailableKey = await queue(db.pool, config, account, 'email_change', now);
    await db.pool.query("UPDATE identity_email_outbox SET key_id='missing' WHERE action_token_id=$1", [unavailableKey.id]);
    await worker.runBatch(); assert.equal((await row(db.pool, unavailableKey.id)).last_error_code, 'KEY_UNAVAILABLE');
    const recovering = await queue(db.pool, config, account, 'password_reset', now);
    await db.pool.query("UPDATE identity_email_outbox SET attempts=1,claimed_until=$2::timestamptz+interval '60 seconds' WHERE action_token_id=$1", [recovering.id, now]);
    const delivered = []; const recovery = createEmailOutboxWorker(db.pool, config, { now: () => now, send: async message => { delivered.push(message); } });
    await recovery.runBatch(); assert.equal(delivered.length, 0);
    now = new Date(+now+60000); await recovery.runBatch(); scrubbed(await row(db.pool, recovering.id), 'sent');
    assert.equal((await row(db.pool, recovering.id)).attempts, 2); assert.equal(delivered.length, 1);
    // Missing-key data must not be sent by a recovery worker either.
    assert.equal((await row(db.pool, unavailableKey.id)).status, 'pending');
    for (let n=3; n<=5; n++) {
      now = (await row(db.pool, unavailableKey.id)).available_at; await recovery.runBatch();
      assert.equal((await row(db.pool, unavailableKey.id)).attempts, n);
    }
    scrubbed(await row(db.pool, unavailableKey.id), 'failed');
    assert.equal((await row(db.pool, unavailableKey.id)).last_error_code, 'KEY_UNAVAILABLE');
    worker.close(); recovery.close();
  } finally { await db.pool.end(); }
});

for (const phase of ['preparation', 'renewal']) {
test(`a worker stalled during ${phase} cannot send or overwrite a replacement worker acknowledgement`, async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); const config = authConfig(); const account = await createAuthAccount(db.pool); let now = new Date();
    const action = await queue(db.pool, config, account, 'password_setup', now); const sent = [];
    let release; let prepared; const gate = new Promise(resolve => { release = resolve; });
    const stalled = new Promise(resolve => { prepared = resolve; });
    const delayedPool = { query: async (sql, args) => {
      const result = await db.pool.query(sql, args);
      if (sql.includes(phase === 'preparation' ? 'SELECT t.purpose' : 'SET claimed_until=$3')) { prepared(); await gate; }
      return result;
    } };
    const first = createEmailOutboxWorker(delayedPool, config, { now: () => now, send: async message => { sent.push(['stale', message]); } });
    const replacement = createEmailOutboxWorker(db.pool, config, { now: () => now, send: async message => { sent.push(['current', message]); } });
    const original = first.runBatch(); await stalled;
    now = new Date(+now+60000); await replacement.runBatch(); release(); await original;
    assert.deepEqual(sent.map(entry => entry[0]), ['current']); scrubbed(await row(db.pool, action.id), 'sent');
    assert.equal((await row(db.pool, action.id)).attempts, 2);
    first.close(); replacement.close();
  } finally { await db.pool.end(); }
});
}

test('database failure before sending or after SMTP acknowledgement retains a recoverable claim without raw errors', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); const config = authConfig(); const account = await createAuthAccount(db.pool); let now = new Date();
    const action = await queue(db.pool, config, account, 'password_setup', now); let sends = 0; let failAt = 'prepare';
    const interruptedPool = { query: async (sql, args) => {
      if ((failAt === 'prepare' && sql.includes('SELECT t.purpose')) || (failAt === 'ack' && sql.includes('SET status=$3'))) {
        throw new Error('private database address and token');
      }
      return db.pool.query(sql, args);
    } };
    const worker = createEmailOutboxWorker(interruptedPool, config, { now: () => now, send: async () => { sends++; } });
    await assert.rejects(worker.runBatch(), { message: 'OUTBOX_UNAVAILABLE' }); assert.equal(sends, 0);
    assert.equal((await row(db.pool, action.id)).status, 'pending'); assert.ok((await row(db.pool, action.id)).ciphertext);
    now = new Date(+now+60000); failAt = 'ack';
    await assert.rejects(worker.runBatch(), { message: 'OUTBOX_UNAVAILABLE' }); assert.equal(sends, 1);
    assert.equal((await row(db.pool, action.id)).last_error_code, null);
    assert.ok((await row(db.pool, action.id)).claimed_until); assert.ok((await row(db.pool, action.id)).ciphertext);
    now = new Date(+now+60000); failAt = null; await worker.runBatch();
    scrubbed(await row(db.pool, action.id), 'sent'); assert.equal(sends, 2); // SMTP acknowledgement loss is at-least-once.
    worker.close();
  } finally { await db.pool.end(); }
});

test('an action expiring while lease renewal is delayed is not sent', async () => {
  const db = await isolatedDatabase();
  try {
    migrate(db.name); const config = authConfig(); const account = await createAuthAccount(db.pool); let now = new Date();
    const action = await queue(db.pool,config,account,'password_setup',now); now = new Date(new Date(action.expiresAt).getTime()-10000);
    let release; let renewed; const gate = new Promise(resolve => { release = resolve; });
    const waiting = new Promise(resolve => { renewed = resolve; }); const sent = [];
    const delayedPool = { query: async (sql,args) => {
      const result = await db.pool.query(sql,args);
      if (sql.includes('SET claimed_until=$3')) { renewed(); await gate; }
      return result;
    } };
    const worker = createEmailOutboxWorker(delayedPool,config,{ now: () => now, send: async message => { sent.push(message); } });
    const running = worker.runBatch(); await waiting; now = new Date(action.expiresAt); release(); await running;
    assert.equal(sent.length,0); await worker.runBatch(); scrubbed(await row(db.pool,action.id),'expired'); worker.close();
  } finally { await db.pool.end(); }
});

test('the total SMTP deadline closes an active socket even when the server keeps sending partial responses', { timeout: 35000 }, async () => {
  const db = await isolatedDatabase(); const sockets = new Set(); let remotelyClosed = false;
  const server = createServer(socket => {
    sockets.add(socket); socket.write('220 local.test ESMTP\r\n'); let buffered = ''; let receiving = false; let trickle;
    socket.on('data', chunk => {
      buffered += chunk.toString(); let end;
      while ((end = buffered.indexOf('\r\n')) >= 0) {
        const line = buffered.slice(0,end); buffered = buffered.slice(end+2);
        if (receiving) {
          if (line === '.') { receiving = false; trickle = setInterval(() => socket.write('250-wait\r\n'),1000); }
        } else if (line.startsWith('EHLO')) socket.write('250-local.test\r\n250 SIZE 100000\r\n');
        else if (line.startsWith('MAIL') || line.startsWith('RCPT')) socket.write('250 OK\r\n');
        else if (line === 'DATA') { receiving = true; socket.write('354 Continue\r\n'); }
      }
    });
    socket.on('error', () => {});
    socket.on('close', () => { remotelyClosed = true; clearInterval(trickle); sockets.delete(socket); });
  });
  let worker;
  try {
    migrate(db.name); const config = authConfig(); const account = await createAuthAccount(db.pool); const now = new Date();
    const action = await queue(db.pool, config, account, 'password_setup', now);
    server.listen(0,'127.0.0.1'); await new Promise(resolve => server.once('listening',resolve));
    worker = createEmailOutboxWorker(db.pool, { ...config, smtp: { ...config.smtp, port: server.address().port } });
    const started = Date.now(); assert.equal((await worker.runBatch()).retried,1);
    assert.ok(Date.now()-started >= 19000 && Date.now()-started < 26000);
    for (let attempt=0; attempt<10 && !remotelyClosed; attempt++) await new Promise(resolve => setTimeout(resolve,100));
    assert.equal(remotelyClosed,true,'Deadline must cancel the active socket, not just abandon its promise');
    assert.equal((await row(db.pool,action.id)).last_error_code,'SMTP_UNAVAILABLE');
  } finally {
    worker?.close(); for (const socket of sockets) socket.destroy();
    if (server.listening) await new Promise(resolve => server.close(resolve)); await db.pool.end();
  }
});
