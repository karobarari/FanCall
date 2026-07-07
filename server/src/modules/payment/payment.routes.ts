import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { HttpError } from '../../lib/errors';
import { pool } from '../../db/pool';
import { env } from '../../config/env';
import { markPaid, redeemCode } from './payment.service';
import { getClubPlans } from '../billing/clubPlans.service';
import { createCheckoutSession, resolvePlatformFeeBps } from './stripe.service';

export const paymentRoutes = Router();

paymentRoutes.use(requireAuth);

// Demo-only "checkout" — no real charge. Kept alongside real Stripe
// checkout (not removed) so the app's core loop (signup -> pay -> predict)
// stays exercisable without a live Stripe account — see payment.service.ts's
// markPaid() for how this coexists with real entitlements.
paymentRoutes.post(
  '/pay',
  asyncHandler(async (req, res) => {
    const user = await markPaid(req.userId!);
    res.json({ user });
  })
);

// GET /api/payment/plans — the signed-in fan's own club's active pricing
// (direct/subscription only; the season-ticket channel is never listed
// here, it's redeemed via a code instead). Deliberately not admin-gated,
// unlike GET /api/admin/clubs/:teamId/plans — a fan only ever needs to see
// their own club's plans, never another club's.
paymentRoutes.get(
  '/plans',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query<{ team_id: string }>('select team_id from users where id = $1', [
      req.userId,
    ]);
    if (!rows[0]) throw new HttpError(401, 'Not authenticated');

    const plans = (await getClubPlans(rows[0].team_id)).filter(
      (p) => p.active && (p.channel === 'direct' || p.channel === 'subscription')
    );
    res.json({ plans });
  })
);

const checkoutBody = z.object({
  channel: z.enum(['direct', 'subscription']),
});

// POST /api/payment/checkout — real Stripe Checkout for the two
// generically-buildable channels. The season-ticket add-on channel isn't
// here (see /redeem below) — it never goes through Stripe.
paymentRoutes.post(
  '/checkout',
  asyncHandler(async (req, res) => {
    const parsed = checkoutBody.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid channel — expected "direct" or "subscription"');
    }

    const { rows } = await pool.query<{
      team_id: string;
      email: string;
      stripe_account_id: string | null;
      platform_fee_bps: number | null;
    }>(
      `select u.team_id, u.email, t.stripe_account_id, t.platform_fee_bps
         from users u
         join teams t on t.id = u.team_id
        where u.id = $1`,
      [req.userId]
    );
    const caller = rows[0];
    if (!caller) throw new HttpError(401, 'Not authenticated');
    if (!caller.stripe_account_id) {
      throw new HttpError(409, "Your club hasn't connected their Stripe account yet");
    }

    const plans = await getClubPlans(caller.team_id);
    const plan = plans.find((p) => p.channel === parsed.data.channel && p.active);
    if (!plan || !plan.stripe_price_id) {
      throw new HttpError(409, 'Your club has not configured that pricing option yet');
    }

    const { url } = await createCheckoutSession({
      userId: req.userId!,
      userEmail: caller.email,
      teamId: caller.team_id,
      stripeAccountId: caller.stripe_account_id,
      channel: parsed.data.channel,
      priceId: plan.stripe_price_id,
      pricePence: plan.price_pence,
      platformFeeBps: resolvePlatformFeeBps(caller.platform_fee_bps),
      successUrl: `${env.CLIENT_ORIGIN}/payment/success`,
      cancelUrl: `${env.CLIENT_ORIGIN}/payment`,
    });
    res.json({ url });
  })
);

const redeemBody = z.object({ code: z.string().min(1) });

// POST /api/payment/redeem — the season-ticket add-on channel: a code a
// club's box office issued outside Stripe entirely.
paymentRoutes.post(
  '/redeem',
  asyncHandler(async (req, res) => {
    const parsed = redeemBody.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Invalid code');

    const { rows } = await pool.query<{ team_id: string }>('select team_id from users where id = $1', [
      req.userId,
    ]);
    if (!rows[0]) throw new HttpError(401, 'Not authenticated');

    await redeemCode(req.userId!, rows[0].team_id, parsed.data.code);
    res.json({ ok: true });
  })
);
