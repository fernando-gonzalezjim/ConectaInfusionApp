-- Pending guardian invitations are not authorizations. Preserve V10 history,
-- including explicitly synthetic local fixture provenance without an invitation.
CREATE TABLE guardian_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dependent_person_id uuid NOT NULL REFERENCES dependent_profiles(person_id),
  dependent_deactivation_sequence integer NOT NULL CHECK (dependent_deactivation_sequence>=0),
  recipient_email text NOT NULL CHECK (recipient_email=lower(btrim(recipient_email)) AND length(recipient_email) BETWEEN 3 AND 320 AND recipient_email !~ '[[:space:][:cntrl:]<>]'),
  issued_by_account_id uuid NOT NULL REFERENCES accounts(id),
  issued_by_account_version integer NOT NULL CHECK (issued_by_account_version>=0),
  issued_by_guardian_id uuid,
  action_token_id uuid UNIQUE REFERENCES identity_action_tokens(id),
  version integer NOT NULL DEFAULT 0 CHECK (version>=0),
  created_at timestamptz NOT NULL CHECK (isfinite(created_at)),
  accepted_at timestamptz CHECK (isfinite(accepted_at)),
  accepted_by_account_id uuid REFERENCES accounts(id),
  CHECK ((accepted_at IS NULL)=(accepted_by_account_id IS NULL)),
  CHECK (accepted_at IS NULL OR accepted_at>=created_at),
  FOREIGN KEY(dependent_person_id,issued_by_guardian_id) REFERENCES dependent_guardians(dependent_person_id,id)
);
CREATE UNIQUE INDEX guardian_pending_invitation_idx ON guardian_invitations(dependent_person_id,recipient_email) WHERE accepted_at IS NULL;

-- Grandfather existing V10 records without claiming email/token consent. New
-- fictional fixtures require an explicit, guarded exception; HTTP has no writer.
CREATE TABLE guardian_consent_exceptions (
  relationship_id uuid PRIMARY KEY REFERENCES dependent_guardians(id) DEFERRABLE INITIALLY DEFERRED,
  reason text NOT NULL CHECK (reason IN ('pre_v11','development_fixture'))
);
INSERT INTO guardian_consent_exceptions(relationship_id,reason)
 SELECT id,'pre_v11' FROM dependent_guardians WHERE source='accepted_invitation';
CREATE FUNCTION guard_guardian_consent_exception() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Guardian consent exceptions are immutable'; END IF;
 IF NEW.reason<>'development_fixture' OR current_database() !~ '^(conecta_dev|test_[a-f0-9]+|foundation_browser)$' THEN
  RAISE EXCEPTION 'Guardian consent exceptions are guarded development fixtures';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guardian_consent_exception_guard BEFORE INSERT OR UPDATE OR DELETE ON guardian_consent_exceptions
 FOR EACH ROW EXECUTE FUNCTION guard_guardian_consent_exception();
CREATE TRIGGER guardian_consent_exception_no_truncate BEFORE TRUNCATE ON guardian_consent_exceptions
 FOR EACH STATEMENT EXECUTE FUNCTION guard_guardian_consent_exception();

CREATE FUNCTION identity_guardian_invitation_valid(invitation_id uuid, token_id uuid, local_delivery boolean) RETURNS boolean
LANGUAGE sql STABLE AS $$
 SELECT EXISTS (
  SELECT 1 FROM guardian_invitations i JOIN dependent_profiles d ON d.person_id=i.dependent_person_id
  JOIN people child ON child.id=d.person_id JOIN accounts a ON a.id=i.issued_by_account_id JOIN people p ON p.id=a.person_id
  JOIN identity_action_tokens t ON t.id=i.action_token_id
  WHERE i.id=invitation_id AND t.id=token_id AND i.accepted_at IS NULL
   AND t.purpose='guardian_invitation' AND t.target_id=i.id AND t.recipient_email=i.recipient_email AND t.expected_version=i.version
   AND child.status='active' AND d.independent_at IS NULL AND d.deactivation_sequence=i.dependent_deactivation_sequence
   AND a.status='active' AND p.status='active' AND a.confirmation_status IN ('verified','exempt') AND a.session_version=i.issued_by_account_version
   AND (local_delivery OR (a.development_fixture IS NULL AND a.email NOT IN ('admin@conecta.example.test','testuser@conecta.example.test')))
   AND ((i.issued_by_guardian_id IS NULL AND EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role IN ('administrator','manager')))
    OR (i.issued_by_guardian_id IS NOT NULL AND EXISTS(SELECT 1 FROM dependent_guardians g WHERE g.id=i.issued_by_guardian_id AND g.dependent_person_id=d.person_id AND g.guardian_account_id=a.id AND g.ended_at IS NULL)
     AND EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role='customer')))
   AND (t.account_id IS NULL OR EXISTS(SELECT 1 FROM accounts recipient JOIN people rp ON rp.id=recipient.person_id
    WHERE recipient.id=t.account_id AND recipient.person_id=t.person_id AND recipient.email=t.recipient_email
     AND recipient.session_version=t.account_version AND recipient.status='active' AND rp.status='active' AND recipient.confirmation_status IN ('verified','exempt')
     AND EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=recipient.id AND r.role='customer')
     AND (local_delivery OR recipient.development_fixture IS NULL)))
 )
$$;

CREATE FUNCTION enforce_guardian_invitation_binding() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invitation_id uuid;
BEGIN
 IF TG_TABLE_NAME='guardian_invitations' THEN invitation_id=NEW.id; ELSE invitation_id=NEW.accepted_invitation_id; END IF;
 IF EXISTS(SELECT 1 FROM guardian_invitations i LEFT JOIN identity_action_tokens t ON t.id=i.action_token_id WHERE i.id=invitation_id
  AND (t.id IS NULL OR t.purpose<>'guardian_invitation' OR t.target_id IS DISTINCT FROM i.id OR t.recipient_email<>i.recipient_email OR t.expected_version IS DISTINCT FROM i.version
   OR (i.accepted_at IS NULL AND t.consumed_at IS NOT NULL)
   OR (i.accepted_at IS NOT NULL AND (t.consumed_at IS DISTINCT FROM i.accepted_at
    OR (t.account_id IS NOT NULL AND t.account_id<>i.accepted_by_account_id)
    OR NOT EXISTS(SELECT 1 FROM dependent_guardians g WHERE g.accepted_invitation_id=i.id AND g.source='accepted_invitation' AND g.dependent_person_id=i.dependent_person_id
      AND g.guardian_account_id=i.accepted_by_account_id AND g.accepted_by_account_id=i.accepted_by_account_id))))) THEN
  RAISE EXCEPTION 'Invalid guardian invitation consent binding';
 END IF;
 IF TG_TABLE_NAME='dependent_guardians' THEN
 IF NEW.source='accepted_invitation' AND NOT EXISTS(SELECT 1 FROM guardian_invitations WHERE id=invitation_id)
  AND NOT EXISTS(SELECT 1 FROM guardian_consent_exceptions WHERE relationship_id=NEW.id) THEN
  RAISE EXCEPTION 'Guardian invitation consent is required';
 END IF;
 IF EXISTS(SELECT 1 FROM guardian_invitations i WHERE i.id=invitation_id
  AND (i.accepted_at IS NULL OR NEW.source<>'accepted_invitation' OR NEW.dependent_person_id<>i.dependent_person_id OR NEW.guardian_account_id<>i.accepted_by_account_id)) THEN
  RAISE EXCEPTION 'Guardian invitation has not authorized this relationship';
 END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER guardian_invitation_binding AFTER INSERT OR UPDATE ON guardian_invitations
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_guardian_invitation_binding();
CREATE CONSTRAINT TRIGGER managed_guardian_consent AFTER INSERT OR UPDATE ON dependent_guardians
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_guardian_invitation_binding();

CREATE FUNCTION preserve_guardian_invitation_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Guardian invitation history cannot be deleted'; END IF;
 IF OLD.accepted_at IS NOT NULL OR NEW.id<>OLD.id OR NEW.dependent_person_id<>OLD.dependent_person_id OR NEW.recipient_email<>OLD.recipient_email OR NEW.created_at<>OLD.created_at THEN
  RAISE EXCEPTION 'Guardian invitation provenance is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guardian_invitation_history BEFORE UPDATE OR DELETE ON guardian_invitations FOR EACH ROW EXECUTE FUNCTION preserve_guardian_invitation_history();
CREATE TRIGGER guardian_invitation_no_truncate BEFORE TRUNCATE ON guardian_invitations FOR EACH STATEMENT EXECUTE FUNCTION preserve_guardian_invitation_history();
