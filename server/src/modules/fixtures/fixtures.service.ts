import { pool } from "../../db/pool";
import { HttpError } from "../../lib/errors";

// ── NEW ──────────────────────────────────────────────────────────
// The exact column set every fixtures query returns. Centralised so
// list / settle / create / update can never drift out of shape — the
// frontend relies on these field names.
const FIXTURE_COLUMNS = `id, season, gameweek, home_team, away_team, kickoff,
                         home_score, away_score, status, locked`;

// Pre-finished status. 'upcoming' is the confirmed canonical value across the
// system: fixtures-play.sql seeds it, and predictions.service.ts only accepts a
// prediction while status === 'upcoming'. schema.sql's column DEFAULT is aligned
// to 'upcoming' to match (it previously read 'scheduled', which would have made
// any default-status fixture silently reject all predictions).
const NEW_FIXTURE_STATUS = "upcoming";
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "23505"
  );
}
// ─────────────────────────────────────────────────────────────────

export async function listFixtures(season?: string, gameweek?: number) {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (season) {
    params.push(season);
    clauses.push(`season = $${params.length}`);
  }
  if (gameweek !== undefined) {
    params.push(gameweek);
    clauses.push(`gameweek = $${params.length}`);
  }
  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";

  const { rows } = await pool.query(
    `select ${FIXTURE_COLUMNS}
       from fixtures ${where}
      order by kickoff`,
    params,
  );
  return rows;
}

// Record a fixture's final score and score every prediction for it.
// The heavy lifting is the settle_fixture() SQL function: it flips the fixture
// to 'finished' and upserts one `scores` row per prediction. Because that
// upsert is on-conflict-update, calling this again with a corrected score
// safely re-scores in place — handy for fixing a fat-fingered result.
export async function settleFixture(
  fixtureId: string,
  homeScore: number,
  awayScore: number,
) {
  const existing = await pool.query("select id from fixtures where id = $1", [
    fixtureId,
  ]);
  if (!existing.rowCount) throw new HttpError(404, "Fixture not found");

  await pool.query("select settle_fixture($1, $2, $3)", [
    fixtureId,
    homeScore,
    awayScore,
  ]);

  const { rows } = await pool.query(
    `select ${FIXTURE_COLUMNS}
       from fixtures
      where id = $1`,
    [fixtureId],
  );
  return rows[0];
}

// ── NEW ──────────────────────────────────────────────────────────

export type FixtureInput = {
  season: string;
  gameweek: number;
  home_team: string;
  away_team: string;
  kickoff: string; // ISO 8601 timestamp
};

// Schedule a new fixture. Scores stay null — they're owned by settle, never
// set at creation. Inserting a row is all it takes: it immediately surfaces in
// predictions, scoring and the leaderboard (fixture-driven architecture).
//
// Note: home_team / away_team are free text (schema.sql does not FK them to
// teams). Fine for the skeleton -- an admin enters known club names. If you want
// data integrity later, FK them to teams(name) or validate here before insert.
export async function createFixture(input: FixtureInput) {
  try {
    const { rows } = await pool.query(
      `insert into fixtures (season, gameweek, home_team, away_team, kickoff, status)
       values ($1, $2, $3, $4, $5, $6)
       returning ${FIXTURE_COLUMNS}`,
      [
        input.season,
        input.gameweek,
        input.home_team,
        input.away_team,
        input.kickoff,
        NEW_FIXTURE_STATUS,
      ],
    );
    return rows[0];
  } catch (err) {
    // 23505 = unique_violation. Only fires if you add a unique index on the
    // fixture identity (see the migration note in the chat).
    if (isUniqueViolation(err)) {
      throw new HttpError(409, "That fixture already exists");
    }
    throw err;
  }
}

export type FixturePatch = Partial<FixtureInput> & { locked?: boolean };

// Edit a fixture's metadata (season, gameweek, teams, kickoff), or toggle its
// manual lock — never its score. Refuses once a fixture is finished: changing
// teams or gameweek after settlement would silently invalidate already-scored
// predictions (locking a finished fixture is moot — it's already unpredictable).
export async function updateFixture(id: string, patch: FixturePatch) {
  const existing = await pool.query(
    "select status from fixtures where id = $1",
    [id],
  );
  if (!existing.rowCount) throw new HttpError(404, "Fixture not found");
  if (existing.rows[0].status === "finished") {
    throw new HttpError(
      409,
      "Can't edit a finished fixture — re-settle to correct the score",
    );
  }

  const sets: string[] = [];
  const params: unknown[] = [id];
  const add = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };

  if (patch.season !== undefined) add("season", patch.season);
  if (patch.gameweek !== undefined) add("gameweek", patch.gameweek);
  if (patch.home_team !== undefined) add("home_team", patch.home_team);
  if (patch.away_team !== undefined) add("away_team", patch.away_team);
  if (patch.kickoff !== undefined) add("kickoff", patch.kickoff);
  if (patch.locked !== undefined) add("locked", patch.locked);

  if (sets.length === 0) throw new HttpError(400, "No fields to update");

  try {
    const { rows } = await pool.query(
      `update fixtures set ${sets.join(", ")}
        where id = $1
      returning ${FIXTURE_COLUMNS}`,
      params,
    );
    return rows[0];
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, "That fixture already exists");
    }
    throw err;
  }
}
// ─────────────────────────────────────────────────────────────────
