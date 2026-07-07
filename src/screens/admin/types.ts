// Shared types for the admin feature.

export type Fixture = {
  id: string;
  season: string;
  gameweek: number;
  home_team: string;
  away_team: string;
  kickoff: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  locked: boolean;
};

export type FixtureDraft = {
  season: string;
  gameweek: number;
  home_team: string;
  away_team: string;
  kickoff: string; // ISO 8601
};

export type LeaderboardEntry = {
  user_id: string;
  display_name: string | null;
  total_points: number;
  rank: number;
};

export type AdminUserRow = {
  id: string;
  email: string;
  display_name: string | null;
  avatar: string | null;
  team_name: string;
  paid: boolean;
  is_active: boolean;
  created_at: string;
};

export type Load = "loading" | "error" | "ready";
