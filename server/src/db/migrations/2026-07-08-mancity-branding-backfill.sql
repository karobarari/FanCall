-- FanCall migration — backfill Man City's crest as its logo_url
-- Date: 2026-07-08
--
-- teams.logo_url (added by 2026-07-08-club-commercial.sql) is null for
-- every seeded club until an admin sets it. The pilot's own crest asset
-- already exists at public/images/Manchester_City_FC_badge.svg (used
-- directly by src/components/ClubBadge.tsx before it took a logoUrl prop)
-- — this just points that same asset at the row so the branding-polish
-- work (ClubBadge reading team_logo_url from the signed-in user) doesn't
-- change what the pilot actually looks like.
--
-- Run:  psql "$DATABASE_URL" -f server/src/db/migrations/2026-07-08-mancity-branding-backfill.sql

update teams
   set logo_url = '/images/Manchester_City_FC_badge.svg'
 where name = 'Manchester City'
   and logo_url is null;
