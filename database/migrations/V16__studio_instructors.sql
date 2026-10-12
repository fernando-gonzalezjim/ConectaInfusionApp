-- Explicit management-owned public facts. No legacy names or private photos adopted.
CREATE TABLE studio_instructor_profiles (
  instructor_id uuid PRIMARY KEY REFERENCES instructors(id),
  public_name text NOT NULL CHECK (length(btrim(public_name)) BETWEEN 1 AND 120),
  biography_es text CHECK (biography_es IS NULL OR length(biography_es) <= 4000),
  biography_en text CHECK (biography_en IS NULL OR length(biography_en) <= 4000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE studio_instructor_disciplines (
  instructor_id uuid NOT NULL REFERENCES studio_instructor_profiles(instructor_id),
  discipline_id uuid NOT NULL REFERENCES studio_disciplines(id),
  PRIMARY KEY(instructor_id,discipline_id)
);
CREATE INDEX studio_instructor_disciplines_discipline_idx ON studio_instructor_disciplines(discipline_id,instructor_id);
