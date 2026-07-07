import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { HttpError } from '../../lib/errors';
import { USERNAME_MESSAGE, USERNAME_PATTERN } from '../../lib/username';
import * as adminUsers from './adminUsers.service';

export const adminUsersRoutes = Router();

adminUsersRoutes.use(requireAuth);
adminUsersRoutes.use(asyncHandler(requireAdmin));

// GET /api/admin/users — full account list for the Players tab.
adminUsersRoutes.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await adminUsers.listUsers();
    res.json({ users });
  })
);

const usernameBody = z.object({
  displayName: z.string().regex(USERNAME_PATTERN, USERNAME_MESSAGE),
});

// PATCH /api/admin/users/:id — fix a username (typos/moderation).
adminUsersRoutes.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success) {
      throw new HttpError(400, 'Invalid user id');
    }
    const parsed = usernameBody.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid username');
    }
    const user = await adminUsers.updateUsername(req.params.id, parsed.data.displayName);
    res.json({ user });
  })
);

const statusBody = z.object({ is_active: z.boolean() });

// PATCH /api/admin/users/:id/status — deactivate/reactivate (soft, not a delete).
adminUsersRoutes.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success) {
      throw new HttpError(400, 'Invalid user id');
    }
    const parsed = statusBody.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid status — expected { is_active: boolean }');
    }
    const user = await adminUsers.setActive(req.params.id, req.userId!, parsed.data.is_active);
    res.json({ user });
  })
);
