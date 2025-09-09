CREATE TABLE IF NOT EXISTS guild_facilities (
  id TEXT PRIMARY KEY,
  guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
  world_seed TEXT NOT NULL,
  region_id TEXT NOT NULL,
  type TEXT NOT NULL,
  level INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guild_facilities_guild ON guild_facilities(guild_id);

