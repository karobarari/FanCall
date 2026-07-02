import { pool } from '../../db/pool';
import { PILOT_TEAM_NAME } from '../../config/pilotTeam';
import { HttpError } from '../../lib/errors';

export interface Team {
  id: string;
  name: string;
}

export async function listTeams(): Promise<Team[]> {
  const { rows } = await pool.query('select id, name from teams order by name');
  return rows;
}

// The only team new signups are assigned to right now. Throws (500, not a
// user-facing error) if it isn't seeded — that's a deploy/config mistake,
// not something a request body could cause.
export async function getPilotTeam(): Promise<Team> {
  const { rows } = await pool.query<Team>('select id, name from teams where name = $1', [
    PILOT_TEAM_NAME,
  ]);
  if (!rows[0]) {
    throw new HttpError(500, `Pilot team "${PILOT_TEAM_NAME}" is not seeded`);
  }
  return rows[0];
}
