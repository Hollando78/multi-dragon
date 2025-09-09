CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  world_seed TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft|active|completed
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tournament_participants (
  tournament_id TEXT REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  seed_rank INT DEFAULT 0,
  PRIMARY KEY (tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS tournament_matches (
  id TEXT PRIMARY KEY,
  tournament_id TEXT REFERENCES tournaments(id) ON DELETE CASCADE,
  round INT NOT NULL,
  player_a TEXT,
  player_b TEXT,
  winner TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

