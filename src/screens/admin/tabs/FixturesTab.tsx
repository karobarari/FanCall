import { useState, Fragment } from "react";
import { CalendarPlus, ChevronDown, Lock, Pencil, Unlock } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { Loading, ErrorBlock } from "../components/Status";
import { Team } from "../components/Team";
import { StatusBadge } from "../components/StatusBadge";
import { FixtureForm } from "../components/FixtureForm";
import type { Fixture, FixtureDraft, Load } from "../types";
import { fmtDate } from "../utils";

const scoreInput =
  "w-20 text-center bg-[#07101d] border border-white/10 rounded-[10px] px-3 py-2 text-ink text-sm outline-none focus:border-white/30";

type EditTarget = { id: string; mode: "score" | "details" } | null;

export function FixturesTab({
  fixtures,
  teams,
  state,
  onSettle,
  onCreate,
  onUpdate,
  onToggleLock,
  onRetry,
}: {
  fixtures: Fixture[];
  teams: string[];
  state: Load;
  onSettle: (id: string, home: number, away: number) => Promise<void>;
  onCreate: (draft: FixtureDraft) => Promise<void>;
  onUpdate: (id: string, draft: FixtureDraft) => Promise<void>;
  onToggleLock: (id: string, locked: boolean) => Promise<void>;
  onRetry: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EditTarget>(null);

  // score editor state
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [scoreError, setScoreError] = useState("");
  const [scoring, setScoring] = useState(false);

  // lock toggle state — tracks which row's request is in flight
  const [lockBusyId, setLockBusyId] = useState<string | null>(null);

  function openScore(f: Fixture) {
    setAdding(false);
    setEditing({ id: f.id, mode: "score" });
    setHome(f.home_score != null ? String(f.home_score) : "");
    setAway(f.away_score != null ? String(f.away_score) : "");
    setScoreError("");
  }

  function openDetails(f: Fixture) {
    setAdding(false);
    setEditing({ id: f.id, mode: "details" });
  }

  function openAdd() {
    setEditing(null);
    setAdding((a) => !a);
  }

  async function saveScore(id: string) {
    const h = Number(home);
    const a = Number(away);
    const ok =
      home.trim() !== "" &&
      away.trim() !== "" &&
      Number.isInteger(h) &&
      Number.isInteger(a) &&
      h >= 0 &&
      a >= 0;
    if (!ok) {
      setScoreError("Enter whole numbers (0 or more).");
      return;
    }
    setScoring(true);
    setScoreError("");
    try {
      await onSettle(id, h, a);
      setEditing(null);
    } catch (e) {
      setScoreError(e instanceof Error ? e.message : "Settle failed.");
    } finally {
      setScoring(false);
    }
  }

  async function handleCreate(draft: FixtureDraft) {
    await onCreate(draft);
    setAdding(false);
  }

  async function handleUpdate(id: string, draft: FixtureDraft) {
    await onUpdate(id, draft);
    setEditing(null);
  }

  async function handleToggleLock(f: Fixture) {
    setLockBusyId(f.id);
    try {
      await onToggleLock(f.id, !f.locked);
    } finally {
      setLockBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 className="text-xl font-bold text-ink m-0">All Fixtures</h2>
          <p className="text-[13px] text-muted m-0 mt-1">
            Add fixtures, edit details, and record results to score predictions
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-4 text-[12px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gold" /> Finished
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white/30" /> Awaiting result
            </span>
          </div>
          <button
            onClick={openAdd}
            className="bg-city-gold text-navy font-semibold rounded-xl px-4 py-2.5 text-sm flex items-center gap-2 whitespace-nowrap"
          >
            <CalendarPlus size={16} /> Add fixture
          </button>
        </div>
      </div>

      {adding && (
        <div className="bg-panel border border-white/10 rounded-card p-4 mb-4">
          <p className="text-[14px] font-semibold text-ink m-0 mb-3">Add fixture</p>
          <FixtureForm
            teams={teams}
            submitLabel="Add fixture"
            onSubmit={handleCreate}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {state === "loading" ? (
        <div className="bg-panel border border-white/10 rounded-card">
          <Loading label="Loading fixtures\u2026" />
        </div>
      ) : state === "error" ? (
        <div className="bg-panel border border-white/10 rounded-card">
          <ErrorBlock label="Couldn't load fixtures." onRetry={onRetry} />
        </div>
      ) : fixtures.length === 0 ? (
        <EmptyState
          title="No fixtures yet"
          lines={["Use \u201cAdd fixture\u201d above to schedule the first match."]}
        />
      ) : (
        <div className="bg-panel border border-white/10 rounded-card overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-faint">
                <th className="text-left font-semibold px-5 py-3">GW</th>
                <th className="text-left font-semibold px-2 py-3">Date</th>
                <th className="text-left font-semibold px-2 py-3">Home Team</th>
                <th className="text-center font-semibold px-2 py-3">Score</th>
                <th className="text-left font-semibold px-2 py-3">Away Team</th>
                <th className="text-left font-semibold px-2 py-3">Status</th>
                <th className="text-right font-semibold px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {fixtures.map((f) => {
                const hasScore = f.home_score != null && f.away_score != null;
                const finished = f.status === "finished";
                const isEditing = editing?.id === f.id;
                return (
                  <Fragment key={f.id}>
                    <tr
                      className={`border-t border-white/[0.06] ${!finished ? "bg-green/5" : ""}`}
                    >
                      <td className="px-5 py-4 text-muted">{f.gameweek}</td>
                      <td className="px-2 py-4 text-muted whitespace-nowrap">
                        {fmtDate(f.kickoff)}
                      </td>
                      <td className="px-2 py-4">
                        <Team name={f.home_team} />
                      </td>
                      <td className="px-2 py-4 text-center whitespace-nowrap">
                        {hasScore ? (
                          <span className="font-bold text-ink">
                            {f.home_score}
                            {"\u2013"}
                            {f.away_score}
                          </span>
                        ) : (
                          <span className="text-faint">vs</span>
                        )}
                      </td>
                      <td className="px-2 py-4">
                        <Team name={f.away_team} />
                      </td>
                      <td className="px-2 py-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <StatusBadge status={f.status} />
                          {f.locked && !finished && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-flag/15 text-flag text-[11px] font-semibold px-2 py-0.5">
                              <Lock size={11} /> Locked
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {!isEditing && (
                            <>
                              <button
                                onClick={() => openScore(f)}
                                className="inline-flex items-center gap-1.5 rounded-[10px] border border-gold/40 text-gold px-3 py-1.5 text-[13px] font-semibold hover:bg-gold/10 transition"
                              >
                                {finished ? "Re-score" : "Score"} <ChevronDown size={14} />
                              </button>
                              {!finished && (
                                <button
                                  onClick={() => openDetails(f)}
                                  title="Edit teams, date or gameweek"
                                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/15 text-muted px-2.5 py-1.5 text-[13px] hover:text-ink hover:bg-white/5 transition"
                                >
                                  <Pencil size={13} /> Edit
                                </button>
                              )}
                              {!finished && (
                                <button
                                  onClick={() => handleToggleLock(f)}
                                  disabled={lockBusyId === f.id}
                                  title={
                                    f.locked
                                      ? "Reopen this fixture for predictions"
                                      : "Lock this fixture — no new or changed predictions until unlocked"
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/15 text-muted px-2.5 py-1.5 text-[13px] hover:text-ink hover:bg-white/5 transition disabled:opacity-60"
                                >
                                  {f.locked ? <Unlock size={13} /> : <Lock size={13} />}
                                  {f.locked ? "Unlock" : "Lock"}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {isEditing && editing?.mode === "score" && (
                      <tr className="bg-green/5 border-t border-white/[0.06]">
                        <td colSpan={7} className="px-5 py-4">
                          <p className="text-[13px] font-semibold text-ink m-0 mb-3">
                            Record result
                          </p>
                          <div className="flex items-end gap-3 flex-wrap">
                            <div>
                              <label className="block text-[12px] text-faint mb-1.5">
                                {f.home_team}
                              </label>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                value={home}
                                onChange={(e) => setHome(e.target.value)}
                                placeholder="0"
                                className={scoreInput}
                              />
                            </div>
                            <span className="text-faint pb-2.5">{"\u2013"}</span>
                            <div>
                              <label className="block text-[12px] text-faint mb-1.5">
                                {f.away_team}
                              </label>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                value={away}
                                onChange={(e) => setAway(e.target.value)}
                                placeholder="0"
                                className={scoreInput}
                              />
                            </div>
                            <button
                              onClick={() => saveScore(f.id)}
                              disabled={scoring}
                              className="bg-city-gold text-navy font-semibold rounded-[10px] px-4 py-2 text-sm disabled:opacity-60"
                            >
                              {scoring ? "Saving\u2026" : "Save result"}
                            </button>
                            <button
                              onClick={() => setEditing(null)}
                              className="text-muted hover:text-ink text-sm px-2 py-2"
                            >
                              Cancel
                            </button>
                            {scoreError && (
                              <span className="text-red-400 text-[13px] pb-2">{scoreError}</span>
                            )}
                          </div>
                          <p className="text-[12px] text-muted m-0 mt-2">
                            Posts to{" "}
                            <span className="font-mono">/api/fixtures/:id/settle</span> and
                            re-scores predictions.
                          </p>
                        </td>
                      </tr>
                    )}

                    {isEditing && editing?.mode === "details" && (
                      <tr className="bg-green/5 border-t border-white/[0.06]">
                        <td colSpan={7} className="px-5 py-4">
                          <p className="text-[13px] font-semibold text-ink m-0 mb-3">
                            Edit fixture details
                          </p>
                          <FixtureForm
                            initial={f}
                            teams={teams}
                            submitLabel="Save changes"
                            onSubmit={(draft) => handleUpdate(f.id, draft)}
                            onCancel={() => setEditing(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
