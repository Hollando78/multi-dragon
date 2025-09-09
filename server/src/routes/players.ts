import { Router } from 'express';
import { verifyAccess } from '../middleware/auth.js';
import { listOnline } from '../services/presence.js';
import { getDb } from '../services/db.js';

const router = Router();
const db = getDb();

router.get('/worlds/:seed/online', async (req, res) => {
  const { seed } = req.params;
  const ids = await listOnline(seed);
  res.json({ seed, count: ids.length, users: ids });
});

router.get('/me', verifyAccess, async (req, res) => {
  res.json({ userId: req.user!.sub, name: req.user!.name || null });
});

router.get('/friends', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { rows } = await db.query(
    `SELECT CASE WHEN a.user_id = $1 THEN a.friend_id ELSE a.user_id END AS friend_id, a.created_at
     FROM friends a WHERE a.user_id = $1 OR a.friend_id = $1`,
    [req.user!.sub]
  );
  res.json({ friends: rows });
});

router.post('/friends/:playerId', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const friendId = req.params.playerId;
  await db.query(
    `INSERT INTO friends (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.user!.sub, friendId]
  );
  res.json({ ok: true });
});

router.delete('/friends/:playerId', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const friendId = req.params.playerId;
  await db.query(`DELETE FROM friends WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)`, [req.user!.sub, friendId]);
  res.json({ ok: true });
});

export default router;

