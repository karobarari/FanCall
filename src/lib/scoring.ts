import type { MatchResult } from "./result";

// Frontend mirror of the server's score_prediction() SQL function.
// Each of the three calls (result, home score, away score) scores 10 if correct
// and 5 if wrong; all three correct earns a +20 bonus. Range 15–50 per fixture.
export function scorePrediction(
  pred: { home: number; away: number; result_pred: MatchResult },
  actual: { home_score: number; away_score: number },
): { points: number; perfect: boolean } {
  const actualResult: MatchResult =
    actual.home_score > actual.away_score
      ? "home"
      : actual.home_score < actual.away_score
        ? "away"
        : "draw";

  const resultPts = pred.result_pred === actualResult ? 10 : 5;
  const homePts = pred.home === actual.home_score ? 10 : 5;
  const awayPts = pred.away === actual.away_score ? 10 : 5;

  const allRight = resultPts === 10 && homePts === 10 && awayPts === 10;
  return {
    points: resultPts + homePts + awayPts + (allRight ? 20 : 0),
    perfect: allRight,
  };
}

// Credit for a finished fixture with no prediction submitted.
// 4 points per call × 3 calls (result, home, away). No perfect bonus.
// Covers both "Missed Fixture" (existing player didn't predict) and
// "Join Anytime" (player joined after the fixture finished).
// NOTE: 12 sits intentionally BELOW the 15-point floor of scorePrediction —
// not predicting should score worse than predicting everything wrong.
// Do not "fix" this to 15.
export const MISSED_FIXTURE_POINTS = 12;
