import {
  useState,
  useEffect,
  useCallback,
  Fragment,
  type ReactNode,
} from "react";
import {
  LayoutGrid,
  Calendar,
  CalendarPlus,
  CreditCard,
  Users,
  Star,
  TrendingUp,
  Trophy,
  PoundSterling,
  RotateCw,
  CheckCircle2,
  ChevronDown,
  Pencil,
  Search,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

/* ==================================================================
   Admin dashboard — backed by LIVE data from the API.

   WIRED (real data):
     - Fixtures tab: list, settle, create (POST /api/fixtures),
       edit metadata (PATCH /api/fixtures/:id)
     - Overview: Players Playing, Avg Points, Current Leader, Top Players
       chart, Fixtures Completed
     - Players tab: name / points / rank             GET /api/leaderboard

   NOT WIRED — left empty with TODOs (no endpoint exists yet):
     - TODO(payments): Total Revenue, Avg Transaction, Cumulative Revenue, Transactions tab
     - TODO(stats):    Perfect Calls count (leaderboard doesn't expose it)
     - TODO(users):    Players tab columns Club / Played / Perfect Calls / Joined,
                       and "Add New Player"

   Adjust the endpoints below if your routes differ.
==================================================================== */
const API = {
  fixtures: "/api/fixtures", //                 GET -> { fixtures }, POST -> { fixture }
  fixture: (id: string) => `/api/fixtures/${id}`, //          PATCH -> { fixture }
  settle: (id: string) => `/api/fixtures/${id}/settle`, //    POST  -> { fixture }
  leaderboard: "/api/leaderboard", //           GET -> { leaderboard }  (path/envelope ASSUMED)
  teams: "/api/teams", //                       GET -> { teams } | string[]  (path ASSUMED)
};

// Optional: set to your club's exact team name to highlight it in the table.
const HIGHLIGHT_TEAM = "";
// Pre-fills the "season" field when adding a fixture.
const DEFAULT_SEASON = "2025/26";

// Fallback team list for the fixture dropdowns when GET /api/teams isn't
// wired. 2026/27 Premier League. The live endpoint (your seeded `teams`
// table) takes priority — keep this in sync, or rely on the fetch.
const PREMIER_LEAGUE_TEAMS = [
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

type Fixture = {
  id: string;
  season: string;
  gameweek: number;
  home_team: string;
  away_team: string;
  kickoff: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
};

type FixtureDraft = {
  season: string;
  gameweek: number;
  home_team: string;
  away_team: string;
  kickoff: string; // ISO 8601
};

type LeaderboardEntry = {
  user_id: string;
  display_name: string | null;
  total_points: number;
  rank: number;
};

type Load = "loading" | "error" | "ready";

const TABS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "fixtures", label: "Fixtures", icon: Calendar },
  { id: "transactions", label: "Transactions", icon: CreditCard },
  { id: "players", label: "Players", icon: Users },
];

const AVATAR = [
  "bg-amber-500/20 text-amber-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-sky-500/20 text-sky-300",
  "bg-violet-500/20 text-violet-300",
  "bg-rose-500/20 text-rose-300",
];
const avatarClass = (s: string) =>
  AVATAR[(s.charCodeAt(0) || 0) % AVATAR.length];

const tooltipStyle = {
  background: "#0b1220",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  fontSize: 12,
} as const;

const scoreInput =
  "w-20 text-center bg-[#07101d] border border-white/10 rounded-[10px] px-3 py-2 text-ink text-sm outline-none focus:border-white/30";
const formInput =
  "w-full bg-[#07101d] border border-white/10 rounded-[10px] px-3 py-2.5 text-ink text-sm outline-none focus:border-white/30 placeholder:text-faint";

const truncate = (s: string) => (s.length > 12 ? s.slice(0, 12) + "\u2026" : s);
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

function pickLeaderboard(json: unknown): LeaderboardEntry[] {
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

function pickTeams(json: unknown): string[] {
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

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const j = (await res.json()) as Record<string, unknown>;
    if (typeof j?.error === "string") return j.error;
    if (typeof j?.message === "string") return j.message;
  } catch {
    /* not JSON */
  }
  return `${fallback} (${res.status}).`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ISO timestamp -> value for <input type="datetime-local"> (local time).
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ---------------------------------------------------------------- */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  valueClass = "text-ink",
  iconClass = "text-muted",
  accent,
  muted,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
  iconClass?: string;
  accent?: "green" | "gold";
  muted?: boolean;
}) {
  const accentBg =
    accent === "green"
      ? "bg-green/5 border-green/20"
      : accent === "gold"
        ? "bg-gold/5 border-gold/20"
        : "bg-panel border-white/10";
  return (
    <div
      className={`${accentBg} border rounded-card p-5 flex gap-4 ${muted ? "opacity-70" : ""}`}
    >
      <div className="w-12 h-12 shrink-0 rounded-xl bg-white/5 flex items-center justify-center">
        <Icon size={20} className={iconClass} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide uppercase text-faint m-0">
          {label}
        </p>
        <p
          className={`text-[26px] leading-tight font-bold m-0 mt-1 ${valueClass}`}
        >
          {value}
        </p>
        {sub && (
          <p className="text-[13px] text-muted m-0 mt-1 truncate">{sub}</p>
        )}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-panel border border-white/10 rounded-card p-5">
      <p className="text-[15px] font-semibold text-ink m-0">{title}</p>
      <p className="text-[13px] text-muted m-0 mt-0.5 mb-4">{subtitle}</p>
      {children}
    </div>
  );
}

function EmptyState({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="bg-panel border border-dashed border-white/15 rounded-card p-10 text-center">
      <p className="text-[15px] font-semibold text-ink m-0">{title}</p>
      {lines.map((l, i) => (
        <p key={i} className="text-[13px] text-muted m-0 mt-1.5">
          {l}
        </p>
      ))}
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center text-muted text-sm">
      {label}
    </div>
  );
}

function ErrorBlock({
  label,
  onRetry,
}: {
  label: string;
  onRetry: () => void;
}) {
  return (
    <div className="h-[200px] flex flex-col items-center justify-center gap-3">
      <p className="text-muted text-sm m-0">{label}</p>
      <button
        onClick={onRetry}
        className="rounded-[10px] border border-white/15 text-ink px-3 py-1.5 text-[13px] hover:bg-white/5"
      >
        Retry
      </button>
    </div>
  );
}

function Team({ name }: { name: string }) {
  const hl = HIGHLIGHT_TEAM !== "" && name === HIGHLIGHT_TEAM;
  return (
    <span className={hl ? "font-semibold text-gold" : "font-medium text-ink"}>
      {name}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "finished")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 text-gold text-[12px] font-semibold px-2.5 py-1">
        <CheckCircle2 size={13} /> Finished
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 text-muted text-[12px] font-semibold px-2.5 py-1">
      {cap(status) || "Scheduled"}
    </span>
  );
}

// Reusable create/edit form for a fixture's metadata (never the score).
// Manages its own field state; the parent closes it on a successful submit.
function FixtureForm({
  initial,
  teams,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Fixture;
  teams: string[];
  submitLabel: string;
  onSubmit: (draft: FixtureDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [season, setSeason] = useState(initial?.season ?? DEFAULT_SEASON);
  const [gameweek, setGameweek] = useState(
    initial ? String(initial.gameweek) : "",
  );
  const [home, setHome] = useState(initial?.home_team ?? "");
  const [away, setAway] = useState(initial?.away_team ?? "");
  const [kickoff, setKickoff] = useState(
    initial ? toLocalInput(initial.kickoff) : "",
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const gw = Number(gameweek);
    if (
      season.trim() === "" ||
      home.trim() === "" ||
      away.trim() === "" ||
      kickoff === ""
    ) {
      setError("Fill in every field.");
      return;
    }
    if (!Number.isInteger(gw) || gw < 1) {
      setError("Gameweek must be a whole number (1 or more).");
      return;
    }
    if (home.trim() === away.trim()) {
      setError("Home and away teams must differ.");
      return;
    }
    const d = new Date(kickoff);
    if (Number.isNaN(d.getTime())) {
      setError("Invalid kickoff date/time.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        season: season.trim(),
        gameweek: gw,
        home_team: home.trim(),
        away_team: away.trim(),
        kickoff: d.toISOString(),
      });
      // success -> parent unmounts this form
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-[120px]">
          <label className="block text-[12px] text-faint mb-1.5">Season</label>
          <input
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            placeholder="2025/26"
            className={formInput}
          />
        </div>
        <div className="w-[80px]">
          <label className="block text-[12px] text-faint mb-1.5">GW</label>
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={gameweek}
            onChange={(e) => setGameweek(e.target.value)}
            placeholder="1"
            className={formInput}
          />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-[12px] text-faint mb-1.5">
            Home team
          </label>
          <select
            value={home}
            onChange={(e) => setHome(e.target.value)}
            className={formInput}
          >
            <option value="">Home team</option>
            {teams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <span className="text-faint pb-2.5">vs</span>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-[12px] text-faint mb-1.5">
            Away team
          </label>
          <select
            value={away}
            onChange={(e) => setAway(e.target.value)}
            className={formInput}
          >
            <option value="">Away team</option>
            {teams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[210px]">
          <label className="block text-[12px] text-faint mb-1.5">Kickoff</label>
          <input
            type="datetime-local"
            value={kickoff}
            onChange={(e) => setKickoff(e.target.value)}
            className={formInput}
          />
        </div>
        <button
          onClick={submit}
          disabled={submitting}
          className="bg-gold text-navy font-semibold rounded-[10px] px-4 py-2.5 text-sm disabled:opacity-60 whitespace-nowrap"
        >
          {submitting ? "Saving\u2026" : submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="text-muted hover:text-ink text-sm px-2 py-2.5"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-red-400 text-[13px] m-0 mt-2">{error}</p>}
    </div>
  );
}

type EditTarget = { id: string; mode: "score" | "details" } | null;

function FixturesTab({
  fixtures,
  teams,
  state,
  onSettle,
  onCreate,
  onUpdate,
  onRetry,
}: {
  fixtures: Fixture[];
  teams: string[];
  state: Load;
  onSettle: (id: string, home: number, away: number) => Promise<void>;
  onCreate: (draft: FixtureDraft) => Promise<void>;
  onUpdate: (id: string, draft: FixtureDraft) => Promise<void>;
  onRetry: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EditTarget>(null);

  // score editor state
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [scoreError, setScoreError] = useState("");
  const [scoring, setScoring] = useState(false);

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
              <span className="w-2 h-2 rounded-full bg-white/30" /> Awaiting
              result
            </span>
          </div>
          <button
            onClick={openAdd}
            className="bg-gold text-navy font-semibold rounded-xl px-4 py-2.5 text-sm flex items-center gap-2 whitespace-nowrap"
          >
            <CalendarPlus size={16} /> Add fixture
          </button>
        </div>
      </div>

      {adding && (
        <div className="bg-panel border border-white/10 rounded-card p-4 mb-4">
          <p className="text-[14px] font-semibold text-ink m-0 mb-3">
            Add fixture
          </p>
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
          lines={[
            "Use \u201cAdd fixture\u201d above to schedule the first match.",
          ]}
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
                        <StatusBadge status={f.status} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {!isEditing && (
                            <>
                              <button
                                onClick={() => openScore(f)}
                                className="inline-flex items-center gap-1.5 rounded-[10px] border border-gold/40 text-gold px-3 py-1.5 text-[13px] font-semibold hover:bg-gold/10 transition"
                              >
                                {finished ? "Re-score" : "Score"}{" "}
                                <ChevronDown size={14} />
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
                            <span className="text-faint pb-2.5">
                              {"\u2013"}
                            </span>
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
                              className="bg-gold text-navy font-semibold rounded-[10px] px-4 py-2 text-sm disabled:opacity-60"
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
                              <span className="text-red-400 text-[13px] pb-2">
                                {scoreError}
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-muted m-0 mt-2">
                            Posts to{" "}
                            <span className="font-mono">
                              /api/fixtures/:id/settle
                            </span>{" "}
                            and re-scores predictions.
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

function PlayersTab({
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
            Players are auth accounts, so adding one needs a backend
            create/invite flow. Wire an endpoint (e.g.{" "}
            <span className="font-mono">POST /api/admin/players</span>) and call
            it here.
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
                  <th className="text-left font-semibold px-2 py-3">
                    Total Points
                  </th>
                  <th className="text-left font-semibold px-2 py-3">Club</th>
                  <th className="text-left font-semibold px-2 py-3">Played</th>
                  <th className="text-left font-semibold px-2 py-3">
                    Perfect Calls
                  </th>
                  <th className="text-left font-semibold px-5 py-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const name = p.display_name ?? "Unnamed";
                  return (
                    <tr
                      key={p.user_id}
                      className="border-t border-white/[0.06]"
                    >
                      <td className="px-5 py-4 text-muted font-semibold">
                        {p.rank}
                      </td>
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
                    <td
                      colSpan={7}
                      className="px-5 py-8 text-center text-muted"
                    >
                      No players match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-faint m-0">
            Club, played, perfect calls and join date show {"\u2014"} until a
            users/admin endpoint exposes them (see TODO in code).
          </p>
        </>
      )}
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState("overview");

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [fxState, setFxState] = useState<Load>("loading");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbState, setLbState] = useState<Load>("loading");
  const [teams, setTeams] = useState<string[]>([]);
  const [teamsReady, setTeamsReady] = useState(false);

  const loadFixtures = useCallback(async () => {
    setFxState("loading");
    try {
      const res = await fetch(API.fixtures, { credentials: "include" });
      if (!res.ok) throw new Error();
      const json: unknown = await res.json();
      const arr =
        isObj(json) && Array.isArray(json.fixtures)
          ? (json.fixtures as Fixture[])
          : Array.isArray(json)
            ? (json as Fixture[])
            : [];
      setFixtures(arr);
      setFxState("ready");
    } catch {
      setFxState("error");
    }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setLbState("loading");
    try {
      const res = await fetch(API.leaderboard, { credentials: "include" });
      if (!res.ok) throw new Error();
      setLeaderboard(pickLeaderboard(await res.json()));
      setLbState("ready");
    } catch {
      setLbState("error");
    }
  }, []);

  // Team list for the fixture dropdowns. Prefers your seeded `teams` table;
  // silently falls back to PREMIER_LEAGUE_TEAMS if the endpoint isn't there.
  const loadTeams = useCallback(async () => {
    try {
      const res = await fetch(API.teams, { credentials: "include" });
      if (!res.ok) throw new Error();
      const t = pickTeams(await res.json());
      if (t.length) {
        setTeams(t);
        setTeamsReady(true);
      }
    } catch {
      /* fall back to PREMIER_LEAGUE_TEAMS */
    }
  }, []);

  useEffect(() => {
    void loadFixtures();
    void loadLeaderboard();
    void loadTeams();
  }, [loadFixtures, loadLeaderboard, loadTeams]);

  async function settle(id: string, hs: number, as: number) {
    const res = await fetch(API.settle(id), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ home_score: hs, away_score: as }),
    });
    if (!res.ok) throw new Error(await readError(res, "Settle failed"));
    // Settling changes scores, so refresh both fixtures and standings.
    await Promise.all([loadFixtures(), loadLeaderboard()]);
  }

  async function createFixture(draft: FixtureDraft) {
    const res = await fetch(API.fixtures, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(draft),
    });
    if (!res.ok) throw new Error(await readError(res, "Couldn't add fixture"));
    await loadFixtures();
  }

  async function updateFixture(id: string, draft: FixtureDraft) {
    const res = await fetch(API.fixture(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(draft),
    });
    if (!res.ok)
      throw new Error(await readError(res, "Couldn't update fixture"));
    // Metadata edit doesn't touch scores, so only fixtures need refreshing.
    await loadFixtures();
  }

  // ---- Overview, derived from live leaderboard + fixtures ----
  const lbReady = lbState === "ready";
  const lbText = (fn: () => string) =>
    lbState === "loading" ? "\u2026" : lbState === "error" ? "\u2014" : fn();

  const completedCount = fixtures.filter((f) => f.status === "finished").length;
  const nextFixture = fixtures.find((f) => f.status !== "finished");
  const fixturesValue =
    fxState === "loading"
      ? "\u2026"
      : fxState === "error"
        ? "\u2014"
        : `${completedCount} / ${fixtures.length}`;
  const fixturesSub =
    fxState !== "ready"
      ? "From your fixtures"
      : nextFixture
        ? `Next: GW${nextFixture.gameweek} ${nextFixture.home_team} vs ${nextFixture.away_team}`
        : "All fixtures settled";

  const playersValue = lbText(() => String(leaderboard.length));
  const avgValue = lbText(() => {
    if (leaderboard.length === 0) return "0";
    const sum = leaderboard.reduce((s, p) => s + p.total_points, 0);
    return String(Math.round(sum / leaderboard.length));
  });
  const leader = lbReady && leaderboard.length ? leaderboard[0] : null;
  const leaderValue = lbText(() =>
    leader ? (leader.display_name ?? "Unnamed") : "\u2014",
  );
  const leaderSub = leader ? `${leader.total_points} points` : undefined;

  const topPlayers = [...leaderboard]
    .sort((a, b) => b.total_points - a.total_points)
    .slice(0, 8)
    .map((p) => ({
      name: p.display_name ?? "Unnamed",
      points: p.total_points,
    }));

  // Dropdown options: live teams (or PL fallback), merged with any team names
  // already present in fixtures so existing rows stay selectable on edit.
  const teamOptions = Array.from(
    new Set([
      ...(teamsReady ? teams : PREMIER_LEAGUE_TEAMS),
      ...fixtures.flatMap((f) => [f.home_team, f.away_team]),
    ]),
  )
    .filter((s) => s !== "")
    .sort((a, b) => a.localeCompare(b));

  return (
    <div>
      {/* Header */}
      <header className="flex items-center justify-between gap-6 mb-6 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[13px] bg-white text-navy font-extrabold flex items-center justify-center text-[17px]">
            FC
          </div>
          <div>
            <h1 className="m-0 text-3xl font-bold tracking-[-0.6px] text-ink">
              Admin Dashboard
            </h1>
            <p className="mt-1 text-faint text-sm">
              Manage fixtures, track players and revenue
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            void loadFixtures();
            void loadLeaderboard();
          }}
          className="flex items-center gap-2 rounded-xl border border-white/15 text-ink px-4 py-2.5 text-sm font-semibold hover:bg-white/5 transition"
        >
          <RotateCw size={16} /> Refresh
        </button>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {TABS.map((t) => {
          const active = t.id === tab;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition border ${
                active
                  ? "bg-white/[0.06] text-gold border-gold/30"
                  : "text-muted hover:text-ink border-transparent"
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {tab === "overview" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              icon={Users}
              label="Players Playing FanCall"
              value={playersValue}
              sub="Registered players"
            />
            {/* TODO(payments): Total Revenue from settled transactions. */}
            <StatCard
              icon={PoundSterling}
              label="Total Revenue"
              value={"\u2014"}
              sub="Awaiting payments"
              muted
            />
            <StatCard
              icon={Calendar}
              label="Fixtures Completed"
              value={fixturesValue}
              sub={fixturesSub}
            />
            {/* TODO(stats): leaderboard has no perfect-call count — expose one and wire here. */}
            <StatCard
              icon={Star}
              label="Perfect Calls"
              value={"\u2014"}
              sub="Awaiting stats endpoint"
              muted
            />
            <StatCard
              icon={TrendingUp}
              label="Avg Points Per Player"
              value={avgValue}
              sub="Across all players"
            />
            <StatCard
              icon={Trophy}
              label="Current Leader"
              value={leaderValue}
              sub={leaderSub}
              valueClass="text-gold"
              iconClass="text-gold"
              accent="gold"
            />
          </div>

          <ChartCard
            title="Top Players by Points"
            subtitle="Current standings \u2014 top 8 players"
          >
            {lbState === "loading" ? (
              <Loading label="Loading standings\u2026" />
            ) : lbState === "error" ? (
              <ErrorBlock
                label="Couldn't load standings."
                onRetry={loadLeaderboard}
              />
            ) : topPlayers.length === 0 ? (
              <Loading label="No players yet." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={topPlayers}
                  margin={{ top: 8, right: 8, left: -16, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.07)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tickFormatter={truncate}
                    interval={0}
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, "auto"]}
                    width={32}
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: "#9fb0c3" }}
                    itemStyle={{ color: "#e8eef5" }}
                  />
                  <Bar dataKey="points" radius={[6, 6, 0, 0]}>
                    {topPlayers.map((p, i) => (
                      <Cell
                        key={p.name}
                        fill={
                          i === 0
                            ? "var(--color-gold, #f5a623)"
                            : "rgba(255,255,255,0.16)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* TODO(payments): replace with a real cumulative-revenue area chart once
              a transactions endpoint exists (sum amount over time). */}
          <EmptyState
            title="Cumulative Revenue"
            lines={[
              "Payments aren't integrated yet, so there's no revenue to chart.",
              "TODO(payments): wire a transactions endpoint and render the area chart here.",
            ]}
          />
        </div>
      ) : tab === "fixtures" ? (
        <FixturesTab
          fixtures={fixtures}
          teams={teamOptions}
          state={fxState}
          onSettle={settle}
          onCreate={createFixture}
          onUpdate={updateFixture}
          onRetry={loadFixtures}
        />
      ) : tab === "transactions" ? (
        /* TODO(payments): build this tab against your payments/transactions endpoint. */
        <EmptyState
          title="Transactions"
          lines={[
            "Payments aren't integrated yet.",
            "TODO(payments): wire GET /api/transactions (or your provider) and render the table here.",
          ]}
        />
      ) : (
        <PlayersTab
          leaderboard={leaderboard}
          state={lbState}
          onRetry={loadLeaderboard}
        />
      )}
    </div>
  );
}
