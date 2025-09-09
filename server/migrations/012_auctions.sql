CREATE TABLE IF NOT EXISTS auctions (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity INT NOT NULL,
  start_bid INT NOT NULL,
  min_increment INT NOT NULL DEFAULT 1,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' -- active|ended|settled|cancelled
);

CREATE TABLE IF NOT EXISTS auction_bids (
  id BIGSERIAL PRIMARY KEY,
  auction_id TEXT REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_id TEXT NOT NULL,
  amount INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auction_bids_auc ON auction_bids(auction_id, amount DESC);

