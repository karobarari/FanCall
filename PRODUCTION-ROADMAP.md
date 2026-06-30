# FanCall — Production Roadmap

A numbered, step-by-step path from where we are now to a production launch. Drive
it by number: tell me "do step N" and I'll execute it (or, for steps that need
something only you can provide, do everything in my power and hand you the rest).

## How to use this
- **Numbers are stable IDs**, not a rigid order. The default sequence respects
  dependencies, but you can reorder where a step says it's independent.
- Each step lists **who does it**, **what it touches**, **what it depends on**,
  and **how it's verified**.
- I deliver code/SQL/docs as downloadable files, compile/verify before handing
  over, one step per turn unless you say otherwise.

## Owner legend
- ✅ **Done**
- 🤖 **I do it fully** — code/SQL/docs, verified end to end.
- 🔑 **I do it, you unlock it** — I write all the code; you supply an account,
  API key, or a yes/no decision first (I'll tell you exactly what).
- 👤 **Yours / external** — needs a human/legal/business action I can't take. I
  prepare every supporting artefact (briefs, templates, instructions).
- ⚠️ **GATE** — must be cleared before the steps that depend on it.

## The two hard gates (so they're not a surprise later)
- **Step 17 — UK gambling/prize-competition legal opinion.** Required before you
  take money for anything prize-linked. Payment processors, the Apple/Google app
  stores, and Meta ads routinely *demand* this opinion before they'll work with a
  competition. Blocks all of Phase E (monetization).
- **Step 16 — privacy/terms/data-protection (UK GDPR).** Required before a public
  launch that collects real user data.

---

## At a glance

| # | Step | Owner | Phase |
|---|------|-------|-------|
| 1 | Backend data foundation (teams, usernames, team_id) | ✅ | A |
| 2 | Backend API — teams + signup(username, team) + login/me | 🤖 | A |
| 3 | Frontend — login/signup split, username, team picker | 🤖 | A |
| 4 | Admin settle UI (+ admin fixture entry) | 🤖 | A |
| 5 | Cleanup & correctness pass | 🤖 | A |
| 6 | Security hardening (rate-limit, headers, validation, cookies) | 🤖 | B |
| 7 | Email service + email verification | 🔑 | B |
| 8 | Password reset | 🤖 | B |
| 9 | Test & CI coverage | 🤖 | B |
| 10 | Managed Postgres provisioned + schema/migrations applied | 🔑 | C |
| 11 | Backend hosting + secrets + prod CORS/cookies | 🔑 | C |
| 12 | Frontend on Vercel + custom domain + SSL | 🔑 | C |
| 13 | Observability, logging, backups | 🔑 | C |
| 14 | Staging environment + end-to-end smoke test | 🔑 | C |
| 15 | Legal/policy docs — privacy, terms, cookies (UK GDPR) | 👤 | D |
| 16 | ⚠️ Public-launch compliance gate (GDPR sign-off) | 👤 | D |
| 17 | ⚠️ Gambling/prize-competition legal opinion | 👤 | D |
| 18 | Payments — Stripe subscriptions, checkout, webhooks | 🔑 | E |
| 19 | Refunds + billing self-service | 🔑 | E |
| 20 | Subscription entitlement gating in app | 🤖 | E |
| 21 | Multi-club isolation (scope data by team) | 🤖 | F |
| 22 | Per-club branding / white-label theming | 🔑 | F |
| 23 | Google / Apple OAuth | 🔑 | F |
| 24 | Automated fixtures + results feed → auto-settle | 🔑 | F |
| 25 | Notifications (reminders / results) | 🔑 | F |
| 26 | Mobile / responsive polish | 🤖 | F |

---

# Phase A — Complete the product flow
*Goal: a clean, complete predict→settle→leaderboard product with real accounts.*

### 1. Backend data foundation — ✅ DONE
Teams table seeded with the 2026/27 PL, `users.team_id` (NOT NULL FK), usernames
required + case-insensitively unique. Schema + migration, verified on Postgres 16.

### 2. Backend API — teams, signup, login/me — 🤖 (S/M)
**Goal:** expose the data foundation to the app.
**Touches:** new `modules/teams/*` (`GET /api/teams`); `auth.routes.ts` +
`auth.service.ts` (signup takes `{ email, password, username, team_id }` with
validation — username format 3–20 chars `[a-zA-Z0-9_]`, 409 on duplicate, 400 on
bad team); `login` and `/me` responses include the user's team.
**Depends on:** 1.
**Verify:** `tsc` clean; Thunder Client run of signup (valid + each failure mode),
login, `/me`, `GET /teams`.

### 3. Frontend — login/signup split + team picker — 🤖 (M)
**Goal:** the onboarding you described.
**Touches:** split `screens/Login.tsx` into `/login` (email+password) and
`/signup` (email, password, username, team picker), links each way; update
`App.tsx` routing; `AuthContext.signup` signature; fetch `GET /teams` for the
picker; surface the chosen club in the app shell.
**Depends on:** 2.
**Verify:** `tsc -b && vite build`; manual run of the full
login→signup→username→team→predict flow.

### 4. Admin settle UI (+ fixture entry) — 🤖 (M)
**Goal:** kill the last curl-only path; let an admin run the game from the browser.
**Touches:** rebuild `screens/Admin.tsx` into a real dashboard — list fixtures,
enter a result and settle (POSTs the existing settle route), and a simple
**create-fixture** form (so fixtures stop being hand-written SQL). Wire the
store's `refresh()` so totals update without a reload. Backend may need a small
`POST /api/fixtures` (admin-only) for fixture creation.
**Depends on:** 2 (admin/auth shape).
**Verify:** `tsc`; create a fixture, predict on it, settle it, see the leaderboard
move — all in the browser.

### 5. Cleanup & correctness pass — 🤖 (S)
**Goal:** clear the known debt so production starts clean.
**Touches:** delete dead `screens/Fixtures.tsx`; resolve `components/ScoringGuide.tsx`
(promote it to one shared guide that includes the missed/join rows the live one
omits); remove the `console.log` in `upsertPrediction`; fold the missed-credit
`leaderboard` view into `schema.sql` (end the view-drift); drop the unused
`hasPrediction` export if still unused.
**Depends on:** ideally after 3–4 so nothing in flight references removed code.
**Verify:** `tsc -b && vite build`; existing tests still green.

---

# Phase B — Harden for real users
*Goal: safe to put in front of strangers.*

### 6. Security hardening — 🤖 (M)
**Goal:** baseline production security.
**Touches:** rate-limiting on auth endpoints (`express-rate-limit`); security
headers (`helmet`); tighten CORS to the real origin(s); confirm cookie flags
(`httpOnly` ✓, `secure`+`sameSite=none` in prod ✓ — validate against the real
deployed domains); request-size limits; consistent input validation; ensure no
stack traces leak in prod errors.
**Depends on:** none (can run anytime); best confirmed against real domains (11–12).
**Verify:** `tsc`; manual abuse tests (rapid login attempts throttled, headers
present, oversized body rejected).

### 7. Email service + email verification — 🔑 (M)
**Goal:** verified email addresses; foundation for resets/notifications.
**You unlock:** pick an email provider and give me the API key (Resend, Postmark,
or AWS SES — I'll recommend based on volume/cost) + a sending domain you control
(needs DNS records you can add).
**Touches:** an email-sending module; `email_verified` column + verification-token
table; verify-on-signup flow + a "resend" endpoint; gate chosen actions on
verified status (your call how strict).
**Depends on:** 2.
**Verify:** real verification email round-trip on staging.

### 8. Password reset — 🤖 (M)
**Goal:** users can recover accounts.
**Touches:** reset-token table; `forgot-password` + `reset-password` endpoints
(time-limited, single-use tokens); frontend request + reset screens.
**Depends on:** 7 (uses the email service).
**Verify:** full reset round-trip on staging; token expiry/reuse rejected.

### 9. Test & CI coverage — 🤖 (S/M)
**Goal:** the green-build safety net you rely on stays meaningful.
**Touches:** add API integration tests for the new auth/teams/admin routes;
optional Playwright smoke test of the core flow; GitHub Actions running `tsc`,
tests, and build on every push.
**Depends on:** 2–5.
**Verify:** CI green on a PR.

---

# Phase C — Go live (infrastructure)
*Goal: the app running on real hosting. Steps 10–14 can be pulled forward to
stand up a private **staging** env as soon as Phase A is done — recommended,
because prod-mode cross-domain cookies behave differently than localhost.*

### 10. Managed Postgres — 🔑 (S)
**You unlock:** choose a host (Supabase / Neon / Vercel Postgres — I'll recommend)
and create the instance; give me the connection string (as a secret).
**Touches:** apply `schema.sql` to the fresh DB; run migrations; load fixtures.
**Verify:** app connects; `select count(*) from teams` = 20.

### 11. Backend hosting — 🔑 (M)
**You unlock:** pick a host (Render / Railway / Fly.io — I'll recommend; Vercel
functions are possible but Express fits a long-running host better) and connect
the GitHub repo.
**Touches:** production env/secrets (`DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`,
`ADMIN_EMAIL`, email key); build/start config; set prod cookie/CORS to the real
frontend domain.
**Depends on:** 10.
**Verify:** `/api/health` green from the deployed URL; a login sets a cookie.

### 12. Frontend on Vercel + domain — 🔑 (S/M)
**You unlock:** Vercel account + the domain you'll use; point DNS.
**Touches:** Vercel project, `VITE_API_URL`/`VITE_CLUB` envs, custom domain + SSL
(automatic), SPA routing config.
**Depends on:** 11.
**Verify:** full flow works on the real domain incl. cookie auth across
frontend↔API domains.

### 13. Observability + backups — 🔑 (S)
**You unlock:** a Sentry account (free tier fine) for error tracking.
**Touches:** Sentry on frontend + backend; structured request logging; confirm
the DB host's automated backups are on; an uptime ping.
**Depends on:** 11–12.
**Verify:** a deliberately thrown error shows in Sentry; a backup exists.

### 14. Staging + smoke test — 🔑 (S)
**Goal:** a non-public mirror of prod to test against before each release.
**Touches:** a second set of envs/instances (or a staging branch deploy); a
documented smoke-test checklist.
**Depends on:** 10–12.
**Verify:** the whole flow passes on staging end to end.

---

# Phase D — Compliance & legal (launch gates)
*I am not a lawyer; these need a solicitor's sign-off. I prepare every artefact
that makes that engagement fast and cheap.*

### 15. Policy & data-protection docs — 👤 (I draft) (M)
**Goal:** the documents a UK consumer app must have.
**I deliver:** drafts of Privacy Policy, Terms of Service, Cookie Policy, and a
data-handling note (what PII you store: email, username, club, later payment refs;
lawful basis; retention; data-subject rights incl. account deletion). Plus a
cookie-consent banner if/when non-essential cookies appear.
**You do:** have a solicitor review; register with the ICO if required.
**Verify:** docs published and linked in-app (footer + signup consent checkbox).

### 16. ⚠️ Public-launch compliance gate — 👤 (S)
Confirm 15 is signed off and the consent/deletion flows exist. **Clears public
launch.** (A private pilot with known users can precede this.)

### 17. ⚠️ Gambling / prize-competition legal opinion — 👤 (I prepare the brief) (M)
**Why this is a gate:** under the **Gambling Act 2005** (Great Britain — Northern
Ireland is separate), an activity that combines *payment to enter*, *a prize*, and
*an outcome that turns on chance/guessing a future event* can be a **lottery or
betting** and need a Gambling Commission licence. A football-prediction game for
money sits squarely in the zone that needs assessment. Two lawful routes typically
keep a paid competition outside licensing: a **genuine skill test** (must be hard
enough to deter a significant share of entrants — not trivial), or a **genuine
free-entry route** (equally weighted, equally convenient, prominently shown — not
buried in T&Cs). From **20 May 2026** a DCMS voluntary code adds transparency
duties for paid+free competitions. Payment processors and the Apple/Google stores
commonly require this legal opinion before onboarding a competition.
**The determining factor is your prize structure:** if the subscription only
unlocks play and there are **no prizes** (bragging rights / leaderboard only),
the gambling analysis may not bite at all; once **prizes** attach to results,
it likely does.
**I deliver:** a structured brief for the solicitor — exact mechanics, money flow
(subscription vs entry vs prize), proposed skill framing and/or free-entry design,
RYG's per-club model, and the specific questions to answer.
**You do:** engage a gambling/betting solicitor; implement their structural
requirements (I'll build whatever they specify — skill gate, free route, age-gating,
terms).
**Blocks:** Phase E.

---

# Phase E — Monetization (gated by Step 17)

### 18. Payments — Stripe subscriptions — 🔑 (L)
**You unlock:** a Stripe account + keys; decide the pricing tiers/trial.
**Touches:** Stripe Checkout / Billing; `subscriptions` table; webhook handler
(`checkout.session.completed`, `invoice.paid`, `customer.subscription.*`) as the
source of truth for entitlement; secure webhook signature verification.
**Depends on:** 17, 11.
**Verify:** test-mode subscribe → webhook flips entitlement → expiry revokes it.

### 19. Refunds + billing self-service — 🔑 (M)
**Touches:** Stripe Customer Portal (cancel/update card/invoices); refund handling
+ the webhooks that revoke access; dunning for failed payments.
**Depends on:** 18.
**Verify:** test refund/cancel revokes access correctly.

### 20. Subscription entitlement gating — 🤖 (M)
**Touches:** middleware that checks subscription status for paid features; frontend
paywall/upgrade states; graceful handling of lapsed accounts.
**Depends on:** 18.
**Verify:** paid routes blocked without an active sub; allowed with one.

---

# Phase F — Scale to the business model & enhancements
*Mostly independent of each other; sequence to taste.*

### 21. Multi-club isolation — 🤖 (L)
**Goal:** the back half of the original Path A — what lets you sell separate
club-branded instances. Scope fixtures, predictions, and leaderboards by
`team_id` so each club is its own world.
**Touches:** `team_id` on fixtures (and the queries that read them); every
fixtures/predictions/leaderboard query filtered by the user's club; admin scoped
per club. **Required before onboarding a second club.**
**Depends on:** 1 (the `team_id` key is already in place).
**Verify:** two clubs' data provably can't see each other; leaderboards separate.

### 22. Per-club branding / white-label — 🔑 (M)
**You unlock:** each club's colours/logo/assets.
**Touches:** theme tokens per club (the Tailwind `@theme` setup already isolates
colours well); club logo/name throughout; per-club config.
**Depends on:** 21.

### 23. Google / Apple OAuth — 🔑 (M)
**You unlock:** Google OAuth credentials; an **Apple Developer account** ($99/yr)
for Sign in with Apple.
**Touches:** OAuth flow alongside email/password; link/merge to existing accounts;
the "Continue with…" buttons we deliberately left out.
**Depends on:** 2.

### 24. Automated fixtures + results → auto-settle — 🔑 (M/L)
**Goal:** stop entering fixtures/results by hand.
**You unlock:** a sports-data API subscription (API-Football, Sportmonks, or Opta —
I'll compare cost/coverage).
**Touches:** scheduled ingestion of fixtures; results polling that calls
`settle_fixture` automatically; reconciliation/override in admin.
**Depends on:** 4.

### 25. Notifications — 🔑 (M)
**Touches:** prediction-deadline reminders and results notifications via email
(reuses Step 7's service) and/or web push; per-user preferences.
**Depends on:** 7.

### 26. Mobile / responsive polish — 🤖 (M)
**Touches:** make the 3-column play page and admin fully responsive (the sidebar
is already a drawer); touch targets; small-screen layouts. (Native apps would be a
separate project.)
**Depends on:** 3–4.

---

## What I'll need from you, collected in one place
- **Step 7:** email provider key + a sending domain (DNS access).
- **Steps 10–13:** accounts for DB host, backend host, Vercel, Sentry; a domain.
- **Step 15/17:** a solicitor (data-protection + a gambling specialist).
- **Step 18:** Stripe account + pricing decisions.
- **Step 22:** club brand assets. **Step 23:** Google + Apple developer accounts.
  **Step 24:** sports-data API subscription.

## Suggested default path
2 → 3 → 4 → 5 (product complete) → stand up staging early (10→11→12→14) → 6 → 7 →
8 → 9 (hardened) → 15/16 (launch docs) → **pilot launch** → 17 + 18 → 19 → 20
(monetize) → 21 → 22 (sell to more clubs) → 23/24/25/26 (enhance).

> Note: a **private pilot with one club, no prizes** can launch after Phase A + a
> staging deploy + basic policy docs — before the gambling opinion — because with
> no prize money the gambling analysis may not apply. Confirm that framing with
> the solicitor.
