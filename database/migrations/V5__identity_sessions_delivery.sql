-- Persistence only. No account seeds, automatic delivery, login or token redemption.
CREATE TABLE identity_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id),
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  csrf_hash bytea NOT NULL CHECK (octet_length(csrf_hash) = 32),
  session_version integer NOT NULL CHECK (session_version >= 0),
  remember_me boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  authenticated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (isfinite(created_at) AND isfinite(authenticated_at) AND isfinite(expires_at)),
  CHECK (authenticated_at >= created_at AND authenticated_at < expires_at),
  CHECK (expires_at = created_at + CASE WHEN remember_me THEN interval '720 hours' ELSE interval '168 hours' END),
  CHECK (revoked_at IS NULL OR (isfinite(revoked_at) AND revoked_at >= created_at))
);
CREATE INDEX identity_sessions_account_idx ON identity_sessions(account_id);
CREATE INDEX identity_sessions_expiry_idx ON identity_sessions(expires_at);

CREATE TABLE identity_action_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  purpose text NOT NULL CHECK (purpose IN (
    'email_confirmation', 'password_setup', 'password_reset', 'email_change',
    'family_invitation', 'family_successor', 'guardian_invitation', 'dependent_transition', 'guardian_reactivation'
  )),
  account_id uuid REFERENCES accounts(id),
  account_version integer CHECK (account_version >= 0),
  person_id uuid REFERENCES people(id),
  -- Relationship/invitation identifiers belong to later Identity slices; validate them at redemption.
  target_id uuid,
  recipient_email text NOT NULL CHECK (
    recipient_email = lower(btrim(recipient_email)) AND length(recipient_email) BETWEEN 3 AND 320
    AND recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+$'
  ),
  expected_version integer NOT NULL CHECK (expected_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  CHECK ((account_id IS NULL) = (account_version IS NULL)),
  CHECK (account_id IS NOT NULL OR person_id IS NOT NULL OR target_id IS NOT NULL),
  CHECK (isfinite(created_at) AND isfinite(expires_at) AND expires_at > created_at),
  CHECK (expires_at <= created_at + CASE
    WHEN purpose = 'password_reset' THEN interval '1 hour'
    WHEN purpose IN ('family_invitation', 'family_successor', 'guardian_invitation', 'guardian_reactivation') THEN interval '168 hours'
    ELSE interval '24 hours' END),
  CHECK (consumed_at IS NULL OR (isfinite(consumed_at) AND consumed_at >= created_at AND consumed_at < expires_at)),
  CHECK (revoked_at IS NULL OR (isfinite(revoked_at) AND revoked_at >= created_at)),
  CHECK (consumed_at IS NULL OR revoked_at IS NULL)
);
CREATE INDEX identity_action_tokens_account_idx ON identity_action_tokens(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX identity_action_tokens_person_idx ON identity_action_tokens(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX identity_action_tokens_target_idx ON identity_action_tokens(target_id) WHERE target_id IS NOT NULL;
CREATE INDEX identity_action_tokens_recipient_idx ON identity_action_tokens(recipient_email, purpose);
CREATE INDEX identity_action_tokens_expiry_idx ON identity_action_tokens(expires_at);

-- HMAC subjects avoid retaining raw emails/IPs in abuse counters. Enforcement is added with auth routes.
CREATE TABLE identity_throttles (
  scope text NOT NULL CHECK (scope IN (
    'login_ip', 'login_identity', 'registration_ip', 'recovery_ip', 'recovery_identity', 'resend_identity', 'action_ip'
  )),
  subject_hash bytea NOT NULL CHECK (octet_length(subject_hash) = 32),
  window_started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts BETWEEN 0 AND 1000000),
  last_attempt_at timestamptz,
  PRIMARY KEY (scope, subject_hash),
  CHECK (isfinite(window_started_at) AND isfinite(expires_at) AND expires_at > window_started_at),
  CHECK (last_attempt_at IS NULL OR (isfinite(last_attempt_at) AND last_attempt_at >= window_started_at))
);
CREATE INDEX identity_throttles_expiry_idx ON identity_throttles(expires_at);

CREATE TABLE identity_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_token_id uuid REFERENCES identity_action_tokens(id),
  kind text NOT NULL DEFAULT 'action' CHECK (kind IN ('action', 'security_notification')),
  recipient_hash bytea NOT NULL CHECK (octet_length(recipient_hash) = 32),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'expired', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  key_id text,
  nonce bytea,
  auth_tag bytea,
  ciphertext bytea,
  created_at timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  claimed_until timestamptz,
  terminal_at timestamptz,
  scrubbed_at timestamptz,
  -- Only stable allowlisted codes, never raw SMTP errors, addresses or tokens.
  last_error_code text CHECK (last_error_code IN ('SMTP_UNAVAILABLE', 'DELIVERY_REJECTED', 'PAYLOAD_INVALID', 'KEY_UNAVAILABLE')),
  CHECK ((kind = 'action') = (action_token_id IS NOT NULL)),
  CHECK (isfinite(created_at) AND isfinite(available_at) AND isfinite(expires_at) AND expires_at > created_at),
  CHECK (available_at >= created_at),
  CHECK (claimed_until IS NULL OR (status = 'pending' AND isfinite(claimed_until) AND claimed_until >= created_at)),
  CONSTRAINT identity_outbox_payload_state CHECK (
    (status = 'pending' AND terminal_at IS NULL AND scrubbed_at IS NULL
      AND key_id IS NOT NULL AND key_id ~ '^[a-zA-Z0-9_-]{1,32}$'
      AND nonce IS NOT NULL AND octet_length(nonce) = 12
      AND auth_tag IS NOT NULL AND octet_length(auth_tag) = 16
      AND ciphertext IS NOT NULL AND octet_length(ciphertext) BETWEEN 1 AND 16384)
    OR (status <> 'pending' AND terminal_at IS NOT NULL AND isfinite(terminal_at) AND terminal_at >= created_at
      AND scrubbed_at IS NOT NULL AND isfinite(scrubbed_at) AND scrubbed_at >= terminal_at
      AND key_id IS NULL AND nonce IS NULL AND auth_tag IS NULL AND ciphertext IS NULL AND claimed_until IS NULL)
  )
);
CREATE INDEX identity_email_outbox_action_idx ON identity_email_outbox(action_token_id) WHERE action_token_id IS NOT NULL;
CREATE INDEX identity_email_outbox_dispatch_idx ON identity_email_outbox(available_at, id) WHERE status = 'pending';
CREATE INDEX identity_email_outbox_expiry_idx ON identity_email_outbox(expires_at) WHERE status = 'pending';
