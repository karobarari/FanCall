-- FanCall — seed data
-- Arsenal, season 2025/26, Premier League gameweeks 1-5 (real fixtures).
-- Source: Arsenal.com / premierleague.com fixture release.
--
-- Opponents, venues and dates are accurate. Kickoff times for GW1-2 are the
-- confirmed broadcast slots; GW3-5 times are best-known and can still shift with
-- TV selections, so verify nearer the date. Times are BST (UTC+1).

insert into fixtures (season, gameweek, home_team, away_team, kickoff) values
  ('2025/26', 1, 'Manchester United', 'Arsenal',           '2025-08-17 16:30+01'),
  ('2025/26', 2, 'Arsenal',           'Leeds United',      '2025-08-23 17:30+01'),
  ('2025/26', 3, 'Liverpool',         'Arsenal',           '2025-08-30 16:30+01'),
  ('2025/26', 4, 'Arsenal',           'Nottingham Forest', '2025-09-13 15:00+01'),
  ('2025/26', 5, 'Arsenal',           'Manchester City',   '2025-09-20 16:30+01');

-- To test scoring end to end once you have a user and a prediction:
--   select settle_fixture('<fixture_id>', 2, 1);
--   select * from leaderboard;
