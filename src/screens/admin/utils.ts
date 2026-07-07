import type { AdminUserRow, LeaderboardEntry } from "./types";

export const truncate = (s: string) => (s.length > 12 ? s.slice(0, 12) + "\u2026" : s);
export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

export function pickLeaderboard(json: unknown): LeaderboardEntry[] {
  const raw: unknown = Array.isArray(json)
    ? json
    : isObj(json) && Array.isArray(json.leaderboard)
      ? json.leaderboard
      : isObj(json) && Array.isArray(json.entries)
        ? json.entries
        : isObj(json) && Array.isArray(json.data)
          ? json.data
          : [];
  return (raw as unknown[]).map((item) => {
    const r = (isObj(item) ? item : {}) as Record<string, unknown>;
    const name = r.display_name ?? r.displayName;
    return {
      user_id: String(r.user_id ?? r.userId ?? ""),
      display_name: typeof name === "string" ? name : null,
      total_points: Number(r.total_points ?? r.points ?? 0),
      rank: Number(r.rank ?? 0),
    };
  });
}

// GET /api/admin/users response — field names are fixed (this endpoint and
// its frontend consumer are written together), so this just coerces types
// defensively rather than guessing at alternate shapes like pickLeaderboard.
export function pickAdminUsers(json: unknown): AdminUserRow[] {
  const raw = isObj(json) && Array.isArray(json.users) ? json.users : [];
  return (raw as unknown[]).map((item) => {
    const r = (isObj(item) ? item : {}) as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      email: String(r.email ?? ""),
      display_name: typeof r.display_name === "string" ? r.display_name : null,
      avatar: typeof r.avatar === "string" ? r.avatar : null,
      team_name: typeof r.team_name === "string" ? r.team_name : "",
      paid: Boolean(r.paid),
      is_active: Boolean(r.is_active),
      created_at: typeof r.created_at === "string" ? r.created_at : "",
    };
  });
}

export function pickTeams(json: unknown): string[] {
  const raw: unknown = Array.isArray(json)
    ? json
    : isObj(json) && Array.isArray(json.teams)
      ? json.teams
      : isObj(json) && Array.isArray(json.data)
        ? json.data
        : [];
  return (raw as unknown[])
    .map((item) => {
      if (typeof item === "string") return item;
      if (isObj(item)) {
        const n = item.name ?? item.team ?? item.title;
        return typeof n === "string" ? n : "";
      }
      return "";
    })
    .filter((s) => s !== "");
}

export async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const j = (await res.json()) as Record<string, unknown>;
    if (typeof j?.error === "string") return j.error;
    if (typeof j?.message === "string") return j.message;
  } catch {
    /* not JSON */
  }
  return `${fallback} (${res.status}).`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ISO timestamp -> value for <input type="datetime-local"> (local time).
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
