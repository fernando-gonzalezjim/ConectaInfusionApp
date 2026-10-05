-- Additive Identity persistence only. No accounts, fabricated emails, invitations
-- or booking/credit operations are created by this migration.
CREATE TABLE dependent_profiles (
  person_id uuid PRIMARY KEY REFERENCES people(id),
  age_text text NOT NULL CHECK (length(btrim(age_text)) BETWEEN 1 AND 40 AND age_text !~ '[[:cntrl:]]'),
  created_by_account_id uuid NOT NULL REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(created_at)),
  version integer NOT NULL DEFAULT 0 CHECK (version>=0),
  deactivation_sequence integer NOT NULL DEFAULT 0 CHECK (deactivation_sequence>=0),
  independent_at timestamptz CHECK (independent_at IS NULL OR (isfinite(independent_at) AND independent_at>=created_at))
);
CREATE TABLE dependent_guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dependent_person_id uuid NOT NULL REFERENCES dependent_profiles(person_id),
  guardian_account_id uuid NOT NULL REFERENCES accounts(id),
  source text NOT NULL CHECK (source IN ('creation','accepted_invitation','accepted_reactivation')),
  accepted_by_account_id uuid NOT NULL REFERENCES accounts(id),
  accepted_invitation_id uuid UNIQUE,
  authorized_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(authorized_at) AND authorized_at<=clock_timestamp()),
  ended_at timestamptz,
  end_reason text CHECK (end_reason IN ('self_removed','removed','guardian_deactivated','dependent_deactivated','transitioned')),
  UNIQUE(dependent_person_id,id),
  CHECK (accepted_by_account_id=guardian_account_id),
  CHECK ((source='creation')=(accepted_invitation_id IS NULL)),
  CHECK ((ended_at IS NULL)=(end_reason IS NULL)),
  CHECK (ended_at IS NULL OR (isfinite(ended_at) AND ended_at>=authorized_at))
);
CREATE UNIQUE INDEX dependent_current_guardian_idx ON dependent_guardians(dependent_person_id,guardian_account_id) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX dependent_creation_guardian_idx ON dependent_guardians(dependent_person_id) WHERE source='creation';
CREATE INDEX dependent_guardians_account_idx ON dependent_guardians(guardian_account_id,dependent_person_id);

CREATE TABLE dependent_deactivations (
  dependent_person_id uuid NOT NULL REFERENCES dependent_profiles(person_id),
  deactivation_sequence integer NOT NULL CHECK (deactivation_sequence>0),
  deactivated_at timestamptz NOT NULL CHECK (isfinite(deactivated_at)),
  PRIMARY KEY(dependent_person_id,deactivation_sequence)
);
CREATE TABLE dependent_prior_guardians (
  dependent_person_id uuid NOT NULL,
  deactivation_sequence integer NOT NULL,
  guardian_relationship_id uuid NOT NULL,
  PRIMARY KEY(dependent_person_id,deactivation_sequence,guardian_relationship_id),
  FOREIGN KEY(dependent_person_id,deactivation_sequence) REFERENCES dependent_deactivations(dependent_person_id,deactivation_sequence),
  FOREIGN KEY(dependent_person_id,guardian_relationship_id) REFERENCES dependent_guardians(dependent_person_id,id)
);

CREATE TABLE saved_child_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account_id uuid NOT NULL REFERENCES accounts(id),
  child_name text NOT NULL CHECK (length(btrim(child_name)) BETWEEN 1 AND 120 AND child_name !~ '[[:cntrl:]]'),
  age_text text NOT NULL CHECK (length(btrim(age_text)) BETWEEN 1 AND 40 AND age_text !~ '[[:cntrl:]]'),
  dependent_person_id uuid REFERENCES dependent_profiles(person_id),
  version integer NOT NULL DEFAULT 0 CHECK (version>=0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(created_at)),
  UNIQUE(id,owner_account_id)
);
CREATE INDEX saved_child_details_owner_idx ON saved_child_details(owner_account_id,id);
CREATE INDEX saved_child_details_dependent_idx ON saved_child_details(dependent_person_id) WHERE dependent_person_id IS NOT NULL;

-- Legacy member_id remains untouched; child booking behavior belongs to
-- credits-bookings. Nullable identity fields do not claim old attendees/actors.
ALTER TABLE bookings
  ADD COLUMN acting_account_id uuid REFERENCES accounts(id),
  ADD COLUMN attendee_person_id uuid REFERENCES people(id),
  ADD COLUMN saved_child_details_id uuid,
  ADD COLUMN child_name_snapshot text,
  ADD COLUMN child_age_snapshot text,
  ADD CONSTRAINT booking_child_details_owner_fk FOREIGN KEY(saved_child_details_id,acting_account_id) REFERENCES saved_child_details(id,owner_account_id),
  ADD CONSTRAINT booking_child_attendee_snapshot CHECK (
    (acting_account_id IS NULL AND attendee_person_id IS NULL AND saved_child_details_id IS NULL AND child_name_snapshot IS NULL AND child_age_snapshot IS NULL)
    OR (acting_account_id IS NOT NULL AND child_name_snapshot IS NOT NULL AND child_age_snapshot IS NOT NULL
      AND length(btrim(child_name_snapshot)) BETWEEN 1 AND 120 AND child_name_snapshot !~ '[[:cntrl:]]'
      AND length(btrim(child_age_snapshot)) BETWEEN 1 AND 40 AND child_age_snapshot !~ '[[:cntrl:]]')
  );
CREATE INDEX bookings_acting_account_idx ON bookings(acting_account_id) WHERE acting_account_id IS NOT NULL;
CREATE INDEX bookings_attendee_person_idx ON bookings(attendee_person_id) WHERE attendee_person_id IS NOT NULL;
CREATE INDEX bookings_saved_child_idx ON bookings(saved_child_details_id) WHERE saved_child_details_id IS NOT NULL;

CREATE FUNCTION protect_dependent_profile() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Dependent profile history is preserved'; END IF;
  IF (NEW.person_id,NEW.created_by_account_id,NEW.created_at) IS DISTINCT FROM (OLD.person_id,OLD.created_by_account_id,OLD.created_at)
    OR NEW.version<>OLD.version+1 OR NEW.deactivation_sequence NOT IN (OLD.deactivation_sequence,OLD.deactivation_sequence+1)
    OR (OLD.independent_at IS NOT NULL AND NEW.independent_at IS DISTINCT FROM OLD.independent_at)
    THEN RAISE EXCEPTION 'Invalid dependent provenance/version change'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER dependent_profile_history BEFORE UPDATE OR DELETE ON dependent_profiles FOR EACH ROW EXECUTE FUNCTION protect_dependent_profile();
CREATE TRIGGER dependent_profile_no_truncate BEFORE TRUNCATE ON dependent_profiles FOR EACH STATEMENT EXECUTE FUNCTION protect_dependent_profile();

CREATE FUNCTION protect_dependent_guardian() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Guardian authorization history is preserved'; END IF;
  IF TG_OP='UPDATE' AND (OLD.ended_at IS NOT NULL OR
    (NEW.id,NEW.dependent_person_id,NEW.guardian_account_id,NEW.source,NEW.accepted_by_account_id,NEW.accepted_invitation_id,NEW.authorized_at)
    IS DISTINCT FROM (OLD.id,OLD.dependent_person_id,OLD.guardian_account_id,OLD.source,OLD.accepted_by_account_id,OLD.accepted_invitation_id,OLD.authorized_at))
    THEN RAISE EXCEPTION 'Guardian authorization provenance is immutable'; END IF;
  PERFORM person_id FROM dependent_profiles WHERE person_id=NEW.dependent_person_id FOR UPDATE;
  IF NEW.ended_at IS NOT NULL AND EXISTS(SELECT 1 FROM dependent_prior_guardians pg JOIN dependent_deactivations d
    USING(dependent_person_id,deactivation_sequence) WHERE pg.guardian_relationship_id=NEW.id AND NEW.ended_at<d.deactivated_at)
    THEN RAISE EXCEPTION 'Guardian end cannot rewrite prior deactivation provenance'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER dependent_guardian_history BEFORE INSERT OR UPDATE OR DELETE ON dependent_guardians FOR EACH ROW EXECUTE FUNCTION protect_dependent_guardian();
CREATE TRIGGER dependent_guardian_no_truncate BEFORE TRUNCATE ON dependent_guardians FOR EACH STATEMENT EXECUTE FUNCTION protect_dependent_guardian();

CREATE FUNCTION protect_dependent_deactivation_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Prior guardian provenance is immutable';
END;
$$;
CREATE TRIGGER dependent_deactivation_history BEFORE UPDATE OR DELETE ON dependent_deactivations FOR EACH ROW EXECUTE FUNCTION protect_dependent_deactivation_history();
CREATE TRIGGER dependent_deactivation_no_truncate BEFORE TRUNCATE ON dependent_deactivations FOR EACH STATEMENT EXECUTE FUNCTION protect_dependent_deactivation_history();
CREATE TRIGGER dependent_prior_guardian_history BEFORE UPDATE OR DELETE ON dependent_prior_guardians FOR EACH ROW EXECUTE FUNCTION protect_dependent_deactivation_history();
CREATE TRIGGER dependent_prior_guardian_no_truncate BEFORE TRUNCATE ON dependent_prior_guardians FOR EACH STATEMENT EXECUTE FUNCTION protect_dependent_deactivation_history();
CREATE FUNCTION protect_dependent_deactivation_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth()<>2 THEN RAISE EXCEPTION 'Deactivation provenance is written only by the dependent status snapshot trigger'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER dependent_deactivation_snapshot_only BEFORE INSERT ON dependent_deactivations FOR EACH ROW EXECUTE FUNCTION protect_dependent_deactivation_insert();
CREATE FUNCTION validate_prior_guardian() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth()<>2 THEN RAISE EXCEPTION 'Prior guardians are written only by the dependent status snapshot trigger'; END IF;
  IF NOT EXISTS(SELECT 1 FROM dependent_guardians g JOIN dependent_deactivations d ON d.dependent_person_id=g.dependent_person_id
    WHERE d.dependent_person_id=NEW.dependent_person_id AND d.deactivation_sequence=NEW.deactivation_sequence AND g.id=NEW.guardian_relationship_id
      AND g.authorized_at<=d.deactivated_at AND (g.ended_at IS NULL OR g.ended_at>=d.deactivated_at))
    THEN RAISE EXCEPTION 'Guardian was not authorized immediately before this deactivation'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER dependent_prior_guardian_valid BEFORE INSERT ON dependent_prior_guardians FOR EACH ROW EXECUTE FUNCTION validate_prior_guardian();

CREATE FUNCTION snapshot_dependent_deactivation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sequence_number integer; snapshot_at timestamptz;
BEGIN
  IF OLD.status='active' AND NEW.status='inactive' AND EXISTS(SELECT 1 FROM dependent_profiles WHERE person_id=NEW.id AND independent_at IS NULL) THEN
    PERFORM person_id FROM dependent_profiles WHERE person_id=NEW.id FOR UPDATE;
    snapshot_at:=clock_timestamp();
    IF NOT EXISTS(SELECT 1 FROM dependent_guardians WHERE dependent_person_id=NEW.id AND ended_at IS NULL)
      THEN RAISE EXCEPTION 'Deactivate dependent before ending final guardian authorizations'; END IF;
    UPDATE dependent_profiles SET deactivation_sequence=deactivation_sequence+1,version=version+1 WHERE person_id=NEW.id RETURNING deactivation_sequence INTO sequence_number;
    INSERT INTO dependent_deactivations VALUES (NEW.id,sequence_number,snapshot_at);
    INSERT INTO dependent_prior_guardians SELECT NEW.id,sequence_number,id FROM dependent_guardians WHERE dependent_person_id=NEW.id AND ended_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER dependent_deactivation_snapshot BEFORE UPDATE OF status ON people FOR EACH ROW EXECUTE FUNCTION snapshot_dependent_deactivation();

-- Parent row locking serializes guardian changes. Deferred checks allow atomic
-- create/transfer/deactivate/transition, but no committed active orphan or login.
CREATE FUNCTION assert_dependent_state(dependent_uuid uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE profile dependent_profiles%ROWTYPE; person_status text;
BEGIN
  SELECT * INTO profile FROM dependent_profiles WHERE person_id=dependent_uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT status INTO person_status FROM people WHERE id=dependent_uuid;
  IF NOT EXISTS(SELECT 1 FROM dependent_guardians WHERE dependent_person_id=dependent_uuid AND source='creation' AND guardian_account_id=profile.created_by_account_id)
    THEN RAISE EXCEPTION 'Dependent creation guardian provenance is required'; END IF;
  IF profile.independent_at IS NULL THEN
    IF EXISTS(SELECT 1 FROM accounts WHERE person_id=dependent_uuid) THEN RAISE EXCEPTION 'Dependent has no login account'; END IF;
    IF person_status='active' AND NOT EXISTS(SELECT 1 FROM dependent_guardians g JOIN accounts a ON a.id=g.guardian_account_id JOIN people p ON p.id=a.person_id
      WHERE g.dependent_person_id=dependent_uuid AND g.ended_at IS NULL AND a.status='active' AND a.confirmation_status IN ('verified','exempt') AND p.status='active'
        AND EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role='customer'))
      THEN RAISE EXCEPTION 'Active dependent requires an active authorized customer guardian'; END IF;
  ELSE
    IF EXISTS(SELECT 1 FROM dependent_guardians WHERE dependent_person_id=dependent_uuid AND ended_at IS NULL)
      OR NOT EXISTS(SELECT 1 FROM accounts WHERE person_id=dependent_uuid AND status IN ('active','inactive') AND confirmation_status='verified' AND password_hash IS NOT NULL)
      THEN RAISE EXCEPTION 'Independent transition requires confirmed credentials and ended guardian access'; END IF;
  END IF;
  IF profile.deactivation_sequence<>(SELECT count(*) FROM dependent_deactivations WHERE dependent_person_id=dependent_uuid)
    THEN RAISE EXCEPTION 'Dependent deactivation provenance is required'; END IF;
END;
$$;
CREATE FUNCTION enforce_dependent_state() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE dependent_uuid uuid; account_uuid uuid;
BEGIN
  IF TG_TABLE_NAME='dependent_profiles' THEN PERFORM assert_dependent_state(NEW.person_id);
  ELSIF TG_TABLE_NAME IN ('dependent_guardians','dependent_deactivations') THEN PERFORM assert_dependent_state(NEW.dependent_person_id);
  ELSE
    IF TG_TABLE_NAME='people' THEN
      PERFORM assert_dependent_state(NEW.id);
      SELECT id INTO account_uuid FROM accounts WHERE person_id=NEW.id;
    ELSIF TG_TABLE_NAME='accounts' THEN
      IF TG_OP='UPDATE' AND OLD.person_id IS DISTINCT FROM NEW.person_id THEN PERFORM assert_dependent_state(OLD.person_id); END IF;
      PERFORM assert_dependent_state(NEW.person_id);account_uuid:=NEW.id;
    ELSE
      IF TG_OP='DELETE' THEN account_uuid:=OLD.account_id; ELSE account_uuid:=NEW.account_id; END IF;
      IF TG_OP='UPDATE' AND OLD.account_id IS DISTINCT FROM NEW.account_id THEN
        FOR dependent_uuid IN SELECT DISTINCT dependent_person_id FROM dependent_guardians WHERE guardian_account_id=OLD.account_id AND ended_at IS NULL ORDER BY dependent_person_id LOOP
          PERFORM assert_dependent_state(dependent_uuid);
        END LOOP;
      END IF;
    END IF;
    FOR dependent_uuid IN SELECT DISTINCT dependent_person_id FROM dependent_guardians WHERE guardian_account_id=account_uuid AND ended_at IS NULL ORDER BY dependent_person_id LOOP
      PERFORM assert_dependent_state(dependent_uuid);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER dependent_profile_state AFTER INSERT OR UPDATE ON dependent_profiles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_dependent_state();
CREATE CONSTRAINT TRIGGER dependent_guardian_state AFTER INSERT OR UPDATE ON dependent_guardians DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_dependent_state();
CREATE CONSTRAINT TRIGGER dependent_deactivation_state AFTER INSERT ON dependent_deactivations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_dependent_state();
CREATE CONSTRAINT TRIGGER dependent_person_state AFTER UPDATE ON people DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_dependent_state();
CREATE CONSTRAINT TRIGGER dependent_account_state AFTER INSERT OR UPDATE ON accounts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_dependent_state();
CREATE CONSTRAINT TRIGGER dependent_role_state AFTER INSERT OR UPDATE OR DELETE ON account_roles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_dependent_state();

CREATE FUNCTION protect_saved_child_details() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Saved child identity history is preserved'; END IF;
  IF (NEW.id,NEW.owner_account_id,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.owner_account_id,OLD.created_at)
    OR NEW.version<>OLD.version+1 OR (OLD.dependent_person_id IS NOT NULL AND NEW.dependent_person_id IS DISTINCT FROM OLD.dependent_person_id)
    THEN RAISE EXCEPTION 'Invalid saved child identity/version change'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER saved_child_details_history BEFORE UPDATE OR DELETE ON saved_child_details FOR EACH ROW EXECUTE FUNCTION protect_saved_child_details();
CREATE TRIGGER saved_child_details_no_truncate BEFORE TRUNCATE ON saved_child_details FOR EACH STATEMENT EXECUTE FUNCTION protect_saved_child_details();
CREATE FUNCTION protect_child_booking_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.acting_account_id IS NOT NULL THEN RAISE EXCEPTION 'Child booking history is preserved'; END IF;
    RETURN OLD;
  END IF;
  IF (NEW.acting_account_id,NEW.attendee_person_id,NEW.saved_child_details_id,NEW.child_name_snapshot,NEW.child_age_snapshot)
    IS DISTINCT FROM (OLD.acting_account_id,OLD.attendee_person_id,OLD.saved_child_details_id,OLD.child_name_snapshot,OLD.child_age_snapshot)
    THEN RAISE EXCEPTION 'Booking child attendee/actor snapshot is immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER booking_child_snapshot_history BEFORE UPDATE OR DELETE ON bookings FOR EACH ROW EXECUTE FUNCTION protect_child_booking_snapshot();
CREATE FUNCTION protect_child_booking_truncate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM bookings WHERE acting_account_id IS NOT NULL) THEN RAISE EXCEPTION 'Child booking history is preserved'; END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER booking_child_snapshot_no_truncate BEFORE TRUNCATE ON bookings FOR EACH STATEMENT EXECUTE FUNCTION protect_child_booking_truncate();
