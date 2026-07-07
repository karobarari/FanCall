import { useState, Fragment } from "react";
import { Users, Search, UserPlus, Pencil, UserX, UserCheck } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { Loading, ErrorBlock } from "../components/Status";
import Avatar from "../../../components/Avatar";
import type { AdminUserRow, LeaderboardEntry, Load } from "../types";
import { fmtDate } from "../utils";

function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center rounded-full bg-green/15 text-green text-[12px] font-semibold px-2.5 py-1">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-red-400/15 text-red-400 text-[12px] font-semibold px-2.5 py-1">
      Deactivated
    </span>
  );
}

export function PlayersTab({
  users,
  state,
  leaderboard,
  onRetry,
  onUpdateUsername,
  onSetActive,
}: {
  users: AdminUserRow[];
  state: Load;
  leaderboard: LeaderboardEntry[];
  onRetry: () => void;
  onUpdateUsername: (id: string, displayName: string) => Promise<void>;
  onSetActive: (id: string, isActive: boolean) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [showAddInfo, setShowAddInfo] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const byUserId = new Map(leaderboard.map((r) => [r.user_id, r]));

  const ql = q.trim().toLowerCase();
  const filtered = users.filter(
    (u) =>
      ql === "" ||
      (u.display_name ?? "").toLowerCase().includes(ql) ||
      u.email.toLowerCase().includes(ql),
  );

  function openEdit(u: AdminUserRow) {
    setEditingId(u.id);
    setEditName(u.display_name ?? "");
    setEditError("");
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) {
      setEditError("Username can't be empty.");
      return;
    }
    setEditBusy(true);
    setEditError("");
    try {
      await onUpdateUsername(id, editName.trim());
      setEditingId(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Couldn't save username.");
    } finally {
      setEditBusy(false);
    }
  }

  async function handleToggleActive(u: AdminUserRow) {
    setStatusBusyId(u.id);
    try {
      await onSetActive(u.id, !u.is_active);
    } catch {
      /* surfaced via onRetry's error state on the next load if it matters */
    } finally {
      setStatusBusyId(null);
    }
  }

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
            placeholder="Search players by name or email..."
            className="w-full bg-panel border border-white/10 rounded-xl pl-10 pr-3 py-3 text-ink text-sm outline-none focus:border-white/30 placeholder:text-faint"
          />
        </div>
        {/* TODO(users): creating a player is an auth-user/invite flow — wire
            a backend endpoint (e.g. POST /api/admin/users/invite) before enabling this. */}
        <button
          onClick={() => setShowAddInfo((s) => !s)}
          className="bg-city-gold text-navy font-semibold rounded-xl px-4 py-3 flex items-center gap-2 whitespace-nowrap"
        >
          <UserPlus size={16} /> Add New Player
        </button>
      </div>

      {showAddInfo && (
        <div className="bg-panel border border-dashed border-white/15 rounded-card p-4">
          <p className="text-[13px] text-ink m-0 font-medium">Not wired yet</p>
          <p className="text-[13px] text-muted m-0 mt-1">
            Players are auth accounts, so adding one needs a backend create/invite flow. Wire
            an endpoint and call it here.
          </p>
        </div>
      )}

      <p className="flex items-center gap-2 text-[13px] text-muted m-0">
        <Users size={15} className="text-faint" />
        <span>
          <span className="text-gold font-bold">
            {state === "ready" ? users.length : "—"}
          </span>{" "}
          players registered
        </span>
      </p>

      {state === "loading" ? (
        <div className="bg-panel border border-white/10 rounded-card">
          <Loading label="Loading players…" />
        </div>
      ) : state === "error" ? (
        <div className="bg-panel border border-white/10 rounded-card">
          <ErrorBlock label="Couldn't load players." onRetry={onRetry} />
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          title="No players yet"
          lines={["Players appear here once they sign up."]}
        />
      ) : (
        <div className="bg-panel border border-white/10 rounded-card overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-faint">
                <th className="text-left font-semibold px-5 py-3">Player</th>
                <th className="text-left font-semibold px-2 py-3">Club</th>
                <th className="text-left font-semibold px-2 py-3">Points</th>
                <th className="text-left font-semibold px-2 py-3">Status</th>
                <th className="text-left font-semibold px-2 py-3">Joined</th>
                <th className="text-right font-semibold px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const name = u.display_name ?? "Unnamed";
                const entry = byUserId.get(u.id);
                const isEditing = editingId === u.id;
                return (
                  <Fragment key={u.id}>
                    <tr className="border-t border-white/[0.06]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={name} avatar={u.avatar} size={44} />
                          <div className="leading-tight">
                            <div className="text-ink font-semibold whitespace-nowrap">{name}</div>
                            <div className="text-faint text-[12px]">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-4 text-muted whitespace-nowrap">{u.team_name}</td>
                      <td className="px-2 py-4">
                        {entry ? (
                          <span className="text-gold font-bold text-[16px]">
                            {entry.total_points}
                          </span>
                        ) : (
                          <span className="text-faint">{"—"}</span>
                        )}
                      </td>
                      <td className="px-2 py-4">
                        <StatusPill active={u.is_active} />
                      </td>
                      <td className="px-2 py-4 text-faint whitespace-nowrap">
                        {u.created_at ? fmtDate(u.created_at) : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {!isEditing && (
                            <button
                              onClick={() => openEdit(u)}
                              title="Edit username"
                              className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/15 text-muted px-2.5 py-1.5 text-[13px] hover:text-ink hover:bg-white/5 transition"
                            >
                              <Pencil size={13} /> Edit
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleActive(u)}
                            disabled={statusBusyId === u.id}
                            title={
                              u.is_active
                                ? "Deactivate — hides them from the leaderboard and blocks login, without deleting their history"
                                : "Reactivate — restores login and leaderboard visibility"
                            }
                            className={
                              "inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-[13px] transition disabled:opacity-60 " +
                              (u.is_active
                                ? "border-red-400/30 text-red-400 hover:bg-red-400/10"
                                : "border-green/30 text-green hover:bg-green/10")
                            }
                          >
                            {u.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                            {u.is_active ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isEditing && (
                      <tr className="bg-green/5 border-t border-white/[0.06]">
                        <td colSpan={6} className="px-5 py-4">
                          <div className="flex items-end gap-3 flex-wrap">
                            <div>
                              <label className="block text-[12px] text-faint mb-1.5">
                                Username
                              </label>
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                maxLength={20}
                                className="w-56 bg-[#07101d] border border-white/10 rounded-[10px] px-3 py-2 text-ink text-sm outline-none focus:border-white/30"
                              />
                            </div>
                            <button
                              onClick={() => saveEdit(u.id)}
                              disabled={editBusy}
                              className="bg-city-gold text-navy font-semibold rounded-[10px] px-4 py-2 text-sm disabled:opacity-60"
                            >
                              {editBusy ? "Saving…" : "Save"}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-muted hover:text-ink text-sm px-2 py-2"
                            >
                              Cancel
                            </button>
                            {editError && (
                              <span className="text-red-400 text-[13px] pb-2">{editError}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr className="border-t border-white/[0.06]">
                  <td colSpan={6} className="px-5 py-8 text-center text-muted">
                    No players match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
