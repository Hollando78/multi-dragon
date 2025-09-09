import { Router } from 'express';
import crypto from 'crypto';
import { manifestForSeed } from '../services/worldManifest.js';

const router = Router();

// Placeholder manifest; in Phase 2 this will be deterministic inputs
router.get('/worlds/:seed/manifest', (req, res) => {
  const { seed } = req.params;
  res.json(manifestForSeed(seed));
});

export default router;
