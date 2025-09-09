import { Router } from 'express';
import { verifyAccess } from '../middleware/auth.js';
import { getDb } from '../services/db.js';
import { randomUUID } from 'crypto';
import { debitPlayer, creditPlayer } from '../services/economy.js';

const router = Router();
const db = getDb();

router.post('/market/list', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { itemId, quantity, price } = req.body || {};
  if (!itemId || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) return res.status(400).json({ error: 'bad_request' });
  // Check inventory
  const { rows } = await db.query(`SELECT quantity FROM player_inventories WHERE player_id=$1 AND item_id=$2`, [req.user!.sub, itemId]);
  const have = rows.length ? Number(rows[0].quantity) : 0;
  if (have < quantity) return res.status(400).json({ error: 'insufficient_items' });
  // Reserve items by debiting inventory
  await db.query(`UPDATE player_inventories SET quantity = quantity - $3 WHERE player_id=$1 AND item_id=$2`, [req.user!.sub, itemId, quantity]);
  const id = randomUUID().replace(/-/g, '');
  await db.query(`INSERT INTO marketplace_listings (id, seller_id, item_id, quantity, price, status) VALUES ($1, $2, $3, $4, $5, 'active')`, [id, req.user!.sub, itemId, quantity, price]);
  res.json({ id, itemId, quantity, price });
});

router.get('/market/search', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { itemId } = req.query as any;
  const params: any[] = [];
  let q = `SELECT id, seller_id, item_id, quantity, price, status FROM marketplace_listings WHERE status='active'`;
  if (itemId) { q += ' AND item_id=$1'; params.push(itemId); }
  const { rows } = await db.query(q, params);
  res.json({ listings: rows });
});

router.post('/market/buy/:id', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { id } = req.params;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT seller_id, item_id, quantity, price, status FROM marketplace_listings WHERE id=$1 FOR UPDATE`, [id]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    const listing = rows[0];
    if (listing.status !== 'active') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'inactive' }); }
    // Debit buyer wallet (with 5% tax fee)
    const tax = Math.floor(Number(listing.price) * 0.05);
    const total = Number(listing.price) + tax;
    try { await debitPlayer(req.user!.sub, total, 'market_buy', id); } catch (e) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'insufficient_funds' }); }
    // Credit item to buyer
    await client.query(
      `INSERT INTO player_inventories (player_id, item_id, quantity) VALUES ($1, $2, $3)
       ON CONFLICT (player_id, item_id) DO UPDATE SET quantity = player_inventories.quantity + EXCLUDED.quantity`,
      [req.user!.sub, listing.item_id, listing.quantity]
    );
    await client.query(`UPDATE marketplace_listings SET status='sold' WHERE id=$1`, [id]);
    // Credit seller wallet minus fee
    await creditPlayer(listing.seller_id, Number(listing.price), 'market_sale', id);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'buy_failed' });
  } finally {
    client.release();
  }
});

export default router;
