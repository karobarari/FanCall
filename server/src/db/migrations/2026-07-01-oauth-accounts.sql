-- FanCall migration — OAuth account linking
-- Date: 2026-07-01
--
-- Prepares `users` for Google / Apple sign-in:
--   1. password_hash becomes nullable — OAuth-only accounts never set one.
--   2. google_id / apple_id: the provider's stable subject id, unique per
--      provider, set the first time a user completes that provider's flow.
--   3. email_verified: true once a provider has vouched for the address
--      (used to decide whether an OAuth sign-in may auto-link to an existing
--      password account with the same email, vs. rejecting the sign-in).
--
-- Safe to run on a populated DB — every change is additive or loosens a
-- constraint. Re-runnable.
--
-- Run:  psql -d karod        -f db/migrations/2026-07-01-oauth-accounts.sql
--       psql -d fancall_test -f db/migrations/2026-07-01-oauth-accounts.sql

begin;

alter table users alter column password_hash drop not null;

alter table users add column if not exists google_id text unique;
alter table users add column if not exists apple_id text unique;
alter table users add column if not exists email_verified boolean not null default false;

commit;
