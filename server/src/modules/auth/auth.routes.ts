import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { authRateLimit } from '../../middleware/rateLimit';
import { setSession, clearSession } from '../../lib/session';
import { HttpError } from '../../lib/errors';
import * as authService from './auth.service';

export const authRoutes = Router();

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(40).optional(),
});

authRoutes.post(
  '/signup',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Need a valid email and a password of at least 8 characters');
    }
    const user = await authService.signup(
      parsed.data.email,
      parsed.data.password,
      parsed.data.displayName
    );
    setSession(res, user.id);
    res.status(201).json({ user });
  })
);

authRoutes.post(
  '/login',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const parsed = credentials.pick({ email: true, password: true }).safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Invalid credentials');
    const user = await authService.login(parsed.data.email, parsed.data.password);
    setSession(res, user.id);
    res.json({ user });
  })
);

authRoutes.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

authRoutes.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.getUser(req.userId!);
    res.json({ user });
  })
);
