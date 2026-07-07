import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { authRateLimit } from '../../middleware/rateLimit';
import { setSession, clearSession } from '../../lib/session';
import { HttpError } from '../../lib/errors';
import { USERNAME_MESSAGE, USERNAME_PATTERN } from '../../lib/username';
import { AVATAR_MESSAGE, isValidAvatar } from '../../lib/avatar';
import * as authService from './auth.service';

export const authRoutes = Router();

const emailPassword = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const signupBody = emailPassword.extend({
  displayName: z.string().regex(USERNAME_PATTERN, USERNAME_MESSAGE),
  teamId: z.string().uuid('Pick a club to continue'),
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
      parsed.data.teamId
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

// Both fields optional but at least one required; avatar null clears the
// preset back to the initials fallback.
const profileBody = z
  .object({
    displayName: z.string().regex(USERNAME_PATTERN, USERNAME_MESSAGE).optional(),
    avatar: z
      .union([z.string().refine(isValidAvatar, AVATAR_MESSAGE), z.null()])
      .optional(),
  })
  .refine((body) => body.displayName !== undefined || body.avatar !== undefined, {
    message: 'Nothing to update',
  });

authRoutes.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = profileBody.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid profile update');
    }
    const user = await authService.updateProfile(req.userId!, parsed.data);
    res.json({ user });
  })
);

const passwordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

authRoutes.patch(
  '/me/password',
  requireAuth,
  authRateLimit,
  asyncHandler(async (req, res) => {
    const parsed = passwordBody.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid password');
    }
    await authService.changePassword(req.userId!, parsed.data.currentPassword, parsed.data.newPassword);
    res.json({ ok: true });
  })
);
