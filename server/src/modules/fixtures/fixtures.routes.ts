import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { HttpError } from "../../lib/errors";
import { listFixtures, settleFixture } from "./fixtures.service";

export const fixturesRoutes = Router();

// GET /api/fixtures?season=2025/26&gameweek=1  (public — drives the play page)
fixturesRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const season =
      typeof req.query.season === "string" ? req.query.season : undefined;
    const gameweek = req.query.gameweek
      ? Number(req.query.gameweek)
      : undefined;
    const fixtures = await listFixtures(season, gameweek);
    res.json({ fixtures });
  }),
);

const settleBody = z.object({
  home_score: z.number().int().min(0),
  away_score: z.number().int().min(0),
});

// POST /api/fixtures/:id/settle  (admin only)
// Records the final score and scores every prediction for the fixture, then
// returns the updated fixture so the caller can reflect the 'finished' state.
fixturesRoutes.post(
  "/:id/settle",
  requireAuth,
  asyncHandler(requireAdmin),
  asyncHandler(async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success) {
      throw new HttpError(400, "Invalid fixture id");
    }
    const parsed = settleBody.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        "Invalid result — need integer home_score and away_score",
      );
    }

    const fixture = await settleFixture(
      req.params.id,
      parsed.data.home_score,
      parsed.data.away_score,
    );
    res.json({ fixture });
  }),
);
