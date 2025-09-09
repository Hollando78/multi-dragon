CREATE TABLE IF NOT EXISTS territories (
  world_seed TEXT NOT NULL,
  region_id TEXT NOT NULL,
  guild_id TEXT REFERENCES guilds(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  season INT DEFAULT 1,
  benefits JSONB DEFAULT '[]',
  PRIMARY KEY (world_seed, region_id)
);

CREATE TABLE IF NOT EXISTS territory_claim_logs (
  id BIGSERIAL PRIMARY KEY,
  world_seed TEXT,
  region_id TEXT,
  guild_id TEXT,
  actor_id TEXT,
  action TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

