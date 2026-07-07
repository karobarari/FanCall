import Stripe from 'stripe';
import { env } from '../../config/env';
import { HttpError } from '../../lib/errors';

let client: Stripe | null = null;

// Lazily instantiated so the server can start without Stripe configured —
// only routes that actually need it fail with 503, same pattern as
// lib/oauthProviders.ts's getGoogleProvider()/getAppleProvider().
export function getStripeClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new HttpError(503, 'Payments are not configured');
  }
  if (!client) {
    client = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return client;
}

// A club's own fee override (teams.platform_fee_bps) if set, otherwise the
// platform default (env.DEFAULT_PLATFORM_FEE_BPS, 3000 = 30%).
export function resolvePlatformFeeBps(clubOverrideBps: number | null): number {
  return clubOverrideBps ?? env.DEFAULT_PLATFORM_FEE_BPS;
}

export interface CreateCheckoutSessionInput {
  userId: string;
  userEmail: string;
  teamId: string;
  stripeAccountId: string;
  channel: 'direct' | 'subscription';
  priceId: string; // club_plans.stripe_price_id
  pricePence: number; // club_plans.price_pence — needed to compute the flat fee for a one-time sale
  platformFeeBps: number;
  successUrl: string;
  cancelUrl: string;
}

// Destination charge: the charge is created on RYG's own (platform) account
// with transfer_data.destination pointing at the club's connected account,
// so RYG stays merchant-of-record for the checkout UX across every club,
// while the club's share of the money moves automatically — no manual
// payout/reconciliation step for the direct/subscription channels.
export async function createCheckoutSession(input: CreateCheckoutSessionInput): Promise<{ url: string }> {
  const stripe = getStripeClient();

  const modeParams: Stripe.Checkout.SessionCreateParams =
    input.channel === 'subscription'
      ? {
          mode: 'subscription',
          subscription_data: {
            application_fee_percent: input.platformFeeBps / 100,
            transfer_data: { destination: input.stripeAccountId },
          },
        }
      : {
          mode: 'payment',
          payment_intent_data: {
            application_fee_amount: Math.round((input.pricePence * input.platformFeeBps) / 10000),
            transfer_data: { destination: input.stripeAccountId },
          },
        };

  const session = await stripe.checkout.sessions.create({
    ...modeParams,
    line_items: [{ price: input.priceId, quantity: 1 }],
    customer_email: input.userEmail,
    // Encodes who to grant entitlement to once the webhook confirms
    // payment — avoids needing to look the user back up by Stripe customer
    // id at that point.
    client_reference_id: `${input.userId}:${input.teamId}:${input.channel}`,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });

  if (!session.url) throw new HttpError(500, 'Stripe did not return a checkout URL');
  return { url: session.url };
}

// Stripe Connect Standard onboarding: the club clicks through Stripe's own
// hosted flow and links their existing (or new) Stripe account — RYG never
// touches their sensitive data. authorizeUrl() is pure URL construction, no
// network call, so this works even before any club has actually connected.
export function getConnectAuthorizeUrl(state: string): string {
  if (!env.STRIPE_CONNECT_CLIENT_ID) {
    throw new HttpError(503, 'Stripe Connect is not configured');
  }
  const stripe = getStripeClient();
  return stripe.oauth.authorizeUrl(
    {
      client_id: env.STRIPE_CONNECT_CLIENT_ID,
      response_type: 'code',
      scope: 'read_write',
      state,
    },
    { express: false }
  );
}

// The OAuth callback's token exchange — a real network call to Stripe, so
// this can only be exercised against a live (test-mode is fine) account.
export async function exchangeConnectCode(code: string): Promise<{ stripeAccountId: string }> {
  const stripe = getStripeClient();
  const token = await stripe.oauth.token({ grant_type: 'authorization_code', code });
  if (!token.stripe_user_id) throw new HttpError(502, "Stripe didn't return a connected account id");
  return { stripeAccountId: token.stripe_user_id };
}
