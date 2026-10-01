-- Applied transactionally by npm run db:migrate.
CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX members_email_unique ON members (lower(email));
CREATE TABLE instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL
);
CREATE TABLE class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  instructor_id uuid NOT NULL REFERENCES instructors(id),
  starts_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  capacity integer NOT NULL CHECK (capacity > 0)
);
CREATE INDEX class_sessions_starts_at_idx ON class_sessions(starts_at);
CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id),
  class_session_id uuid NOT NULL REFERENCES class_sessions(id),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'attended', 'no_show')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, class_session_id)
);
CREATE INDEX bookings_class_session_idx ON bookings(class_session_id);
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('coffee', 'tea', 'food', 'retail')),
  price_minor integer NOT NULL CHECK (price_minor >= 0),
  currency char(3) NOT NULL DEFAULT 'MXN',
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'cancelled', 'refunded')),
  currency char(3) NOT NULL DEFAULT 'MXN',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id),
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_minor integer NOT NULL CHECK (unit_price_minor >= 0)
);
CREATE INDEX sale_items_sale_idx ON sale_items(sale_id);
