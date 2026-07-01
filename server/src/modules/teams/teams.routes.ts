import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { listTeams } from './teams.service';

export const teamsRoutes = Router();

// Public — the team picker needs this before a session exists (signup flow).
teamsRoutes.get(
  '/',
  asyncHandler(async (_req, res) => {
    const teams = await listTeams();
    res.json({ teams });
  }),
);
