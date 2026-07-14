-- FanCall — seed data: default club pricing (the three RYG-FanCall channels).
--
-- Loads the pricing from Gus's "RYG - FanCall Prediction Game explainer"
-- (11 May 2026) as the default every club starts on. Each club can override
-- any channel later via PUT /api/admin/clubs/:teamId/plans; these are just the
-- proposed defaults so the pricing in the app matches the deck.
--
--   season_ticket_addon   £10  / season   (one-time; redeemed via a code, not Stripe)
--   direct                £15  / season   (one-time)
--   subscription          £1.50 / month   (works out to ~£18 / year)
--
-- Prices are in pence, currency GBP. stripe_price_id is left null until a club
-- connects Stripe and its Price objects are created (payments aren't live yet).
-- Revenue split is separate config on teams.platform_fee_bps (default 70/30).
--
-- Seeds every club in the teams table so any team a fan picks shows a price
-- list. Idempotent (ON CONFLICT DO NOTHING) — safe to re-run, and it will NOT
-- overwrite a club that already has custom pricing.
--
-- NOTE — effect on the demo flow: once a club has an active 'direct' or
-- 'subscription' plan, the fan Payment screen replaces its demo
-- "Pay & Continue" button with real Stripe checkout buttons. Those require the
-- club's Stripe Connect account and return 409 until it's connected, so on a
-- keyless local/demo database, unlock a fan via a redemption code instead.
-- This file is therefore optional — apply it only when you want the real
-- pricing surfaced (e.g. a walkthrough of the commercial model).
--
-- Run:  psql -d <db> -f db/seed-plans.sql

insert into club_plans (team_id, channel, price_pence, currency, billing_interval)
select id, 'season_ticket_addon', 1000, 'gbp', 'one_time' from teams
union all
select id, 'direct',              1500, 'gbp', 'one_time' from teams
union all
select id, 'subscription',         150, 'gbp', 'monthly'  from teams
on conflict (team_id, channel) do nothing;
