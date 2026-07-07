import { pool } from '../../db/pool';

export interface Team {
  id: string;
  name: string;
  // Per-club branding (roadmap "branding polish") — all nullable until an
  // admin sets them; the frontend falls back to the pilot's hardcoded
  // sky-blue/gold/crest defaults when they're unset.
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
}

const TEAM_COLUMNS = 'id, name, primary_color, secondary_color, logo_url';

export async function listTeams(): Promise<Team[]> {
  const { rows } = await pool.query(`select ${TEAM_COLUMNS} from teams order by name`);
  return rows;
}

// Looks up a team a caller claims to have picked (signup/OAuth-complete).
// Returns null rather than throwing so callers can turn an unknown id into a
// 400 (bad request body) instead of a 500 (server misconfig) — the
// distinction that used to matter for getPilotTeam(), which this replaces
// now that every signup carries a real team_id instead of one hardcoded
// pilot club.
export async function getTeamById(id: string): Promise<Team | null> {
  const { rows } = await pool.query<Team>(`select ${TEAM_COLUMNS} from teams where id = $1`, [id]);
  return rows[0] ?? null;
}

// Resolves a team an admin typed into a fixture form. fixtures.home_team/
// away_team are still free-text columns, so this is what turns that text
// into a real teams.id — and the canonical teams.name gets written back,
// which fixes any casing/typo drift for free.
export async function getTeamByName(name: string): Promise<Team | null> {
  const { rows } = await pool.query<Team>(`select ${TEAM_COLUMNS} from teams where name = $1`, [name]);
  return rows[0] ?? null;
}
