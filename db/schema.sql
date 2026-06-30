-- FanCall schema snapshot
-- Fixture-driven prediction game: insert a fixture row, predictions flow
-- automatically through scoring and leaderboard views.

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
  status text not null default 'scheduled',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Uniqueness: no duplicate matches per season/gameweek.
-- The backend catches 23505 and returns 409 Conflict.
create unique index if not exists fixtures_identity_uniq
  on fixtures (season, gameweek, home_team, away_team);

create table if not exists predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  fixture_id uuid not null references fixtures (id) on delete cascade,
  home_result text,
  away_result text,
  home_score integer,
  away_score integer,
  locked_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

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

-- Leaderboard view: total points per user, with 12-pt missed-fixture credit.
-- Missed fixtures (finished, no prediction) earn 4 pts per call × 3 calls = 12 pts.
-- Computed at read time to reflect settle-and-score immediately.
Leaderboard view: total points per user, with 12-pt missed-fixture credit.
-- Missed fixtures (finished, no scored prediction) earn 4 pts per call × 3
-- calls = 12 pts. Both "Missed Fixture" and "Join Anytime" are the same case:
-- a finished fixture the fan has no scored row for. Computed at read time to
-- reflect settle-and-score immediately. Keep 12 in sync with
-- MISSED_FIXTURE_POINTS in scoring.ts.
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

-- Leaderboard with rank: competitive ranking (ties share a rank, next rank skips).
-- Example: 1, 2, 2, 4 (not 1, 2, 3, 4).
-- Computed at read time to reflect live standings.
