-- FanCall — database schema (PostgreSQL)
-- Runs on any Postgres host: Supabase, Neon, Vercel Postgres, local.
-- Mirrors the app's data model and the 3/1/0 scoring rule.

create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- Users. Auth runs in the Express API, so the bcrypt password hash lives here.
-- Never store plaintext passwords.
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  display_name  text,
  created_at    timestamptz not null default now()
);

create table fixtures (
  id          uuid primary key default gen_random_uuid(),
  season      text not null,                       -- e.g. '2025/26'
  gameweek    int  not null,
  home_team   text not null,
  away_team   text not null,
  kickoff     timestamptz not null,
  home_score  int,                                 -- null until settled
  away_score  int,
  status      text not null default 'upcoming'
              check (status in ('upcoming', 'finished')),
  created_at  timestamptz not null default now()
);
create index fixtures_gameweek_idx on fixtures (gameweek);

create table predictions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  fixture_id  uuid not null references fixtures(id) on delete cascade,
  home_pred   int not null check (home_pred >= 0),
  away_pred   int not null check (away_pred >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, fixture_id)                     -- one prediction per match
);

-- Points awarded once a fixture is settled. Leaderboard = sum per user.
create table scores (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  fixture_id  uuid not null references fixtures(id) on delete cascade,
  points      int not null,
  created_at  timestamptz not null default now(),
  unique (user_id, fixture_id)
);

-- Scoring rule: 3 = exact score, 1 = right outcome, 0 = wrong.
create or replace function score_prediction(
  p_home int, p_away int, a_home int, a_away int
) returns int language sql immutable as $$
  select case
    when p_home = a_home and p_away = a_away then 3
    when sign(p_home - p_away) = sign(a_home - a_away) then 1
    else 0
  end;
$$;

-- Settle a fixture: record the result and score every prediction for it.
create or replace function settle_fixture(
  p_fixture_id uuid, p_home int, p_away int
) returns void language plpgsql as $$
begin
  update fixtures
     set home_score = p_home, away_score = p_away, status = 'finished'
   where id = p_fixture_id;

  insert into scores (user_id, fixture_id, points)
  select pr.user_id, pr.fixture_id,
         score_prediction(pr.home_pred, pr.away_pred, p_home, p_away)
    from predictions pr
   where pr.fixture_id = p_fixture_id
  on conflict (user_id, fixture_id)
  do update set points = excluded.points;
end;
$$;

create view leaderboard as
  select u.id as user_id,
         u.display_name,
         coalesce(sum(s.points), 0) as total_points
    from users u
    left join scores s on s.user_id = u.id
   group by u.id, u.display_name
   order by total_points desc;
