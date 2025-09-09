import { Router } from 'express';
import { verifyAccess } from '../middleware/auth.js';
import { getDb } from '../services/db.js';
import { randomUUID } from 'crypto';
import { debitPlayer } from '../services/economy.js';

const router = Router();
const db = getDb();

router.post('/auctions', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { itemId, quantity, startBid, minIncrement, endsInSec } = req.body || {};
  if (!itemId || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(startBid) || startBid <= 0) return res.status(400).json({ error: 'bad_request' });
  const inc = Number.isFinite(minIncrement) && minIncrement > 0 ? minIncrement : 1;
  const ends = new Date(Date.now() + Math.max(endsInSec || 60, 30) * 1000);
  // Reserve by debiting inventory
  await db.query(`UPDATE player_inventories SET quantity = quantity - $3 WHERE player_id=$1 AND item_id=$2 AND quantity >= $3`, [req.user!.sub, itemId, quantity]);
  const id = randomUUID().replace(/-/g, '');
  await db.query(`INSERT INTO auctions (id, seller_id, item_id, quantity, start_bid, min_increment, ends_at, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`, [id, req.user!.sub, itemId, quantity, startBid, inc, ends.toISOString()]);
  res.json({ id, itemId, quantity, startBid, minIncrement: inc, endsAt: ends.toISOString() });
});

router.post('/auctions/:id/bid', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { id } = req.params;
  const { amount } = req.body || {};
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT seller_id, start_bid, min_increment, ends_at, status FROM auctions WHERE id=$1 FOR UPDATE`, [id]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    const a = rows[0];
    if (a.status !== 'active') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'inactive' }); }
    const { rows: top } = await client.query(`SELECT amount FROM auction_bids WHERE auction_id=$1 ORDER BY amount DESC LIMIT 1`, [id]);
    const current = top.length ? Number(top[0].amount) : Number(a.start_bid);
    const minNeeded = current + Number(a.min_increment);
    if (!Number.isFinite(amount) || amount < minNeeded) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'low_bid', minNeeded }); }
    // Debit small hold from bidder wallet equal to amount difference (simple model)
    try { await debitPlayer(req.user!.sub, amount, 'auction_bid', id); } catch (e) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'insufficient_funds' }); }
    // Insert bid
    await client.query(`INSERT INTO auction_bids (auction_id, bidder_id, amount) VALUES ($1, $2, $3)`, [id, req.user!.sub, amount]);
    // Snipe guard: extend 15s if within last 10s
    const endsAt = new Date(a.ends_at);
    if (endsAt.getTime() - Date.now() <= 10000) {
      const newEnds = new Date(Date.now() + 15000);
      await client.query(`UPDATE auctions SET ends_at=$2 WHERE id=$1`, [id, newEnds.toISOString()]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'bid_failed' });
  } finally { client.release(); }
});

router.get('/auctions', async (_req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { rows } = await db.query(`SELECT id, seller_id, item_id, quantity, start_bid, min_increment, ends_at, status FROM auctions WHERE status='active' ORDER BY ends_at ASC`);
  res.json({ auctions: rows });
});

export default router;
