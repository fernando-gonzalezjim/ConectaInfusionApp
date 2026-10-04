import { isIP } from 'node:net';

type Environment = Record<string, string | undefined>;
export interface IdentitySecrets {
  readonly activeKeyId: string;
  outboxKey(id: string): Buffer | undefined;
  throttleKey(): Buffer;
}
export interface EnabledIdentityConfig {
  readonly enabled: true;
  readonly publicOrigin: string;
  readonly webOrigins: readonly string[];
  readonly secrets: IdentitySecrets;
  readonly smtp: {
    readonly transport: 'mailpit' | 'smtp'; readonly host: string; readonly port: number; readonly from: string;
    readonly secure: boolean; readonly requireTLS: boolean; readonly ignoreTLS: boolean; readonly rejectUnauthorized: true;
    auth(): { user: string; pass: string } | undefined;
  };
}
export type IdentityConfig = { readonly enabled: false } | EnabledIdentityConfig;
function invalid(): never { throw new Error('IDENTITY_CONFIG_INVALID'); }
const loopback = (host: string) => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host);

function secret(value: string | undefined): Buffer {
  if (!value || value.length !== 44 || !/^[A-Za-z0-9+/]{43}=$/.test(value)) invalid();
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== 32 || bytes.toString('base64') !== value || new Set(bytes).size < 8) invalid();
  return bytes;
}
function text(value: string | undefined, max: number): string {
  if (!value || value.length > max || value.trim() !== value || /[\x00-\x1f\x7f]/.test(value)) invalid();
  return value;
}
function origin(value: string, local: boolean): URL {
  let url: URL;
  try { url = new URL(value); } catch { return invalid(); }
  if (url.origin !== value || url.username || url.password || url.search || url.hash) invalid();
  if (local ? !loopback(url.hostname) || !['http:', 'https:'].includes(url.protocol) : url.protocol !== 'https:') invalid();
  return url;
}

// Call during startup before enabling Identity. Disabled Foundation installs need no Identity secrets.
export function readIdentityConfig(env: Environment = process.env): IdentityConfig {
  if (env.IDENTITY_ENABLED === undefined || env.IDENTITY_ENABLED === 'false') return { enabled: false };
  if (env.IDENTITY_ENABLED !== 'true' || !['development', 'test', 'staging', 'production'].includes(env.NODE_ENV ?? '')) invalid();
  const local = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
  const activeKeyId = text(env.IDENTITY_OUTBOX_ACTIVE_KEY_ID, 32);
  if (!/^[a-zA-Z0-9_-]+$/.test(activeKeyId)) invalid();
  let parsed: unknown;
  try {
    const raw = text(env.IDENTITY_OUTBOX_KEYS, 4096);
    parsed = JSON.parse(raw);
  } catch { return invalid(); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) invalid();
  const entries = Object.entries(parsed);
  if (entries.length < 1 || entries.length > 8) invalid();
  const keys = new Map<string, Buffer>();
  for (const [id, value] of entries) {
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(id) || typeof value !== 'string') invalid();
    keys.set(id, secret(value));
  }
  if (!keys.has(activeKeyId)) invalid();
  const subjectKey = secret(env.IDENTITY_THROTTLE_KEY);
  // Independent keys for encryption and pseudonymous abuse/delivery identifiers.
  if ([...keys.values()].some(key => key.equals(subjectKey))) invalid();
  const publicOrigin = text(env.IDENTITY_PUBLIC_ORIGIN, 2048);
  const publicUrl = origin(publicOrigin, local);
  const origins = text(env.WEB_ORIGINS, 4096).split(',');
  if (origins.length > 8 || !origins.includes(publicOrigin)) invalid();
  for (const allowed of origins) {
    if (origin(allowed, local).hostname !== publicUrl.hostname) invalid();
  }
  const host = text(env.SMTP_HOST, 253);
  const from = text(env.SMTP_FROM, 320);
  if (from !== from.toLowerCase() || !/^[^\s@<>]+@[^\s@<>]+$/.test(from)) invalid();
  const rawPort = text(env.SMTP_PORT, 5);
  if (!/^[1-9][0-9]*$/.test(rawPort)) invalid();
  const port = Number(rawPort);
  if (port > 65535) invalid();
  let smtp: EnabledIdentityConfig['smtp'];
  if (local) {
    if (env.IDENTITY_MAIL_TRANSPORT !== 'mailpit' || !loopback(host) || port < 1024
      || env.SMTP_USER || env.SMTP_PASSWORD || env.SMTP_TLS_MODE) invalid();
    smtp = { transport: 'mailpit', host, port, from, secure: false, requireTLS: false, ignoreTLS: true,
      rejectUnauthorized: true, auth: () => undefined };
  } else {
    if (env.IDENTITY_MAIL_TRANSPORT !== 'smtp' || loopback(host) || isIP(host)
      || !/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(host)) invalid();
    const secure = env.SMTP_TLS_MODE === 'implicit';
    if (!(secure && port === 465) && !(env.SMTP_TLS_MODE === 'starttls' && port === 587)) invalid();
    const user = text(env.SMTP_USER, 320);
    const pass = text(env.SMTP_PASSWORD, 4096);
    smtp = { transport: 'smtp', host, port, from, secure, requireTLS: true, ignoreTLS: false,
      rejectUnauthorized: true, auth: () => ({ user, pass }) };
  }
  // Keep key material and SMTP credentials in closures, absent from JSON and normal inspection.
  const secrets: IdentitySecrets = Object.freeze({ activeKeyId,
    outboxKey: (id: string) => { const key = keys.get(id); return key ? Buffer.from(key) : undefined; },
    throttleKey: () => Buffer.from(subjectKey) });
  return Object.freeze({ enabled: true, publicOrigin, webOrigins: Object.freeze([...origins]), secrets, smtp: Object.freeze(smtp) });
}
