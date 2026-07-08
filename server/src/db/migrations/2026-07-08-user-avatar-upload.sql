-- FanCall migration — user-uploaded profile pictures
-- Date: 2026-07-08
--
-- Adds users.avatar_url alongside the existing preset users.avatar column.
-- Kept as a separate column rather than overloading users.avatar, since a
-- preset id ("sky-lion") and an uploaded file's public path are different
-- kinds of data with different validation. The app treats them as mutually
-- exclusive at write time: setting one clears the other.
--
-- Run:  psql "$DATABASE_URL" -f server/src/db/migrations/2026-07-08-user-avatar-upload.sql

begin;

alter table users add column if not exists avatar_url text;

commit;
