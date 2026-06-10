// src/lib/result.ts
export const CLUB = import.meta.env.VITE_CLUB;

export type MatchResult = "home" | "draw" | "away";
export type ClubResult = "WIN" | "DRAW" | "LOSE"; // UI labels stay as-is

export const clubIsHome = (fx: { home_team: string }) => fx.home_team === CLUB;

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
