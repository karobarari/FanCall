import { Router, raw } from 'express';
import type Stripe from 'stripe';
import { env } from '../../config/env';
import { getStripeClient } from './stripe.service';
import { handleCheckoutCompleted, handleInvoicePaid, handleSubscriptionChange } from './payment.service';

export const paymentWebhookRoutes = Router();

// Mounted in app.ts BEFORE the global express.json() — signature
// verification needs the exact raw bytes Stripe signed, and once the
// global JSON parser runs those are gone. (Unlike the Apple form-post
// exception in oauth.routes.ts, which works *because* of a differing
// content-type and so can add its own parser after the fact — Stripe's
// payload is itself application/json, so express.json() would otherwise
// intercept it first.)
paymentWebhookRoutes.post('/', raw({ type: 'application/json' }), async (req, res) => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({ error: 'Payments are not configured' });
    return;
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || Array.isArray(signature)) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(req.body as Buffer, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionChange(event.data.object);
        break;
      default:
        // Unhandled event types are expected — Stripe sends far more event
        // types than this integration acts on.
        break;
    }
    res.json({ received: true });
  } catch (err) {
    // Surfacing 500 here makes Stripe retry the webhook later rather than
    // silently losing the event.
    console.error('Stripe webhook handler failed:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});
