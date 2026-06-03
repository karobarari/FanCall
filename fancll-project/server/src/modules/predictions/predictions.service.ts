import { pool } from '../../db/pool';
import { HttpError } from '../../lib/errors';

export async function listPredictions(userId: string) {
  const { rows } = await pool.query(
    `select fixture_id, home_pred, away_pred, updated_at
       from predictions
      where user_id = $1`,
    [userId]
  );
  return rows;
}

export async function upsertPrediction(
  userId: string,
  fixtureId: string,
  home: number,
  away: number
) {
  const fixture = await pool.query('select status, kickoff from fixtures where id = $1', [
    fixtureId,
  ]);
  if (!fixture.rowCount) throw new HttpError(404, 'Fixture not found');

  const { status, kickoff } = fixture.rows[0];
  if (status !== 'upcoming' || new Date(kickoff) <= new Date()) {
    throw new HttpError(409, 'This match has locked');
  }

  const { rows } = await pool.query(
    `insert into predictions (user_id, fixture_id, home_pred, away_pred)
     values ($1, $2, $3, $4)
     on conflict (user_id, fixture_id)
     do update set home_pred  = excluded.home_pred,
                   away_pred  = excluded.away_pred,
                   updated_at = now()
     returning fixture_id, home_pred, away_pred, updated_at`,
    [userId, fixtureId, home, away]
  );
  return rows[0];
}
