import { getDb } from './db.js';

let seasonsInitialized = false;

async function ensureSeasonsInitialized(db: any) {
  if (seasonsInitialized) return;
  try {
    // Create seasons table if missing and ensure a current season exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS seasons (
        id INT PRIMARY KEY,
        started_at TIMESTAMPTZ NOT NULL,
        ends_at TIMESTAMPTZ NOT NULL
      );
    `);
    // Territories should carry a season column for resets
    await db.query(`
      ALTER TABLE IF EXISTS territories
        ADD COLUMN IF NOT EXISTS season INT DEFAULT 1,
        ADD COLUMN IF NOT EXISTS contested BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS contested_by TEXT;
    `);
    const { rowCount } = await db.query(`SELECT 1 FROM seasons LIMIT 1`);
    if (rowCount === 0) {
      await db.query(`INSERT INTO seasons (id, started_at, ends_at) VALUES (1, now(), now() + interval '30 days') ON CONFLICT (id) DO NOTHING`);
    }
    seasonsInitialized = true;
  } catch (e) {
    // Swallow errors to avoid crashing periodic worker; will retry next tick
  }
}

export async function checkAndRotateSeason() {
  const db = getDb();
  if (!db) return;
  await ensureSeasonsInitialized(db);
  try {
    const { rows } = await db.query(`SELECT id, started_at, ends_at FROM seasons ORDER BY id DESC LIMIT 1`);
    if (!rows.length) return;
    const cur = rows[0];
    if (Date.now() >= new Date(cur.ends_at).getTime()) {
      const nextId = Number(cur.id) + 1;
      const now = new Date();
      const ends = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
      await db.query('BEGIN');
      try {
        // Reset territories but keep history in logs
        await db.query(`UPDATE territories SET guild_id=NULL, claimed_at=NULL, contested=false, contested_by=NULL, season=$1`, [nextId]);
        await db.query(`INSERT INTO seasons (id, started_at, ends_at) VALUES ($1, $2, $3)`, [nextId, now.toISOString(), ends.toISOString()]);
        await db.query('COMMIT');
      } catch (e) {
        await db.query('ROLLBACK');
      }
    }
  } catch (e) {
    // If seasons table still isn't ready, skip without throwing
  }
}
