-- FanCall — playable fixture set (Arsenal, 2025/26)
-- ---------------------------------------------------------------------------
-- A set you can actually predict on. Kickoffs are dated RELATIVE TO now(), so
-- the upcoming ones are always in the future — unlike real calendar dates,
-- which would all be in the past and lock immediately.
--
--   GW1-2  already finished (with results)  -> show the settled state + scores
--   GW3-9  upcoming, future kickoff          -> ready to open for predictions
--
-- New fixtures default to locked (see fixtures.service.ts), so GW3-9 seed in
-- LOCKED and won't accept predictions until you open them — unlock in the app
-- (admin Fixtures tab) or PATCH /api/fixtures/<id> { "locked": false }.
--
-- Fixed 'fc000000-…' ids, so re-running refreshes the dates and resets the
-- slate (clears these fixtures' scores) without duplicating anything.
--
-- Run:  psql -d karod -f db/fixtures-play.sql      (use your own DB name)
-- ---------------------------------------------------------------------------

-- Reset just this set's scores so a re-run starts from a clean board.
delete from scores where fixture_id in (
  'fc000000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000002',
  'fc000000-0000-4000-8000-000000000003','fc000000-0000-4000-8000-000000000004',
  'fc000000-0000-4000-8000-000000000005','fc000000-0000-4000-8000-000000000006',
  'fc000000-0000-4000-8000-000000000007','fc000000-0000-4000-8000-000000000008',
  'fc000000-0000-4000-8000-000000000009'
);

-- Team ids (fixtures.home_team_id/away_team_id, both NOT NULL) are resolved
-- from teams.name via the joins below — the app writes both the canonical name
-- and the FK id, so a name that isn't in teams would simply drop that row here.
-- Opponents are drawn from the seeded 20-club set (db/seed-teams.sql); names
-- must match teams.name exactly (e.g. 'Newcastle United', not 'Newcastle').
insert into fixtures
  (id, season, gameweek, home_team, away_team, home_team_id, away_team_id,
   kickoff, home_score, away_score, status, locked)
select
  v.id, v.season, v.gameweek, v.home_team, v.away_team, ht.id, at.id,
  v.kickoff, v.home_score, v.away_score, v.status, v.locked
from (values
  -- Finished — these display with a result and a score badge (lock is moot once
  -- finished; left false as the natural resting state)
  ('fc000000-0000-4000-8000-000000000001'::uuid, '2025/26', 1, 'Arsenal',        'Sunderland',             now() - interval '10 days', 3::int, 0::int, 'finished', false),
  ('fc000000-0000-4000-8000-000000000002'::uuid, '2025/26', 2, 'Crystal Palace', 'Arsenal',                now() - interval '7 days',  1,      2,      'finished', false),
  -- Upcoming — seed LOCKED (the new default); unlock to open for predictions
  ('fc000000-0000-4000-8000-000000000003'::uuid, '2025/26', 3, 'Arsenal',        'Nottingham Forest',      now() + interval '2 days',  null,   null,   'upcoming', true),
  ('fc000000-0000-4000-8000-000000000004'::uuid, '2025/26', 4, 'Fulham',         'Arsenal',                now() + interval '5 days',  null,   null,   'upcoming', true),
  ('fc000000-0000-4000-8000-000000000005'::uuid, '2025/26', 5, 'Arsenal',        'Chelsea',                now() + interval '9 days',  null,   null,   'upcoming', true),
  ('fc000000-0000-4000-8000-000000000006'::uuid, '2025/26', 6, 'Brentford',      'Arsenal',                now() + interval '13 days', null,   null,   'upcoming', true),
  ('fc000000-0000-4000-8000-000000000007'::uuid, '2025/26', 7, 'Arsenal',        'Brighton & Hove Albion', now() + interval '16 days', null,   null,   'upcoming', true),
  ('fc000000-0000-4000-8000-000000000008'::uuid, '2025/26', 8, 'Everton',        'Arsenal',                now() + interval '20 days', null,   null,   'upcoming', true),
  ('fc000000-0000-4000-8000-000000000009'::uuid, '2025/26', 9, 'Arsenal',        'Newcastle United',       now() + interval '24 days', null,   null,   'upcoming', true)
) as v(id, season, gameweek, home_team, away_team, kickoff, home_score, away_score, status, locked)
join teams ht on ht.name = v.home_team
join teams at on at.name = v.away_team
on conflict (id) do update set
  season       = excluded.season,
  gameweek     = excluded.gameweek,
  home_team    = excluded.home_team,
  away_team    = excluded.away_team,
  home_team_id = excluded.home_team_id,
  away_team_id = excluded.away_team_id,
  kickoff      = excluded.kickoff,
  home_score   = excluded.home_score,
  away_score   = excluded.away_score,
  status       = excluded.status,
  locked       = excluded.locked;

-- ---------------------------------------------------------------------------
-- PLAY THE LOOP
--   1. Open a GW3-9 fixture: unlock it in the app (admin Fixtures tab) or
--        PATCH /api/fixtures/<id>   body { "locked": false }
--      then predict on it (in the app, or POST /api/predictions).
--   2. Settle it as admin:
--        POST /api/fixtures/<id>/settle   body { "home_score": x, "away_score": y }
--   3. GET /api/leaderboard to watch the points land.
--
-- Fixture ids run fc000000-…-000000000001 through …009 (GW number = last digit).
-- Re-run this file any time to reset dates and clear these fixtures' scores.
-- ---------------------------------------------------------------------------
