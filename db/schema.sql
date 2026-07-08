-- FanCall schema snapshot
-- Fixture-driven prediction game: insert a fixture row, predictions flow
-- automatically through scoring and leaderboard views.
--
-- Regenerated from the live fancall_test database (which now matches dev)
-- via:
--   pg_dump --schema-only --no-owner --no-privileges fancall_test > db/schema.sql
-- This replaces an older, hand-maintained version of this file that had
-- drifted from the running code (missing the scoring functions entirely,
-- and using a pre-teams-migration users/teams shape). If this file drifts
-- again, regenerate it the same way rather than hand-editing around the gap.
--
-- To bootstrap a fresh database from just this file:
--   psql -d <db> -f db/schema.sql
--   psql -d <db> -f db/seed-teams.sql   -- the 20-club list; schema.sql is
--                                            schema-only, no data
--   psql -d <db> -f db/seed.sql         -- optional: a few sample fixtures

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

--
-- score_prediction: points for one prediction against the actual result.
-- 10 per correct call (result / home score / away score), 5 per miss, +20
-- bonus if all three are correct (i.e. 50 for a perfect call, 15 floor for
-- an all-wrong submitted prediction).
--
CREATE FUNCTION public.score_prediction(p_result text, p_home integer, p_away integer, a_home integer, a_away integer) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
  with calls as (
    select
      case
        when p_result = case
                          when a_home > a_away then 'home'
                          when a_home < a_away then 'away'
                          else 'draw'
                        end then 10 else 5
      end as result_pts,
      case when p_home = a_home then 10 else 5 end as home_pts,
      case when p_away = a_away then 10 else 5 end as away_pts
  )
  select result_pts + home_pts + away_pts
       + case when result_pts = 10 and home_pts = 10 and away_pts = 10
              then 20 else 0 end
    from calls;
$$;

--
-- settle_fixture: records the final score and scores every existing
-- prediction for that fixture. on-conflict-update makes this safe to call
-- again with a corrected score (re-scores in place).
--
CREATE FUNCTION public.settle_fixture(p_fixture_id uuid, p_home integer, p_away integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  update fixtures
     set home_score = p_home, away_score = p_away, status = 'finished'
   where id = p_fixture_id;

  insert into scores (user_id, fixture_id, points)
  select pr.user_id, pr.fixture_id,
         score_prediction(pr.result_pred, pr.home_pred, pr.away_pred,
                           p_home, p_away)
    from predictions pr
   where pr.fixture_id = p_fixture_id
  on conflict (user_id, fixture_id)
  do update set points = excluded.points;
end;
$$;

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    -- Stripe Connect identity + revenue-share config, one row per club (the
    -- split is flat across a club's channels; club_plans below is where the
    -- per-channel prices live). stripe_account_id/status stay unset until
    -- an admin runs the club through Connect onboarding.
    stripe_account_id text,
    stripe_connect_status text DEFAULT 'not_started'::text NOT NULL,
    platform_fee_bps integer,
    -- Per-club branding (roadmap "branding polish"): CSS custom properties
    -- set at runtime from these, not a static theme per club.
    primary_color text,
    secondary_color text,
    logo_url text,
    CONSTRAINT teams_stripe_connect_status_check CHECK ((stripe_connect_status = ANY (ARRAY['not_started'::text, 'onboarding'::text, 'active'::text, 'restricted'::text])))
);

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_name_key UNIQUE (name);

-- Per-club pricing: three channels (season-ticket add-on, direct one-time
-- sale, monthly subscription), each independently priced/toggled. A child
-- table, not columns on teams, since this is 1-to-many per club and that
-- shape only grows.
CREATE TABLE public.club_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    channel text NOT NULL,
    price_pence integer NOT NULL,
    currency text DEFAULT 'gbp'::text NOT NULL,
    billing_interval text NOT NULL,
    -- Stripe Price object id (direct/subscription only — season_ticket_addon
    -- has no Stripe Price, that channel is reconciled outside Stripe).
    stripe_price_id text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT club_plans_billing_interval_check CHECK ((billing_interval = ANY (ARRAY['one_time'::text, 'monthly'::text]))),
    CONSTRAINT club_plans_channel_check CHECK ((channel = ANY (ARRAY['season_ticket_addon'::text, 'direct'::text, 'subscription'::text]))),
    CONSTRAINT club_plans_price_pence_check CHECK ((price_pence >= 0))
);

ALTER TABLE ONLY public.club_plans
    ADD CONSTRAINT club_plans_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.club_plans
    ADD CONSTRAINT club_plans_team_id_channel_key UNIQUE (team_id, channel);
ALTER TABLE ONLY public.club_plans
    ADD CONSTRAINT club_plans_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    -- Nullable: OAuth-only accounts (Google/Apple) never set a password.
    password_hash text,
    display_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    team_id uuid NOT NULL,
    google_id text,
    apple_id text,
    email_verified boolean DEFAULT false NOT NULL,
    -- Denormalized "any entitlement active" flag, cheap to read on /me
    -- without a join. entitlements (below) is the source of truth
    -- requireEntitled actually checks; this stays in sync with it (kept
    -- true by the demo pay endpoint, Stripe webhooks, and redemption/grant
    -- handlers alike), the same coexistence pattern as is_active + requireActive.
    paid boolean DEFAULT false NOT NULL,
    -- Preset avatar id "<color>-<icon>" (validated against the fixed lists in
    -- server/src/lib/avatar.ts). NULL = no preset chosen; the frontend falls
    -- back to initials derived from display_name. Not an uploaded image.
    avatar text,
    -- Public path to an uploaded profile picture (server/src/lib/avatarUpload.ts),
    -- e.g. "/uploads/avatars/<user id>.png?v=<timestamp>". Mutually exclusive
    -- with `avatar` in practice: setting one clears the other. NULL = no
    -- upload, falls back to the preset avatar or initials.
    avatar_url text,
    -- Soft-deactivation flag (admin user management, roadmap step 28).
    -- Blocked at login and excluded from the leaderboard view; predictions
    -- and scores are left untouched so history isn't lost.
    is_active boolean DEFAULT true NOT NULL
);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_apple_id_key UNIQUE (apple_id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);

-- Usernames (display_name) are required and unique case-insensitively.
CREATE UNIQUE INDEX users_display_name_lower_idx ON public.users USING btree (lower(display_name));

-- One completed or attempted Stripe charge (direct one-time sale or a
-- subscription's initial charge). application_fee_pence is RYG's cut, kept
-- for reconciliation — the club's connected account receives the rest
-- automatically via the destination charge.
CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    team_id uuid NOT NULL,
    club_plan_id uuid,
    channel text NOT NULL,
    stripe_checkout_session_id text,
    stripe_payment_intent_id text,
    amount_pence integer NOT NULL,
    application_fee_pence integer NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_channel_check CHECK ((channel = ANY (ARRAY['season_ticket_addon'::text, 'direct'::text, 'subscription'::text]))),
    CONSTRAINT payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text])))
);

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_club_plan_id_fkey FOREIGN KEY (club_plan_id) REFERENCES public.club_plans(id);
ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);
ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

-- One Stripe subscription per user (the monthly channel). status mirrors
-- Stripe's own subscription.status values verbatim (active/past_due/
-- canceled/...) rather than a narrower enum, so a new Stripe status never
-- needs a migration to accommodate.
CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    team_id uuid NOT NULL,
    stripe_subscription_id text NOT NULL,
    stripe_customer_id text NOT NULL,
    status text NOT NULL,
    current_period_end timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);
ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);
ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

-- The source of truth requireEntitled actually checks. Channel-agnostic (a
-- one-time sale has an expiry, a subscription doesn't) and future-proofed
-- against a user ever switching clubs. One user + one club (users.team_id
-- is singular today) -> one row is enough; re-granting updates it in place.
CREATE TABLE public.entitlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    team_id uuid NOT NULL,
    channel text NOT NULL,
    source text NOT NULL,
    expires_at timestamp with time zone,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT entitlements_channel_check CHECK ((channel = ANY (ARRAY['season_ticket_addon'::text, 'direct'::text, 'subscription'::text, 'demo'::text]))),
    CONSTRAINT entitlements_source_check CHECK ((source = ANY (ARRAY['stripe_checkout'::text, 'stripe_subscription'::text, 'redemption_code'::text, 'club_webhook'::text, 'demo'::text])))
);

ALTER TABLE ONLY public.entitlements
    ADD CONSTRAINT entitlements_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.entitlements
    ADD CONSTRAINT entitlements_user_id_team_id_key UNIQUE (user_id, team_id);
ALTER TABLE ONLY public.entitlements
    ADD CONSTRAINT entitlements_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);
ALTER TABLE ONLY public.entitlements
    ADD CONSTRAINT entitlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

-- Season-ticket add-on channel (an "extensibility point, not a generic
-- build" — it lives inside each club's own external ticketing system). A
-- club's box office issues these to season-ticket holders who paid the
-- add-on through the club's own system, entirely outside Stripe; that
-- channel's revenue is reconciled club-to-RYG out of band, not auto-split.
CREATE TABLE public.redemption_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    team_id uuid NOT NULL,
    channel text DEFAULT 'season_ticket_addon'::text NOT NULL,
    expires_at timestamp with time zone,
    redeemed_by uuid,
    redeemed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.redemption_codes
    ADD CONSTRAINT redemption_codes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.redemption_codes
    ADD CONSTRAINT redemption_codes_code_key UNIQUE (code);
ALTER TABLE ONLY public.redemption_codes
    ADD CONSTRAINT redemption_codes_redeemed_by_fkey FOREIGN KEY (redeemed_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.redemption_codes
    ADD CONSTRAINT redemption_codes_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);

CREATE TABLE public.fixtures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    season text NOT NULL,
    gameweek integer NOT NULL,
    home_team text NOT NULL,
    away_team text NOT NULL,
    kickoff timestamp with time zone NOT NULL,
    home_score integer,
    away_score integer,
    status text DEFAULT 'upcoming'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    -- Admin-controlled early lock, independent of kickoff/status. See
    -- predictions.service.ts's upsertPrediction for enforcement.
    locked boolean DEFAULT false NOT NULL,
    -- FKs to teams (multi-club scoping, roadmap "fixtures -> club scoping").
    -- A fixture stays one row visible to BOTH clubs playing in it -- these
    -- let a query answer "is club X in this match" without string-matching
    -- home_team/away_team. Those text columns are still written, kept in
    -- sync from teams.name by fixtures.service.ts, not typed independently.
    home_team_id uuid NOT NULL,
    away_team_id uuid NOT NULL,
    CONSTRAINT fixtures_status_check CHECK ((status = ANY (ARRAY['upcoming'::text, 'finished'::text])))
);

ALTER TABLE ONLY public.fixtures
    ADD CONSTRAINT fixtures_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.fixtures
    ADD CONSTRAINT fixtures_home_team_id_fkey FOREIGN KEY (home_team_id) REFERENCES public.teams(id);
ALTER TABLE ONLY public.fixtures
    ADD CONSTRAINT fixtures_away_team_id_fkey FOREIGN KEY (away_team_id) REFERENCES public.teams(id);

CREATE INDEX fixtures_gameweek_idx ON public.fixtures USING btree (gameweek);
CREATE INDEX fixtures_home_team_id_idx ON public.fixtures USING btree (home_team_id);
CREATE INDEX fixtures_away_team_id_idx ON public.fixtures USING btree (away_team_id);

-- No duplicate matches per season/gameweek/teams. The backend catches the
-- resulting 23505 and returns 409 Conflict.
CREATE UNIQUE INDEX fixtures_identity_uniq ON public.fixtures USING btree (season, gameweek, home_team_id, away_team_id);

CREATE TABLE public.predictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fixture_id uuid NOT NULL,
    result_pred text NOT NULL,
    home_pred integer NOT NULL,
    away_pred integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT predictions_away_pred_check CHECK ((away_pred >= 0)),
    CONSTRAINT predictions_home_pred_check CHECK ((home_pred >= 0)),
    CONSTRAINT predictions_result_pred_check CHECK ((result_pred = ANY (ARRAY['home'::text, 'draw'::text, 'away'::text])))
);

ALTER TABLE ONLY public.predictions
    ADD CONSTRAINT predictions_pkey PRIMARY KEY (id);
-- Required by upsertPrediction's ON CONFLICT (user_id, fixture_id).
ALTER TABLE ONLY public.predictions
    ADD CONSTRAINT predictions_user_id_fixture_id_key UNIQUE (user_id, fixture_id);
ALTER TABLE ONLY public.predictions
    ADD CONSTRAINT predictions_fixture_id_fkey FOREIGN KEY (fixture_id) REFERENCES public.fixtures(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.predictions
    ADD CONSTRAINT predictions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

CREATE TABLE public.scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fixture_id uuid NOT NULL,
    points integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.scores
    ADD CONSTRAINT scores_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scores
    ADD CONSTRAINT scores_user_id_fixture_id_key UNIQUE (user_id, fixture_id);
ALTER TABLE ONLY public.scores
    ADD CONSTRAINT scores_fixture_id_fkey FOREIGN KEY (fixture_id) REFERENCES public.fixtures(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scores
    ADD CONSTRAINT scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Leaderboard view: total points per user, with the 12-pt missed-fixture
-- credit. Missed fixtures (finished, no scored prediction) earn 4 pts per
-- call x 3 calls = 12 pts — this covers both "missed a fixture" and "joined
-- after a fixture was already settled" (same case: no scored row on a
-- finished fixture). Computed at read time so it reflects settle-and-score
-- immediately. Keep 12 in sync with MISSED in scoring.ts. Deactivated users
-- (is_active = false) are excluded entirely.
--
-- Each user's finished-fixture count (user_finished.n) is a per-user
-- correlated subquery scoped to fixtures their own team_id is playing in
-- (home or away) — not one global count — so a fan's missed-fixture credit
-- only ever reflects their own club's fixtures. This same view serves both
-- leaderboard scopes: "club" filters these rows by team_id at query time,
-- "league" doesn't filter at all (the per-user correlation already makes
-- the unfiltered totals correct).
CREATE VIEW public.leaderboard AS
 WITH user_finished AS (
         SELECT u_1.id AS user_id,
            ( SELECT (count(*))::integer AS count
                   FROM public.fixtures f
                  WHERE ((f.status = 'finished'::text) AND ((f.home_team_id = u_1.team_id) OR (f.away_team_id = u_1.team_id)))) AS n
           FROM public.users u_1
        )
 SELECT u.id AS user_id,
    u.display_name,
    (COALESCE(sum(s.points), (0)::bigint) + (12 * (uf.n - count(s.id)))) AS total_points,
    COALESCE(sum(s.points), (0)::bigint) AS predicted_points,
    (12 * (uf.n - count(s.id))) AS missed_points,
    u.team_id
   FROM ((public.users u
     JOIN user_finished uf ON ((uf.user_id = u.id)))
     LEFT JOIN public.scores s ON (((s.user_id = u.id) AND (s.fixture_id IN ( SELECT f2.id
           FROM public.fixtures f2
          WHERE ((f2.status = 'finished'::text) AND ((f2.home_team_id = u.team_id) OR (f2.away_team_id = u.team_id))))))))
  WHERE u.is_active
  GROUP BY u.id, u.display_name, u.team_id, uf.n
  ORDER BY (COALESCE(sum(s.points), (0)::bigint) + (12 * (uf.n - count(s.id)))) DESC;
