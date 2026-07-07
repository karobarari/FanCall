import type Stripe from 'stripe';
import { pool } from '../../db/pool';
import { HttpError } from '../../lib/errors';
import type { PublicUser } from '../auth/auth.service';
import type { PlanChannel } from '../billing/clubPlans.service';

type EntitlementChannel = PlanChannel | 'demo';
type EntitlementSource = 'stripe_checkout' | 'stripe_subscription' | 'redemption_code' | 'club_webhook' | 'demo';

// The primitive every grant path (demo, redemption code, Stripe webhook)
// goes through. entitlements is the source of truth requireEntitled checks;
// users.paid stays a denormalized "any entitlement active" flag kept in
// sync here, cheap to read on /me without a join — same coexistence
// pattern as users.is_active + requireActive.
export async function grantEntitlement(
  userId: string,
  teamId: string,
  channel: EntitlementChannel,
  source: EntitlementSource,
  expiresAt: Date | null
): Promise<void> {
  await pool.query(
    `insert into entitlements (user_id, team_id, channel, source, expires_at, active)
     values ($1, $2, $3, $4, $5, true)
     on conflict (user_id, team_id) do update
       set channel = excluded.channel,
           source = excluded.source,
           expires_at = excluded.expires_at,
           active = true`,
    [userId, teamId, channel, source, expiresAt]
  );
  await pool.query('update users set paid = true where id = $1', [userId]);
}

export async function revokeEntitlement(userId: string, teamId: string): Promise<void> {
  await pool.query('update entitlements set active = false where user_id = $1 and team_id = $2', [
    userId,
    teamId,
  ]);
  await pool.query('update users set paid = false where id = $1', [userId]);
}

// Demo-only "checkout" — no real charge. Predates Stripe Connect and is
// kept alongside it (rather than removed) so the app's core loop
// (signup -> pay -> predict) stays exercisable in dev/test without a live
// Stripe account; grants the same entitlements row a real payment would,
// just with channel/source 'demo' so it's clearly distinguishable in the data.
export async function markPaid(userId: string): Promise<PublicUser> {
  const { rows } = await pool.query<PublicUser>(
    `update users u set paid = true
       from teams t
      where u.id = $1 and t.id = u.team_id
      returning u.id, u.email, u.display_name, u.team_id, t.name as team_name, u.paid`,
    [userId]
  );
  if (!rows[0]) throw new HttpError(404, 'User not found');
  await grantEntitlement(userId, rows[0].team_id, 'demo', 'demo', null);
  return rows[0];
}

// Season-ticket add-on channel: a club's box office issues these to
// existing season-ticket holders entirely outside Stripe (roadmap
// "extensibility point, not a generic build" — see redemption_codes'
// migration comment for why). Scoped to the caller's own club so a Man
// City code can't redeem for an Arsenal fan.
export async function redeemCode(userId: string, teamId: string, code: string): Promise<void> {
  const { rows } = await pool.query<{
    id: string;
    team_id: string;
    channel: PlanChannel;
    expires_at: string | null;
    redeemed_at: string | null;
  }>('select id, team_id, channel, expires_at, redeemed_at from redemption_codes where code = $1', [code]);

  const found = rows[0];
  if (!found) throw new HttpError(404, 'Invalid code');
  if (found.redeemed_at) throw new HttpError(409, 'This code has already been used');
  if (found.expires_at && new Date(found.expires_at) < new Date()) {
    throw new HttpError(410, 'This code has expired');
  }
  if (found.team_id !== teamId) throw new HttpError(400, "This code isn't for your club");

  await pool.query('update redemption_codes set redeemed_by = $1, redeemed_at = now() where id = $2', [
    userId,
    found.id,
  ]);
  await grantEntitlement(userId, teamId, found.channel, 'redemption_code', null);
}

// ── Stripe webhook event handlers ───────────────────────────────────────
// Parsed Stripe objects in, plain DB writes out — kept separate from
// webhook.routes.ts (which owns signature verification/dispatch) so these
// can be unit-tested with hand-built fake events, no live Stripe call
// needed.

async function recordPayment(params: {
  userId: string;
  teamId: string;
  channel: 'direct';
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  amountPence: number;
  applicationFeePence: number;
}): Promise<void> {
  await pool.query(
    `insert into payments
       (user_id, team_id, channel, stripe_checkout_session_id, stripe_payment_intent_id, amount_pence, application_fee_pence, status)
     values ($1, $2, $3, $4, $5, $6, $7, 'paid')`,
    [
      params.userId,
      params.teamId,
      params.channel,
      params.stripeCheckoutSessionId,
      params.stripePaymentIntentId,
      params.amountPence,
      params.applicationFeePence,
    ]
  );
}

async function upsertSubscription(params: {
  userId: string;
  teamId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: string;
  currentPeriodEnd: Date;
}): Promise<void> {
  await pool.query(
    `insert into subscriptions (user_id, team_id, stripe_subscription_id, stripe_customer_id, status, current_period_end)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (stripe_subscription_id) do update
       set status = excluded.status,
           current_period_end = excluded.current_period_end,
           updated_at = now()`,
    [params.userId, params.teamId, params.stripeSubscriptionId, params.stripeCustomerId, params.status, params.currentPeriodEnd]
  );
}

// client_reference_id was set to "userId:teamId:channel" when the checkout
// session was created (stripe.service.ts) — decoding it here avoids needing
// to look the user back up by Stripe customer id.
function parseClientReferenceId(ref: string | null): { userId: string; teamId: string; channel: string } | null {
  if (!ref) return null;
  const [userId, teamId, channel] = ref.split(':');
  if (!userId || !teamId || !channel) return null;
  return { userId, teamId, channel };
}

export async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const parsed = parseClientReferenceId(session.client_reference_id);
  if (!parsed) return;
  const { userId, teamId, channel } = parsed;

  if (channel === 'direct') {
    const paymentIntentId =
      typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null);
    const amountPence = session.amount_total ?? 0;
    const feePence =
      typeof session.payment_intent === 'object' && session.payment_intent?.application_fee_amount != null
        ? session.payment_intent.application_fee_amount
        : 0;

    await grantEntitlement(userId, teamId, 'direct', 'stripe_checkout', null);
    await recordPayment({
      userId,
      teamId,
      channel: 'direct',
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      amountPence,
      applicationFeePence: feePence,
    });
  } else if (channel === 'subscription') {
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : (session.subscription?.id ?? null);
    const customerId = typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null);
    if (!subscriptionId || !customerId) return;

    // Checkout completing means the subscription was created successfully;
    // invoice.paid/customer.subscription.updated keep it in sync from here.
    await grantEntitlement(userId, teamId, 'subscription', 'stripe_subscription', null);
    await upsertSubscription({
      userId,
      teamId,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000), // refined by the next invoice.paid
    });
  }
}

export async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId =
    typeof invoice.parent?.subscription_details?.subscription === 'string'
      ? invoice.parent.subscription_details.subscription
      : (invoice.parent?.subscription_details?.subscription?.id ?? null);
  if (!subscriptionId) return;

  const { rows } = await pool.query<{ user_id: string; team_id: string }>(
    'select user_id, team_id from subscriptions where stripe_subscription_id = $1',
    [subscriptionId]
  );
  const sub = rows[0];
  if (!sub) return;

  const periodEnd = invoice.lines.data[0]?.period?.end;
  await pool.query(
    `update subscriptions
        set status = 'active', current_period_end = $2, updated_at = now()
      where stripe_subscription_id = $1`,
    [subscriptionId, periodEnd ? new Date(periodEnd * 1000) : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000)]
  );
  // A renewal succeeding after a prior failed payment should restore access.
  await grantEntitlement(sub.user_id, sub.team_id, 'subscription', 'stripe_subscription', null);
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

export async function handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
  const { rows } = await pool.query<{ user_id: string; team_id: string }>(
    'select user_id, team_id from subscriptions where stripe_subscription_id = $1',
    [subscription.id]
  );
  const sub = rows[0];
  if (!sub) return;

  await pool.query(
    `update subscriptions set status = $2, updated_at = now() where stripe_subscription_id = $1`,
    [subscription.id, subscription.status]
  );

  if (ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    await grantEntitlement(sub.user_id, sub.team_id, 'subscription', 'stripe_subscription', null);
  } else {
    await revokeEntitlement(sub.user_id, sub.team_id);
  }
}
