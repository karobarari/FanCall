import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { HttpError } from '../../lib/errors';
import { getTeamById } from '../teams/teams.service';
import { getClubPlans, upsertClubPlan } from './clubPlans.service';

export const clubPlansRoutes = Router();

clubPlansRoutes.use(requireAuth);
clubPlansRoutes.use(asyncHandler(requireAdmin));

// GET /api/admin/clubs/:teamId/plans — a club's configured pricing channels.
clubPlansRoutes.get(
  '/:teamId/plans',
  asyncHandler(async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.teamId).success) {
      throw new HttpError(400, 'Invalid team id');
    }
    const team = await getTeamById(req.params.teamId);
    if (!team) throw new HttpError(404, 'Team not found');

    const plans = await getClubPlans(req.params.teamId);
    res.json({ plans });
  })
);

const planBody = z.object({
  channel: z.enum(['season_ticket_addon', 'direct', 'subscription']),
  price_pence: z.number().int().min(0),
  billing_interval: z.enum(['one_time', 'monthly']),
  currency: z.string().length(3).optional(),
  active: z.boolean().optional(),
});

// PUT /api/admin/clubs/:teamId/plans — set/update one channel's pricing.
clubPlansRoutes.put(
  '/:teamId/plans',
  asyncHandler(async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.teamId).success) {
      throw new HttpError(400, 'Invalid team id');
    }
    const team = await getTeamById(req.params.teamId);
    if (!team) throw new HttpError(404, 'Team not found');

    const parsed = planBody.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid plan');
    }

    const plan = await upsertClubPlan(req.params.teamId, parsed.data);
    res.json({ plan });
  })
);
