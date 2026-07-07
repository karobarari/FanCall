// src/lib/result.ts
export type MatchResult = "home" | "draw" | "away";
export type ClubResult = "WIN" | "DRAW" | "LOSE"; // UI labels stay as-is

// Whether the signed-in fan's own club is the home side in this fixture —
// a runtime comparison against their team_id, not a single build-time
// VITE_CLUB constant, now that a fan can follow any club.
export const clubIsHome = (fx: { home_team_id: string }, teamId: string) =>
  fx.home_team_id === teamId;

// fan's WIN/DRAW/LOSE pick -> canonical result_pred (lowercase, matches DB constraint)
export function toResultPred(pick: ClubResult, isHome: boolean): MatchResult {
  if (pick === "DRAW") return "draw";
  return (pick === "WIN") === isHome ? "home" : "away";
}

// stored result_pred -> WIN/DRAW/LOSE (for repopulating a saved pick)
export function toClubResult(pred: MatchResult, isHome: boolean): ClubResult {
  if (pred === "draw") return "DRAW";
  return (pred === "home") === isHome ? "WIN" : "LOSE";
}
