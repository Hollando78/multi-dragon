import { getDb } from './db.js';

export async function checkAndRotateSeason() {
  const db = getDb();
  if (!db) return;
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
}

