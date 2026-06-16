import type { Request, Response, NextFunction } from 'express';
import { SESSION_COOKIE } from '../lib/session';
import { verifyToken } from '../lib/jwt';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.userId = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid session' });
  }
}
