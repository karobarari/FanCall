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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_name_key UNIQUE (name);

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
    email_verified boolean DEFAULT false NOT NULL
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
    CONSTRAINT fixtures_status_check CHECK ((status = ANY (ARRAY['upcoming'::text, 'finished'::text])))
);

ALTER TABLE ONLY public.fixtures
    ADD CONSTRAINT fixtures_pkey PRIMARY KEY (id);

CREATE INDEX fixtures_gameweek_idx ON public.fixtures USING btree (gameweek);

-- No duplicate matches per season/gameweek/teams. The backend catches the
-- resulting 23505 and returns 409 Conflict.
CREATE UNIQUE INDEX fixtures_identity_uniq ON public.fixtures USING btree (season, gameweek, home_team, away_team);

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
-- immediately. Keep 12 in sync with MISSED in scoring.ts.
CREATE VIEW public.leaderboard AS
 WITH finished AS (
         SELECT (count(*))::integer AS n
           FROM public.fixtures
          WHERE (fixtures.status = 'finished'::text)
        )
 SELECT u.id AS user_id,
    u.display_name,
    (COALESCE(sum(s.points), (0)::bigint) + (12 * (f.n - count(s.id)))) AS total_points,
    COALESCE(sum(s.points), (0)::bigint) AS predicted_points,
    (12 * (f.n - count(s.id))) AS missed_points
   FROM ((public.users u
     CROSS JOIN finished f)
     LEFT JOIN public.scores s ON (((s.user_id = u.id) AND (s.fixture_id IN ( SELECT fixtures.id
           FROM public.fixtures
          WHERE (fixtures.status = 'finished'::text))))))
  GROUP BY u.id, u.display_name, f.n
  ORDER BY (COALESCE(sum(s.points), (0)::bigint) + (12 * (f.n - count(s.id)))) DESC;
