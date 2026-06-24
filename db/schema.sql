-- FanCall — database schema (PostgreSQL)
-- Runs on any Postgres host: Supabase, Neon, Vercel Postgres, local.
-- Mirrors the app's data model and the scoring rule.

create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- Clubs a fan can represent. Reference data — seeded below with the current
-- Premier League (2026/27). NOTE: fixtures carry free-text team names; this
-- table is the fan's chosen club, and it's the key the multi-club isolation
-- work will scope on later. Keep the list editable as promotions/relegations
-- change the division each season.
create table teams (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  created_at timestamptz not null default now()
);

insert into teams (name) values
  ('Arsenal'),
  ('Aston Villa'),
  ('AFC Bournemouth'),
  ('Brentford'),
  ('Brighton & Hove Albion'),
  ('Chelsea'),
  ('Coventry City'),
  ('Crystal Palace'),
  ('Everton'),
  ('Fulham'),
  ('Hull City'),
  ('Ipswich Town'),
  ('Leeds United'),
  ('Liverpool'),
  ('Manchester City'),
  ('Manchester United'),
  ('Newcastle United'),
  ('Nottingham Forest'),
  ('Sunderland'),
  ('Tottenham Hotspur');

-- Users. Auth runs in the Express API, so the bcrypt password hash lives here.
-- Never store plaintext passwords.
--   display_name = the fan's username: required, and unique case-insensitively
--                  (enforced by the lower(display_name) index below).
--   team_id      = the club the fan chose at signup (required).
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  display_name  text not null,
  team_id       uuid not null references teams(id),
  created_at    timestamptz not null default now()
);

-- Usernames are unique regardless of case ('Gooner' == 'gooner').
create unique index users_display_name_lower_idx on users (lower(display_name));

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
  result_pred text not null check (result_pred in ('home','draw','away')),
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

-- Scoring rule: each of the three calls (result, home score, away score)
-- scores independently — 10 if correct, 5 if submitted-but-wrong. All three
-- correct earns a +20 bonus. A submitted prediction scores 15-50; perfect = 50.
create or replace function score_prediction(
  p_result text,   -- predicted outcome: 'home' | 'draw' | 'away'
  p_home   int,    -- predicted home-team score
  p_away   int,    -- predicted away-team score
  a_home   int,    -- actual home-team score
  a_away   int     -- actual away-team score
) returns int language sql immutable as $$
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
         score_prediction(pr.result_pred, pr.home_pred, pr.away_pred,
                           p_home, p_away)
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
