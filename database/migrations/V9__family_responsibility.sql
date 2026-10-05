-- Offers are historical consent records; they never confer authority while pending.
CREATE TABLE family_successor_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id),
  family_version integer NOT NULL CHECK (family_version >= 0),
  recipient_email text NOT NULL CHECK (recipient_email=lower(btrim(recipient_email)) AND length(recipient_email) BETWEEN 3 AND 320 AND recipient_email !~ '[[:space:][:cntrl:]<>]'),
  target_membership_id uuid NOT NULL,
  issued_by_account_id uuid NOT NULL REFERENCES accounts(id),
  issuer_version integer NOT NULL CHECK (issuer_version >= 0),
  issued_by_membership_id uuid,
  action_token_id uuid UNIQUE REFERENCES identity_action_tokens(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_at timestamptz NOT NULL CHECK (isfinite(created_at)),
  resolved_at timestamptz CHECK (isfinite(resolved_at) AND resolved_at >= created_at),
  CHECK ((status='pending')=(resolved_at IS NULL)),
  FOREIGN KEY (family_id,target_membership_id) REFERENCES family_memberships(family_id,id),
  FOREIGN KEY (family_id,issued_by_membership_id) REFERENCES family_memberships(family_id,id)
);
CREATE UNIQUE INDEX family_one_pending_successor_idx ON family_successor_offers(family_id) WHERE status='pending';

CREATE FUNCTION identity_family_successor_valid(offer_id uuid,token_id uuid,local_delivery boolean) RETURNS boolean
LANGUAGE sql STABLE AS $$
 SELECT EXISTS (
  SELECT 1 FROM family_successor_offers o JOIN families f ON f.id=o.family_id
  JOIN accounts a ON a.id=o.issued_by_account_id JOIN people p ON p.id=a.person_id
  JOIN family_memberships m ON m.id=o.target_membership_id AND m.family_id=f.id
  JOIN accounts r ON r.person_id=m.person_id JOIN people rp ON rp.id=r.person_id
  WHERE o.id=offer_id AND o.action_token_id=token_id AND o.status='pending'
   AND f.status='active' AND f.version=o.family_version AND m.ended_at IS NULL
   AND m.id IS DISTINCT FROM f.responsible_membership_id
   AND a.status='active' AND p.status='active' AND a.session_version=o.issuer_version AND a.confirmation_status IN ('verified','exempt')
   AND r.status='active' AND rp.status='active' AND r.confirmation_status IN ('verified','exempt') AND r.email=o.recipient_email
   AND EXISTS (SELECT 1 FROM account_roles WHERE account_id=r.id AND role='customer')
   AND (local_delivery OR (a.development_fixture IS NULL AND r.development_fixture IS NULL
     AND a.email NOT IN ('admin@conecta.example.test','testuser@conecta.example.test') AND r.email NOT IN ('admin@conecta.example.test','testuser@conecta.example.test')))
   AND ((o.issued_by_membership_id IS NULL AND EXISTS (SELECT 1 FROM account_roles WHERE account_id=a.id AND role IN ('administrator','manager')))
     OR (o.issued_by_membership_id=f.responsible_membership_id AND EXISTS (
       SELECT 1 FROM family_memberships s WHERE s.id=o.issued_by_membership_id AND s.person_id=a.person_id AND s.ended_at IS NULL)
       AND EXISTS (SELECT 1 FROM account_roles WHERE account_id=a.id AND role='customer')))
 )
$$;
CREATE FUNCTION enforce_family_successor_token() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM family_successor_offers o LEFT JOIN identity_action_tokens t ON t.id=o.action_token_id
   JOIN family_memberships m ON m.id=o.target_membership_id
   WHERE o.id=NEW.id AND (t.id IS NULL OR t.purpose<>'family_successor' OR t.target_id IS DISTINCT FROM o.id
    OR t.recipient_email<>o.recipient_email OR t.person_id IS DISTINCT FROM m.person_id OR t.expected_version<>0)) THEN
   RAISE EXCEPTION 'Invalid family successor token binding';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER family_successor_token_binding AFTER INSERT OR UPDATE ON family_successor_offers
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_family_successor_token();
CREATE FUNCTION preserve_family_successor_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Family successor history cannot be deleted'; END IF;
 IF OLD.status<>'pending' OR NEW.id<>OLD.id OR NEW.family_id<>OLD.family_id OR NEW.family_version<>OLD.family_version
  OR NEW.target_membership_id<>OLD.target_membership_id OR NEW.recipient_email<>OLD.recipient_email
  OR NEW.issued_by_account_id<>OLD.issued_by_account_id OR NEW.issuer_version<>OLD.issuer_version
  OR NEW.issued_by_membership_id IS DISTINCT FROM OLD.issued_by_membership_id OR NEW.created_at<>OLD.created_at
  OR (OLD.action_token_id IS NOT NULL AND NEW.action_token_id IS DISTINCT FROM OLD.action_token_id) THEN
  RAISE EXCEPTION 'Family successor provenance is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER family_successor_history BEFORE UPDATE OR DELETE ON family_successor_offers FOR EACH ROW EXECUTE FUNCTION preserve_family_successor_history();
CREATE TRIGGER family_successor_no_truncate BEFORE TRUNCATE ON family_successor_offers FOR EACH STATEMENT EXECUTE FUNCTION preserve_family_successor_history();
