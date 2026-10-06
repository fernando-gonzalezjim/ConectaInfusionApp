-- Additive only: no accounts, default passwords or automatic legacy identity claims.
CREATE TABLE people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 1 AND 120),
  phone text CHECK (phone IS NULL OR length(phone) <= 40),
  preferred_locale text NOT NULL DEFAULT 'es-MX' CHECK (preferred_locale IN ('es-MX', 'en')),
  photo_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL UNIQUE REFERENCES people(id),
  email text NOT NULL UNIQUE CHECK (
    email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 320
    AND email ~ '^[^[:space:]@]+@[^[:space:]@]+$'
  ),
  password_hash text CHECK (password_hash IS NULL OR password_hash LIKE '$argon2id$%'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
  confirmation_status text NOT NULL DEFAULT 'pending' CHECK (confirmation_status IN ('pending', 'verified', 'exempt')),
  email_verified_at timestamptz,
  exemption_source text CHECK (exemption_source IN ('manual_bootstrap', 'management')),
  exemption_actor_id uuid REFERENCES accounts(id),
  exemption_reason text,
  exemption_at timestamptz,
  session_version integer NOT NULL DEFAULT 0 CHECK (session_version >= 0),
  development_fixture text CHECK (development_fixture IN ('admin', 'testuser')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  CONSTRAINT account_confirmation_provenance CHECK (
    (confirmation_status = 'pending' AND email_verified_at IS NULL
      AND exemption_source IS NULL AND exemption_actor_id IS NULL AND exemption_reason IS NULL AND exemption_at IS NULL)
    OR (confirmation_status = 'verified' AND email_verified_at IS NOT NULL
      AND exemption_source IS NULL AND exemption_actor_id IS NULL AND exemption_reason IS NULL AND exemption_at IS NULL)
    OR (confirmation_status = 'exempt' AND email_verified_at IS NULL
      AND exemption_source IS NOT NULL AND exemption_reason IS NOT NULL AND length(btrim(exemption_reason)) BETWEEN 1 AND 500
      AND exemption_at IS NOT NULL AND (
        (exemption_source = 'management' AND exemption_actor_id IS NOT NULL)
        OR (exemption_source = 'manual_bootstrap' AND exemption_actor_id IS NULL)))
  ),
  CONSTRAINT account_active_credentials CHECK (status <> 'active' OR (password_hash IS NOT NULL AND confirmation_status <> 'pending')),
  CONSTRAINT account_deactivation_timestamp CHECK ((status = 'inactive') = (deactivated_at IS NOT NULL)),
  CONSTRAINT account_fixture_identity CHECK (development_fixture IS NULL
    OR (development_fixture = 'admin' AND email = 'admin@conecta.example.test')
    OR (development_fixture = 'testuser' AND email = 'testuser@conecta.example.test'))
);
CREATE INDEX accounts_exemption_actor_idx ON accounts(exemption_actor_id) WHERE exemption_actor_id IS NOT NULL;

CREATE TABLE account_roles (
  account_id uuid NOT NULL REFERENCES accounts(id),
  role text NOT NULL CHECK (role IN ('administrator', 'manager', 'reception', 'cafe_staff', 'instructor', 'customer')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES accounts(id),
  PRIMARY KEY (account_id, role)
);
CREATE INDEX account_roles_role_idx ON account_roles(role, account_id);
CREATE INDEX account_roles_assigned_by_idx ON account_roles(assigned_by) WHERE assigned_by IS NOT NULL;

-- Nullable links allow reviewed adoption without changing old FK targets or inventing emails.
ALTER TABLE members ADD COLUMN person_id uuid UNIQUE REFERENCES people(id);
ALTER TABLE instructors ADD COLUMN person_id uuid UNIQUE REFERENCES people(id);
