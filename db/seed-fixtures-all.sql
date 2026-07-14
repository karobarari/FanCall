-- FanCall — seed data: a full-league sample fixture slate for every club.
--
-- Why: db/seed.sql only creates Manchester City fixtures (the original pilot),
-- so after the multi-club pivot a fan of any other club sees an EMPTY fixture
-- list -- fixtures are scoped per club (home OR away). This seed gives all 20
-- clubs a slate so every fan has something to predict, without needing the
-- football-data.org API key. Fictional fixtures/dates -- a stopgap until the
-- real feed (POST /api/fixtures/sync) is wired up; safe to delete then.
--
-- Round-robin (circle method) across gameweeks 6-10: each club plays
-- exactly once per gameweek (10 matches/gameweek, 50 total). Deliberately
-- starts at GW6 so it never collides with seed.sql's GW1-5 Man City rows.
--
-- team ids are resolved from teams.name (the columns are NOT NULL with no
-- trigger), so this must run AFTER db/seed-teams.sql. Idempotent via ON
-- CONFLICT on the (season, gameweek, home_team_id, away_team_id) identity
-- index -- safe to re-run.
--
-- Run:  psql -d <db> -f db/seed-fixtures-all.sql

insert into fixtures (season, gameweek, home_team, away_team, home_team_id, away_team_id, kickoff)
select '2026/27', v.gw, v.home, v.away, ht.id, at.id, v.kickoff
from (values
  (6, 'Arsenal', 'Tottenham Hotspur', timestamptz '2026-09-27 15:00+01'),
  (6, 'Aston Villa', 'Sunderland', timestamptz '2026-09-27 15:00+01'),
  (6, 'AFC Bournemouth', 'Nottingham Forest', timestamptz '2026-09-27 15:00+01'),
  (6, 'Brentford', 'Newcastle United', timestamptz '2026-09-27 15:00+01'),
  (6, 'Brighton & Hove Albion', 'Manchester United', timestamptz '2026-09-27 15:00+01'),
  (6, 'Chelsea', 'Manchester City', timestamptz '2026-09-27 15:00+01'),
  (6, 'Coventry City', 'Liverpool', timestamptz '2026-09-27 15:00+01'),
  (6, 'Crystal Palace', 'Leeds United', timestamptz '2026-09-27 15:00+01'),
  (6, 'Everton', 'Ipswich Town', timestamptz '2026-09-27 15:00+01'),
  (6, 'Fulham', 'Hull City', timestamptz '2026-09-27 15:00+01'),
  (7, 'Sunderland', 'Arsenal', timestamptz '2026-10-04 15:00+01'),
  (7, 'Nottingham Forest', 'Tottenham Hotspur', timestamptz '2026-10-04 15:00+01'),
  (7, 'Newcastle United', 'Aston Villa', timestamptz '2026-10-04 15:00+01'),
  (7, 'Manchester United', 'AFC Bournemouth', timestamptz '2026-10-04 15:00+01'),
  (7, 'Manchester City', 'Brentford', timestamptz '2026-10-04 15:00+01'),
  (7, 'Liverpool', 'Brighton & Hove Albion', timestamptz '2026-10-04 15:00+01'),
  (7, 'Leeds United', 'Chelsea', timestamptz '2026-10-04 15:00+01'),
  (7, 'Ipswich Town', 'Coventry City', timestamptz '2026-10-04 15:00+01'),
  (7, 'Hull City', 'Crystal Palace', timestamptz '2026-10-04 15:00+01'),
  (7, 'Fulham', 'Everton', timestamptz '2026-10-04 15:00+01'),
  (8, 'Arsenal', 'Nottingham Forest', timestamptz '2026-10-11 15:00+01'),
  (8, 'Sunderland', 'Newcastle United', timestamptz '2026-10-11 15:00+01'),
  (8, 'Tottenham Hotspur', 'Manchester United', timestamptz '2026-10-11 15:00+01'),
  (8, 'Aston Villa', 'Manchester City', timestamptz '2026-10-11 15:00+01'),
  (8, 'AFC Bournemouth', 'Liverpool', timestamptz '2026-10-11 15:00+01'),
  (8, 'Brentford', 'Leeds United', timestamptz '2026-10-11 15:00+01'),
  (8, 'Brighton & Hove Albion', 'Ipswich Town', timestamptz '2026-10-11 15:00+01'),
  (8, 'Chelsea', 'Hull City', timestamptz '2026-10-11 15:00+01'),
  (8, 'Coventry City', 'Fulham', timestamptz '2026-10-11 15:00+01'),
  (8, 'Crystal Palace', 'Everton', timestamptz '2026-10-11 15:00+01'),
  (9, 'Newcastle United', 'Arsenal', timestamptz '2026-10-18 15:00+01'),
  (9, 'Manchester United', 'Nottingham Forest', timestamptz '2026-10-18 15:00+01'),
  (9, 'Manchester City', 'Sunderland', timestamptz '2026-10-18 15:00+01'),
  (9, 'Liverpool', 'Tottenham Hotspur', timestamptz '2026-10-18 15:00+01'),
  (9, 'Leeds United', 'Aston Villa', timestamptz '2026-10-18 15:00+01'),
  (9, 'Ipswich Town', 'AFC Bournemouth', timestamptz '2026-10-18 15:00+01'),
  (9, 'Hull City', 'Brentford', timestamptz '2026-10-18 15:00+01'),
  (9, 'Fulham', 'Brighton & Hove Albion', timestamptz '2026-10-18 15:00+01'),
  (9, 'Everton', 'Chelsea', timestamptz '2026-10-18 15:00+01'),
  (9, 'Crystal Palace', 'Coventry City', timestamptz '2026-10-18 15:00+01'),
  (10, 'Arsenal', 'Manchester United', timestamptz '2026-10-25 15:00+01'),
  (10, 'Newcastle United', 'Manchester City', timestamptz '2026-10-25 15:00+01'),
  (10, 'Nottingham Forest', 'Liverpool', timestamptz '2026-10-25 15:00+01'),
  (10, 'Sunderland', 'Leeds United', timestamptz '2026-10-25 15:00+01'),
  (10, 'Tottenham Hotspur', 'Ipswich Town', timestamptz '2026-10-25 15:00+01'),
  (10, 'Aston Villa', 'Hull City', timestamptz '2026-10-25 15:00+01'),
  (10, 'AFC Bournemouth', 'Fulham', timestamptz '2026-10-25 15:00+01'),
  (10, 'Brentford', 'Everton', timestamptz '2026-10-25 15:00+01'),
  (10, 'Brighton & Hove Albion', 'Crystal Palace', timestamptz '2026-10-25 15:00+01'),
  (10, 'Chelsea', 'Coventry City', timestamptz '2026-10-25 15:00+01')
) as v(gw, home, away, kickoff)
join teams ht on ht.name = v.home
join teams at on at.name = v.away
on conflict (season, gameweek, home_team_id, away_team_id) do nothing;
