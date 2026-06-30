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
create or replace view leaderboard as
  select
    u.id as user_id,
    u.display_name,
    coalesce(
      sum(s.points) filter (where f.status = 'finished')
      + (
        select count(*) * 12
        from fixtures f2
        where f2.status = 'finished'
          and not exists (
            select 1 from predictions p
            where p.user_id = u.id and p.fixture_id = f2.id
          )
      ),
      0
    ) as total_points
  from users u
  left join scores s on s.user_id = u.id
  left join fixtures f on s.fixture_id = f.id
  group by u.id, u.display_name
  order by total_points desc;

-- Leaderboard with rank: competitive ranking (ties share a rank, next rank skips).
-- Example: 1, 2, 2, 4 (not 1, 2, 3, 4).
-- Computed at read time to reflect live standings.
create or replace view leaderboard_ranked as
  select
    user_id,
    display_name,
    total_points,
    rank() over (order by total_points desc) as rank
  from leaderboard;
