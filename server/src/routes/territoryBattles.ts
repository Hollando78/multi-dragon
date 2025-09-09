import { Router } from 'express';
import { verifyAccess } from '../middleware/auth.js';
import { getDb } from '../services/db.js';
import { randomUUID } from 'crypto';

const router = Router();
const db = getDb();

// Start a battle on a region (marks contested)
router.post('/worlds/:seed/territory/:regionId/battles', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { seed, regionId } = req.params;
  const { rows: gRows } = await db.query(`SELECT guild_id FROM guild_members WHERE player_id=$1 LIMIT 1`, [req.user!.sub]);
  if (!gRows.length) return res.status(403).json({ error: 'not_in_guild' });
  const attackerGuild = gRows[0].guild_id;
  const id = randomUUID().replace(/-/g, '');
  await db.query(`INSERT INTO territory_battles (id, world_seed, region_id, attackers, status, started_at) VALUES ($1, $2, $3, $4, 'active', now())`, [id, seed, regionId, JSON.stringify([attackerGuild])]);
  await db.query(`UPDATE territories SET contested=true, contested_by=$3 WHERE world_seed=$1 AND region_id=$2`, [seed, regionId, attackerGuild]);
  res.json({ id, seed, regionId, status: 'active' });
});

// Complete a battle and set winner ownership
router.post('/territory-battles/:id/complete', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { id } = req.params;
  const { winnerGuildId } = req.body || {};
  if (!winnerGuildId) return res.status(400).json({ error: 'missing_winner' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT world_seed, region_id FROM territory_battles WHERE id=$1 FOR UPDATE`, [id]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    const { world_seed, region_id } = rows[0];
    await client.query(`UPDATE territory_battles SET status='completed', winner_guild_id=$2, ended_at=now() WHERE id=$1`, [id, winnerGuildId]);
    await client.query(
      `INSERT INTO territories (world_seed, region_id, guild_id, claimed_at, contested, contested_by)
       VALUES ($1, $2, $3, now(), false, NULL)
       ON CONFLICT (world_seed, region_id) DO UPDATE SET guild_id=EXCLUDED.guild_id, claimed_at=now(), contested=false, contested_by=NULL`,
      [world_seed, region_id, winnerGuildId]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'complete_failed' });
  } finally { client.release(); }
});

export default router;

