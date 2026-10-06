-- Identity facts only; credit disposition remains domain-owned.
CREATE TABLE families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120 AND name !~ '[[:cntrl:]]'),
  created_by_person_id uuid NOT NULL REFERENCES people(id),
  responsible_membership_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(created_at)),
  closed_at timestamptz,
  CHECK ((status='closed')=(closed_at IS NOT NULL)),
  CHECK (closed_at IS NULL OR (isfinite(closed_at) AND closed_at>=created_at)),
  CHECK (status<>'closed' OR responsible_membership_id IS NULL)
);
CREATE TABLE family_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id),
  person_id uuid NOT NULL REFERENCES people(id),
  source text NOT NULL CHECK (source IN ('creation','accepted_invitation')),
  accepted_invitation_id uuid UNIQUE,
  accepted_by_person_id uuid NOT NULL REFERENCES people(id),
  joined_at timestamptz NOT NULL CHECK (isfinite(joined_at)),
  ended_at timestamptz,
  end_reason text CHECK (end_reason IN ('left','removed','closed','deactivated')),
  UNIQUE(family_id,id),
  CHECK (accepted_by_person_id=person_id),
  CHECK ((source='accepted_invitation')=(accepted_invitation_id IS NOT NULL)),
  CHECK ((ended_at IS NULL)=(end_reason IS NULL)),
  CHECK (ended_at IS NULL OR (isfinite(ended_at) AND ended_at>=joined_at))
);
CREATE UNIQUE INDEX family_current_membership_idx ON family_memberships(family_id,person_id) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX family_creation_membership_idx ON family_memberships(family_id) WHERE source='creation';
CREATE INDEX family_memberships_person_idx ON family_memberships(person_id,family_id);
ALTER TABLE families ADD CONSTRAINT family_responsible_membership_fk
  FOREIGN KEY(id,responsible_membership_id) REFERENCES family_memberships(family_id,id) DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION protect_family_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Family membership history is preserved'; END IF;
  IF TG_OP='UPDATE' AND (OLD.ended_at IS NOT NULL OR
    (NEW.id,NEW.family_id,NEW.person_id,NEW.source,NEW.accepted_invitation_id,NEW.accepted_by_person_id,NEW.joined_at)
    IS DISTINCT FROM (OLD.id,OLD.family_id,OLD.person_id,OLD.source,OLD.accepted_invitation_id,OLD.accepted_by_person_id,OLD.joined_at))
    THEN RAISE EXCEPTION 'Family membership provenance is immutable'; END IF;
  PERFORM id FROM families WHERE id=NEW.family_id FOR UPDATE;
  RETURN NEW;
END;
$$;
CREATE TRIGGER family_membership_provenance BEFORE INSERT OR UPDATE OR DELETE ON family_memberships FOR EACH ROW EXECUTE FUNCTION protect_family_membership();
CREATE TRIGGER family_membership_no_truncate BEFORE TRUNCATE ON family_memberships FOR EACH STATEMENT EXECUTE FUNCTION protect_family_membership();
CREATE FUNCTION protect_family_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Family history is preserved'; END IF;
  IF OLD.status='closed' OR (NEW.id,NEW.created_by_person_id,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.created_by_person_id,OLD.created_at)
    OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Invalid family history/version change'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER family_history BEFORE UPDATE OR DELETE ON families FOR EACH ROW EXECUTE FUNCTION protect_family_history();
CREATE TRIGGER family_no_truncate BEFORE TRUNCATE ON families FOR EACH STATEMENT EXECUTE FUNCTION protect_family_history();

-- Deferred checks permit atomic creation/departure/closure but no invalid committed state.
CREATE FUNCTION enforce_family_state() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE family_uuid uuid; current_family families%ROWTYPE; active_count integer;
BEGIN
  IF TG_TABLE_NAME='families' THEN family_uuid:=NEW.id; ELSE family_uuid:=NEW.family_id; END IF;
  SELECT * INTO current_family FROM families WHERE id=family_uuid FOR UPDATE;
  SELECT count(*) INTO active_count FROM family_memberships WHERE family_id=family_uuid AND ended_at IS NULL;
  IF NOT EXISTS(SELECT 1 FROM family_memberships WHERE family_id=family_uuid AND source='creation' AND person_id=current_family.created_by_person_id)
    OR (current_family.status='active' AND active_count=0) OR (current_family.status='closed' AND active_count<>0)
    OR (current_family.responsible_membership_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM family_memberships WHERE id=current_family.responsible_membership_id AND family_id=family_uuid AND ended_at IS NULL))
    THEN RAISE EXCEPTION 'Invalid family/member/responsible state'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER family_state AFTER INSERT OR UPDATE ON families DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_family_state();
CREATE CONSTRAINT TRIGGER family_member_state AFTER INSERT OR UPDATE ON family_memberships DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_family_state();
CREATE INDEX audit_events_page_idx ON audit_events(occurred_at DESC,id DESC);
