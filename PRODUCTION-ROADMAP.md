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

> ⚠️ **Note (2026-07-08):** Step 18 (Stripe Connect payments) is now code-complete
> — checkout, destination charges, webhook-driven entitlements are all built —
> ahead of Steps 15–17 being cleared. This is fine for continued local/dev/demo
> use (Stripe keys are unset, so it degrades to the `demo`/redemption-code paths),
> but **do not put live Stripe keys into a public deployment** until the GDPR
> docs (15/16) and, if any club attaches prizes to the leaderboard, the gambling
> opinion (17) are actually signed off.

---

## At a glance

| # | Step | Owner | Phase |
|---|------|-------|-------|
| 1 | Backend data foundation (teams, usernames, team_id) | ✅ | A |
| 2 | Backend API — teams + signup(username, team) + login/me | ✅ | A |
| 3 | Frontend — login/signup split, username, team picker | ✅ | A |
| 4 | Admin settle UI (+ admin fixture entry) | ✅ | A |
| 5 | Cleanup & correctness pass | ✅ | A |
| 6 | Security hardening (rate-limit, headers, validation, cookies) | ✅ | B |
| 7 | Email service + email verification | 🔑 | B |
| 8 | Password reset | 🤖 | B |
| 9 | Test & CI coverage | ✅ | B |
| 10 | Managed Postgres provisioned + schema/migrations applied | 🔑 | C |
| 11 | Backend hosting + secrets + prod CORS/cookies | 🔑 | C |
| 12 | Frontend on Vercel + custom domain + SSL | 🔑 | C |
| 13 | Observability, logging, backups | 🔑 | C |
| 14 | Staging environment + end-to-end smoke test | 🔑 | C |
| 15 | Legal/policy docs — privacy, terms, cookies (UK GDPR) | 👤 | D |
| 16 | ⚠️ Public-launch compliance gate (GDPR sign-off) | 👤 | D |
| 17 | ⚠️ Gambling/prize-competition legal opinion | 👤 | D |
| 18 | Payments — Stripe Connect checkout + webhooks | ✅ (code) / 🔑 (live keys) | E |
| 19 | Refunds + billing self-service | 🔑 | E |
| 20 | Subscription entitlement gating in app | ✅ | E |
| 21 | Multi-club isolation (scope data by team) | ✅ | F |
| 22 | Per-club branding / white-label theming | ✅ | F |
| 23 | Google / Apple OAuth | ✅ Google / 🔑 Apple | F |
| 24 | Automated fixtures + results feed → auto-settle | partial / 🔑 | F |
| 25 | Notifications (reminders / results) | 🔑 | F |
| 26 | Mobile / responsive polish | ✅ | F |
| 27 | User profile self-service (username, password, avatar) | ✅ | A |
| 28 | Admin user management (edit / deactivate users) | ✅ | A |

# Phase A — Complete the product flow
*Goal: a clean, complete predict→settle→leaderboard product with real accounts.*

### 1. Backend data foundation — ✅ DONE
Teams table seeded with the 2026/27 PL, `users.team_id` (NOT NULL FK), usernames
required + case-insensitively unique. Schema + migration, verified on Postgres 16.

### 2. Backend API — teams, signup, login/me — ✅ DONE
`GET /api/teams`, `auth.routes.ts`/`auth.service.ts` signup taking
`{ email, password, username, team_id }` (username 3–20 chars
`[a-zA-Z0-9_]`, 409 on duplicate, 400 on bad team), and `login`/`/me`
responses carrying the user's team. Superseded in scope by Step 21 — teams
are now real Premier League clubs, not just the Man City pilot.

### 3. Frontend — login/signup split + team picker — ✅ DONE
`/login` (email+password) and `/signup` (email, password, username, team
picker) as separate routes, `AuthContext.signup` wired to `GET /teams`,
chosen club surfaced through the app shell (sidebar crest/name, per-club
theme colours).

### 4. Admin settle UI (+ fixture entry) — ✅ DONE
`screens/admin/*` is a real tabbed dashboard (fixtures, players, overview) —
list fixtures, enter a result and settle, create a fixture from a form
instead of hand-written SQL, plus lock/unlock individual fixtures
(`dac0078`) so a fixture can be frozen ahead of kickoff without settling it.

### 5. Cleanup & correctness pass — ✅ DONE
Dead `screens/Fixtures.tsx` removed, `hasPrediction` export gone, no stray
`console.log` in the prediction path. Continued as an ongoing habit rather
than a one-off: `9f99619` removed further dead exports
(`MISSED_FIXTURE_POINTS`, unused `Skeleton`/`ScoringGuide` exports) after
the multi-club rework left them unreferenced.

### 27. User profile self-service — ✅ DONE
`PATCH /api/auth/me` (username, plus a preset avatar — `"<color>-<icon>"`,
validated server-side against a fixed list; no upload/storage dependency) and
`PATCH /api/auth/me/password` (current + new password). New `screens/Profile.tsx`
reachable from the sidebar, with an avatar picker, username form, and password
form. Real image upload is still a future 🔑 add-on (needs S3/Cloudinary).
Migration: `2026-07-07-user-avatar.sql`. 121→133 backend tests passing;
verified live against the dev DB (username change persists, password change
invalidates the old one).

### 28. Admin user management — ✅ DONE
`GET /api/admin/users` (email, username, club, join date, paid + active
status), admin-only `PATCH /api/admin/users/:id` (edit username) and
`PATCH /api/admin/users/:id/status` (deactivate/reactivate — a soft
`users.is_active` flag, not a delete, so predictions/scores are untouched).
Deactivation blocks login (`auth.service.ts`), excludes the user from the
`leaderboard` view, and — via a new `requireActive` middleware mirroring
`requirePaid` — cuts off an already-open session from making further
predictions. An admin can't deactivate their own account. Players tab in
`screens/admin/tabs/PlayersTab.tsx` now shows the full account list (incl.
deactivated users, so they can be reactivated) with inline username editing
and a deactivate/reactivate action. Migration: `2026-07-07-admin-user-management.sql`.
12 new backend tests; verified live (non-admin gets 403, schema applied to
dev DB).

---

# Phase B — Harden for real users
*Goal: safe to put in front of strangers.*

### 6. Security hardening — ✅ DONE
Rate-limiting on auth endpoints (`express-rate-limit`), `helmet` security
headers, CORS locked to the configured origin, cookie flags (`httpOnly`,
`secure`+`sameSite=none` in prod), request-size limits, JWT/timing hardening
(`834c7a5`). CSRF posture documented in `c7e1a3e` (why `sameSite=none` +
strict CORS is safe here). **Still to confirm:** the cookie/CORS settings
against real deployed domains once Steps 11–12 stand up hosting — localhost
testing can't fully exercise cross-domain cookie behaviour.

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

### 9. Test & CI coverage — ✅ DONE
API integration tests across auth, teams, admin, fixtures, predictions,
leaderboard, and payment/webhook modules (a `*.routes.test.ts` next to every
route module); GitHub Actions (`.github/workflows/ci.yml`) running `tsc`,
tests, and build on every push (`296ec68`). **Not done:** a Playwright
end-to-end smoke test of the full browser flow — coverage today is API-level,
not UI-level.

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

### 18. Payments — Stripe Connect — ✅ CODE DONE / 🔑 needs live keys
**Built ahead of Step 17** (see the gate note above) as part of the
multi-club pivot (`34ffa27`) — actual scope differs from the original plan
(destination-charge Connect, not plain subscriptions-only): Stripe Checkout,
Connect OAuth (`stripe.service.ts`) with a 70/30 platform fee split, webhook
handler (`checkout.session.completed`, `invoice.paid`,
`customer.subscription.updated/deleted`) driving an `entitlements` table as
the source of truth, plus a non-Stripe **redemption-code** fallback for
clubs selling season-ticket bundles outside the app. `STRIPE_SECRET_KEY` /
`STRIPE_WEBHOOK_SECRET` / `STRIPE_CONNECT_CLIENT_ID` are optional env vars —
unset, the app degrades to the `demo` entitlement channel, so this is safe
to leave un-configured until you're ready to take real money.
**You still unlock:** a Stripe account + live/test keys, and a decision on
per-club pricing, before any real charge can happen.

### 19. Refunds + billing self-service — 🔑 (M)
**Touches:** Stripe Customer Portal (cancel/update card/invoices); refund handling
+ the webhooks that revoke access; dunning for failed payments. **Not started** —
`charge.refunded` isn't handled yet; cancellation today only flows through
`customer.subscription.deleted`.
**Depends on:** 18.
**Verify:** test refund/cancel revokes access correctly.

### 20. Subscription entitlement gating — ✅ DONE
`requireEntitled` middleware (mirroring `requireActive`) gates the
predictions routes on an active `entitlements` row; `payment.service.ts`
grants/revokes entitlements from the demo, redemption-code, and Stripe
webhook paths alike so all three stay consistent.

---

# Phase F — Scale to the business model & enhancements
*Mostly independent of each other; sequence to taste.*

### 21. Multi-club isolation — ✅ DONE
Landed in `34ffa27`, ahead of schedule (was gated on Phase E in the original
plan; shipped alongside it instead). **Business model reminder:** FanCall is
a single-club product the company sells to individual clubs (Man City is
the launch customer) — each club's fans get their own space, not a
"pick any Premier League club" consumer app. This step is the multi-tenant
technical foundation that makes selling separate club-branded instances
possible from one shared codebase: fixtures, predictions, and per-club
leaderboards are scoped by `team_id` (`2026-07-08-fixtures-team-fk.sql`),
with admin actions scoped per club too. It also enables an optional
**overall/cross-club leaderboard** spanning every club on the platform
(`2026-07-08-dual-leaderboard.sql`, distinct navy/orange identity) —
a nice-to-have across FanCall's customers, not the core product.

### 22. Per-club branding / white-label — ✅ DONE
Theme tokens flow per-club through `teams.primary_color`/`secondary_color`
(`AppLayout.tsx` sets CSS custom properties per logged-in user's club, only
overriding the pilot's default sky-blue/gold when a club has actually
configured colours), plus the real Man City crest (`9112edd`) and a
`ClubBadge` component used throughout. **Still open:** this covers colour
tokens and the crest; a club supplying genuinely custom assets/copy beyond
what the schema already models would still need bespoke work.

### 23. Google / Apple OAuth — ✅ Google DONE / 🔑 Apple still needs unlocking
`b5530ba` added the OAuth flow (`oauth.routes.ts`/`oauth.service.ts`) with
account linking, "Continue with…" buttons, and graceful 503s when a
provider's env vars are unset. Google is configured and live. Apple's code
path is complete but disabled — it needs a paid **Apple Developer account**
($99/yr) plus `APPLE_CLIENT_ID`/`APPLE_TEAM_ID`/`APPLE_KEY_ID`/
`APPLE_PRIVATE_KEY` before it can go live (see `server/.env.example`).

### 24. Automated fixtures + results → auto-settle — ◑ PARTIAL / 🔑
**Goal:** stop entering fixtures/results by hand.
**Built (2026-07-14):** integration against **football-data.org's free tier**
(Premier League, no card). `server/src/modules/fixtures/footballData.service.ts`
fetches the season's matches, maps provider team names to FanCall teams,
upserts fixtures, and auto-settles finished matches via the existing
`settle_fixture` function. Exposed as **`POST /api/fixtures/sync`** (admin-only),
returning a summary (`created/updated/settled/skipped`). Reads
`FOOTBALL_DATA_API_KEY` from env — unset, the route 503s and manual entry
(Step 4) still works, so this is a safe no-op until configured.
**Still to fully integrate (the 🔑 + remaining work):**
1. Get a free API key (register at football-data.org) and set `FOOTBALL_DATA_API_KEY`.
2. **A scheduler** — nothing calls `/sync` automatically yet; needs a cron/worker
   to poll on a cadence (e.g. hourly on matchdays). Mind the 10 req/min free limit.
3. An admin **"Sync now"** button in the Fixtures tab (currently endpoint-only).
4. **Live verification** — the sync has only been compile/logic-checked; it has
   never run against the real API (no key yet). Team-name matching in particular
   needs a real-data check, since FanCall's seeded 20 clubs are a partly
   fictional list and won't all match the real PL feed (unmatched clubs are
   skipped and reported, by design).
**Depends on:** 4.

### 25. Notifications — 🔑 (M)
**Touches:** prediction-deadline reminders and results notifications via email
(reuses Step 7's service) and/or web push; per-user preferences.
**Depends on:** 7. **Not started.**

### 26. Mobile / responsive polish — ✅ DONE
The sidebar is a slide-out drawer (toggle-based, not just a breakpoint
collapse) and the 3-column play page collapses to a single column below
1100px (`MakeYourCall.tsx`'s `grid-cols-1 min-[1100px]:grid-cols-[...]`).
Native apps remain a separate, unstarted project.

---

## What I'll need from you, collected in one place
- **Step 7:** email provider key + a sending domain (DNS access).
- **Steps 10–13:** accounts for DB host, backend host, Vercel, Sentry; a domain.
- **Step 15/17:** a solicitor (data-protection + a gambling specialist).
- **Step 18:** Stripe account + live/test keys + pricing decisions (code is done).
- **Step 22:** bespoke club brand assets beyond colours/crest, if a club wants them.
- **Step 23:** an Apple Developer account ($99/yr) — Google is already live.
- **Step 24:** sports-data API subscription.

## Suggested default path — updated 2026-07-10
Done: 1→2→3→4→5→27→28 (product complete) → 6→9 (hardened) → 18→20→21→22→23
(Google)→26 landed together during the multi-club/payments push, ahead of
the original sequencing.

**Remaining, roughly in order:** stand up staging (10→11→12→13→14) → 7→8
(email + password reset) → 15/16 (privacy/terms/GDPR docs) → **pilot
launch** (private, no prizes, can precede 17) → 17 (gambling opinion, only
if prizes attach to results) → flip on live Stripe keys for 18 → 19
(refunds/billing self-service) → 24/25 (automated fixtures, notifications)
→ Apple half of 23 (needs a paid Apple Developer account).

> Note: a **private pilot with one club, no prizes** can launch after Phase A + a
> staging deploy + basic policy docs — before the gambling opinion — because with
> no prize money the gambling analysis may not apply. Confirm that framing with
> the solicitor.
