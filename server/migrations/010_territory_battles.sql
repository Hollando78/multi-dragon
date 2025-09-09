-- Extend territories with contested state
ALTER TABLE territories
  ADD COLUMN IF NOT EXISTS contested BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contested_by TEXT;

CREATE TABLE IF NOT EXISTS territory_battles (
  id TEXT PRIMARY KEY,
  world_seed TEXT NOT NULL,
  region_id TEXT NOT NULL,
  attackers JSONB NOT NULL DEFAULT '[]',
  defenders JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending', -- pending|active|completed|cancelled
  winner_guild_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tb_world_region ON territory_battles(world_seed, region_id);

