CREATE TABLE IF NOT EXISTS player_wallets (
  player_id TEXT PRIMARY KEY,
  balance BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS guild_wallets (
  guild_id TEXT PRIMARY KEY,
  balance BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS economy_ledger (
  id BIGSERIAL PRIMARY KEY,
  actor_type TEXT NOT NULL, -- player|guild|system
  actor_id TEXT,
  amount BIGINT NOT NULL,
  reason TEXT,
  ref_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

