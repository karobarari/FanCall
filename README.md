# FanCall

A football fan prediction game. Fans predict each fixture's result and
scoreline, earn points, and climb their club's leaderboard.

**Business model:** FanCall is a single-club product the company sells to
individual clubs (Manchester City is the launch/pilot customer). Each club
gets its own branded instance for its own fans. The codebase is multi-tenant
so new clubs can be onboarded from one shared codebase, with an optional
cross-club overall leaderboard spanning every club on the platform.

## Tech stack

- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS, React Router, Recharts.
- **Backend:** Express + TypeScript, Postgres (`pg`), cookie-session auth (JWT).
- **Payments:** Stripe Connect (destination charges, 70/30 platform split) with
  a demo-pay and redemption-code fallback.
- **Auth:** email/password + Google OAuth (live) and Apple OAuth (coded, needs a
  paid Apple Developer account to enable).
- **Tests/CI:** Jest integration tests on the backend; GitHub Actions runs
  typecheck, tests, and build on every push.

## Repository layout

```
src/                 Frontend (React app)
server/              Backend (Express API)
db/                  Schema, seed data, and sample fixtures
ARCHITECTURE.md      One-liner guide to every source file/directory
PRODUCTION-ROADMAP.md  Numbered, phase-based path to launch (source of truth)
```

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for a per-file description and
**[PRODUCTION-ROADMAP.md](./PRODUCTION-ROADMAP.md)** for what's built vs. planned.

## Prerequisites

- Node.js (18+) and npm
- PostgreSQL 16

## Setup

### 1. Database

```bash
createdb fancall
psql -d fancall -f db/schema.sql        # schema only
psql -d fancall -f db/seed-teams.sql    # the 20-club Premier League list
psql -d fancall -f db/seed.sql          # optional: a few sample fixtures
psql -d fancall -f db/seed-plans.sql    # optional: default £10/£15/£1.50 club pricing
```

### 2. Backend (`server/`)

```bash
cd server
npm install
cp .env.example .env                    # then fill in the values
npm run dev                             # http://localhost:3000
```

Key env vars (see `server/.env.example` for the full list): `DATABASE_URL`,
`JWT_SECRET`, `CLIENT_ORIGIN`, `ADMIN_EMAIL` (the one account allowed to settle
fixtures). Google OAuth and Stripe keys are optional — left blank, those
features degrade gracefully (OAuth returns 503, payments fall back to demo mode).

### 3. Frontend (repo root)

```bash
npm install
cp .env.example .env                    # VITE_API_URL=http://localhost:3000/api
npm run dev                             # http://localhost:5173
```

## Scripts

**Frontend (repo root)**
- `npm run dev` — Vite dev server
- `npm run build` — typecheck + production build
- `npm run lint` — ESLint

**Backend (`server/`)**
- `npm run dev` — API with watch/reload
- `npm run build` — compile to `dist/`
- `npm start` — run the compiled server
- `npm test` — Jest integration tests (needs a Postgres test database)

## How it works

- A fan signs up, picks their club, and unlocks access (demo pay or a
  redemption code today; Stripe Checkout when live keys are configured).
- On the play page they predict each fixture's result (win/draw/lose) and
  scoreline before kickoff; fixtures can be locked ahead of time.
- An admin enters the real result and settles the fixture, which triggers scoring.
- **Scoring:** three calls per fixture (result, home score, away score) —
  +10 each if correct, +5 if wrong, +20 bonus for a perfect call (15–50 points
  per played fixture). A missed/pre-join fixture earns a 12-point credit; a
  void/unplayed fixture scores 0. The canonical rule lives in the SQL
  `score_prediction` function and is mirrored in `server/src/modules/predictions/scoring.ts`
  and `src/lib/scoring.ts`.
- The leaderboard ranks fans within their club, with an optional league-wide
  view across all clubs.
