-- FanCall migration — dual club/league leaderboard
-- Date: 2026-07-08
--
-- The old leaderboard view pooled every active user with ONE global
-- "finished fixtures" count cross-joined onto everyone. Now that fixtures
-- belong to specific clubs (2026-07-08-fixtures-team-fk.sql), that's wrong:
-- a fan's missed-fixture credit must reflect only THEIR club's finished
-- fixtures, not every finished fixture across every club in the league —
-- otherwise a Man City fan would be credited/penalized for Arsenal matches
-- they were never eligible to predict on.
--
-- Fix: compute each user's finished-fixture count via a correlated
-- subquery scoped to fixtures where their own team_id is playing (home or
-- away), instead of one global constant. This also lets ONE view serve both
-- leaderboard scopes: "club" = filter this view's rows by team_id at query
-- time, "league" = no filter — the per-user correlation already makes the
-- unfiltered (league-wide) totals correct.
--
-- Run:  psql "$DATABASE_URL" -f server/src/db/migrations/2026-07-08-dual-leaderboard.sql

begin;

create or replace view leaderboard as
  with user_finished as (
    select u.id as user_id,
           (select count(*)::int
              from fixtures f
             where f.status = 'finished'
               and (f.home_team_id = u.team_id or f.away_team_id = u.team_id)) as n
      from users u
  )
  select
    u.id           as user_id,
    u.display_name,
    coalesce(sum(s.points), 0) + 12 * (uf.n - count(s.id)) as total_points,
    coalesce(sum(s.points), 0)                              as predicted_points,
    12 * (uf.n - count(s.id))                               as missed_points,
    -- Appended at the end: CREATE OR REPLACE VIEW can only add columns, not
    -- reorder/insert them, without a DROP VIEW first.
    u.team_id
  from users u
  join user_finished uf on uf.user_id = u.id
  left join scores s on s.user_id = u.id
    and s.fixture_id in (
      select f2.id from fixtures f2
       where f2.status = 'finished'
         and (f2.home_team_id = u.team_id or f2.away_team_id = u.team_id)
    )
  where u.is_active
  group by u.id, u.display_name, u.team_id, uf.n
  order by total_points desc;

commit;
