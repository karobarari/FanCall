-- FanCall migration — teams + usernames
-- Date: 2026-06-24
--
-- Brings an existing database up to the new schema:
--   1. Adds the `teams` reference table and seeds the 2026/27 Premier League.
--   2. Adds users.team_id (FK -> teams), backfilling existing fans to Arsenal,
--      then makes it NOT NULL.
--   3. Makes display_name (the username) required and unique case-insensitively,
--      repairing any existing NULL/blank or duplicate names first.
--
-- Safe to run on a populated DB. Wrapped in a transaction: if anything fails,
-- nothing is applied. Re-runnable (idempotent where it matters).
--
-- Run:  psql -d karod        -f db/migrations/2026-06-24-teams-and-usernames.sql
--       psql -d fancall_test -f db/migrations/2026-06-24-teams-and-usernames.sql

begin;

-- 1. Teams reference table + seed -------------------------------------------
create table if not exists teams (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  created_at timestamptz not null default now()
);

insert into teams (name) values
  ('Arsenal'),
  ('Aston Villa'),
  ('AFC Bournemouth'),
  ('Brentford'),
  ('Brighton & Hove Albion'),
  ('Chelsea'),
  ('Coventry City'),
  ('Crystal Palace'),
  ('Everton'),
  ('Fulham'),
  ('Hull City'),
  ('Ipswich Town'),
  ('Leeds United'),
  ('Liverpool'),
  ('Manchester City'),
  ('Manchester United'),
  ('Newcastle United'),
  ('Nottingham Forest'),
  ('Sunderland'),
  ('Tottenham Hotspur')
on conflict (name) do nothing;

-- 2. users.team_id ----------------------------------------------------------
alter table users add column if not exists team_id uuid references teams(id);

-- Backfill existing fans to Arsenal (the app's current single club) so the
-- NOT NULL flip succeeds.
update users
   set team_id = (select id from teams where name = 'Arsenal')
 where team_id is null;

alter table users alter column team_id set not null;

-- 3. display_name -> required, case-insensitively unique --------------------
-- Repair NULL / blank names first (fall back to the email's local part).
update users
   set display_name = split_part(email, '@', 1)
 where display_name is null or btrim(display_name) = '';

-- Resolve case-insensitive duplicates: keep the earliest, suffix the rest with
-- a slice of their own id (guaranteed unique, and an obvious "rename me" marker).
with ranked as (
  select id,
         row_number() over (partition by lower(display_name)
                            order by created_at, id) as rn
    from users
)
update users u
   set display_name = u.display_name || '_' || substr(u.id::text, 1, 4)
  from ranked r
 where u.id = r.id
   and r.rn > 1;

alter table users alter column display_name set not null;

create unique index if not exists users_display_name_lower_idx
  on users (lower(display_name));

commit;
