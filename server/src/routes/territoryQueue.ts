import { Router } from 'express';
import { verifyAccess } from '../middleware/auth.js';
import { enqueueTerritory } from '../services/territoryQueue.js';

const router = Router();

router.post('/worlds/:seed/territory/:regionId/queue', verifyAccess, async (req, res) => {
  const { seed, regionId } = req.params;
  const { role } = req.body || {};
  if (role !== 'attacker' && role !== 'defender') return res.status(400).json({ error: 'bad_role' });
  await enqueueTerritory(seed, regionId, req.user!.sub, role);
  res.json({ ok: true });
});

export default router;

