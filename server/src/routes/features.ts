import { Router } from 'express';
import { getFlags, loadFlagsFromEnv } from '../services/flags.js';

const router = Router();

router.get('/features', (_req, res) => {
  loadFlagsFromEnv();
  res.json(getFlags());
});

export default router;

