import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { listFixtures } from './fixtures.service';

export const fixturesRoutes = Router();

// GET /api/fixtures?season=2025/26&gameweek=1
fixturesRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const season = typeof req.query.season === 'string' ? req.query.season : undefined;
    const gameweek = req.query.gameweek ? Number(req.query.gameweek) : undefined;
    const fixtures = await listFixtures(season, gameweek);
    res.json({ fixtures });
  })
);
