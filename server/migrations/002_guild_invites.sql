CREATE TABLE IF NOT EXISTS guild_invites (
  guild_id TEXT REFERENCES guilds(id) ON DELETE CASCADE,
  player_id TEXT REFERENCES players(user_id) ON DELETE CASCADE,
  inviter_id TEXT REFERENCES players(user_id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (guild_id, player_id)
);

