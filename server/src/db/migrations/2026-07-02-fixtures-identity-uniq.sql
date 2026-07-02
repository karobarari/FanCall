-- FanCall migration — fixtures identity uniqueness
-- Date: 2026-07-02
--
-- fixtures.service.ts has always caught a 23505 unique_violation on
-- (season, gameweek, home_team, away_team) and turned it into a 409, and
-- db/schema.sql has declared this index for a while — but no migration file
-- ever created it, so any database provisioned from the migrations directory
-- alone (rather than a pg_dump of an already-patched instance) is missing it
-- silently: duplicate fixtures insert without error.
--
-- Safe to run on a populated DB: additive only, IF NOT EXISTS. Will fail if
-- the database already has duplicate (season, gameweek, home_team, away_team)
-- rows — there shouldn't be any if the app has been the only writer.
--
-- Run:  psql -d karod        -f db/migrations/2026-07-02-fixtures-identity-uniq.sql
--       psql -d fancall_test -f db/migrations/2026-07-02-fixtures-identity-uniq.sql

create unique index if not exists fixtures_identity_uniq
  on fixtures (season, gameweek, home_team, away_team);
