import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { HttpError } from '../../lib/errors';
import { pool } from '../../db/pool';
import { getTeamById } from '../teams/teams.service';
import { getConnectAuthorizeUrl, exchangeConnectCode } from '../payment/stripe.service';

export const clubOnboardingRoutes = Router();

// GET /api/admin/clubs/connect/callback?code=...&state=<teamId> — Stripe
// redirects the CLUB's own browser here after they approve the connection,
// so this is deliberately public (not gated on a FanCall admin session —
// the club rep completing Stripe's flow isn't logged into FanCall at all).
// The security boundary is Stripe's own one-time `code`, not this route's auth.
clubOnboardingRoutes.get(
  '/connect/callback',
  asyncHandler(async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const teamId = typeof req.query.state === 'string' ? req.query.state : undefined;
    if (!code || !teamId) throw new HttpError(400, 'Missing code or state');
    if (!z.string().uuid().safeParse(teamId).success) throw new HttpError(400, 'Invalid state');

    const team = await getTeamById(teamId);
    if (!team) throw new HttpError(404, 'Team not found');

    const { stripeAccountId } = await exchangeConnectCode(code);
    await pool.query(`update teams set stripe_account_id = $1, stripe_connect_status = 'active' where id = $2`, [
      stripeAccountId,
      teamId,
    ]);
    res.json({ team_id: teamId, stripe_account_id: stripeAccountId, status: 'active' });
  })
);

// GET /api/admin/clubs/:teamId/connect-link — an admin generates this URL
// and sends it to the club so they can click through Stripe's own hosted
// Connect Standard onboarding. Admin-only: only FanCall admins should be
// able to mint these.
clubOnboardingRoutes.get(
  '/:teamId/connect-link',
  requireAuth,
  asyncHandler(requireAdmin),
  asyncHandler(async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.teamId).success) {
      throw new HttpError(400, 'Invalid team id');
    }
    const team = await getTeamById(req.params.teamId);
    if (!team) throw new HttpError(404, 'Team not found');

    const url = getConnectAuthorizeUrl(req.params.teamId);
    res.json({ url });
  })
);
