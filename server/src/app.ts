import path from 'node:path';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env, isProd } from './config/env';
import { AVATAR_UPLOADS_DIR } from './lib/avatarUpload';
import { authRoutes } from './modules/auth/auth.routes';
import { avatarUploadRoutes } from './modules/auth/avatarUpload.routes';
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

  // Render (and most PaaS hosts) put the app behind a single reverse proxy that
  // terminates TLS and sets X-Forwarded-For / X-Forwarded-Proto. Trust exactly
  // one hop so req.ip is the real client IP (not the proxy's) — express-rate-limit
  // keys on it, so without this every request shares the proxy's IP and one
  // user's failed logins would rate-limit everyone. Trusting just 1 hop (not
  // `true`) means clients can't spoof the header to dodge the limit.
  app.set('trust proxy', 1);

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
  // Moved ahead of the body parsers below: it only reads the Cookie header,
  // never the body, so it's safe to run before either raw/JSON parsing, and
  // requireAuth (used by the routes mounted next) depends on it.
  app.use(cookieParser());
  app.use('/api/payment/webhook', paymentWebhookRoutes);
  // Its own bigger JSON body limit — see avatarUpload.routes.ts for why this
  // has to be mounted here, before the global express.json() below.
  app.use('/api/auth/me/avatar', avatarUploadRoutes);
  app.use(express.json());
  // AVATAR_UPLOADS_DIR is the .../uploads/avatars folder; serving its parent
  // at /uploads keeps the URL shape ("/uploads/avatars/<file>") independent
  // of exactly which subfolder each upload type lives in.
  //
  // helmet()'s default Cross-Origin-Resource-Policy: same-origin would make
  // the browser block these images when loaded from the frontend's own
  // origin (e.g. an <img> on localhost:5173 fetching from localhost:3000) —
  // CORP is enforced by the browser regardless of the CORS headers above.
  // These files are public avatars with no auth check on read, so opening
  // them up to cross-origin embedding is safe.
  app.use(
    '/uploads',
    express.static(path.dirname(AVATAR_UPLOADS_DIR), {
      setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
    })
  );

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

  // Single-origin production deploy: the API also serves the built frontend, so
  // the SPA and the API share one origin. That removes the cross-site session
  // cookie entirely (it becomes same-origin), which is what makes login work in
  // browsers that block third-party cookies (Safari/iOS, and increasingly
  // Chrome). Any GET that isn't an /api or /uploads path falls through to
  // index.html so client-side routing (deep links, refresh) works. Gated on
  // prod so `npm run dev` keeps proxying to the Vite dev server instead.
  if (isProd) {
    const clientDist =
      process.env.CLIENT_DIST_DIR ?? path.resolve(__dirname, '..', '..', 'dist');
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
