import { pool } from '../../db/pool';

export async function getLeaderboard() {
  const { rows } = await pool.query(
    'select user_id, display_name, total_points from leaderboard'
  );
  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}
