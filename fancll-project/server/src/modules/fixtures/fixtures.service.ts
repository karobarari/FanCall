import { pool } from '../../db/pool';

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
  const where = clauses.length ? `where ${clauses.join(' and ')}` : '';

  const { rows } = await pool.query(
    `select id, season, gameweek, home_team, away_team, kickoff,
            home_score, away_score, status
       from fixtures ${where}
      order by kickoff`,
    params
  );
  return rows;
}
