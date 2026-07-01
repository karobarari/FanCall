import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { authRateLimit } from '../../middleware/rateLimit';
import { setSession, clearSession } from '../../lib/session';
import { HttpError } from '../../lib/errors';
import { USERNAME_MESSAGE, USERNAME_PATTERN } from '../../lib/username';
import * as authService from './auth.service';

export const authRoutes = Router();

const emailPassword = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const signupBody = emailPassword.extend({
  displayName: z.string().regex(USERNAME_PATTERN, USERNAME_MESSAGE),
  team_id: z.string().uuid(),
});

authRoutes.post(
  '/signup',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const parsed = signupBody.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid signup');
    }
    const user = await authService.signup(
      parsed.data.email,
      parsed.data.password,
      parsed.data.displayName,
      parsed.data.team_id
    );
    setSession(res, user.id);
    res.status(201).json({ user });
  })
);

authRoutes.post(
  '/login',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const parsed = emailPassword.safeParse(req.body);
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
