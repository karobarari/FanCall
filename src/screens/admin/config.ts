import { LayoutGrid, Calendar, CreditCard, Users, type LucideIcon } from "lucide-react";
const API_BASE = "http://localhost:3000/api";
/* ==================================================================
   API endpoints. Adjust these if your routes differ.
==================================================================== */
export const API = {
  fixtures: `${API_BASE}/fixtures`, //                 GET -> { fixtures }, POST -> { fixture }
  fixture: (id: string) => `${API_BASE}/fixtures/${id}`, //          PATCH -> { fixture }
  settle: (id: string) => `${API_BASE}/fixtures/${id}/settle`, //    POST  -> { fixture }
  leaderboard: `${API_BASE}/leaderboard`, //           GET -> { leaderboard }  (path/envelope ASSUMED)
  teams: `${API_BASE}/teams`, //                       GET -> { teams } | string[]  (path ASSUMED)
};

// Optional: set to your club's exact team name to highlight it in the table.
export const HIGHLIGHT_TEAM = "";
// Pre-fills the "season" field when adding a fixture.
export const DEFAULT_SEASON = "2025/26";

// Fallback team list for the fixture dropdowns when GET /api/teams isn't
// wired. 2026/27 Premier League. The live endpoint (your seeded `teams`
// table) takes priority — keep this in sync, or rely on the fetch.
export const PREMIER_LEAGUE_TEAMS = [
  "Arsenal",
  "Aston Villa",
  "Bournemouth",
  "Brentford",
  "Brighton",
  "Chelsea",
  "Coventry City",
  "Crystal Palace",
  "Everton",
  "Fulham",
  "Hull City",
  "Ipswich Town",
  "Leeds United",
  "Liverpool",
  "Manchester City",
  "Manchester United",
  "Newcastle",
  "Nottingham Forest",
  "Sunderland",
  "Tottenham",
];

export const TABS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "fixtures", label: "Fixtures", icon: Calendar },
  { id: "transactions", label: "Transactions", icon: CreditCard },
  { id: "players", label: "Players", icon: Users },
];
