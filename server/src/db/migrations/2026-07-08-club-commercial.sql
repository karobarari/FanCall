-- FanCall migration — per-club commercial config
-- Date: 2026-07-08
--
-- Adds the schema for "each club/league can set their own pricing" (the
-- three channels: season-ticket add-on, direct one-time sale, monthly
-- subscription) and the Stripe Connect identity + revenue-share config each
-- club needs so payments can be split automatically. No Stripe calls happen
-- yet — this is just the data model step 4 (real payments) builds on.
--
-- club_plans is a child table keyed by team_id, not columns bolted onto
-- teams, because pricing is 1-to-many per club: three channels today, each
-- independently priced/toggled/mapped to its own Stripe Price object, and
-- that shape only grows (a club adding a promo price, retiring a channel).
-- Same pattern the schema already uses for predictions/scores hanging off
-- users.
--
-- Run:  psql "$DATABASE_URL" -f server/src/db/migrations/2026-07-08-club-commercial.sql

begin;

create table if not exists club_plans (
    id uuid default gen_random_uuid() not null primary key,
    team_id uuid not null references teams(id),
    channel text not null check (channel in ('season_ticket_addon', 'direct', 'subscription')),
    price_pence integer not null check (price_pence >= 0),
    currency text not null default 'gbp',
    billing_interval text not null check (billing_interval in ('one_time', 'monthly')),
    -- Stripe Price object id for this club+channel (direct/subscription
    -- only — season_ticket_addon has no Stripe Price; that channel is
    -- reconciled outside Stripe, see roadmap step 4d). Nullable until the
    -- club's Connect account exists and the Price is created.
    stripe_price_id text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (team_id, channel)
);

-- Revenue split + Stripe Connect identity live on teams — one row per club,
-- not per-channel (the split is the same across a club's channels per the
-- stakeholder's flat 70/30, with room for a negotiated override).
alter table teams
  add column if not exists stripe_account_id text,
  add column if not exists stripe_connect_status text not null default 'not_started'
      check (stripe_connect_status in ('not_started', 'onboarding', 'active', 'restricted')),
  add column if not exists platform_fee_bps integer,
  add column if not exists primary_color text,
  add column if not exists secondary_color text,
  add column if not exists logo_url text;

commit;
