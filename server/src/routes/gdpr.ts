import { Router } from 'express';
import { verifyAccess } from '../middleware/auth.js';
import { getDb } from '../services/db.js';

const router = Router();
const db = getDb();

// Danger: irreversibly deletes user-owned data
router.delete('/me', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const uid = req.user!.sub;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM friends WHERE user_id=$1 OR friend_id=$1`, [uid]);
    await client.query(`DELETE FROM guild_members WHERE player_id=$1`, [uid]);
    await client.query(`DELETE FROM player_inventories WHERE player_id=$1`, [uid]);
    await client.query(`DELETE FROM race_results WHERE user_id=$1`, [uid]);
    await client.query(`DELETE FROM trade WHERE seller_id=$1 OR buyer_id=$1`, [uid]);
    await client.query(`DELETE FROM trade_offers WHERE user_id=$1`, [uid]);
    await client.query(`DELETE FROM marketplace_listings WHERE seller_id=$1`, [uid]);
    await client.query(`DELETE FROM auction_bids WHERE bidder_id=$1`, [uid]);
    await client.query(`DELETE FROM auctions WHERE seller_id=$1`, [uid]);
    await client.query(`DELETE FROM player_wallets WHERE player_id=$1`, [uid]);
    await client.query(`DELETE FROM players WHERE user_id=$1`, [uid]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'delete_failed' });
  } finally { client.release(); }
});

export default router;

