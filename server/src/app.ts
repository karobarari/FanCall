import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from './config/env';
import { authRoutes } from './modules/auth/auth.routes';
import { oauthRoutes } from './modules/auth/oauth.routes';
import { fixturesRoutes } from './modules/fixtures/fixtures.routes';
import { predictionsRoutes } from './modules/predictions/predictions.routes';
import { leaderboardRoutes } from './modules/leaderboard/leaderboard.routes';
import { teamsRoutes } from './modules/teams/teams.routes';
import { paymentRoutes } from './modules/payment/payment.routes';
import { paymentWebhookRoutes } from './modules/payment/webhook.routes';
import { adminUsersRoutes } from './modules/admin/adminUsers.routes';
import { clubPlansRoutes } from './modules/billing/clubPlans.routes';
import { clubOnboardingRoutes } from './modules/admin/clubOnboarding.routes';
import { notFound, errorHandler } from './middleware/error';

export function createApp() {
  const app = express();

  app.use(helmet());
  // credentials: true is required for the session cookie to flow to the frontend.
  //
  // CSRF note: the session cookie is sameSite: 'none' in prod (see session.ts),
  // which lets browsers attach it to cross-site requests. That's only safe
  // because of two things held together here: origin is a single fixed string
  // (not reflected/wildcarded), and every mutating route requires a JSON body
  // via express.json() below. JSON is a non-simple content type, so cross-origin
  // JSON requests need a CORS preflight, which this strict origin blocks; a
  // plain HTML-form CSRF can't set that content type, so express.json() leaves
  // req.body empty and validation rejects it. If CORS is ever widened to
  // multiple origins, or a urlencoded/multipart body parser is added for
  // application routes, this protection silently breaks — add real CSRF
  // tokens at that point.
  //
  // One deliberate, narrow exception: POST /api/auth/apple/callback attaches
  // its own urlencoded() parser (Apple's Sign in flow requires form_post).
  // That route is still safe without this JSON-only property because it
  // doesn't trust the posted form body directly — it checks a state cookie
  // set moments earlier by us, then exchanges Apple's one-time `code` for
  // tokens server-to-server; a forged form post can't supply a code that
  // exchanges successfully. See oauth.routes.ts for the full reasoning.
  //
  // A second, different exception: POST /api/payment/webhook is mounted
  // below with its own raw-body parser, BEFORE express.json() — Stripe's
  // payload is itself application/json (unlike Apple's form-post), so it
  // has to come first or express.json() would consume the raw bytes
  // signature verification needs. This route also isn't cookie-authenticated
  // at all — Stripe calls it server-to-server, and the signature check
  // *is* the auth, so the CSRF reasoning above doesn't apply to it.
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use('/api/payment/webhook', paymentWebhookRoutes);
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/auth', oauthRoutes);
  app.use('/api/fixtures', fixturesRoutes);
  app.use('/api/predictions', predictionsRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/teams', teamsRoutes);
  app.use('/api/payment', paymentRoutes);
  app.use('/api/admin/users', adminUsersRoutes);
  // clubOnboardingRoutes first: its /connect/callback route is deliberately
  // public (Stripe redirects the club's own browser there, not a FanCall
  // admin session — see that file for why), and clubPlansRoutes has a
  // blanket requireAuth/requireAdmin .use() that would otherwise intercept
  // every path under this prefix, including that one, before it ever got a
  // chance to run.
  app.use('/api/admin/clubs', clubOnboardingRoutes);
  app.use('/api/admin/clubs', clubPlansRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
