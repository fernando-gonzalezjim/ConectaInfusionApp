-- Preserve historical membership. Conflicting existing current memberships must
-- be reconciled explicitly; migration must never choose a group or move credits.
CREATE UNIQUE INDEX family_one_current_group_per_person_idx
  ON family_memberships(person_id) WHERE ended_at IS NULL;
