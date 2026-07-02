-- FanCall — seed data: the 2026/27 Premier League club list.
-- Needed by any fresh database (CI, a new dev machine) since db/schema.sql
-- is schema-only. Idempotent — safe to re-run.

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
