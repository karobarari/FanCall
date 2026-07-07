-- FanCall migration — preset avatar picker
-- Date: 2026-07-07
--
-- Adds users.avatar: a preset id in the form "<color>-<icon>" (e.g.
-- "sky-ball"), chosen from the fixed lists in server/src/lib/avatar.ts and
-- validated there — deliberately NOT an uploaded image (no object storage in
-- the stack yet; see roadmap step 27's notes). NULL means "no preset chosen":
-- the frontend falls back to the initials avatar derived from the username.
--
-- Run:  psql "$DATABASE_URL" -f server/src/db/migrations/2026-07-07-user-avatar.sql

alter table users add column if not exists avatar text;
