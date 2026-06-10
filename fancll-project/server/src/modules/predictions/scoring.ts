// Pure scoring logic for one prediction against one actual result.
//
// Canonical rule (see docs/SCORING.md, verified against the SQL
// score_prediction function): three independent calls per fixture —
//   result (home/draw/away), home score, away score.
// Each call: +10 correct, +5 submitted-but-wrong.
// +20 perfect-call bonus when all three are correct.
// Range: 15 (all wrong) .. 50 (perfect).
//
// Kept as a pure function so settlement can import it directly and a
// future background worker can reuse it without the HTTP/DB layer.

export type MatchResult = "home" | "draw" | "away";

export const CORRECT = 10;
export const WRONG = 5;
export const PERFECT_BONUS = 20;

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
 * Score a single prediction.
 * The three calls are judged independently against reality, so a
 * self-contradictory prediction (e.g. result "draw" with a 2-1 scoreline)
 * is scored exactly as entered — each call on its own merits.
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
