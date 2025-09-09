import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface AuthPayload {
  sub: string; // userId
  name?: string;
  iat?: number;
  exp?: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthPayload;
  }
}

export function issueTokens(user: { id: string; name?: string }) {
  const access = jwt.sign({ sub: user.id, name: user.name }, config.jwt.accessSecret, { expiresIn: config.jwt.accessTtlSec });
  const refresh = jwt.sign({ sub: user.id }, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshTtlSec });
  return { access, refresh };
}

export function verifyAccess(req: Request, res: Response, next: NextFunction) {
  const header = req.headers['authorization'];
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as AuthPayload;
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

export function rotateRefresh(req: Request, res: Response) {
  const { refresh } = req.body || {};
  if (!refresh) return res.status(400).json({ error: 'missing_refresh' });
  try {
    const payload = jwt.verify(refresh, config.jwt.refreshSecret) as AuthPayload;
    const tokens = issueTokens({ id: payload.sub });
    return res.json(tokens);
  } catch (err) {
    return res.status(401).json({ error: 'invalid_refresh' });
  }
}

