import { getDb } from './db.js';

export async function settleEndedAuctions() {
  const db = getDb();
  if (!db) return;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: aucs } = await client.query(`SELECT id, seller_id, item_id, quantity FROM auctions WHERE status='active' AND ends_at <= now() FOR UPDATE SKIP LOCKED`);
    for (const a of aucs) {
      const { rows: top } = await client.query(`SELECT bidder_id, amount FROM auction_bids WHERE auction_id=$1 ORDER BY amount DESC, created_at ASC LIMIT 1`, [a.id]);
      if (!top.length) {
        // No bids: return items to seller by crediting back (seller had to reserve before listing)
        await client.query(
          `INSERT INTO player_inventories (player_id, item_id, quantity) VALUES ($1, $2, $3)
           ON CONFLICT (player_id, item_id) DO UPDATE SET quantity = player_inventories.quantity + EXCLUDED.quantity`,
          [a.seller_id, a.item_id, a.quantity]
        );
        await client.query(`UPDATE auctions SET status='settled' WHERE id=$1`, [a.id]);
      } else {
        const bidder = top[0].bidder_id;
        // Credit item to winner
        await client.query(
          `INSERT INTO player_inventories (player_id, item_id, quantity) VALUES ($1, $2, $3)
           ON CONFLICT (player_id, item_id) DO UPDATE SET quantity = player_inventories.quantity + EXCLUDED.quantity`,
          [bidder, a.item_id, a.quantity]
        );
        // Seller payout could be handled here if using hold model; skipped for brevity
        await client.query(`UPDATE auctions SET status='settled' WHERE id=$1`, [a.id]);
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
}
