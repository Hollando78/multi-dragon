import { Router } from 'express';
import { verifyAccess } from '../middleware/auth.js';
import { getDb } from '../services/db.js';

const router = Router();
const db = getDb();

// Minimal offline -> online import endpoint
router.post('/offline/import', verifyAccess, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'db_unavailable' });
    const { dragons = [], inventory = [], worldSeed = 'alpha' } = req.body || {};
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      for (const d of dragons) {
        const exists = await client.query(`SELECT owner_id FROM dragons WHERE id=$1`, [d.id]);
        if (exists.rowCount && exists.rows[0].owner_id && exists.rows[0].owner_id !== req.user!.sub) {
          await client.query(`INSERT INTO offline_import_conflicts (user_id, type, external_id, details) VALUES ($1, 'dragon', $2, $3)`, [req.user!.sub, d.id, JSON.stringify({ existingOwner: exists.rows[0].owner_id })]);
          continue;
        }
        await client.query(
          `INSERT INTO dragons (id, owner_id, world_seed, species, name, level, stats, bond, personality)
           VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::jsonb,'{}'::jsonb), COALESCE($8,0), $9)
           ON CONFLICT (id) DO NOTHING`,
          [d.id, req.user!.sub, worldSeed, d.species, d.name || null, d.level || 1, JSON.stringify(d.stats || {}), d.bond || 0, d.personality || null]
        );
      }
      for (const it of inventory) {
        await client.query(
          `INSERT INTO player_inventories (player_id, item_id, quantity)
           VALUES ($1, $2, $3)
           ON CONFLICT (player_id, item_id) DO UPDATE SET quantity = player_inventories.quantity + EXCLUDED.quantity`,
          [req.user!.sub, it.itemId || it.id, it.quantity || it.qty || 0]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'import_failed' });
  }
});

export default router;
