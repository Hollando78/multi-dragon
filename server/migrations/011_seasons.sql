CREATE TABLE IF NOT EXISTS seasons (
  id INT PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL
);

INSERT INTO seasons (id, started_at, ends_at)
  SELECT 1, now(), now() + interval '30 days'
  ON CONFLICT (id) DO NOTHING;

