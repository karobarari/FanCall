-- FanCall — seed data
-- Manchester City (the pilot club — see server/src/config/pilotTeam.ts and
-- VITE_CLUB), season 2026/27, gameweeks 1-5. Opponents/dates are plausible
-- placeholders, not sourced from a real fixture release — same as the rest
-- of this project's 20-club seed list (see db/seed-teams.sql), which mixes
-- clubs that have never shared a real top-flight season together.

-- locked = true: new fixtures start locked (see fixtures.service.ts) — an admin
-- opens each to predictions by unlocking it. Seeded fixtures match that default.
--
-- Team ids (fixtures.home_team_id/away_team_id, both NOT NULL) are resolved from
-- teams.name via the joins below, matching how fixtures.service.ts writes them.
-- Names must match teams.name exactly. on conflict do nothing (on the fixture
-- identity index) makes this safe to re-run against an already-seeded DB.
insert into fixtures
  (season, gameweek, home_team, away_team, home_team_id, away_team_id, kickoff, locked)
select v.season, v.gameweek, v.home_team, v.away_team, ht.id, at.id, v.kickoff, true
from (values
  ('2026/27', 1, 'Manchester City',   'Aston Villa',        '2026-08-16 15:00+01'::timestamptz),
  ('2026/27', 2, 'Newcastle United',  'Manchester City',    '2026-08-23 12:30+01'::timestamptz),
  ('2026/27', 3, 'Manchester City',   'Tottenham Hotspur',  '2026-08-30 15:00+01'::timestamptz),
  ('2026/27', 4, 'Everton',           'Manchester City',    '2026-09-13 15:00+01'::timestamptz),
  ('2026/27', 5, 'Manchester City',   'Liverpool',          '2026-09-20 17:30+01'::timestamptz)
) as v(season, gameweek, home_team, away_team, kickoff)
join teams ht on ht.name = v.home_team
join teams at on at.name = v.away_team
on conflict (season, gameweek, home_team_id, away_team_id) do nothing;

-- To test scoring end to end once you have a user and a prediction:
--   select settle_fixture('<fixture_id>', 2, 1);
--   select * from leaderboard;
