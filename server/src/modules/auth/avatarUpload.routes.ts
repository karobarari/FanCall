import { Router, json } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';
import { HttpError } from '../../lib/errors';
import { saveAvatarUpload, deleteAvatarUpload } from '../../lib/avatarUpload';
import * as authService from './auth.service';

export const avatarUploadRoutes = Router();

// Mounted in app.ts at /api/auth/me/avatar, BEFORE the global express.json()
// — that parser defaults to a 100kb limit, too small for a base64-encoded
// photo, and raising it globally would let every JSON route on the app
// accept oversized bodies. This route gets its own bigger limit instead,
// same "dedicated parser mounted early" pattern as the Stripe webhook route.
//
// The upload itself travels as a base64 data URL inside a JSON body, not
// multipart/form-data, specifically so this route still satisfies app.ts's
// documented CSRF invariant: every mutating route requires an
// application/json body, which a plain HTML-form CSRF attempt can't produce.
avatarUploadRoutes.post(
  '/',
  requireAuth,
  json({ limit: '4mb' }),
  asyncHandler(async (req, res) => {
    const { image } = req.body as { image?: unknown };
    if (typeof image !== 'string') throw new HttpError(400, 'Missing image');
    const avatarUrl = saveAvatarUpload(req.userId!, image);
    const user = await authService.setAvatarUrl(req.userId!, avatarUrl);
    res.json({ user });
  })
);

avatarUploadRoutes.delete(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    deleteAvatarUpload(req.userId!);
    const user = await authService.setAvatarUrl(req.userId!, null);
    res.json({ user });
  })
);
