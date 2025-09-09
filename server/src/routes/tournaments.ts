import { Router } from 'express';
import { getDb } from '../services/db.js';
import { verifyAccess } from '../middleware/auth.js';
import { randomUUID } from 'crypto';

const router = Router();
const db = getDb();

router.post('/tournaments', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { name, seed } = req.body || {};
  const id = randomUUID().replace(/-/g, '');
  await db.query(`INSERT INTO tournaments (id, name, world_seed, status) VALUES ($1, $2, $3, 'draft')`, [id, name || 'Tournament', seed || null]);
  res.json({ id, name: name || 'Tournament' });
});

router.post('/tournaments/:id/participants', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { id } = req.params;
  const { participants } = req.body || {};
  if (!Array.isArray(participants) || participants.length < 2) return res.status(400).json({ error: 'need_participants' });
  for (const p of participants) {
    await db.query(`INSERT INTO tournament_participants (tournament_id, user_id, seed_rank) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [id, p.userId, p.seedRank || 0]);
  }
  res.json({ ok: true });
});

router.post('/tournaments/:id/start', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { id } = req.params;
  const { rows } = await db.query(`SELECT user_id, seed_rank FROM tournament_participants WHERE tournament_id=$1 ORDER BY seed_rank ASC`, [id]);
  if (rows.length < 2) return res.status(400).json({ error: 'need_participants' });
  // Create first-round matches pairing 1-2, 3-4, etc.
  let round = 1;
  for (let i = 0; i < rows.length; i += 2) {
    const a = rows[i]?.user_id || null;
    const b = rows[i + 1]?.user_id || null;
    const mid = randomUUID().replace(/-/g, '');
    await db.query(`INSERT INTO tournament_matches (id, tournament_id, round, player_a, player_b) VALUES ($1, $2, $3, $4, $5)`, [mid, id, round, a, b]);
  }
  await db.query(`UPDATE tournaments SET status='active' WHERE id=$1`, [id]);
  res.json({ ok: true });
});

router.post('/tournaments/:id/report', verifyAccess, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { id } = req.params;
  const { matchId, winner } = req.body || {};
  if (!matchId || !winner) return res.status(400).json({ error: 'bad_request' });
  await db.query(`UPDATE tournament_matches SET winner=$2 WHERE id=$1`, [matchId, winner]);
  res.json({ ok: true });
});

router.get('/tournaments/:id/bracket', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'db_unavailable' });
  const { id } = req.params;
  const { rows: matches } = await db.query(`SELECT id, round, player_a, player_b, winner FROM tournament_matches WHERE tournament_id=$1 ORDER BY round ASC, id ASC`, [id]);
  res.json({ id, matches });
});

export default router;

