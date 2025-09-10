import { Router } from 'express';
import { verifyAccess } from '../middleware/auth.js';
import { getDb } from '../services/db.js';
import { logger } from '../logger.js';

const router = Router();
const db = getDb();

router.get('/worlds/:seed/territory', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { seed } = req.params;
  const { rows } = await db.query(`SELECT world_seed, region_id, guild_id, claimed_at, season, benefits FROM territories WHERE world_seed=$1`, [seed]);
  res.json({ seed, regions: rows });
});

router.post('/worlds/:seed/territory/claim', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { seed } = req.params;
  const { regionId } = req.body || {};
  if (!regionId) return res.status(400).json({ error: 'missing_region' });
  // Check that user is in a guild
  const { rows: guilds } = await db.query(`SELECT guild_id FROM guild_members WHERE player_id=$1 LIMIT 1`, [req.user!.sub]);
  if (!guilds.length) return res.status(403).json({ error: 'not_in_guild' });
  const guildId = guilds[0].guild_id;
  // Simple claim with upkeep schedule
  const upkeepCost = 100; // demo flat cost
  const dueAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  await db.query(
    `INSERT INTO territories AS t (world_seed, region_id, guild_id, claimed_at, upkeep_cost, upkeep_due_at)
     VALUES ($1, $2, $3, now(), $4, $5)
     ON CONFLICT (world_seed, region_id) DO UPDATE
       SET guild_id = COALESCE(t.guild_id, EXCLUDED.guild_id),
           claimed_at = COALESCE(t.claimed_at, EXCLUDED.claimed_at),
           upkeep_cost = EXCLUDED.upkeep_cost,
           upkeep_due_at = EXCLUDED.upkeep_due_at`,
    [seed, regionId, guildId, upkeepCost, dueAt]
  );
  await db.query(`INSERT INTO territory_claim_logs (world_seed, region_id, guild_id, actor_id, action, details) VALUES ($1, $2, $3, $4, 'claim', '{}'::jsonb)`, [seed, regionId, guildId, req.user!.sub]);
  res.json({ ok: true, guildId, regionId });
});

router.post('/worlds/:seed/territory/:regionId/pay-upkeep', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { seed, regionId } = req.params;
  const { rows: gRows } = await db.query(`SELECT guild_id FROM guild_members WHERE player_id=$1 LIMIT 1`, [req.user!.sub]);
  if (!gRows.length) return res.status(403).json({ error: 'not_in_guild' });
  const guildId = gRows[0].guild_id;
  const { rows } = await db.query(`SELECT upkeep_cost FROM territories WHERE world_seed=$1 AND region_id=$2`, [seed, regionId]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  const cost = Number(rows[0].upkeep_cost || 0);
  const { debitGuild } = await import('../services/economy.js');
  try {
    await debitGuild(guildId, cost, 'territory_upkeep', `${seed}:${regionId}`);
  } catch {
    return res.status(400).json({ error: 'insufficient_guild_funds' });
  }
  const dueAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  await db.query(`UPDATE territories SET upkeep_due_at=$3, decayed=false WHERE world_seed=$1 AND region_id=$2`, [seed, regionId, dueAt]);
  res.json({ ok: true, nextDueAt: dueAt });
});

export default router;
