-- The existing action row records immutable issuer, relationship, mailbox and
-- dependent version. No pending account or duplicate person is created.
CREATE FUNCTION identity_dependent_transition_valid(action_id uuid, local_delivery boolean)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM identity_action_tokens t
    JOIN accounts a ON a.id=t.account_id
    JOIN people issuer ON issuer.id=a.person_id
    JOIN people child ON child.id=t.person_id
    JOIN dependent_profiles d ON d.person_id=child.id
    JOIN dependent_guardians g ON g.id=t.target_id
    WHERE t.id=action_id AND t.purpose='dependent_transition'
      AND a.status='active' AND a.confirmation_status IN ('verified','exempt')
      AND a.session_version=t.account_version AND issuer.status='active'
      AND (local_delivery OR a.development_fixture IS NULL)
      AND EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role='customer')
      AND child.status='active' AND d.independent_at IS NULL AND d.version=t.expected_version
      AND g.dependent_person_id=child.id AND g.guardian_account_id=a.id AND g.ended_at IS NULL
      AND NOT EXISTS(SELECT 1 FROM accounts recipient WHERE recipient.email=t.recipient_email)
  );
$$;
