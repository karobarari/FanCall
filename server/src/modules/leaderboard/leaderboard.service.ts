import { pool } from '../../db/pool';
import { rankLeaderboard } from '../predictions/scoring';

// A single row of the public leaderboard, as the API returns it.
export interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  total_points: number;
  rank: number;
  team_id: string;
  team_name: string;
  team_logo_url: string | null;
  avatar: string | null;
}

// Build the leaderboard, scoped to one club or spanning the whole league.
//
// Totals come straight from the `leaderboard` view (which already folds in the
// 12-pt missed-fixture credit, computed per-user against only their own
// club's finished fixtures). Ranking is delegated to rankLeaderboard() — the
// same pure, unit-tested function the scoring spec uses — so tied fans SHARE a
// rank (standard competition ranking: 1, 2, 2, 4) instead of getting arbitrary
// sequential numbers.
//
// teamId scopes to one club's fans ("club" leaderboard); omit it for the
// league-wide leaderboard spanning every club — the view's per-user
// correlated fixture count already makes that unfiltered total correct.
//
// The SQL ORDER BY gives a deterministic tiebreak (alphabetical, then id) so the
// order among equal-points fans is stable across requests; rankLeaderboard's
// sort is stable, so it preserves that order. total_points is coerced to a
// number because pg returns the view's bigint sum as a string.
export async function getLeaderboard(teamId?: string): Promise<LeaderboardEntry[]> {
  const where = teamId ? 'where l.team_id = $1' : '';
  const params = teamId ? [teamId] : [];
  const { rows } = await pool.query<{
    user_id: string;
    display_name: string | null;
    total_points: string | number;
    team_id: string;
    team_name: string;
    team_logo_url: string | null;
    avatar: string | null;
  }>(
    `select l.user_id, l.display_name, l.total_points,
            l.team_id, t.name as team_name, t.logo_url as team_logo_url,
            u.avatar
       from leaderboard l
       join teams t on t.id = l.team_id
       join users u on u.id = l.user_id
       ${where}
      order by l.total_points desc, l.display_name asc, l.user_id asc`,
    params,
  );

  // rankLeaderboard carries only { userId, points } through, so keep the rest
  // of each row by id to re-attach after ranking.
  const byId = new Map(rows.map((r) => [r.user_id, r] as const));

  const ranked = rankLeaderboard(
    rows.map((r) => ({ userId: r.user_id, points: Number(r.total_points) })),
  );

  return ranked.map((r) => {
    const row = byId.get(r.userId);
    return {
      user_id: r.userId,
      display_name: row?.display_name ?? null,
      total_points: r.points,
      rank: r.rank,
      team_id: row!.team_id,
      team_name: row!.team_name,
      team_logo_url: row!.team_logo_url,
      avatar: row?.avatar ?? null,
    };
  });
}
