CREATE TABLE business_units (
  code text PRIMARY KEY CHECK (code IN ('studio', 'cafe')),
  label_es text NOT NULL,
  label_en text NOT NULL
);
INSERT INTO business_units VALUES ('studio', 'Estudio', 'Studio'), ('cafe', 'Cafetería', 'Café');

CREATE TABLE business_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 120),
  country text NOT NULL CHECK (country = 'MX'),
  currency text NOT NULL CHECK (currency = 'MXN'),
  timezone text NOT NULL,
  default_locale text NOT NULL CHECK (default_locale IN ('es-MX', 'en')),
  supported_locales text[] NOT NULL CHECK (supported_locales = ARRAY['es-MX', 'en']),
  default_capacity integer NOT NULL CHECK (default_capacity > 0)
);
INSERT INTO business_settings VALUES (1, 'Conecta Infusion', 'MX', 'MXN', 'America/Mexico_City', 'es-MX', ARRAY['es-MX','en'], 16);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_id text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('staff', 'system')),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  business_unit text REFERENCES business_units(code),
  changes jsonb NOT NULL,
  reason text NOT NULL,
  correlation_id uuid NOT NULL,
  correction_of uuid REFERENCES audit_events(id)
);
CREATE INDEX audit_events_target_idx ON audit_events(target_type, target_id, occurred_at);

CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit history is append-only';
END;
$$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_events
FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
