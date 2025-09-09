import { Router } from 'express';
import { verifyAccess } from '../middleware/auth.js';
import { getDb } from '../services/db.js';
import { randomUUID } from 'crypto';

const router = Router();
const db = getDb();

router.post('/guilds', verifyAccess, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'db_unavailable' });
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'missing_name' });
    const id = cryptoRandomId();
    await db.query(
      `INSERT INTO guilds (id, name, leader_id, description) VALUES ($1, $2, $3, $4)`,
      [id, name, req.user!.sub, description || null]
    );
    await db.query(
      `INSERT INTO guild_members (guild_id, player_id, role) VALUES ($1, $2, 'leader') ON CONFLICT DO NOTHING`,
      [id, req.user!.sub]
    );
    return res.json({ id, name, description });
  } catch (e) {
    return res.status(500).json({ error: 'guild_create_failed' });
  }
});

router.post('/guilds/:id/invite', verifyAccess, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'db_unavailable' });
    const { id } = req.params;
    const { playerId } = req.body || {};
    if (!playerId) return res.status(400).json({ error: 'missing_playerId' });
    await db.query(
      `INSERT INTO guild_invites (guild_id, player_id, inviter_id, status) VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (guild_id, player_id) DO UPDATE SET status='pending'`,
      [id, playerId, req.user!.sub]
    );
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'guild_invite_failed' });
  }
});

router.post('/guilds/:id/join', verifyAccess, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'db_unavailable' });
    const { id } = req.params;
    await db.query(
      `INSERT INTO guild_members (guild_id, player_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
      [id, req.user!.sub]
    );
    await db.query(`DELETE FROM guild_invites WHERE guild_id=$1 AND player_id=$2`, [id, req.user!.sub]);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'guild_join_failed' });
  }
});

router.post('/guilds/:id/leave', verifyAccess, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'db_unavailable' });
    const { id } = req.params;
    await db.query(`DELETE FROM guild_members WHERE guild_id=$1 AND player_id=$2`, [id, req.user!.sub]);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'guild_leave_failed' });
  }
});

function cryptoRandomId() { return randomUUID().replace(/-/g, ''); }

export default router;
