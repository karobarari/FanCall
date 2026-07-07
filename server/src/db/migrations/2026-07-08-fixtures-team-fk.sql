-- FanCall migration — fixtures -> teams FK (multi-club scoping)
-- Date: 2026-07-08
--
-- Adds home_team_id/away_team_id so a fixture can answer "is club X playing
-- in this match" without string-matching home_team/away_team. A fixture
-- stays a single row visible to BOTH clubs playing in it — e.g. Man City vs
-- Arsenal shows up in both fans' feeds — this only adds a way to filter by
-- team, it doesn't change what a fixture "belongs to".
--
-- home_team/away_team stay as columns (frontend still reads them directly)
-- but going forward are written from the resolved teams.name, not raw
-- caller input — see fixtures.service.ts.
--
-- Run:  psql "$DATABASE_URL" -f server/src/db/migrations/2026-07-08-fixtures-team-fk.sql

begin;

alter table fixtures
  add column if not exists home_team_id uuid references teams(id),
  add column if not exists away_team_id uuid references teams(id);

update fixtures f set home_team_id = t.id from teams t where t.name = f.home_team and f.home_team_id is null;
update fixtures f set away_team_id = t.id from teams t where t.name = f.away_team and f.away_team_id is null;

-- Guard: every existing fixture must have resolved before these become
-- NOT NULL — if this raises, a fixture's home_team/away_team text doesn't
-- match any teams.name and needs manual reconciliation first.
do $$
declare
  unresolved int;
begin
  select count(*) into unresolved from fixtures where home_team_id is null or away_team_id is null;
  if unresolved > 0 then
    raise exception '% fixture(s) have a home_team/away_team that does not match any teams.name — fix those rows before re-running this migration', unresolved;
  end if;
end $$;

alter table fixtures
  alter column home_team_id set not null,
  alter column away_team_id set not null;

create index if not exists fixtures_home_team_id_idx on fixtures (home_team_id);
create index if not exists fixtures_away_team_id_idx on fixtures (away_team_id);

-- The identity uniqueness now keys off the FKs instead of free text, so two
-- fixtures can't collide just because of a name-casing difference.
drop index if exists fixtures_identity_uniq;
create unique index fixtures_identity_uniq on fixtures (season, gameweek, home_team_id, away_team_id);

commit;
