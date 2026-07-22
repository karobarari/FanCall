-- FanCall — DEMO seed data (codes + users + fixtures).
-- Safe to re-run (every insert is ON CONFLICT DO NOTHING).
-- Run against a provisioned DB (schema + seed-teams already applied).
--
-- Contents:
--   1. Redemption codes  — 20 per club (all clubs), skips the payment page.
--   2. Demo users        — 28 fans across clubs. Password for all: FanCall2026!
--   3. Fixtures          — GW1 finished (with scores) + GW2 upcoming, every club.

-- ────────────────────────────────────────────────────────────────────────
-- 1. Season-ticket redemption codes — 20 for EVERY club.
-- Codes are club-scoped (redeemCode rejects a code whose team != the user's
-- club). Naming: ST-<CLUBNAME>-NN, e.g. ST-ARSENAL-01, ST-MANCHESTERCITY-07,
-- ST-BRIGHTONHOVEALBION-20. Redeem one at the payment page → grants the
-- season_ticket_addon entitlement and sets paid = true. Single-use.
-- Uses a cross join over teams, so it auto-covers any club in the table.
-- ────────────────────────────────────────────────────────────────────────
insert into redemption_codes (code, team_id, channel)
select
  'ST-' || upper(regexp_replace(t.name, '[^a-zA-Z0-9]', '', 'g')) || '-' || lpad(g::text, 2, '0'),
  t.id,
  'season_ticket_addon'
from teams t
cross join generate_series(1, 20) as g
on conflict (code) do nothing;

-- ────────────────────────────────────────────────────────────────────────
-- 2. Demo users. All share password "FanCall2026!" (bcrypt hash below).
-- email_verified = true so there's no verification friction; paid = false so
-- you can test redeeming a code. display_name is unique (case-insensitive).
-- ────────────────────────────────────────────────────────────────────────
with seed(email, display_name, club) as (
  values
    ('pep_fan@demo.fancall.app',        'Pep_Fan',          'Manchester City'),
    ('citytillidie@demo.fancall.app',   'CityTillIDie',     'Manchester City'),
    ('etihadeddie@demo.fancall.app',    'EtihadEddie',      'Manchester City'),
    ('bluemoon@demo.fancall.app',       'BlueMoonRising',   'Manchester City'),
    ('goonergraham@demo.fancall.app',   'GoonerGraham',     'Arsenal'),
    ('nlnina@demo.fancall.app',         'NorthLondonNina',  'Arsenal'),
    ('artetaarmy@demo.fancall.app',     'Arteta_Army',      'Arsenal'),
    ('kopklopper@demo.fancall.app',     'KopKlopper',       'Liverpool'),
    ('anfieldamy@demo.fancall.app',     'AnfieldAmy',       'Liverpool'),
    ('ynwayusuf@demo.fancall.app',      'YNWA_Yusuf',       'Liverpool'),
    ('reddevilray@demo.fancall.app',    'RedDevilRay',      'Manchester United'),
    ('otollie@demo.fancall.app',        'OldTraffordOllie', 'Manchester United'),
    ('spursspencer@demo.fancall.app',   'SpursSpencer',     'Tottenham Hotspur'),
    ('bridgebecky@demo.fancall.app',    'BridgeBecky',      'Chelsea'),
    ('toontommy@demo.fancall.app',      'ToonTommy',        'Newcastle United'),
    ('villavince@demo.fancall.app',     'VillaVince',       'Aston Villa'),
    ('seagullsam@demo.fancall.app',     'SeagullSam',       'Brighton & Hove Albion'),
    ('toffeetom@demo.fancall.app',      'ToffeeTom',        'Everton'),
    ('eaglesemma@demo.fancall.app',     'EaglesEmma',       'Crystal Palace'),
    ('forestfinn@demo.fancall.app',     'ForestFinn',       'Nottingham Forest'),
    ('cottagecarl@demo.fancall.app',    'CottageCarl',      'Fulham'),
    ('beesben@demo.fancall.app',        'BeesBen',          'Brentford'),
    ('leedsliam@demo.fancall.app',      'LeedsLiam',        'Leeds United'),
    ('mackemmax@demo.fancall.app',      'MackemMax',        'Sunderland'),
    ('skybluesue@demo.fancall.app',     'SkyBlueSue',       'Coventry City'),
    ('tigerstara@demo.fancall.app',     'TigersTara',       'Hull City'),
    ('tractorted@demo.fancall.app',     'TractorTed',       'Ipswich Town'),
    ('cherrieschloe@demo.fancall.app',  'CherriesChloe',    'AFC Bournemouth')
)
insert into users (email, password_hash, display_name, team_id, email_verified, paid)
select
  s.email,
  '$2a$10$ubqHue6PM23HGNjCov7aIeu5LvKjcQjqkJ6Vkrw9NY/RUGUPDXG1q',
  s.display_name,
  t.id,
  true,
  false
from seed s
join teams t on t.name = s.club
on conflict (email) do nothing;

-- ────────────────────────────────────────────────────────────────────────
-- 3. Fixtures. Season 2025/26 (matches the admin default).
--   GW1: finished, with scores, locked — gives the app settled results.
--   GW2: upcoming, unlocked, kickoff in the future — open for predictions.
-- Both gameweeks pair all 20 clubs, so every club's fans have something.
-- ────────────────────────────────────────────────────────────────────────
with gw1(home, away, hs, aws) as (
  values
    ('Manchester City',   'Tottenham Hotspur',       3, 1),
    ('Arsenal',           'Everton',                 2, 0),
    ('Liverpool',         'Chelsea',                 2, 2),
    ('Manchester United', 'Newcastle United',        1, 1),
    ('Aston Villa',       'Brighton & Hove Albion',  0, 1),
    ('Crystal Palace',    'Nottingham Forest',       1, 2),
    ('Fulham',            'Ipswich Town',            3, 0),
    ('Brentford',         'AFC Bournemouth',         2, 1),
    ('Leeds United',      'Sunderland',              1, 1),
    ('Coventry City',     'Hull City',               0, 2)
)
insert into fixtures
  (season, gameweek, home_team, away_team, home_team_id, away_team_id, kickoff, status, home_score, away_score, locked)
select
  '2025/26', 1, g.home, g.away, ht.id, at.id,
  now() - interval '7 days', 'finished', g.hs, g.aws, true
from gw1 g
join teams ht on ht.name = g.home
join teams at on at.name = g.away
on conflict (season, gameweek, home_team_id, away_team_id) do nothing;

with gw2(home, away) as (
  values
    ('Tottenham Hotspur',      'Arsenal'),
    ('Everton',                'Manchester City'),
    ('Chelsea',                'Manchester United'),
    ('Newcastle United',       'Liverpool'),
    ('Brighton & Hove Albion', 'Crystal Palace'),
    ('Nottingham Forest',      'Aston Villa'),
    ('Ipswich Town',           'Brentford'),
    ('AFC Bournemouth',        'Fulham'),
    ('Sunderland',             'Coventry City'),
    ('Hull City',              'Leeds United')
)
insert into fixtures
  (season, gameweek, home_team, away_team, home_team_id, away_team_id, kickoff, status, locked)
select
  '2025/26', 2, g.home, g.away, ht.id, at.id,
  now() + interval '7 days', 'upcoming', false
from gw2 g
join teams ht on ht.name = g.home
join teams at on at.name = g.away
on conflict (season, gameweek, home_team_id, away_team_id) do nothing;
