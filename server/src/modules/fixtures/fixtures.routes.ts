import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { HttpError } from "../../lib/errors";
import { isAdminEmail } from "../../lib/adminEmail";
import { pool } from "../../db/pool";
import {
  listFixtures,
  settleFixture,
  createFixture, // ── NEW ──
  updateFixture, // ── NEW ──
} from "./fixtures.service";

export const fixturesRoutes = Router();

// GET /api/fixtures?season=2025/26&gameweek=1
// Scoped to the caller's own club (home OR away — a fixture is visible to
// both clubs playing in it) so a Man City fan can't spoof Arsenal's list by
// changing a query param; admin sees every club's fixtures unfiltered, for
// the fixture-management view.
fixturesRoutes.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const season =
      typeof req.query.season === "string" ? req.query.season : undefined;
    const gameweek = req.query.gameweek
      ? Number(req.query.gameweek)
      : undefined;

    const { rows } = await pool.query<{ team_id: string; email: string }>(
      "select team_id, email from users where id = $1",
      [req.userId],
    );
    const caller = rows[0];
    if (!caller) throw new HttpError(401, "Not authenticated");

    const teamId = isAdminEmail(caller.email) ? undefined : caller.team_id;
    const fixtures = await listFixtures(season, gameweek, teamId);
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

// ── NEW ──────────────────────────────────────────────────────────
// Shared fixture-metadata fields. Scores are deliberately excluded — they're
// owned by the settle route, never set on create/edit.
// kickoff expects an ISO 8601 string (e.g. "2025-08-16T14:00:00.000Z"); the
// frontend sends new Date(<datetime-local value>).toISOString().
const fixtureFields = {
  season: z.string().min(1),
  gameweek: z.number().int().min(1),
  home_team: z.string().min(1),
  away_team: z.string().min(1),
  kickoff: z.string().datetime(),
};

const createFixtureBody = z
  .object(fixtureFields)
  .refine((b) => b.home_team !== b.away_team, {
    message: "Home and away teams must differ",
  });

const updateFixtureBody = z
  .object({
    season: fixtureFields.season.optional(),
    gameweek: fixtureFields.gameweek.optional(),
    home_team: fixtureFields.home_team.optional(),
    away_team: fixtureFields.away_team.optional(),
    kickoff: fixtureFields.kickoff.optional(),
    // Admin-controlled early lock, independent of kickoff/status — see
    // predictions.service.ts's upsertPrediction for enforcement.
    locked: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, {
    message: "Provide at least one field to update",
  })
  .refine((b) => !(b.home_team && b.away_team) || b.home_team !== b.away_team, {
    message: "Home and away teams must differ",
  });

// POST /api/fixtures  (admin only) — schedule a new fixture
fixturesRoutes.post(
  "/",
  requireAuth,
  asyncHandler(requireAdmin),
  asyncHandler(async (req, res) => {
    const parsed = createFixtureBody.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid fixture",
      );
    }
    const fixture = await createFixture(parsed.data);
    res.status(201).json({ fixture });
  }),
);

// PATCH /api/fixtures/:id  (admin only) — edit fixture metadata (not the score)
fixturesRoutes.patch(
  "/:id",
  requireAuth,
  asyncHandler(requireAdmin),
  asyncHandler(async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success) {
      throw new HttpError(400, "Invalid fixture id");
    }
    const parsed = updateFixtureBody.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid update",
      );
    }
    const fixture = await updateFixture(req.params.id, parsed.data);
    res.json({ fixture });
  }),
);
// ─────────────────────────────────────────────────────────────────
