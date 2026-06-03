import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { HttpError } from '../../lib/errors';
import { listPredictions, upsertPrediction } from './predictions.service';

export const predictionsRoutes = Router();

// Everything here needs a signed-in user.
predictionsRoutes.use(requireAuth);

predictionsRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const predictions = await listPredictions(req.userId!);
    res.json({ predictions });
  })
);

const body = z.object({
  fixtureId: z.string().uuid(),
  home: z.number().int().min(0),
  away: z.number().int().min(0),
});

predictionsRoutes.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Invalid prediction');
    const { fixtureId, home, away } = parsed.data;
    const prediction = await upsertPrediction(req.userId!, fixtureId, home, away);
    res.json({ prediction });
  })
);
