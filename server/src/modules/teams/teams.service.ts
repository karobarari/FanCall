import { pool } from '../../db/pool';

export interface Team {
  id: string;
  name: string;
}

export async function listTeams(): Promise<Team[]> {
  const { rows } = await pool.query('select id, name from teams order by name');
  return rows;
}
