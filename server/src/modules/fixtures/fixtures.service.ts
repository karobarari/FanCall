import { pool } from "../../db/pool";
import { HttpError } from "../../lib/errors";

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
    `select id, season, gameweek, home_team, away_team, kickoff,
            home_score, away_score, status
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
    `select id, season, gameweek, home_team, away_team, kickoff,
            home_score, away_score, status
       from fixtures
      where id = $1`,
    [fixtureId],
  );
  return rows[0];
}
