import { getDb } from './db.js';

export async function enforceUpkeep() {
  const db = getDb(); if (!db) return;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Mark territories as decayed if overdue
    await client.query(`UPDATE territories SET decayed=true WHERE upkeep_due_at IS NOT NULL AND upkeep_due_at < now()`);
    // Optionally unclaim after grace period (not implemented)
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); } finally { client.release(); }
}

