-- Keep V2 history/triggers intact; customer self-service must not impersonate staff.
ALTER TABLE audit_events DROP CONSTRAINT audit_events_actor_type_check;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_actor_type_check
  CHECK (actor_type IN ('staff', 'system', 'customer'));
