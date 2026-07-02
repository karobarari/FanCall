import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requirePaid } from "../../middleware/auth";
import { HttpError } from "../../lib/errors";
import { listPredictions, upsertPrediction } from "./predictions.service";

export const predictionsRoutes = Router();

// Everything here needs a signed-in, paid user — this is the product the
// demo payment step gates. Checked server-side (not just a frontend
// redirect) so it can't be bypassed by calling the API directly.
predictionsRoutes.use(requireAuth);
predictionsRoutes.use(asyncHandler(requirePaid));

predictionsRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const predictions = await listPredictions(req.userId!);
    res.json({ predictions });
  }),
);

const body = z.object({
  fixture_id: z.string().uuid(),
  home_pred: z.number().int().min(0),
  away_pred: z.number().int().min(0),
  result_pred: z.enum(["home", "draw", "away"]),
});

predictionsRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid prediction");
    const { fixture_id, home_pred, away_pred, result_pred } = parsed.data;

    const prediction = await upsertPrediction(
      req.userId!,
      fixture_id,
      home_pred,
      away_pred,
      result_pred,
    );
    res.json({ prediction });
  }),
);
