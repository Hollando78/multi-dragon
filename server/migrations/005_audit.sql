CREATE TABLE IF NOT EXISTS trade_audit (
  id BIGSERIAL PRIMARY KEY,
  trade_id TEXT,
  actor_id TEXT,
  action TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS breeding_audit (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  parent_a TEXT,
  parent_b TEXT,
  offspring_id TEXT,
  world_seed TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

