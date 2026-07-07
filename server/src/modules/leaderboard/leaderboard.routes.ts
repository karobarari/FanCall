import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { pool } from '../../db/pool';
import { HttpError } from '../../lib/errors';
import { getLeaderboard } from './leaderboard.service';

export const leaderboardRoutes = Router();

const scopeQuery = z.enum(['club', 'league']).default('club');

// GET /api/leaderboard?scope=club|league — "club" (the default) ranks the
// signed-in fan against others following the same team; "league" pools
// every club together for the league-wide grand-prize standings.
leaderboardRoutes.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = scopeQuery.safeParse(req.query.scope);
    if (!parsed.success) throw new HttpError(400, 'Invalid scope — expected "club" or "league"');

    let teamId: string | undefined;
    if (parsed.data === 'club') {
      const { rows } = await pool.query<{ team_id: string }>(
        'select team_id from users where id = $1',
        [req.userId],
      );
      if (!rows[0]) throw new HttpError(401, 'Not authenticated');
      teamId = rows[0].team_id;
    }

    const leaderboard = await getLeaderboard(teamId);
    res.json({ leaderboard });
  })
);
