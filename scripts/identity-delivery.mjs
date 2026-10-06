import 'dotenv/config';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { readIdentityConfig } from '../apps/api/dist/modules/identity/config.js';
import { createEmailOutboxWorker } from '../apps/api/dist/modules/identity/email-outbox.js';

// Explicit local operator tick. No startup hook, account creation or external SMTP authorization.
export async function runDeliveryCommand(args, dependencies = {}) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--once')) throw new Error('INVALID_DELIVERY_COMMAND');
  const environment = dependencies.environment ?? process.env;
  const config = readIdentityConfig(environment);
  if (!config.enabled) throw new Error('IDENTITY_DISABLED');
  if (!['development', 'test'].includes(environment.NODE_ENV) || config.smtp.transport !== 'mailpit') throw new Error('IDENTITY_DELIVERY_LOCAL_ONLY');
  let target;
  try { target = new URL(environment.DATABASE_URL ?? ''); } catch { throw new Error('UNSAFE_DELIVERY_DATABASE'); }
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
    || target.search || target.hash || !/^\/(conecta|conecta_dev|foundation_browser|test_[a-f0-9]{32})$/.test(target.pathname)) throw new Error('UNSAFE_DELIVERY_DATABASE');
  const log = dependencies.log ?? console.log;
  const pool = (dependencies.createPool ?? (options => new pg.Pool(options)))({ connectionString: target.href,
    max: 2, connectionTimeoutMillis: 5000, idleTimeoutMillis: 1000, statement_timeout: 10000 });
  let worker;
  try {
    pool.on('error', () => log('Identity delivery database unavailable.'));
    worker = (dependencies.createWorker ?? createEmailOutboxWorker)(pool,config);
    const counts = await worker.runBatch(10);
    log(`Identity delivery: sent=${counts.sent} retried=${counts.retried} failed=${counts.failed} expired=${counts.expired} cancelled=${counts.cancelled}`);
    return counts;
  } catch { throw new Error('IDENTITY_DELIVERY_UNAVAILABLE'); }
  finally { worker?.close(); await pool.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await runDeliveryCommand(process.argv.slice(2)); }
  catch { console.error('Identity delivery failed. Check local settings and docs/idntityImplementation/identity-action-delivery.md.'); process.exitCode = 1; }
}
