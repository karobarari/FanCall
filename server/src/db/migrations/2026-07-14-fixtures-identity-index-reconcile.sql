-- FanCall migration — reconcile the fixtures identity unique index
-- Date: 2026-07-14
--
-- Fixes a long-standing drift in what `fixtures_identity_uniq` indexes:
--
--   * The 2026-07-02 migration creates it on team NAMES
--       (season, gameweek, home_team, away_team)
--   * db/schema.sql (dumped from the live DB) declares it on team IDS
--       (season, gameweek, home_team_id, away_team_id)
--
-- Both variants share the SAME index name, so the 2026-07-02 migration's
-- `create ... if not exists` silently no-ops on any DB that already has the
-- id-based index (that's why dev/test are correct today) — but a database
-- provisioned from the migrations directory alone would get the NAME-based
-- index instead. The id-based form is canonical: it matches schema.sql and the
-- FK columns, and it's robust to a team being renamed.
--
-- This migration converges every database on the id-based index regardless of
-- which variant (or none) it starts with:
--   * name-based present  -> dropped and recreated on ids
--   * id-based present    -> left as is (create is a no-op)
--   * neither present     -> created on ids
--
-- Safe/idempotent — re-runnable. Will fail loudly if the table already holds
-- rows that are duplicates under the id-tuple (there shouldn't be any if the
-- app has been the only writer); resolve those dupes and re-run.
--
-- Run:  psql -d karod        -f server/src/db/migrations/2026-07-14-fixtures-identity-index-reconcile.sql
--       psql -d fancall_test -f server/src/db/migrations/2026-07-14-fixtures-identity-index-reconcile.sql

begin;

do $$
declare
  def text;
begin
  select indexdef into def
    from pg_indexes
   where schemaname = 'public'
     and tablename = 'fixtures'
     and indexname = 'fixtures_identity_uniq';

  -- The id-based index's definition contains "home_team_id"; the drifted
  -- name-based one indexes "home_team"/"away_team" and never does. So a
  -- non-null def without "home_team_id" is the stale variant — drop it.
  if def is not null and def not like '%home_team_id%' then
    drop index fixtures_identity_uniq;
  end if;
end $$;

create unique index if not exists fixtures_identity_uniq
  on fixtures (season, gameweek, home_team_id, away_team_id);

commit;
