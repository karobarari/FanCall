// Pure scoring logic for FanCall.
//
// Canonical rule (see docs/SCORING.md, verified against the SQL
// score_prediction function): three independent calls per fixture —
//   result (home/draw/away), home score, away score.
// Each call: +10 correct, +5 submitted-but-wrong.
// +20 perfect-call bonus when all three are correct.
// Range for a scored prediction: 15 (all wrong) .. 50 (perfect).
//
// Important distinctions the higher-level functions enforce:
//   - 15 is the floor for a prediction that WAS submitted on a PLAYED match.
//   - 12 (4 per call x 3) is the "missed fixture" credit: a fan who made no
//     prediction on a FINISHED fixture. This also covers "join anytime" —
//     fixtures finished before a fan joined are, for them, missed fixtures.
//   - 0 is only for a void / unplayed fixture: it hasn't happened, so there is
//     nothing to score and nothing to miss.
//
// Kept pure so settlement / a future background worker can import directly.

export type MatchResult = "home" | "draw" | "away";

export const CORRECT = 10;
export const WRONG = 5;
export const PERFECT_BONUS = 20;
export const MIN_SCORED = 15; // floor when a prediction was actually submitted
export const MISSED = 12; // 4 per call x 3 calls: no prediction on a finished fixture
export const NO_SCORE = 0; // void / unplayed fixture only — nothing to score or miss

export interface Prediction {
  userId: string;
  resultPred: MatchResult;
  homePred: number;
  awayPred: number;
}

export interface FixtureResult {
  homeScore: number;
  awayScore: number;
}

/** Derive the actual result from a final scoreline. */
export function resultFromScore(
  homeScore: number,
  awayScore: number,
): MatchResult {
  if (homeScore > awayScore) return "home";
  if (homeScore < awayScore) return "away";
  return "draw";
}

/**
 * Score a single prediction against an actual result.
 * The three calls are judged independently, so a self-contradictory
 * prediction (result "draw" with a 2-1 scoreline) is scored as entered.
 */
export function scorePrediction(
  resultPred: MatchResult,
  homePred: number,
  awayPred: number,
  actualHome: number,
  actualAway: number,
): number {
  const actualResult = resultFromScore(actualHome, actualAway);

  const resultPts = resultPred === actualResult ? CORRECT : WRONG;
  const homePts = homePred === actualHome ? CORRECT : WRONG;
  const awayPts = awayPred === actualAway ? CORRECT : WRONG;

  const allThreeRight =
    resultPts === CORRECT && homePts === CORRECT && awayPts === CORRECT;
  const bonus = allThreeRight ? PERFECT_BONUS : 0;

  return resultPts + homePts + awayPts + bonus;
}

/**
 * Score every prediction for one fixture.
 *
 * @param predictions all predictions submitted for this fixture
 * @param result      the final result, or null if the fixture is void /
 *                    not yet played
 * @returns one row per prediction: { userId, points }. A void fixture
 *          scores every prediction 0. (Fans with no prediction simply do
 *          not appear here — there is no row to score.)
 */
export function scoreFixture(
  predictions: Prediction[],
  result: FixtureResult | null,
): { userId: string; points: number }[] {
  return predictions.map((p) => {
    if (result === null) {
      return { userId: p.userId, points: NO_SCORE };
    }
    return {
      userId: p.userId,
      points: scorePrediction(
        p.resultPred,
        p.homePred,
        p.awayPred,
        result.homeScore,
        result.awayScore,
      ),
    };
  });
}

/**
 * A fan's points for a single fixture, handling the missing-prediction case.
 *
 * @param prediction the fan's prediction, or null if they didn't submit one
 * @param result     the fixture result, or null if void / not played
 * @returns points:
 *   - void / unplayed fixture (result null)      -> 0  (nothing to miss yet)
 *   - finished fixture, no prediction submitted  -> 12 (the missed-fixture credit)
 *   - finished fixture, prediction submitted     -> 15..50 via scorePrediction
 *
 * This is the building block for totals. A no-show on a played fixture earns
 * 12, NOT 0 and NOT the 15 floor — the floor still requires three (wrong) calls.
 * Mirrors the SQL leaderboard view, which credits 12 for every finished fixture
 * a fan has no scored row for.
 */
export function scoreFixtureForUser(
  prediction: Prediction | null,
  result: FixtureResult | null,
): number {
  if (result === null) return NO_SCORE; // void / not played — nothing to miss
  if (prediction === null) return MISSED; // finished fixture, no submission
  return scorePrediction(
    prediction.resultPred,
    prediction.homePred,
    prediction.awayPred,
    result.homeScore,
    result.awayScore,
  );
}

/**
 * A fan's running total across many fixtures (their leaderboard points).
 * Pass one entry per fixture, pairing the fan's prediction (or null) with the
 * result (or null). Void / unplayed fixtures add 0; a finished fixture the fan
 * didn't predict adds the 12 missed-fixture credit; a predicted finished
 * fixture adds 15..50.
 */
export function userTotal(
  entries: { prediction: Prediction | null; result: FixtureResult | null }[],
): number {
  return entries.reduce(
    (sum, e) => sum + scoreFixtureForUser(e.prediction, e.result),
    0,
  );
}

/**
 * Build a ranked leaderboard from per-user totals.
 * Ties share the lower rank number (standard competition ranking: 1,2,2,4).
 */
export function rankLeaderboard(
  totals: { userId: string; points: number }[],
): { userId: string; points: number; rank: number }[] {
  const sorted = [...totals].sort((a, b) => b.points - a.points);
  let lastPoints: number | null = null;
  let lastRank = 0;
  return sorted.map((row, i) => {
    const rank = row.points === lastPoints ? lastRank : i + 1;
    lastPoints = row.points;
    lastRank = rank;
    return { ...row, rank };
  });
}
