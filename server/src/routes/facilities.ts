import { Router } from 'express';
import { verifyAccess } from '../middleware/auth.js';
import { getDb } from '../services/db.js';
import { randomUUID } from 'crypto';

const router = Router();
const db = getDb();

router.post('/worlds/:seed/facilities/build', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { seed } = req.params;
  const { regionId, type } = req.body || {};
  if (!regionId || !type) return res.status(400).json({ error: 'bad_request' });
  const { rows: guilds } = await db.query(`SELECT guild_id FROM guild_members WHERE player_id=$1 LIMIT 1`, [req.user!.sub]);
  if (!guilds.length) return res.status(403).json({ error: 'not_in_guild' });
  const guildId = guilds[0].guild_id;
  // Verify territory ownership
  const { rows: terr } = await db.query(`SELECT guild_id FROM territories WHERE world_seed=$1 AND region_id=$2`, [seed, regionId]);
  if (!terr.length || terr[0].guild_id !== guildId) return res.status(403).json({ error: 'not_owner' });
  const id = randomUUID().replace(/-/g, '');
  await db.query(`INSERT INTO guild_facilities (id, guild_id, world_seed, region_id, type, level) VALUES ($1, $2, $3, $4, $5, 1)`, [id, guildId, seed, regionId, type]);
  res.json({ id, guildId, seed, regionId, type, level: 1 });
});

router.post('/facilities/:id/upgrade', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { id } = req.params;
  // Require that requester is member of owning guild
  const { rows: fac } = await db.query(`SELECT guild_id, level FROM guild_facilities WHERE id=$1`, [id]);
  if (!fac.length) return res.status(404).json({ error: 'not_found' });
  const guildId = fac[0].guild_id;
  const { rows: member } = await db.query(`SELECT 1 FROM guild_members WHERE guild_id=$1 AND player_id=$2`, [guildId, req.user!.sub]);
  if (!member.length) return res.status(403).json({ error: 'not_member' });
  await db.query(`UPDATE guild_facilities SET level = level + 1 WHERE id=$1`, [id]);
  res.json({ ok: true });
});

export default router;

