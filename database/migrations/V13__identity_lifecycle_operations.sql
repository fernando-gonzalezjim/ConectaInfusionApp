-- Completed internal coordination receipts only; no default lifecycle mutation.
CREATE TABLE identity_lifecycle_operations (
  id uuid PRIMARY KEY,
  actor_account_id uuid NOT NULL REFERENCES accounts(id),
  idempotency_key uuid NOT NULL,
  request_hash bytea NOT NULL CHECK (octet_length(request_hash)=32),
  preview_revision text NOT NULL CHECK (preview_revision ~ '^[a-f0-9]{64}$'),
  completed_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(completed_at)),
  UNIQUE(actor_account_id,idempotency_key)
);
CREATE FUNCTION protect_identity_lifecycle_receipts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Identity lifecycle receipts are immutable'; END;
$$;
CREATE TRIGGER identity_lifecycle_receipt_history BEFORE UPDATE OR DELETE ON identity_lifecycle_operations
FOR EACH ROW EXECUTE FUNCTION protect_identity_lifecycle_receipts();
CREATE TRIGGER identity_lifecycle_receipt_no_truncate BEFORE TRUNCATE ON identity_lifecycle_operations
FOR EACH STATEMENT EXECUTE FUNCTION protect_identity_lifecycle_receipts();
