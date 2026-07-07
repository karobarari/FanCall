-- FanCall migration — admin user management (roadmap step 28)
-- Date: 2026-07-07
--
-- Adds users.is_active: a soft flag an admin can flip via
-- PATCH /api/admin/users/:id/status instead of deleting the row outright —
-- deleting a user with settled predictions would either cascade-delete their
-- scores (predictions/scores both have ON DELETE CASCADE to users) or need
-- extra work to preserve them. A deactivated user is blocked at login
-- (auth.service.ts) and excluded from the leaderboard (redefined below), but
-- their historical scores stay intact.
--
-- Run:  psql "$DATABASE_URL" -f server/src/db/migrations/2026-07-07-admin-user-management.sql

begin;

alter table users add column if not exists is_active boolean not null default true;

-- Same missed-fixture/join-anytime credit logic as the 2026-06-22 migration,
-- just with an added `where u.is_active` so deactivated accounts drop off
-- the leaderboard immediately without touching their stored scores.
create or replace view leaderboard as
  with finished as (
    select count(*)::int as n from fixtures where status = 'finished'
  )
  select
    u.id           as user_id,
    u.display_name,
    coalesce(sum(s.points), 0) + 12 * (f.n - count(s.id)) as total_points,
    coalesce(sum(s.points), 0)                            as predicted_points,
    12 * (f.n - count(s.id))                              as missed_points
  from users u
  cross join finished f
  left join scores s on s.user_id = u.id
    and s.fixture_id in (select id from fixtures where status = 'finished')
  where u.is_active
  group by u.id, u.display_name, f.n
  order by total_points desc;

commit;
