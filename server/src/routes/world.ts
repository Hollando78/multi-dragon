import { Router } from 'express';
import crypto from 'crypto';
import { manifestForSeed } from '../services/worldManifest.js';

const router = Router();

// Placeholder manifest; in Phase 2 this will be deterministic inputs
router.get('/worlds/:seed/manifest', (req, res) => {
  const { seed } = req.params;
  const compact = 'compact' in (req.query || {});
  const manifest = manifestForSeed(seed);
  if (!compact) {
    return res.json(manifest);
  }
  // Provide a lighter payload for mobile/slow links by omitting heightMap
  const world = manifest.world || {};
  const { heightMap, ...restWorld } = world as any;
  return res.json({ ...manifest, world: restWorld });
});

export default router;
