-- FanCall — migration: missed-fixture + join-anytime credit
-- Run ONCE against your already-live database:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-06-22-missed-join-credit.sql
--
-- WHY
--   The Scoring Guide promises two things the engine didn't yet pay out:
--     • Missed Fixture  — +4 per question = 12 pts when no prediction was made
--     • Join Anytime    — 12 pts for every fixture missed before a fan joined
--   Both are the SAME case: "a fan has no scored prediction on a FINISHED
--   fixture." So both are handled in ONE place — the leaderboard read — not at
--   settlement. No join-date column, no signup backfill: a fan who joins after
--   a fixture was settled is, by definition, a fan with no prediction on it, so
--   they pick up the 12 automatically. Settlement (settle_fixture) is unchanged
--   and the scores table is untouched — this is purely how totals are summed.
--
-- THE RULE
--   total = (sum of real scored predictions, 15-50 each)
--         + 12 * (number of FINISHED fixtures the fan has no scored row for)
--   Upcoming fixtures never count — only status = 'finished'. The 12 is
--   4 points per call across the 3 calls (result, home score, away score).
--   Keep the 12 in sync with MISSED_FIXTURE_POINTS in scoring.ts.
--
-- INVARIANT MADE EXPLICIT
--   The scores join is restricted to FINISHED fixtures. This guarantees
--   count(s.id) <= f.n, so the missed term 12 * (f.n - count(s.id)) can never
--   go negative — even if a score row ever exists for a non-finished fixture.
--   Without this guard the leaderboard would silently DOCK points in that case.
--
-- This only redefines a VIEW, so it is safe and instant on a populated DB:
-- nothing is dropped, no rows are written.

create or replace view leaderboard as
  with finished as (
    select count(*)::int as n from fixtures where status = 'finished'
  )
  select
    u.id           as user_id,
    u.display_name,
    -- headline total the leaderboard orders on
    coalesce(sum(s.points), 0) + 12 * (f.n - count(s.id)) as total_points,
    -- breakdown columns (free; useful for "you earned X, +Y from missed" UI).
    -- The API reads total_points by name, so these extras don't affect it.
    coalesce(sum(s.points), 0)                            as predicted_points,
    12 * (f.n - count(s.id))                              as missed_points
  from users u
  cross join finished f
  -- finished-only guard: count(s.id) counts scores on FINISHED fixtures only,
  -- so it is provably <= f.n and the missed term stays >= 0.
  left join scores s on s.user_id = u.id
    and s.fixture_id in (select id from fixtures where status = 'finished')
  group by u.id, u.display_name, f.n
  order by total_points desc;

-- Sanity check after running (2 finished fixtures, a fan who predicted none):
--   their predicted_points = 0 and missed_points = 24.
