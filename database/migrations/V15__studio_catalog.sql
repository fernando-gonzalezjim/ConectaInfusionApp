-- Additive catalog model. Legacy sessions retain IDs, values and booking references.
CREATE TABLE studio_disciplines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_es text NOT NULL CHECK (length(btrim(name_es)) BETWEEN 1 AND 120),
  name_en text CHECK (name_en IS NULL OR length(btrim(name_en)) BETWEEN 1 AND 120),
  description_es text NOT NULL DEFAULT '' CHECK (length(description_es) <= 4000),
  description_en text CHECK (description_en IS NULL OR length(description_en) <= 4000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX studio_disciplines_status_idx ON studio_disciplines(status,id);

CREATE TABLE studio_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_id uuid NOT NULL REFERENCES studio_disciplines(id),
  name_es text NOT NULL CHECK (length(btrim(name_es)) BETWEEN 1 AND 120),
  name_en text CHECK (name_en IS NULL OR length(btrim(name_en)) BETWEEN 1 AND 120),
  description_es text NOT NULL DEFAULT '' CHECK (length(description_es) <= 4000),
  description_en text CHECK (description_en IS NULL OR length(description_en) <= 4000),
  audience text NOT NULL CHECK (audience IN ('children','adults')),
  min_age integer CHECK (min_age >= 0),
  max_age integer CHECK (max_age >= 0),
  CONSTRAINT studio_class_age_order CHECK (min_age IS NULL OR max_age IS NULL OR min_age <= max_age),
  CONSTRAINT studio_class_adult_age CHECK (audience = 'children' OR (min_age IS NULL AND max_age IS NULL)),
  level text NOT NULL CHECK (level IN ('beginner','intermediate','advanced','all')),
  color text NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  duration_minutes integer NOT NULL DEFAULT 55 CHECK (duration_minutes = 55),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX studio_classes_discipline_idx ON studio_classes(discipline_id,status,id);

ALTER TABLE class_sessions ADD COLUMN class_id uuid REFERENCES studio_classes(id);
ALTER TABLE class_sessions ADD COLUMN status text NOT NULL DEFAULT 'legacy'
  CHECK (status IN ('legacy','draft','published','cancelled'));
ALTER TABLE class_sessions ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0);
ALTER TABLE class_sessions ALTER COLUMN instructor_id DROP NOT NULL;
ALTER TABLE class_sessions ADD CONSTRAINT studio_session_catalog_state
  CHECK ((class_id IS NULL AND status = 'legacy') OR (class_id IS NOT NULL AND status <> 'legacy'));
ALTER TABLE class_sessions ADD CONSTRAINT studio_session_instructor
  CHECK (instructor_id IS NOT NULL OR (class_id IS NOT NULL AND status IN ('draft','cancelled')));
ALTER TABLE class_sessions ADD CONSTRAINT studio_session_duration
  CHECK (class_id IS NULL OR duration_minutes = 55);
CREATE INDEX class_sessions_catalog_idx ON class_sessions(class_id,status,starts_at,id);

-- Operator/management reconciliation only; no name-based adoption or public exposure.
CREATE VIEW studio_legacy_session_reconciliation AS
  SELECT s.id,s.title,s.instructor_id,i.person_id AS instructor_person_id,
    s.starts_at,s.duration_minutes,s.capacity,
    (SELECT count(*)::integer FROM bookings b WHERE b.class_session_id=s.id) AS historical_booking_count
  FROM class_sessions s JOIN instructors i ON i.id=s.instructor_id
  WHERE s.class_id IS NULL;
