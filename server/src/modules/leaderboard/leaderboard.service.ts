import { pool } from '../../db/pool';
import { rankLeaderboard } from '../predictions/scoring';

// A single row of the public leaderboard, as the API returns it.
export interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  total_points: number;
  rank: number;
}

// Build the public leaderboard.
//
// Totals come straight from the `leaderboard` view (which already folds in the
// 12-pt missed-fixture credit). Ranking is delegated to rankLeaderboard() — the
// same pure, unit-tested function the scoring spec uses — so tied fans SHARE a
// rank (standard competition ranking: 1, 2, 2, 4) instead of getting arbitrary
// sequential numbers.
//
// The SQL ORDER BY gives a deterministic tiebreak (alphabetical, then id) so the
// order among equal-points fans is stable across requests; rankLeaderboard's
// sort is stable, so it preserves that order. total_points is coerced to a
// number because pg returns the view's bigint sum as a string.
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const { rows } = await pool.query<{
    user_id: string;
    display_name: string | null;
    total_points: string | number;
  }>(
    `select user_id, display_name, total_points
       from leaderboard
      order by total_points desc, display_name asc, user_id asc`,
  );

  // rankLeaderboard carries only { userId, points } through, so keep names by id
  // to re-attach after ranking.
  const names = new Map(rows.map((r) => [r.user_id, r.display_name] as const));

  const ranked = rankLeaderboard(
    rows.map((r) => ({ userId: r.user_id, points: Number(r.total_points) })),
  );

  return ranked.map((r) => ({
    user_id: r.userId,
    display_name: names.get(r.userId) ?? null,
    total_points: r.points,
    rank: r.rank,
  }));
}
