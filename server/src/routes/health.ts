import { Router } from 'express';

const router = Router();

router.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

router.get('/readyz', (_req, res) => {
  // In the future, check DB/Redis readiness
  res.json({ status: 'ready' });
});

export default router;

