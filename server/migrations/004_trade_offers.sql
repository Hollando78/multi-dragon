CREATE TABLE IF NOT EXISTS trade_offers (
  id TEXT PRIMARY KEY,
  trade_id TEXT REFERENCES trade(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trade_offers_trade ON trade_offers(trade_id);

