import { getDb } from './db.js';
import { getRedis } from './redis.js';
import { logger } from '../logger.js';
import { randomUUID } from 'crypto';

const TRADE_KEY = (id: string) => `trade:${id}`; // Redis hash: { sellerId, buyerId, status, acceptedBy?, confirmed:<json> }
const USER_TRADES = (uid: string) => `user_trades:${uid}`; // Redis set of tradeIds

export type TradeRecord = {
  id: string;
  seller_id: string | null;
  buyer_id: string | null;
  items: any;
  status: string;
  created_at: string;
};

export async function startTrade(fromUserId: string, targetUserId: string, items: any[]): Promise<string> {
  const id = randomUUID().replace(/-/g, '');
  const db = getDb();
  const redis = await getRedis();
  if (!db || !redis) throw new Error('infra_unavailable');
  await db.query(`INSERT INTO trade (id, seller_id, buyer_id, items, status) VALUES ($1, $2, $3, $4, 'pending')`, [id, fromUserId, targetUserId, JSON.stringify(items)]);
  await redis.hSet(TRADE_KEY(id), { sellerId: fromUserId, buyerId: targetUserId, status: 'pending' });
  await redis.sAdd(USER_TRADES(fromUserId), id);
  await redis.sAdd(USER_TRADES(targetUserId), id);
  return id;
}

export async function acceptTrade(id: string, byUserId: string) {
  const db = getDb();
  const redis = await getRedis();
  if (!db || !redis) throw new Error('infra_unavailable');
  const exists = await redis.exists(TRADE_KEY(id));
  if (!exists) throw new Error('not_found');
  await redis.hSet(TRADE_KEY(id), { status: 'accepted' });
  await db.query(`UPDATE trade SET status='accepted' WHERE id=$1`, [id]);
}

export async function cancelTrade(id: string, byUserId: string) {
  const db = getDb();
  const redis = await getRedis();
  if (!db || !redis) throw new Error('infra_unavailable');
  await redis.hSet(TRADE_KEY(id), { status: 'cancelled', cancelledBy: byUserId });
  await db.query(`UPDATE trade SET status='cancelled' WHERE id=$1`, [id]);
}

export async function confirmTrade(id: string, byUserId: string): Promise<'accepted' | 'completed'> {
  const db = getDb();
  const redis = await getRedis();
  if (!db || !redis) throw new Error('infra_unavailable');
  const data = await redis.hGetAll(TRADE_KEY(id));
  if (!data || !data.status) throw new Error('not_found');
  const confirmedRaw = data.confirmed || '{}';
  const confirmed = JSON.parse(confirmedRaw);
  confirmed[byUserId] = true;
  await redis.hSet(TRADE_KEY(id), { confirmed: JSON.stringify(confirmed) });
  const both = data.sellerId && data.buyerId && confirmed[data.sellerId] && confirmed[data.buyerId];
  if (both) {
    // Attempt to complete with escrowed items
    await completeTrade(id);
    await redis.hSet(TRADE_KEY(id), { status: 'completed' });
    await db.query(`UPDATE trade SET status='completed' WHERE id=$1`, [id]);
    return 'completed';
  } else {
    await db.query(`UPDATE trade SET status='accepted' WHERE id=$1 AND status<>'completed'`, [id]);
    return 'accepted';
  }
}

export async function cancelUserTrades(userId: string) {
  const db = getDb();
  const redis = await getRedis();
  if (!db || !redis) return;
  const ids = await redis.sMembers(USER_TRADES(userId));
  for (const id of ids) {
    try {
      await cancelTrade(id, userId);
    } catch (e) {
      logger.warn({ id }, 'cancel_trade_failed');
    }
  }
  await redis.del(USER_TRADES(userId));
}

export async function setOffer(tradeId: string, userId: string, items: any[]) {
  const db = getDb();
  if (!db) throw new Error('infra_unavailable');
  const id = randomUUID().replace(/-/g, '');
  await db.query(
    `INSERT INTO trade_offers (id, trade_id, user_id, items) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [id, tradeId, userId, JSON.stringify(items)]
  );
  await db.query(
    `UPDATE trade_offers SET items=$3, updated_at=now() WHERE trade_id=$1 AND user_id=$2`,
    [tradeId, userId, JSON.stringify(items)]
  );
  await db.query(`INSERT INTO trade_audit (trade_id, actor_id, action, details) VALUES ($1, $2, 'offer', $3)`, [tradeId, userId, JSON.stringify({ items })]);
}

async function completeTrade(tradeId: string) {
  const db = getDb();
  if (!db) throw new Error('infra_unavailable');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const trade = await client.query(`SELECT seller_id, buyer_id FROM trade WHERE id=$1 FOR UPDATE`, [tradeId]);
    if (trade.rowCount === 0) throw new Error('trade_not_found');
    const { seller_id, buyer_id } = trade.rows[0];
    const offers = await client.query(`SELECT user_id, items FROM trade_offers WHERE trade_id=$1`, [tradeId]);
    const byUser: Record<string, any[]> = {};
    for (const r of offers.rows) byUser[r.user_id] = r.items || [];
    // Move items: seller->buyer and buyer->seller based on their offers
    await moveItems(client, seller_id, buyer_id, byUser[seller_id] || []);
    await moveItems(client, buyer_id, seller_id, byUser[buyer_id] || []);
    await client.query(`INSERT INTO trade_audit (trade_id, actor_id, action, details) VALUES ($1, NULL, 'completed', '{}'::jsonb)`, [tradeId]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function moveItems(client: any, fromUser: string, toUser: string, items: any[]) {
  for (const it of items) {
    const itemId = it.id || it.itemId;
    const qty = Number(it.qty || it.quantity || 0);
    if (!itemId || qty <= 0) continue;
    // Check balance
    const bal = await client.query(`SELECT quantity FROM player_inventories WHERE player_id=$1 AND item_id=$2 FOR UPDATE`, [fromUser, itemId]);
    const have = bal.rowCount ? Number(bal.rows[0].quantity) : 0;
    if (have < qty) throw new Error('insufficient_items');
    // Debit from fromUser
    await client.query(`UPDATE player_inventories SET quantity = quantity - $3 WHERE player_id=$1 AND item_id=$2`, [fromUser, itemId, qty]);
    // Credit to toUser
    await client.query(
      `INSERT INTO player_inventories (player_id, item_id, quantity) VALUES ($1, $2, $3)
       ON CONFLICT (player_id, item_id) DO UPDATE SET quantity = player_inventories.quantity + EXCLUDED.quantity`,
      [toUser, itemId, qty]
    );
  }
}

