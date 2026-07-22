-- FanCall — DEMO predictions (populates the leaderboard).
-- Run AFTER db/seed-demo.sql (needs the demo users + GW1 fixtures).
-- Safe to re-run (ON CONFLICT DO NOTHING + settle_fixture re-scores in place).
--
-- Gives every demo user one prediction on their own club's GW1 fixture, with a
-- deliberate spread of accuracy (some perfect = 50, some partial, some off = 15)
-- so clubs with several fans (Man City, Arsenal, Liverpool, Man Utd) get a real
-- ranking. Then re-settles GW1 so score_prediction() writes the scores rows the
-- leaderboard reads.
--
-- GW1 actual results (from seed-demo.sql):
--   MCI 3-1 TOT | ARS 2-0 EVE | LIV 2-2 CHE | MUN 1-1 NEW | AVL 0-1 BHA
--   CRY 1-2 NFO | FUL 3-0 IPS | BRE 2-1 BOU | LEE 1-1 SUN | COV 0-2 HUL

with pred(display_name, result_pred, home_pred, away_pred) as (
  values
    -- Manchester City fixture (MCI 3-1 TOT)
    ('Pep_Fan',          'home', 3, 1),   -- perfect
    ('CityTillIDie',     'home', 2, 1),
    ('EtihadEddie',      'home', 2, 0),
    ('BlueMoonRising',   'away', 0, 2),
    ('SpursSpencer',     'away', 1, 2),
    -- Arsenal fixture (ARS 2-0 EVE)
    ('GoonerGraham',     'home', 2, 0),   -- perfect
    ('NorthLondonNina',  'home', 1, 0),
    ('Arteta_Army',      'home', 3, 1),
    ('ToffeeTom',        'draw', 1, 1),
    -- Liverpool fixture (LIV 2-2 CHE)
    ('KopKlopper',       'draw', 2, 2),   -- perfect
    ('AnfieldAmy',       'draw', 1, 1),
    ('YNWA_Yusuf',       'home', 2, 1),
    ('BridgeBecky',      'away', 1, 2),
    -- Manchester United fixture (MUN 1-1 NEW)
    ('RedDevilRay',      'draw', 1, 1),   -- perfect
    ('OldTraffordOllie', 'draw', 2, 2),
    ('ToonTommy',        'away', 0, 1),
    -- Aston Villa fixture (AVL 0-1 BHA)
    ('VillaVince',       'draw', 1, 1),
    ('SeagullSam',       'away', 0, 1),   -- perfect
    -- Crystal Palace fixture (CRY 1-2 NFO)
    ('EaglesEmma',       'draw', 1, 1),
    ('ForestFinn',       'away', 1, 2),   -- perfect
    -- Fulham fixture (FUL 3-0 IPS)
    ('CottageCarl',      'home', 2, 0),
    ('TractorTed',       'away', 0, 2),
    -- Brentford fixture (BRE 2-1 BOU)
    ('BeesBen',          'home', 2, 1),   -- perfect
    ('CherriesChloe',    'away', 1, 2),
    -- Leeds United fixture (LEE 1-1 SUN)
    ('LeedsLiam',        'draw', 1, 1),   -- perfect
    ('MackemMax',        'draw', 0, 0),
    -- Coventry City fixture (COV 0-2 HUL)
    ('SkyBlueSue',       'draw', 1, 1),
    ('TigersTara',       'away', 0, 2)    -- perfect
)
insert into predictions (user_id, fixture_id, result_pred, home_pred, away_pred)
select u.id, f.id, p.result_pred, p.home_pred, p.away_pred
from pred p
join users u on u.display_name = p.display_name
join fixtures f
  on f.season = '2025/26' and f.gameweek = 1
 and (f.home_team_id = u.team_id or f.away_team_id = u.team_id)
on conflict (user_id, fixture_id) do nothing;

-- Re-settle every GW1 fixture with its own final score. settle_fixture() is
-- idempotent (upsert on scores), so this just (re)writes one scores row per
-- prediction using score_prediction().
select settle_fixture(f.id, f.home_score, f.away_score)
from fixtures f
where f.season = '2025/26' and f.gameweek = 1;
