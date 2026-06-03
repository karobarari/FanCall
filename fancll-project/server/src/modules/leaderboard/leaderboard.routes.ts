import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { getLeaderboard } from './leaderboard.service';

export const leaderboardRoutes = Router();

leaderboardRoutes.get(
  '/',
  asyncHandler(async (_req, res) => {
    const leaderboard = await getLeaderboard();
    res.json({ leaderboard });
  })
);
