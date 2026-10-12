-- Small optimized public catalog portraits are transactionally stored separately
-- from private Identity photos. No URL, path or Identity photo reference exists.
CREATE TABLE studio_instructor_photos (
  instructor_id uuid PRIMARY KEY REFERENCES studio_instructor_profiles(instructor_id),
  data bytea NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 5242880),
  content_type text NOT NULL DEFAULT 'image/webp' CHECK (content_type='image/webp'),
  alt_es text NOT NULL CHECK (length(btrim(alt_es)) BETWEEN 1 AND 300),
  alt_en text CHECK (alt_en IS NULL OR length(btrim(alt_en)) BETWEEN 1 AND 300),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
