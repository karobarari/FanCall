import { z } from "zod";
import { pool } from "../../db/pool";
import { env } from "../../config/env";
import { HttpError } from "../../lib/errors";

// Automated fixtures + results feed via football-data.org's free tier.
// Free plan gives fixtures/results for the Premier League at 10 req/min, no
// live scores needed here (we settle after a match finishes, not during it),
// so a scheduled batch pull is a perfect fit for the free limit.
//
// PARTIAL INTEGRATION — this module fetches, upserts, and auto-settles when
// POST /api/fixtures/sync is called. It is NOT yet wired to a scheduler, so
// nothing calls it automatically. See PRODUCTION-ROADMAP.md step 24 and the
// project memory for what "fully integrate" still needs (cron/worker, an admin
// "Sync now" button, and a live verification against a real API key).

const FOOTBALL_DATA_BASE = "https://api.football-data.org/v4";
const PREMIER_LEAGUE_CODE = "PL";

export function isFootballDataConfigured(): boolean {
  return Boolean(env.FOOTBALL_DATA_API_KEY);
}

// Only the fields of the /competitions/{code}/matches response we rely on;
// parsed defensively so a provider shape change fails loudly here rather than
// corrupting fixture data downstream.
const matchSchema = z.object({
  utcDate: z.string(),
  status: z.string(),
  matchday: z.number().nullable(),
  season: z.object({ startDate: z.string() }),
  homeTeam: z.object({ name: z.string().nullable() }),
  awayTeam: z.object({ name: z.string().nullable() }),
  score: z.object({
    fullTime: z.object({
      home: z.number().nullable(),
      away: z.number().nullable(),
    }),
  }),
});
const matchesResponseSchema = z.object({ matches: z.array(matchSchema) });
type ApiMatch = z.infer<typeof matchSchema>;

async function fetchPremierLeagueMatches(): Promise<ApiMatch[]> {
  if (!env.FOOTBALL_DATA_API_KEY) {
    throw new HttpError(503, "Automated fixtures are not configured");
  }

  let res;
  try {
    res = await fetch(
      `${FOOTBALL_DATA_BASE}/competitions/${PREMIER_LEAGUE_CODE}/matches`,
      { headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY } },
    );
  } catch {
    throw new HttpError(502, "Could not reach the fixtures provider");
  }

  if (res.status === 429) {
    throw new HttpError(429, "Fixtures provider rate limit hit — try again shortly");
  }
  if (res.status === 401 || res.status === 403) {
    throw new HttpError(502, "Fixtures provider rejected the API key");
  }
  if (!res.ok) {
    throw new HttpError(502, `Fixtures provider error (${res.status})`);
  }

  const json: unknown = await res.json().catch(() => null);
  const parsed = matchesResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new HttpError(502, "Unexpected response from the fixtures provider");
  }
  return parsed.data.matches;
}

// The provider suffixes club names ("Manchester City FC", "Arsenal FC") and
// FanCall's own list doesn't; normalising both sides (drop FC/AFC tokens,
// fold "&", strip punctuation) lets them match without a hand-maintained map.
// A club present in the real PL feed but absent from FanCall's seeded list
// simply won't match and its fixtures are skipped (reported in the summary).
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(?:fc|afc)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "2026-08-15" -> "2026/27", matching FanCall's season string convention.
function seasonLabel(startDate: string): string {
  const y = new Date(startDate).getUTCFullYear();
  return `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
}

interface TeamRow {
  id: string;
  name: string;
}

export interface SyncSummary {
  fetched: number;
  created: number;
  updated: number;
  settled: number;
  skipped: { match: string; reason: string }[];
}

// Pull the current Premier League season's matches, upsert them as fixtures,
// and auto-settle any that have finished. Idempotent: safe to call repeatedly,
// and re-running after a match finishes is what flips it to settled.
export async function syncPremierLeagueFixtures(): Promise<SyncSummary> {
  const matches = await fetchPremierLeagueMatches();

  const { rows: teams } = await pool.query<TeamRow>("select id, name from teams");
  const byNorm = new Map<string, TeamRow>();
  for (const t of teams) byNorm.set(normalizeTeamName(t.name), t);

  const summary: SyncSummary = {
    fetched: matches.length,
    created: 0,
    updated: 0,
    settled: 0,
    skipped: [],
  };

  for (const m of matches) {
    const homeName = m.homeTeam.name ?? "?";
    const awayName = m.awayTeam.name ?? "?";
    const label = `${homeName} v ${awayName}`;

    if (m.matchday == null) {
      summary.skipped.push({ match: label, reason: "no matchday" });
      continue;
    }

    const home = m.homeTeam.name ? byNorm.get(normalizeTeamName(m.homeTeam.name)) : undefined;
    const away = m.awayTeam.name ? byNorm.get(normalizeTeamName(m.awayTeam.name)) : undefined;
    if (!home || !away) {
      const missing = [!home ? homeName : null, !away ? awayName : null].filter(Boolean).join(", ");
      summary.skipped.push({ match: label, reason: `not in FanCall teams: ${missing}` });
      continue;
    }

    const season = seasonLabel(m.season.startDate);
    const gameweek = m.matchday;
    const kickoff = m.utcDate;

    // Upsert without ON CONFLICT: the fixtures identity unique index has
    // drifted between name-based and id-based variants across environments
    // (see the 2026-07-02 migration vs. schema.sql), so a select-then-write is
    // robust to either. Safe here because the sync runs as one serial job.
    const existing = await pool.query<{
      id: string;
      status: string;
      home_score: number | null;
      away_score: number | null;
    }>(
      `select id, status, home_score, away_score from fixtures
        where season = $1 and gameweek = $2 and home_team_id = $3 and away_team_id = $4`,
      [season, gameweek, home.id, away.id],
    );

    let fixtureId: string;
    let currentStatus: string;
    let currentHome: number | null;
    let currentAway: number | null;

    if (existing.rowCount) {
      const row = existing.rows[0];
      fixtureId = row.id;
      currentStatus = row.status;
      currentHome = row.home_score;
      currentAway = row.away_score;
      // Keep kickoff current in case the match was rescheduled; score/status
      // are owned by the settle step below, never touched here.
      await pool.query("update fixtures set kickoff = $2 where id = $1", [fixtureId, kickoff]);
      summary.updated++;
    } else {
      const inserted = await pool.query<{ id: string }>(
        `insert into fixtures
           (season, gameweek, home_team, away_team, home_team_id, away_team_id, kickoff, status)
         values ($1, $2, $3, $4, $5, $6, $7, 'upcoming')
         returning id`,
        [season, gameweek, home.name, away.name, home.id, away.id, kickoff],
      );
      fixtureId = inserted.rows[0].id;
      currentStatus = "upcoming";
      currentHome = null;
      currentAway = null;
      summary.created++;
    }

    // Auto-settle finished matches. settle_fixture is idempotent (on-conflict
    // upsert of scores), so re-settling a corrected score is safe; we skip the
    // call only when this exact score is already settled, to avoid needless
    // re-scoring on every sync.
    const fh = m.score.fullTime.home;
    const fa = m.score.fullTime.away;
    if (m.status === "FINISHED" && fh != null && fa != null) {
      const alreadySettled = currentStatus === "finished" && currentHome === fh && currentAway === fa;
      if (!alreadySettled) {
        await pool.query("select settle_fixture($1, $2, $3)", [fixtureId, fh, fa]);
        summary.settled++;
      }
    }
  }

  return summary;
}
