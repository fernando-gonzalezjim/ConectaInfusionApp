import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import type { Pool } from 'pg';
import type { IdentitySecrets } from './config.js';

export class LoginThrottleError extends Error {
  readonly code = 'THROTTLED';
  constructor(readonly retryAfterSeconds: number) { super('THROTTLED'); }
}

// Reserve before password work, including unknown accounts. Counters commit independently of failed logins.
export async function reserveLoginAttempt(
  pool: Pool, secrets: Pick<IdentitySecrets, 'throttleKey'>, email: string, ip: string, now: Date,
): Promise<void> {
  if (!isIP(ip) || typeof email !== 'string' || email.length < 3 || email.length > 320
    || !Number.isFinite(now.getTime())) throw new Error('INVALID_LOGIN_CONTEXT');
  const key = secrets.throttleKey();
  try {
    // Each UPSERT is independently atomic. No multi-row transaction or lock-order dependency.
    for (const [scope, subject, limit] of [
      ['login_ip', ip, 30], ['login_identity', email, 10],
    ] as const) {
      const hash = createHmac('sha256', key).update(`identity-throttle-v1\0${scope}\0${subject}`).digest();
      const result = await pool.query<{ attempts: number; expires_at: Date }>(`INSERT INTO identity_throttles
        (scope,subject_hash,window_started_at,expires_at,attempts,last_attempt_at)
        VALUES ($1,$2,$3,$3::timestamptz + interval '15 minutes',1,$3)
        ON CONFLICT (scope,subject_hash) DO UPDATE SET
          attempts=CASE WHEN identity_throttles.expires_at <= $3 THEN 1 ELSE LEAST(identity_throttles.attempts+1,$4+1) END,
          window_started_at=CASE WHEN identity_throttles.expires_at <= $3 THEN $3 ELSE identity_throttles.window_started_at END,
          expires_at=CASE WHEN identity_throttles.expires_at <= $3 THEN $3::timestamptz + interval '15 minutes' ELSE identity_throttles.expires_at END,
          last_attempt_at=GREATEST(identity_throttles.window_started_at,$3::timestamptz)
        RETURNING attempts,expires_at`, [scope, hash, now, limit]);
      const counter = result.rows[0];
      if (!counter) throw new Error('LOGIN_THROTTLE_UNAVAILABLE');
      if (counter.attempts > limit) {
        throw new LoginThrottleError(Math.max(1, Math.ceil((counter.expires_at.getTime() - now.getTime()) / 1000)));
      }
    }
  } finally { key.fill(0); }
}
