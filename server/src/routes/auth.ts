import { Router } from 'express';
import { rotateRefresh } from '../middleware/auth.js';

const router = Router();

router.post('/auth/refresh', rotateRefresh);

export default router;

