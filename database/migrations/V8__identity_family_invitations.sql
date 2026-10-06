-- Independent-account invitations only. Pending invitations are not memberships.
CREATE TABLE family_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id),
  recipient_email text NOT NULL CHECK (recipient_email = lower(btrim(recipient_email)) AND length(recipient_email) BETWEEN 3 AND 320 AND recipient_email !~ '[[:space:][:cntrl:]<>]'),
  issued_by_account_id uuid NOT NULL REFERENCES accounts(id),
  issued_by_membership_id uuid,
  action_token_id uuid UNIQUE REFERENCES identity_action_tokens(id),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now() CHECK (isfinite(created_at)),
  accepted_at timestamptz CHECK (isfinite(accepted_at)),
  accepted_by_person_id uuid REFERENCES people(id),
  CHECK ((accepted_at IS NULL) = (accepted_by_person_id IS NULL)),
  CHECK (accepted_at IS NULL OR accepted_at >= created_at),
  FOREIGN KEY (family_id, issued_by_membership_id) REFERENCES family_memberships(family_id,id)
);
CREATE UNIQUE INDEX family_one_pending_invitation_idx ON family_invitations(family_id,recipient_email) WHERE accepted_at IS NULL;

-- Delivery and redemption use the same live sender/domain policy. Token expiry,
-- recipient/account binding and single use are additionally checked by action-tokens.
CREATE FUNCTION identity_family_invitation_valid(invitation_id uuid, token_id uuid, local_delivery boolean) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM family_invitations i JOIN families f ON f.id=i.family_id
    JOIN accounts a ON a.id=i.issued_by_account_id JOIN people p ON p.id=a.person_id
    WHERE i.id=invitation_id AND i.action_token_id=token_id AND i.accepted_at IS NULL
      AND f.status='active' AND a.status='active' AND p.status='active' AND a.confirmation_status IN ('verified','exempt')
      AND (local_delivery OR (a.development_fixture IS NULL AND a.email NOT IN ('admin@conecta.example.test','testuser@conecta.example.test')))
      AND ((i.issued_by_membership_id IS NULL AND EXISTS (
        SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role IN ('administrator','manager')))
        OR (i.issued_by_membership_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM family_memberships m WHERE m.id=i.issued_by_membership_id AND m.family_id=f.id
            AND m.person_id=p.id AND m.ended_at IS NULL)
          AND EXISTS (SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role='customer')))
  )
$$;

-- Tokens are created in the same transaction as their invitation. Legacy I23
-- synthetic accepted-membership provenance is preserved, without inventing emails.
CREATE FUNCTION enforce_family_invitation_token() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM family_invitations i LEFT JOIN identity_action_tokens t ON t.id=i.action_token_id
    WHERE i.id=NEW.id AND (t.id IS NULL OR t.purpose<>'family_invitation' OR t.target_id IS DISTINCT FROM i.id
      OR t.recipient_email<>i.recipient_email OR t.expected_version<>i.version)) THEN
    RAISE EXCEPTION 'Invalid family invitation token binding';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER family_invitation_token_binding AFTER INSERT OR UPDATE ON family_invitations
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_family_invitation_token();

CREATE FUNCTION preserve_family_invitation_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Family invitation history cannot be deleted'; END IF;
  IF OLD.accepted_at IS NOT NULL OR NEW.id<>OLD.id OR NEW.family_id<>OLD.family_id
    OR NEW.recipient_email<>OLD.recipient_email OR NEW.created_at<>OLD.created_at THEN
    RAISE EXCEPTION 'Family invitation provenance is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER family_invitation_history BEFORE UPDATE OR DELETE ON family_invitations
  FOR EACH ROW EXECUTE FUNCTION preserve_family_invitation_history();
CREATE TRIGGER family_invitation_no_truncate BEFORE TRUNCATE ON family_invitations
  FOR EACH STATEMENT EXECUTE FUNCTION preserve_family_invitation_history();
