-- FanCall — seed data
-- Manchester City (the pilot club — see server/src/config/pilotTeam.ts and
-- VITE_CLUB), season 2026/27, gameweeks 1-5. Opponents/dates are plausible
-- placeholders, not sourced from a real fixture release — same as the rest
-- of this project's 20-club seed list (see db/seed-teams.sql), which mixes
-- clubs that have never shared a real top-flight season together.

insert into fixtures (season, gameweek, home_team, away_team, kickoff) values
  ('2026/27', 1, 'Manchester City',   'Aston Villa',        '2026-08-16 15:00+01'),
  ('2026/27', 2, 'Newcastle United',  'Manchester City',    '2026-08-23 12:30+01'),
  ('2026/27', 3, 'Manchester City',   'Tottenham Hotspur',  '2026-08-30 15:00+01'),
  ('2026/27', 4, 'Everton',           'Manchester City',    '2026-09-13 15:00+01'),
  ('2026/27', 5, 'Manchester City',   'Liverpool',          '2026-09-20 17:30+01');

-- To test scoring end to end once you have a user and a prediction:
--   select settle_fixture('<fixture_id>', 2, 1);
--   select * from leaderboard;
