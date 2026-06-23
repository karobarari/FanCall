-- FanCall — playable fixture set (Arsenal, 2025/26)
-- ---------------------------------------------------------------------------
-- A set you can actually predict on. Kickoffs are dated RELATIVE TO now(), so
-- the upcoming ones are always in the future and stay open for predictions no
-- matter when you run this — unlike real calendar dates, which would all be in
-- the past and lock immediately.
--
--   GW1-2  already finished (with results)  -> show the settled state + scores
--   GW3-9  upcoming, future kickoff          -> open for predictions right now
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

insert into fixtures
  (id, season, gameweek, home_team, away_team, kickoff, home_score, away_score, status)
values
  -- Finished — these display with a result and a score badge
  ('fc000000-0000-4000-8000-000000000001', '2025/26', 1, 'Arsenal',        'Sunderland', now() - interval '10 days', 3,    0,    'finished'),
  ('fc000000-0000-4000-8000-000000000002', '2025/26', 2, 'Crystal Palace', 'Arsenal',    now() - interval '7 days',  1,    2,    'finished'),
  -- Open — kickoff in the future, so predictable right now
  ('fc000000-0000-4000-8000-000000000003', '2025/26', 3, 'Arsenal',        'Wolves',     now() + interval '2 days',  null, null, 'upcoming'),
  ('fc000000-0000-4000-8000-000000000004', '2025/26', 4, 'Fulham',         'Arsenal',    now() + interval '5 days',  null, null, 'upcoming'),
  ('fc000000-0000-4000-8000-000000000005', '2025/26', 5, 'Arsenal',        'West Ham',   now() + interval '9 days',  null, null, 'upcoming'),
  ('fc000000-0000-4000-8000-000000000006', '2025/26', 6, 'Brentford',      'Arsenal',    now() + interval '13 days', null, null, 'upcoming'),
  ('fc000000-0000-4000-8000-000000000007', '2025/26', 7, 'Arsenal',        'Brighton',   now() + interval '16 days', null, null, 'upcoming'),
  ('fc000000-0000-4000-8000-000000000008', '2025/26', 8, 'Everton',        'Arsenal',    now() + interval '20 days', null, null, 'upcoming'),
  ('fc000000-0000-4000-8000-000000000009', '2025/26', 9, 'Arsenal',        'Newcastle',  now() + interval '24 days', null, null, 'upcoming')
on conflict (id) do update set
  season     = excluded.season,
  gameweek   = excluded.gameweek,
  home_team  = excluded.home_team,
  away_team  = excluded.away_team,
  kickoff    = excluded.kickoff,
  home_score = excluded.home_score,
  away_score = excluded.away_score,
  status     = excluded.status;

-- ---------------------------------------------------------------------------
-- PLAY THE LOOP
--   1. Predict on any GW3-9 fixture (in the app, or POST /api/predictions).
--   2. Settle it as admin:
--        POST /api/fixtures/<id>/settle   body { "home_score": x, "away_score": y }
--   3. GET /api/leaderboard to watch the points land.
--
-- Fixture ids run fc000000-…-000000000001 through …009 (GW number = last digit).
-- Re-run this file any time to reset dates and clear these fixtures' scores.
-- ---------------------------------------------------------------------------
