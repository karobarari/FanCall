-- FanCall migration — manual fixture locking
-- Date: 2026-07-04
--
-- Adds fixtures.locked, defaulting false. Predictions already lock
-- automatically once a fixture's kickoff passes or it's settled — this
-- adds an admin-controlled early lock on top, so a fixture can be closed
-- to new/changed predictions before kickoff while others stay open.
-- Enforced server-side in predictions.service.ts's upsertPrediction, same
-- as the existing kickoff/status checks.
--
-- Safe to run on a populated DB — additive only. Re-runnable.
--
-- Run:  psql -d karod        -f db/migrations/2026-07-04-fixture-locking.sql
--       psql -d fancall_test -f db/migrations/2026-07-04-fixture-locking.sql

alter table fixtures add column if not exists locked boolean not null default false;
