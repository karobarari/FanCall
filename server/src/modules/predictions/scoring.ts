// Pure scoring logic for FanCall.
//
// Canonical rule (see docs/SCORING.md, verified against the SQL
// score_prediction function): three independent calls per fixture —
//   result (home/draw/away), home score, away score.
// Each call: +10 correct, +5 submitted-but-wrong.
// +20 perfect-call bonus when all three are correct.
// Range for a scored prediction: 15 (all wrong) .. 50 (perfect).
//
// Important distinction the higher-level functions enforce:
//   - 15 is the floor for a prediction that WAS submitted on a PLAYED match.
//   - 0 is for a missing prediction (fan didn't submit) or a void/unplayed
//     fixture. No three calls were made, so there is nothing to score.
//
// Kept pure so settlement / a future background worker can import directly.

export type MatchResult = "home" | "draw" | "away";

export const CORRECT = 10;
export const WRONG = 5;
export const PERFECT_BONUS = 20;
export const MIN_SCORED = 15; // floor when a prediction was actually submitted
export const NO_SCORE = 0; // missing prediction or void fixture

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
 * @returns points; 0 if either the prediction or the result is absent.
 *
 * This is the building block for totals: a no-show scores 0, NOT the 15
 * floor — the floor requires having submitted three (wrong) calls.
 */
export function scoreFixtureForUser(
  prediction: Prediction | null,
  result: FixtureResult | null,
): number {
  if (prediction === null || result === null) return NO_SCORE;
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
 * Each entry pairs the fan's prediction (or null) with the result (or null);
 * void fixtures and skipped fixtures contribute 0.
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
