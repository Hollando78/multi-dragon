CREATE TABLE IF NOT EXISTS race_tracks (
  id TEXT PRIMARY KEY,
  world_seed TEXT NOT NULL,
  name TEXT NOT NULL,
  checkpoints JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS race_results (
  id BIGSERIAL PRIMARY KEY,
  track_id TEXT REFERENCES race_tracks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  time_ms INT NOT NULL,
  flags JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_race_results_track ON race_results(track_id);
