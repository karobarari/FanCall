-- FanCall — migration: adopt the 3-call scoring model
-- Run this ONCE against your already-live database (the one you seeded).
-- It is safe to run on a populated DB: it alters in place, no data dropped.
--
--   psql "$DATABASE_URL" -f db/migrations/2026-06-03-new-scoring.sql
--
-- What changes:
--   1. predictions gains a `result_pred` column (the WIN/DRAW/LOSS call,
--      stored neutrally as home/draw/away).
--   2. score_prediction() is replaced with the new +10/+5 per-call rule
--      plus the +20 perfect-call bonus (max 50).
--   3. settle_fixture() is updated to pass the result call through.

------------------------------------------------------------------------------
-- 1. Add the result call to predictions.
--    The temporary default lets the NOT NULL apply cleanly even if you have
--    leftover test rows; it's dropped immediately so real inserts must supply
--    a value. (If those test rows are junk, you can `truncate predictions;`
--    first instead — skeleton data, nothing of value is lost.)
------------------------------------------------------------------------------
alter table predictions
  add column if not exists result_pred text not null default 'home'
    check (result_pred in ('home', 'draw', 'away'));

alter table predictions
  alter column result_pred drop default;

------------------------------------------------------------------------------
-- 2. New scoring rule.
--    Each of the three calls (result, home score, away score) scores
--    independently: 10 if correct, 5 if submitted-but-wrong. All three
--    correct earns a +20 bonus on top. A submitted prediction therefore
--    scores 15-50; a perfect one is exactly 50.
--    (The "missed = 4 per call = 12" case is the absence of a row, handled
--    at settlement / catchup time, not here.)
------------------------------------------------------------------------------
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

------------------------------------------------------------------------------
-- 3. Settlement passes the result call through to scoring.
------------------------------------------------------------------------------
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

-- Sanity check after running (should print 50, then 25):
--   select score_prediction('home', 2, 1, 2, 1);  -- all three correct -> 50
--   select score_prediction('home', 2, 1, 3, 0);  -- result right, scores wrong -> 20
