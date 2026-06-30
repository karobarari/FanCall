import { useState } from "react";
import { Users, Search, UserPlus } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { Loading, ErrorBlock } from "../components/Status";
import type { LeaderboardEntry, Load } from "../types";

const AVATAR = [
  "bg-amber-500/20 text-amber-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-sky-500/20 text-sky-300",
  "bg-violet-500/20 text-violet-300",
  "bg-rose-500/20 text-rose-300",
];
const avatarClass = (s: string) => AVATAR[(s.charCodeAt(0) || 0) % AVATAR.length];

export function PlayersTab({
  leaderboard,
  state,
  onRetry,
}: {
  leaderboard: LeaderboardEntry[];
  state: Load;
  onRetry: () => void;
}) {
  const [q, setQ] = useState("");
  const [showAddInfo, setShowAddInfo] = useState(false);

  const ql = q.trim().toLowerCase();
  const filtered = leaderboard.filter(
    (p) => ql === "" || (p.display_name ?? "").toLowerCase().includes(ql),
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search players by name..."
            className="w-full bg-panel border border-white/10 rounded-xl pl-10 pr-3 py-3 text-ink text-sm outline-none focus:border-white/30 placeholder:text-faint"
          />
        </div>
        {/* TODO(users): creating a player is an auth-user/invite flow — wire a
            backend endpoint (e.g. POST /api/admin/players) before enabling this. */}
        <button
          onClick={() => setShowAddInfo((s) => !s)}
          className="bg-gold text-navy font-semibold rounded-xl px-4 py-3 flex items-center gap-2 whitespace-nowrap"
        >
          <UserPlus size={16} /> Add New Player
        </button>
      </div>

      {showAddInfo && (
        <div className="bg-panel border border-dashed border-white/15 rounded-card p-4">
          <p className="text-[13px] text-ink m-0 font-medium">Not wired yet</p>
          <p className="text-[13px] text-muted m-0 mt-1">
            Players are auth accounts, so adding one needs a backend create/invite flow. Wire
            an endpoint (e.g. <span className="font-mono">POST /api/admin/players</span>) and
            call it here.
          </p>
        </div>
      )}

      <p className="flex items-center gap-2 text-[13px] text-muted m-0">
        <Users size={15} className="text-faint" />
        <span>
          <span className="text-gold font-bold">
            {state === "ready" ? leaderboard.length : "\u2014"}
          </span>{" "}
          players registered
        </span>
      </p>

      {state === "loading" ? (
        <div className="bg-panel border border-white/10 rounded-card">
          <Loading label="Loading players\u2026" />
        </div>
      ) : state === "error" ? (
        <div className="bg-panel border border-white/10 rounded-card">
          <ErrorBlock label="Couldn't load players." onRetry={onRetry} />
        </div>
      ) : leaderboard.length === 0 ? (
        <EmptyState
          title="No players yet"
          lines={["Players appear here once they sign up."]}
        />
      ) : (
        <>
          <div className="bg-panel border border-white/10 rounded-card overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-faint">
                  <th className="text-left font-semibold px-5 py-3">Rank</th>
                  <th className="text-left font-semibold px-2 py-3">Player</th>
                  <th className="text-left font-semibold px-2 py-3">Total Points</th>
                  <th className="text-left font-semibold px-2 py-3">Club</th>
                  <th className="text-left font-semibold px-2 py-3">Played</th>
                  <th className="text-left font-semibold px-2 py-3">Perfect Calls</th>
                  <th className="text-left font-semibold px-5 py-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const name = p.display_name ?? "Unnamed";
                  return (
                    <tr key={p.user_id} className="border-t border-white/[0.06]">
                      <td className="px-5 py-4 text-muted font-semibold">{p.rank}</td>
                      <td className="px-2 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-[13px] font-bold ${avatarClass(name)}`}
                          >
                            {name.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-ink font-semibold whitespace-nowrap">
                            {name}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-4">
                        <span className="text-gold font-bold text-[16px]">
                          {p.total_points}
                        </span>
                      </td>
                      {/* TODO(users): columns below need a users/admin endpoint
                          exposing club, played count, perfect-call count and join date. */}
                      <td className="px-2 py-4 text-faint">{"\u2014"}</td>
                      <td className="px-2 py-4 text-faint">{"\u2014"}</td>
                      <td className="px-2 py-4 text-faint">{"\u2014"}</td>
                      <td className="px-5 py-4 text-faint">{"\u2014"}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr className="border-t border-white/[0.06]">
                    <td colSpan={7} className="px-5 py-8 text-center text-muted">
                      No players match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-faint m-0">
            Club, played, perfect calls and join date show {"\u2014"} until a users/admin
            endpoint exposes them (see TODO in code).
          </p>
        </>
      )}
    </div>
  );
}
