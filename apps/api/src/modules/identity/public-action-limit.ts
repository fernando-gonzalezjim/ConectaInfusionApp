import { isIP } from 'node:net';
import type { Pool } from 'pg';
import type { EnabledIdentityConfig } from './config.js';
import { actionSubjectHash } from './action-tokens.js';
import { AuthError } from './sessions.js';
import { LoginThrottleError } from './login-throttle.js';

// IP-only public limit cannot reveal recipient existence; reserve before password/database work.
export async function reservePublicAction(pool: Pool, config: EnabledIdentityConfig, ip: string, scope: 'registration_ip' | 'recovery_ip' | 'action_ip', now: Date) {
    if (!isIP(ip)) throw new AuthError('INVALID_REQUEST');
    const hash = actionSubjectHash(config.secrets, scope, ip);
    const row = (await pool.query<{ attempts: number; expires_at: Date }>(`INSERT INTO identity_throttles
      (scope,subject_hash,window_started_at,expires_at,attempts,last_attempt_at)
      VALUES ($1,$2,$3,$3::timestamptz+interval '15 minutes',1,$3)
      ON CONFLICT(scope,subject_hash) DO UPDATE SET
      attempts=CASE WHEN identity_throttles.expires_at <= $3 THEN 1 ELSE LEAST(identity_throttles.attempts+1,31) END,
      window_started_at=CASE WHEN identity_throttles.expires_at <= $3 THEN $3 ELSE identity_throttles.window_started_at END,
      expires_at=CASE WHEN identity_throttles.expires_at <= $3 THEN $3::timestamptz+interval '15 minutes' ELSE identity_throttles.expires_at END,
      last_attempt_at=GREATEST(identity_throttles.window_started_at,$3::timestamptz)
      RETURNING attempts,expires_at`, [scope, hash, now])).rows[0]!;
    if (row.attempts > 30) throw new LoginThrottleError(Math.max(1, Math.ceil((+row.expires_at-+now)/1000)));
  }
