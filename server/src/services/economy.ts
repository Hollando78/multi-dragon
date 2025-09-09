import { getDb } from './db.js';

export async function creditPlayer(playerId: string, amount: number, reason: string, refId?: string) {
  const db = getDb(); if (!db) throw new Error('db');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO player_wallets (player_id, balance) VALUES ($1, 0) ON CONFLICT (player_id) DO NOTHING`, [playerId]);
    await client.query(`UPDATE player_wallets SET balance = balance + $2 WHERE player_id=$1`, [playerId, amount]);
    await client.query(`INSERT INTO economy_ledger (actor_type, actor_id, amount, reason, ref_id) VALUES ('player', $1, $2, $3, $4)`, [playerId, amount, reason, refId || null]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

export async function debitPlayer(playerId: string, amount: number, reason: string, refId?: string) {
  const db = getDb(); if (!db) throw new Error('db');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT balance FROM player_wallets WHERE player_id=$1 FOR UPDATE`, [playerId]);
    const bal = rows.length ? Number(rows[0].balance) : 0;
    if (bal < amount) { await client.query('ROLLBACK'); throw new Error('insufficient_funds'); }
    await client.query(`UPDATE player_wallets SET balance = balance - $2 WHERE player_id=$1`, [playerId, amount]);
    await client.query(`INSERT INTO economy_ledger (actor_type, actor_id, amount, reason, ref_id) VALUES ('player', $1, $2, $3, $4)`, [playerId, -amount, reason, refId || null]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

export async function creditGuild(guildId: string, amount: number, reason: string, refId?: string) {
  const db = getDb(); if (!db) throw new Error('db');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO guild_wallets (guild_id, balance) VALUES ($1, 0) ON CONFLICT (guild_id) DO NOTHING`, [guildId]);
    await client.query(`UPDATE guild_wallets SET balance = balance + $2 WHERE guild_id=$1`, [guildId, amount]);
    await client.query(`INSERT INTO economy_ledger (actor_type, actor_id, amount, reason, ref_id) VALUES ('guild', $1, $2, $3, $4)`, [guildId, amount, reason, refId || null]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

export async function debitGuild(guildId: string, amount: number, reason: string, refId?: string) {
  const db = getDb(); if (!db) throw new Error('db');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT balance FROM guild_wallets WHERE guild_id=$1 FOR UPDATE`, [guildId]);
    const bal = rows.length ? Number(rows[0].balance) : 0;
    if (bal < amount) { await client.query('ROLLBACK'); throw new Error('insufficient_funds'); }
    await client.query(`UPDATE guild_wallets SET balance = balance - $2 WHERE guild_id=$1`, [guildId, amount]);
    await client.query(`INSERT INTO economy_ledger (actor_type, actor_id, amount, reason, ref_id) VALUES ('guild', $1, $2, $3, $4)`, [guildId, -amount, reason, refId || null]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

