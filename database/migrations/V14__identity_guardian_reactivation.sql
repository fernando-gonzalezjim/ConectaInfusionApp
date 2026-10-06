-- Pending/accepted renewal consent grants no dependent access by itself.
CREATE TABLE guardian_reactivation_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 dependent_person_id uuid NOT NULL REFERENCES dependent_profiles(person_id),
 deactivation_sequence integer NOT NULL CHECK (deactivation_sequence>0),
 profile_version integer NOT NULL CHECK (profile_version>=0),
 prior_guardian_relationship_id uuid NOT NULL,
 guardian_account_id uuid NOT NULL REFERENCES accounts(id),
 recipient_email text NOT NULL,
 recipient_version integer NOT NULL CHECK (recipient_version>=0),
 issued_by_account_id uuid NOT NULL REFERENCES accounts(id),
 issued_by_account_version integer NOT NULL CHECK (issued_by_account_version>=0),
 action_token_id uuid UNIQUE REFERENCES identity_action_tokens(id),
 version integer NOT NULL DEFAULT 0 CHECK (version>=0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(created_at)),
 accepted_at timestamptz CHECK (isfinite(accepted_at)),
 accepted_by_account_id uuid REFERENCES accounts(id),
 superseded_at timestamptz CHECK (isfinite(superseded_at)),
 FOREIGN KEY(dependent_person_id,deactivation_sequence,prior_guardian_relationship_id)
  REFERENCES dependent_prior_guardians(dependent_person_id,deactivation_sequence,guardian_relationship_id),
 CHECK ((accepted_at IS NULL)=(accepted_by_account_id IS NULL)),
 CHECK (accepted_at IS NULL OR (accepted_by_account_id=guardian_account_id AND accepted_at>=created_at AND superseded_at IS NULL)),
 CHECK (superseded_at IS NULL OR superseded_at>=created_at)
);
CREATE UNIQUE INDEX guardian_reactivation_pending_idx ON guardian_reactivation_invitations(dependent_person_id,deactivation_sequence,guardian_account_id) WHERE accepted_at IS NULL AND superseded_at IS NULL;

CREATE FUNCTION identity_guardian_reactivation_valid(invitation_id uuid,token_id uuid,local_delivery boolean) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM guardian_reactivation_invitations i
  JOIN dependent_profiles d ON d.person_id=i.dependent_person_id JOIN people child ON child.id=d.person_id
  JOIN dependent_prior_guardians pg ON pg.dependent_person_id=d.person_id AND pg.deactivation_sequence=d.deactivation_sequence AND pg.guardian_relationship_id=i.prior_guardian_relationship_id
  JOIN dependent_guardians g ON g.id=pg.guardian_relationship_id AND g.guardian_account_id=i.guardian_account_id
  JOIN accounts a ON a.id=i.issued_by_account_id JOIN people p ON p.id=a.person_id
  JOIN accounts r ON r.id=i.guardian_account_id JOIN people rp ON rp.id=r.person_id
  JOIN identity_action_tokens t ON t.id=i.action_token_id
  WHERE i.id=invitation_id AND t.id=token_id AND i.accepted_at IS NULL AND i.superseded_at IS NULL
   AND child.status='inactive' AND d.independent_at IS NULL AND d.deactivation_sequence=i.deactivation_sequence AND d.version=i.profile_version
   AND a.status='active' AND p.status='active' AND a.confirmation_status IN ('verified','exempt') AND a.session_version=i.issued_by_account_version
   AND EXISTS(SELECT 1 FROM account_roles WHERE account_id=a.id AND role IN ('administrator','manager'))
   AND r.status='active' AND rp.status='active' AND r.confirmation_status IN ('verified','exempt') AND r.email=i.recipient_email AND r.session_version=i.recipient_version
   AND EXISTS(SELECT 1 FROM account_roles WHERE account_id=r.id AND role='customer')
   AND (local_delivery OR (a.development_fixture IS NULL AND r.development_fixture IS NULL))
   AND t.purpose='guardian_reactivation' AND t.target_id=i.id AND t.expected_version=i.version
   AND t.recipient_email=i.recipient_email AND t.account_id=r.id AND t.account_version=i.recipient_version AND t.person_id=r.person_id)
$$;

CREATE FUNCTION protect_guardian_reactivation_consent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Guardian renewal consent history is preserved'; END IF;
 IF (NEW.id,NEW.dependent_person_id,NEW.deactivation_sequence,NEW.profile_version,NEW.prior_guardian_relationship_id,NEW.guardian_account_id,NEW.recipient_email,NEW.recipient_version,NEW.created_at)
  IS DISTINCT FROM (OLD.id,OLD.dependent_person_id,OLD.deactivation_sequence,OLD.profile_version,OLD.prior_guardian_relationship_id,OLD.guardian_account_id,OLD.recipient_email,OLD.recipient_version,OLD.created_at)
  OR (NEW.issued_by_account_id,NEW.issued_by_account_version,NEW.version) IS DISTINCT FROM (OLD.issued_by_account_id,OLD.issued_by_account_version,OLD.version)
  OR (OLD.action_token_id IS NOT NULL AND NEW.action_token_id IS DISTINCT FROM OLD.action_token_id)
  OR OLD.accepted_at IS NOT NULL OR OLD.superseded_at IS NOT NULL THEN RAISE EXCEPTION 'Guardian renewal consent is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guardian_reactivation_history BEFORE UPDATE OR DELETE ON guardian_reactivation_invitations FOR EACH ROW EXECUTE FUNCTION protect_guardian_reactivation_consent();
CREATE TRIGGER guardian_reactivation_no_truncate BEFORE TRUNCATE ON guardian_reactivation_invitations FOR EACH STATEMENT EXECUTE FUNCTION protect_guardian_reactivation_consent();

CREATE FUNCTION enforce_guardian_reactivation_consent() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invitation_uuid uuid; i guardian_reactivation_invitations%ROWTYPE; t identity_action_tokens%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='dependent_guardians' THEN
  IF NEW.source<>'accepted_reactivation' THEN RETURN NULL; END IF;
  invitation_uuid:=NEW.accepted_invitation_id;
 ELSE invitation_uuid:=NEW.id; END IF;
 SELECT * INTO i FROM guardian_reactivation_invitations WHERE id=invitation_uuid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Renewal consent is required'; END IF;
 SELECT * INTO t FROM identity_action_tokens WHERE id=i.action_token_id;
 IF NOT FOUND OR t.purpose<>'guardian_reactivation' OR t.target_id IS DISTINCT FROM i.id OR t.expected_version IS DISTINCT FROM i.version
  OR t.recipient_email<>i.recipient_email OR t.account_id IS DISTINCT FROM i.guardian_account_id OR t.account_version IS DISTINCT FROM i.recipient_version
  OR NOT EXISTS(SELECT 1 FROM accounts WHERE id=i.guardian_account_id AND person_id=t.person_id)
  OR NOT EXISTS(SELECT 1 FROM dependent_guardians WHERE id=i.prior_guardian_relationship_id AND dependent_person_id=i.dependent_person_id AND guardian_account_id=i.guardian_account_id)
  OR (i.accepted_at IS NULL AND t.consumed_at IS NOT NULL)
  OR (i.accepted_at IS NOT NULL AND (t.consumed_at IS DISTINCT FROM i.accepted_at OR t.revoked_at IS NOT NULL OR i.accepted_at<t.created_at OR i.accepted_at>=t.expires_at))
 THEN RAISE EXCEPTION 'Invalid renewal action binding'; END IF;
 IF TG_TABLE_NAME='dependent_guardians' THEN
 IF (i.accepted_at IS NULL OR NEW.guardian_account_id<>i.guardian_account_id OR NEW.dependent_person_id<>i.dependent_person_id
  OR NEW.accepted_by_account_id<>i.guardian_account_id OR NEW.authorized_at<i.accepted_at) THEN RAISE EXCEPTION 'Renewal has not authorized this guardian'; END IF;
 -- Historical ended renewals remain valid when later sequence/versions change.
 IF NEW.ended_at IS NULL AND NOT EXISTS(SELECT 1 FROM dependent_profiles d JOIN people p ON p.id=d.person_id
  WHERE d.person_id=i.dependent_person_id AND d.independent_at IS NULL AND d.deactivation_sequence=i.deactivation_sequence AND p.status='active')
 THEN RAISE EXCEPTION 'Renewal is not for the current dependent deactivation'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER guardian_reactivation_binding AFTER INSERT OR UPDATE ON guardian_reactivation_invitations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_guardian_reactivation_consent();
CREATE CONSTRAINT TRIGGER guardian_reactivation_authorization AFTER INSERT OR UPDATE ON dependent_guardians DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_guardian_reactivation_consent();
