-- FanCall migration — Stripe Connect payments (test mode)
-- Date: 2026-07-08
--
-- Replaces the single global users.paid boolean as the source of truth for
-- "can this user predict" with per-club entitlements — channel-agnostic
-- (a one-time direct sale has an expiry, a subscription doesn't) and
-- future-proofed against a user ever switching clubs. users.paid stays as a
-- cheap denormalized "any entitlement active" flag kept in sync by the
-- webhook/redeem/grant handlers and the demo pay endpoint — same
-- coexistence pattern already used for users.is_active + requireActive.
--
-- Run:  psql "$DATABASE_URL" -f server/src/db/migrations/2026-07-08-stripe-payments.sql

begin;

create table if not exists payments (
    id uuid default gen_random_uuid() not null primary key,
    user_id uuid not null references users(id),
    team_id uuid not null references teams(id),
    club_plan_id uuid references club_plans(id),
    channel text not null check (channel in ('season_ticket_addon', 'direct', 'subscription')),
    stripe_checkout_session_id text,
    stripe_payment_intent_id text,
    amount_pence integer not null,
    -- RYG's cut of this charge, for reconciliation — the club's connected
    -- account receives the rest automatically via the destination charge.
    application_fee_pence integer not null,
    status text not null check (status in ('pending', 'paid', 'failed', 'refunded')),
    created_at timestamptz not null default now()
);

create table if not exists subscriptions (
    id uuid default gen_random_uuid() not null primary key,
    user_id uuid not null references users(id),
    team_id uuid not null references teams(id),
    stripe_subscription_id text not null unique,
    stripe_customer_id text not null,
    -- Mirrors Stripe's own subscription.status values (active/past_due/
    -- canceled/...) rather than a narrower enum, so a new Stripe status
    -- never needs a migration to accommodate.
    status text not null,
    current_period_end timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists entitlements (
    id uuid default gen_random_uuid() not null primary key,
    user_id uuid not null references users(id),
    team_id uuid not null references teams(id),
    channel text not null check (channel in ('season_ticket_addon', 'direct', 'subscription', 'demo')),
    source text not null check (source in ('stripe_checkout', 'stripe_subscription', 'redemption_code', 'club_webhook', 'demo')),
    -- NULL for a subscription (subscriptions.status is what actually governs
    -- it) or the demo grant; a one-time sale sets this to the end of the
    -- season it paid for.
    expires_at timestamptz,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    -- One user, one club (users.team_id is singular today) -> one entitlement
    -- row is enough; re-granting just updates it in place.
    unique (user_id, team_id)
);

-- Season-ticket add-on (roadmap "extensibility point, not a generic build"):
-- a club's box office issues these to season-ticket holders who paid the
-- +£10 through the club's own system, entirely outside Stripe — that
-- channel's revenue is reconciled club-to-RYG out of band, not auto-split.
create table if not exists redemption_codes (
    id uuid default gen_random_uuid() not null primary key,
    code text not null unique,
    team_id uuid not null references teams(id),
    channel text not null default 'season_ticket_addon',
    expires_at timestamptz,
    redeemed_by uuid references users(id),
    redeemed_at timestamptz,
    created_at timestamptz not null default now()
);

commit;
