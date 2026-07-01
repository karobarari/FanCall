-- FanCall schema snapshot
-- Fixture-driven prediction game: insert a fixture row, predictions flow
-- automatically through scoring and leaderboard views.
--
-- WARNING — NOT FULLY AUTHORITATIVE. This file drifted from the live database.
-- The predictions columns below were reconstructed from the running code, and
-- the two scoring FUNCTIONS the app depends on are absent entirely (see the note
-- above the leaderboard view). Regenerate this file from the live DB with:
--   pg_dump --schema-only --no-owner --no-privileges fancall > db/schema.sql

create table if not exists teams (
  name text primary key,
  created_at timestamp with time zone default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references teams (name),
  display_name text not null unique,
  created_at timestamp with time zone default now()
);

create table if not exists fixtures (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  gameweek integer not null,
  home_team text not null,
  away_team text not null,
  kickoff timestamp with time zone not null,
  home_score integer,
  away_score integer,
  status text not null default 'upcoming',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Uniqueness: no duplicate matches per season/gameweek.
-- The backend catches 23505 and returns 409 Conflict.
create unique index if not exists fixtures_identity_uniq
  on fixtures (season, gameweek, home_team, away_team);

-- NOTE: columns reconstructed to match the running code. predictions.service.ts
-- upserts home_pred / away_pred / result_pred and relies on the unique index
-- below for its ON CONFLICT. The committed schema previously declared
-- home_result / away_result / home_score / away_score with NO (user_id,
-- fixture_id) unique index -- which the code cannot run against. Confirm against
-- the live DB via the pg_dump command at the top of this file.
create table if not exists predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  fixture_id uuid not null references fixtures (id) on delete cascade,
  home_pred integer,
  away_pred integer,
  result_pred text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Required by upsertPrediction's ON CONFLICT (user_id, fixture_id).
create unique index if not exists idx_predictions_user_fixture
  on predictions (user_id, fixture_id);
create index if not exists idx_predictions_user_id on predictions (user_id);
create index if not exists idx_predictions_fixture_id on predictions (fixture_id);

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  fixture_id uuid not null references fixtures (id) on delete cascade,
  points integer not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index if not exists idx_scores_user_fixture
  on scores (user_id, fixture_id);

create index if not exists idx_scores_user_id on scores (user_id);

-- == MISSING FROM THIS FILE =================================================
-- The scoring functions are NOT defined here, yet they are called at runtime
-- (fixtures.service.ts -> settle_fixture) and by the SQL tests
-- (scoring.sql.test.ts -> score_prediction + settle_fixture). They currently
-- exist only in your local dev/test databases, so a database built fresh from
-- this file will fail to settle, and the leaderboard will only ever show the
-- 12-pt missed credits (the `scores` table never gets populated). Recover them
-- with the pg_dump command at the top of this file, which emits both:
--   score_prediction(result_pred text, home_pred int, away_pred int,
--                    actual_home int, actual_away int) returns int
--   settle_fixture(fixture_id uuid, home_score int, away_score int) returns void
-- ===========================================================================

-- Leaderboard view: total points per user, with the 12-pt missed-fixture credit.
-- Missed fixtures (finished, no scored prediction) earn 4 pts per call x 3
-- calls = 12 pts. "Missed Fixture" and "Join Anytime" are the same case: a
-- finished fixture the fan has no scored row for. Computed at read time so it
-- reflects settle-and-score immediately. Keep 12 in sync with the MISSED
-- constant in scoring.ts.
create or replace view leaderboard as
  with finished as (
    select count(*)::int as n from fixtures where status = 'finished'
  )
  select
    u.id           as user_id,
    u.display_name,
    coalesce(sum(s.points), 0) + 12 * (f.n - count(s.id)) as total_points,
    coalesce(sum(s.points), 0)                            as predicted_points,
    12 * (f.n - count(s.id))                              as missed_points
  from users u
  cross join finished f
  -- finished-only guard keeps count(s.id) <= f.n, so missed term stays >= 0
  left join scores s on s.user_id = u.id
    and s.fixture_id in (select id from fixtures where status = 'finished')
  group by u.id, u.display_name, f.n
  order by total_points desc;

-- Leaderboard with rank: competitive ranking (ties share a rank, next rank
-- skips). Example: 1, 2, 2, 4 (not 1, 2, 3, 4). Computed at read time.
create or replace view leaderboard_ranked as
  select
    user_id,
    display_name,
    total_points,
    rank() over (order by total_points desc) as rank
  from leaderboard;
