import express, { Router, type Response } from 'express';
import { z } from 'zod';
import { generateCodeVerifier, generateState } from 'arctic';
import { asyncHandler } from '../../middleware/asyncHandler';
import { HttpError } from '../../lib/errors';
import { env, isProd } from '../../config/env';
import { setSession } from '../../lib/session';
import { signOAuthPending, verifyOAuthPending } from '../../lib/jwt';
import { getAppleProvider, getGoogleProvider, parseIdTokenClaims } from '../../lib/oauthProviders';
import { USERNAME_MESSAGE, USERNAME_PATTERN } from '../../lib/username';
import { completeOAuthSignup, resolveOAuthLogin, type OAuthIdentity } from './oauth.service';

export const oauthRoutes = Router();

const STATE_COOKIE = 'fancall_oauth_state';
const VERIFIER_COOKIE = 'fancall_oauth_verifier';
const PENDING_COOKIE = 'fancall_oauth_pending';

// Short-lived and scoped to /api/auth — these never carry session privileges,
// they just survive the round trip to the provider and back (state/verifier)
// or the short gap before a new user finishes picking a team (pending).
// sameSite mirrors the session cookie (see session.ts): 'none' + secure in
// prod so these survive the frontend and API being on different domains. The
// pending cookie in particular is read by POST /api/auth/oauth/complete, which
// the frontend calls as a cross-site fetch — a 'lax' cookie is never sent on
// that, so a new user could never finish signup cross-domain. 'lax' over HTTP
// in dev, where frontend and API share localhost.
const FLOW_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? ('none' as const) : ('lax' as const),
  path: '/api/auth',
  maxAge: 10 * 60 * 1000,
};

type OAuthErrorReason = 'denied' | 'session' | 'conflict' | 'failed';

function redirectWithError(res: Response, reason: OAuthErrorReason) {
  res.redirect(`${env.CLIENT_ORIGIN}/login?oauth_error=${reason}`);
}

// Shared tail end of both providers' callbacks: an existing linked/matched
// user logs straight in; a genuinely new identity gets a pending-profile
// cookie and is sent to pick a team + username before an account exists.
async function finishOAuthCallback(res: Response, identity: OAuthIdentity) {
  const result = await resolveOAuthLogin(identity).catch((err) => {
    if (err instanceof HttpError && err.status === 409) {
      redirectWithError(res, 'conflict');
      return null;
    }
    throw err;
  });
  if (!result) return;

  if (result.status === 'logged_in') {
    setSession(res, result.user.id);
    res.redirect(`${env.CLIENT_ORIGIN}/app`);
    return;
  }

  res.cookie(PENDING_COOKIE, signOAuthPending(identity), FLOW_COOKIE_OPTIONS);
  res.redirect(`${env.CLIENT_ORIGIN}/complete-signup`);
}

// GET /api/auth/google — start the redirect flow.
oauthRoutes.get(
  '/google',
  asyncHandler(async (_req, res) => {
    const google = getGoogleProvider();
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    res.cookie(STATE_COOKIE, state, FLOW_COOKIE_OPTIONS);
    res.cookie(VERIFIER_COOKIE, codeVerifier, FLOW_COOKIE_OPTIONS);
    const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'email']);
    res.redirect(url.toString());
  }),
);

oauthRoutes.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const storedState = req.cookies?.[STATE_COOKIE];
    const codeVerifier = req.cookies?.[VERIFIER_COOKIE];
    res.clearCookie(STATE_COOKIE, FLOW_COOKIE_OPTIONS);
    res.clearCookie(VERIFIER_COOKIE, FLOW_COOKIE_OPTIONS);

    const { code, state, error } = req.query;
    if (error) return redirectWithError(res, 'denied');
    if (!storedState || !codeVerifier || typeof code !== 'string' || state !== storedState) {
      return redirectWithError(res, 'session');
    }

    let identity: OAuthIdentity;
    try {
      const google = getGoogleProvider();
      const tokens = await google.validateAuthorizationCode(code, codeVerifier);
      const claims = parseIdTokenClaims(tokens.idToken(), env.GOOGLE_CLIENT_ID!, [
        'https://accounts.google.com',
        'accounts.google.com',
      ]);
      identity = {
        provider: 'google',
        providerId: claims.sub,
        email: claims.email,
        emailVerified: claims.emailVerified,
      };
    } catch {
      return redirectWithError(res, 'failed');
    }

    await finishOAuthCallback(res, identity);
  }),
);

// GET /api/auth/apple — start the redirect flow.
oauthRoutes.get(
  '/apple',
  asyncHandler(async (_req, res) => {
    const apple = getAppleProvider();
    const state = generateState();
    res.cookie(STATE_COOKIE, state, FLOW_COOKIE_OPTIONS);
    const url = apple.createAuthorizationURL(state, ['name', 'email']);
    // Apple requires form_post whenever scopes are requested — it POSTs the
    // result to the redirect URI instead of appending a query string.
    url.searchParams.set('response_mode', 'form_post');
    res.redirect(url.toString());
  }),
);

// Apple posts here as application/x-www-form-urlencoded. This is a narrow,
// deliberate exception to the JSON-only body parsing the rest of the API
// relies on for CSRF safety (see app.ts) — it's still safe because the state
// cookie is checked below and the `code` is single-use and tied to our
// client/redirect_uri at Apple, so a forged form post can't produce a valid
// session even though the browser will submit our cookies alongside it.
oauthRoutes.post(
  '/apple/callback',
  express.urlencoded({ extended: false }),
  asyncHandler(async (req, res) => {
    const storedState = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, FLOW_COOKIE_OPTIONS);

    const body = req.body as Record<string, unknown>;
    if (body?.error) return redirectWithError(res, 'denied');
    if (!storedState || typeof body?.code !== 'string' || body?.state !== storedState) {
      return redirectWithError(res, 'session');
    }

    let identity: OAuthIdentity;
    try {
      const apple = getAppleProvider();
      const tokens = await apple.validateAuthorizationCode(body.code);
      const claims = parseIdTokenClaims(tokens.idToken(), env.APPLE_CLIENT_ID!, [
        'https://appleid.apple.com',
      ]);
      identity = {
        provider: 'apple',
        providerId: claims.sub,
        email: claims.email,
        emailVerified: claims.emailVerified,
      };
    } catch {
      return redirectWithError(res, 'failed');
    }

    await finishOAuthCallback(res, identity);
  }),
);

const completeBody = z.object({
  display_name: z.string().regex(USERNAME_PATTERN, USERNAME_MESSAGE),
  team_id: z.string().uuid('Pick a club to continue'),
});

// POST /api/auth/oauth/complete — the "needs_profile" step: a brand-new
// OAuth identity has no account yet because users.display_name is required
// and only the caller knows which name (and club) they want.
oauthRoutes.post(
  '/oauth/complete',
  asyncHandler(async (req, res) => {
    const pendingToken = req.cookies?.[PENDING_COOKIE];
    if (!pendingToken) {
      throw new HttpError(400, 'No pending sign-in — start over with Continue with Google/Apple');
    }

    let pending;
    try {
      pending = verifyOAuthPending(pendingToken);
    } catch {
      res.clearCookie(PENDING_COOKIE, FLOW_COOKIE_OPTIONS);
      throw new HttpError(400, 'Sign-in expired — start over');
    }

    const parsed = completeBody.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid profile');
    }

    const user = await completeOAuthSignup({
      ...pending,
      displayName: parsed.data.display_name,
      teamId: parsed.data.team_id,
    });

    res.clearCookie(PENDING_COOKIE, FLOW_COOKIE_OPTIONS);
    setSession(res, user.id);
    res.status(201).json({ user });
  }),
);
