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
import { syncPremierLeagueFixtures } from "./footballData.service";

export const fixturesRoutes = Router();

// GET /api/fixtures?season=2025/26&gameweek=1
// Scoped by default to the caller's own club (home OR away — a fixture is
// visible to both clubs playing in it), so every user — admin included — sees
// only their own team's fixtures on the prediction page, and a fan can't spoof
// another club's list by changing a query param.
//
// scope=all lifts the club filter to return every club's fixtures — the
// admin-only fixture-management view. It's ignored for non-admins (they stay
// scoped to their club regardless), so it can't be used to escape scoping.
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

    const wantsAll = req.query.scope === "all" && isAdminEmail(caller.email);
    const teamId = wantsAll ? undefined : caller.team_id;
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

// POST /api/fixtures/sync  (admin only)
// Pulls the Premier League season's fixtures + results from the
// football-data.org free feed, upserts them, and auto-settles finished
// matches — replacing manual fixture entry. Returns a summary of what changed.
// 503s until FOOTBALL_DATA_API_KEY is set. Manual trigger for now; a scheduler
// to call this on a cadence is the remaining "fully integrate" work.
fixturesRoutes.post(
  "/sync",
  requireAuth,
  asyncHandler(requireAdmin),
  asyncHandler(async (_req, res) => {
    const summary = await syncPremierLeagueFixtures();
    res.json({ summary });
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
