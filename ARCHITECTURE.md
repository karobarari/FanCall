# FanCall — Architecture / File Guide

Short one-liners for every source file and directory. FanCall is a single-club
fan prediction game the company sells to individual clubs (Man City is the
pilot); the code is multi-tenant so each club gets its own scoped instance,
with an optional cross-club overall leaderboard.

---

## Frontend (`src/`)

React + TypeScript + Vite. Talks to the API over a session cookie.

### Entry & routing
- `main.tsx` — app bootstrap; mounts React and the router.
- `App.tsx` — route table (login/signup, play, leaderboard, profile, admin, payment) and route guards.
- `playpage.css` — global styles + the CSS-variable theme (light re-skin, per-club colour tokens).

### Screens (`src/screens/`)
- `Login.tsx` — email + password sign-in, plus OAuth buttons.
- `Signup.tsx` — email/password/username + club picker signup.
- `CompleteSignup.tsx` — post-OAuth step: new Google/Apple user picks a username + club before the account exists.
- `MakeYourCall.tsx` — the core play page: predict each fixture's result + scoreline.
- `Leaderboard.tsx` — player rankings within the club and globally (league-wide).
- `Profile.tsx` — self-service: change username, password, and avatar (preset or uploaded photo).
- `Payment.tsx` — unlock access: plan list, Stripe checkout button, redemption-code entry.
- `PaymentSuccess.tsx` — post-checkout landing that refreshes entitlement state.
- `Admin.tsx` — admin dashboard shell; wires the tabs to live API data.

### Admin dashboard (`src/screens/admin/`)
- `config.ts` — API endpoint map, tab definitions, Premier League team list.
- `useAdminData.ts` — single data hook: loads fixtures/leaderboard/teams/users and the settle/create/update mutations.
- `types.ts` — admin-specific TypeScript types (fixtures, drafts, user rows, leaderboard entries).
- `utils.ts` — response-shape normalizers and small formatters (truncate, capitalize).
- `tabs/OverviewTab.tsx` — KPI tiles + top-players chart across the club.
- `tabs/FixturesTab.tsx` — list fixtures, create one, enter a result and settle, lock/unlock.
- `tabs/PlayersTab.tsx` — full account list; edit username, deactivate/reactivate.
- `tabs/TransactionsTab.tsx` — placeholder; payments/transactions table not wired yet (TODO).
- `components/StatCard.tsx` — single KPI tile.
- `components/ChartCard.tsx` — chart container/card.
- `components/FixtureForm.tsx` — create/edit-fixture form.
- `components/Team.tsx` — team name + badge row.
- `components/StatusBadge.tsx` — coloured fixture/user status pill.
- `components/Status.tsx` — inline loading/error/empty state text.
- `components/EmptyState.tsx` — reusable "nothing here yet" panel.

### Auth (`src/auth/`)
- `AuthContext.tsx` — current-user state; login/signup/logout/refresh; avatar upload.
- `RequireAuth.tsx` — route guard: redirects logged-out users to login.
- `RequireAdmin.tsx` — route guard: admin-only routes.

### Shared state & data (`src/data/`)
- `store.tsx` — app-wide provider for fixtures/predictions/standings, with `refresh()`.

### Components (`src/components/`)
- `AppLayout.tsx` — sidebar shell (drawer nav, club crest, per-club theme colours) wrapping every screen.
- `Avatar.tsx` — renders a user's preset avatar or uploaded photo.
- `ClubBadge.tsx` — club crest image with fallback.
- `CrestWatermark.tsx` — large low-opacity decorative crest behind headers.
- `CountUp.tsx` — animates a number tweening to its new value (points totals).
- `OAuthButtons.tsx` — "Continue with Google / Apple" buttons.
- `Skeleton.tsx` — loading-placeholder shimmer.

### Lib (`src/lib/`)
- `api.ts` — fetch wrapper (`apiGet/Post/Patch`); sends the session cookie on every call.
- `result.ts` — maps between the fan's WIN/DRAW/LOSE pick and the canonical home/draw/away result.
- `scoring.ts` — frontend mirror of the server's scoring rules (for preview/display).
- `teams.ts` — fetches the club list for pickers.
- `avatar.ts` — preset avatar hex colours + emoji icons (source of truth for rendering).

---

## Backend (`server/src/`)

Express + TypeScript + Postgres. Cookie-session auth, module-per-feature.

### Entry & wiring
- `index.ts` — server startup; creates the app and listens.
- `app.ts` — Express app: helmet, CORS, cookies, body parsing, static uploads, route mounting.
- `testUtils.ts` — shared helpers for the integration tests.
- `types/express.d.ts` — augments Express `Request` with `userId`.

### Config (`server/src/config/`)
- `env.ts` — validates all environment variables at startup (DB, JWT, OAuth, Stripe).

### Middleware (`server/src/middleware/`)
- `auth.ts` — `requireAuth` / `requireAdmin` / `requireActive` / `requireEntitled` gates.
- `rateLimit.ts` — rate limiter for auth endpoints.
- `error.ts` — 404 + central error handler (maps `HttpError`, hides stack traces in prod).
- `asyncHandler.ts` — wraps async route handlers so thrown errors reach the error middleware.

### Lib (`server/src/lib/`)
- `jwt.ts` — sign/verify session JWTs.
- `session.ts` — set/clear the `fancall_token` cookie with correct prod/dev flags.
- `password.ts` — hash + verify passwords.
- `oauthProviders.ts` — builds Google/Apple OAuth providers; 503s when unconfigured.
- `username.ts` — username format validation.
- `avatar.ts` — preset-avatar allowlist validation (mirrors the frontend).
- `avatarUpload.ts` — validates + stores uploaded profile photos on disk.
- `adminEmail.ts` — checks whether an email is the configured admin.
- `errors.ts` — `HttpError` class carrying a status code.

### Database (`server/src/db/`)
- `pool.ts` — the shared Postgres connection pool.
- `migrations/*.sql` — ordered, dated schema changes (teams, OAuth, payments, avatars, locking, dual leaderboard).

### Modules (`server/src/modules/`) — each is `*.routes.ts` (HTTP) + `*.service.ts` (logic) + `*.test.ts`
- `auth/` — signup, login, logout, `/me`, profile edits (`auth.*`); OAuth flow (`oauth.*`); photo upload route (`avatarUpload.routes.ts`).
- `teams/` — `GET /api/teams` — the club list.
- `fixtures/` — list/create/edit fixtures, lock/unlock, and settle (enter a result → triggers scoring).
- `predictions/` — submit/read a fan's predictions; `scoring.ts` is the pure scoring rule (mirrored on the frontend).
- `leaderboard/` — per-club and league-wide standings.
- `payment/` — demo pay + redemption-code redeem (`payment.*`); Stripe Connect checkout/OAuth (`stripe.service.ts`); webhook handler that grants/revokes entitlements (`webhook.*`).
- `billing/` — `clubPlans.*`: the pricing plans a club offers (direct, subscription, season-ticket add-on).
- `admin/` — `adminUsers.*`: list/edit/deactivate users; `clubOnboarding.*`: Stripe Connect onboarding callback for a club.

### Scoring rule (shared concept)
Three calls per fixture (result, home score, away score): +10 each if correct,
+5 if wrong, +20 bonus for a perfect call → 15–50 per played fixture. 12 = credit
for a missed/pre-join fixture; 0 = void/unplayed. Source of truth is the SQL
`score_prediction` function; `predictions/scoring.ts` and `src/lib/scoring.ts` mirror it.
