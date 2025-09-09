import { Router } from 'express';
import { getDb } from '../services/db.js';
import { verifyAccess } from '../middleware/auth.js';
import { randomUUID } from 'crypto';

const router = Router();
const db = getDb();

router.post('/worlds/:seed/races/track', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { seed } = req.params;
  const { name, checkpoints } = req.body || {};
  if (!name || !Array.isArray(checkpoints)) return res.status(400).json({ error: 'bad_request' });
  const id = randomUUID().replace(/-/g, '');
  await db.query(`INSERT INTO race_tracks (id, world_seed, name, checkpoints) VALUES ($1, $2, $3, $4)`, [id, seed, name, JSON.stringify(checkpoints)]);
  res.json({ id, seed, name });
});

router.get('/worlds/:seed/races/tracks', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { seed } = req.params;
  const { rows } = await db.query(`SELECT id, name, checkpoints FROM race_tracks WHERE world_seed=$1`, [seed]);
  res.json({ seed, tracks: rows });
});

router.post('/races/:trackId/submit', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { trackId } = req.params;
  const { timeMs, maxSpeed, teleportCount } = req.body || {};
  if (!Number.isFinite(timeMs) || timeMs <= 0) return res.status(400).json({ error: 'bad_time' });
  // Anti-cheat thresholds (basic)
  const MIN_TIME_MS = 5000; // 5s minimum demo
  if (timeMs < MIN_TIME_MS) return res.status(400).json({ error: 'too_fast', min: MIN_TIME_MS });
  const flags: any = {};
  if (Number.isFinite(maxSpeed) && maxSpeed > 1000) flags.maxSpeed = maxSpeed;
  if (Number.isFinite(teleportCount) && teleportCount > 0) flags.teleports = teleportCount;
  await db.query(`INSERT INTO race_results (track_id, user_id, time_ms, flags) VALUES ($1, $2, $3, $4)`, [trackId, req.user!.sub, timeMs, JSON.stringify(flags)]);
  res.json({ ok: true, flags });
});

router.get('/races/:trackId/leaderboard', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { trackId } = req.params;
  const sinceDays = Number((req.query.sinceDays as string) || '0');
  let q = `SELECT user_id, time_ms, created_at FROM race_results WHERE track_id=$1`;
  const params: any[] = [trackId];
  if (sinceDays > 0) { q += ` AND created_at >= now() - ($2::int || ' days')::interval`; params.push(sinceDays); }
  q += ` ORDER BY time_ms ASC, created_at ASC LIMIT 50`;
  const { rows } = await db.query(q, params);
  res.json({ trackId, leaderboard: rows, windowDays: sinceDays || null });
});

export default router;
