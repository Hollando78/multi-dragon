import { Router } from 'express';
import { getDb } from '../services/db.js';
import { verifyAccess } from '../middleware/auth.js';

const router = Router();
const db = getDb();

router.get('/profiles/:userId', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { userId } = req.params;
  const { rows } = await db.query(`SELECT user_id, character_name, colour, level, experience FROM players WHERE user_id=$1`, [userId]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

router.patch('/profiles/me', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { character_name, colour } = req.body || {};
  await db.query(
    `INSERT INTO players (user_id, character_name, colour) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET character_name = COALESCE($2, players.character_name), colour = COALESCE($3, players.colour), last_active = now()`,
    [req.user!.sub, character_name || null, colour || null]
  );
  res.json({ ok: true });
});

export default router;

