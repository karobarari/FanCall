import { useState, type ReactNode } from 'react';
import {
  useFixtures,
  usePredictions,
  useLeaderboard,
  type Fixture,
  type Prediction,
} from '../data/store';
import { useAuth } from '../auth/AuthContext';
import {
  clubIsHome,
  toResultPred,
  toClubResult,
  CLUB,
  type ClubResult,
} from '../lib/result';
import { scorePrediction } from '../lib/scoring';
import ClubBadge from '../components/ClubBadge';

interface GuideRow {
  icon: string;
  title: string;
  description: string;
  points: number;
  color: "green" | "orange" | "gold" | "teal";
}

const SCORING_RULES: GuideRow[] = [
  {
    icon: "✓",
    title: "Correct Prediction",
    description: "Each of the 3 predictions you get right",
    points: 10,
    color: "green",
  },
  {
    icon: "✕",
    title: "Incorrect Prediction",
    description: "You still earn points even if wrong",
    points: 5,
    color: "orange",
  },
  {
    icon: "○",
    title: "Missed Fixture",
    description: "Per question if no prediction submitted",
    points: 4,
    color: "teal",
  },
  {
    icon: "★",
    title: "Perfect Call Bonus",
    description: "All 3 correct — bonus on top of 30 pts",
    points: 20,
    color: "gold",
  },
];
function isOpen(f: Fixture): boolean {
  return f.status === 'upcoming' && !f.locked && new Date(f.kickoff).getTime() > Date.now();
}

function kickoffLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// --- Left column: every fixture, by state ----------------------------------
function FixturesColumn({
  fixtures,
  predictions,
  selectedId,
  onSelect,
}: {
  fixtures: Fixture[];
  predictions: Record<string, Prediction>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const sorted = [...fixtures].sort((a, b) => a.gameweek - b.gameweek);
  const settled = fixtures.filter((f) => f.status === 'finished').length;

  return (
    <section className="bg-panel border border-white/10 rounded-card p-[18px]">
      <header className="flex items-center justify-between mb-3.5">
        <span className="text-[15px] font-semibold">All Fixtures</span>
        <span className="text-xs text-faint">
          {settled}/{fixtures.length} played
        </span>
      </header>

      <div className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
        {sorted.length === 0 && (
          <p className="text-faint text-[13px]">No fixtures yet.</p>
        )}

        {sorted.map((f) => {
          const open = isOpen(f);
          const finished = f.status === 'finished';
          const pred = predictions[f.id];
          const selected = f.id === selectedId;

          let badge: ReactNode;
          if (finished) {
            const pts =
              pred && f.home_score != null && f.away_score != null
                ? scorePrediction(pred, {
                    home_score: f.home_score,
                    away_score: f.away_score,
                  }).points
                : null;
            badge =
              pts != null ? (
                <span className="text-[11px] font-semibold py-1 px-[9px] rounded-full whitespace-nowrap shrink-0 text-gold bg-gold/15">
                  {pts} pts
                </span>
              ) : (
                <span className="text-[11px] font-semibold py-1 px-[9px] rounded-full whitespace-nowrap shrink-0 text-muted bg-white/10">
                  FT
                </span>
              );
          } else if (open) {
            badge = pred ? (
              <span className="text-[11px] font-semibold py-1 px-[9px] rounded-full whitespace-nowrap shrink-0 text-green bg-green/15">
                Done ✓
              </span>
            ) : (
              <span className="text-[11px] font-semibold py-1 px-[9px] rounded-full whitespace-nowrap shrink-0 text-gold bg-gold/15">
                Predict →
              </span>
            );
          } else {
            badge = (
              <span
                className="text-[12px] font-semibold whitespace-nowrap shrink-0"
                aria-label="Locked"
              >
                🔒
              </span>
            );
          }

          return (
            <button
              key={f.id}
              type="button"
              className={
                'flex items-center justify-between gap-2.5 w-full text-left rounded-[11px] py-3 px-[13px] text-ink border transition-colors ' +
                (selected
                  ? 'border-gold bg-gold/15 '
                  : 'border-transparent bg-panel-2 ') +
                (open
                  ? 'cursor-pointer enabled:hover:border-white/20'
                  : 'cursor-default opacity-60')
              }
              disabled={!open}
              onClick={() => onSelect(f.id)}
            >
              <span className="flex flex-col gap-[3px] min-w-0">
                <span className="text-sm font-medium">
                  {f.home_team} v {f.away_team}
                  {finished && f.home_score != null && (
                    <span className="text-gold font-bold">
                      {' '}
                      {f.home_score}–{f.away_score}
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-faint">
                  GW{f.gameweek} · {kickoffLabel(f.kickoff)}
                </span>
              </span>
              {badge}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// --- Middle column: a score stepper ----------------------------------------
function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-[9px] flex-1">
      <span className="text-xs text-muted text-center">{label}</span>
      <div className="w-full max-w-[120px] h-[58px] rounded-[11px] bg-panel-2 border border-white/10 flex items-center justify-center text-[28px] font-bold">
        {value}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="w-[42px] h-[38px] rounded-[9px] border border-white/10 bg-panel-2 text-ink text-[20px] cursor-pointer hover:border-white/20"
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          −
        </button>
        <button
          type="button"
          className="w-[42px] h-[38px] rounded-[9px] border border-white/10 bg-panel-2 text-ink text-[20px] cursor-pointer hover:border-white/20"
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

// --- Middle column: make the call ------------------------------------------
function PredictPanel({
  fixture,
  existing,
}: {
  fixture: Fixture;
  existing: Prediction | undefined;
}) {
  const { savePrediction } = usePredictions();
  const [home, setHome] = useState(existing ? existing.home : 0);
  const [away, setAway] = useState(existing ? existing.away : 0);
  const [result, setResult] = useState<ClubResult | null>(
    existing ? toClubResult(existing.result_pred, clubIsHome(fixture)) : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const options: { key: ClubResult; label: string }[] = [
    { key: 'WIN', label: 'WIN' },
    { key: 'DRAW', label: 'DRAW' },
    { key: 'LOSE', label: 'LOSE' },
  ];

  async function submit() {
    if (!result) {
      setError('Pick Win, Draw, or Lose first.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await savePrediction(
        fixture.id,
        home,
        away,
        toResultPred(result, clubIsHome(fixture)),
      );
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your call.');
    } finally {
      setBusy(false);
    }
  }

  const dirty = () => setSaved(false);

  return (
    <section className="bg-panel border border-white/10 rounded-card p-[18px] flex flex-col">
      <div className="flex items-center justify-between mb-[18px]">
        <span className="text-[11px] font-semibold py-[5px] px-[11px] rounded-full uppercase tracking-[0.4px] text-green bg-green/15">
          ● Open for predictions
        </span>
        <span className="text-xs text-faint">GW{fixture.gameweek}</span>
      </div>

      <div className="flex items-center justify-center gap-[18px] my-[6px]">
        <span className="text-[19px] font-bold flex-1 text-center">
          {fixture.home_team}
        </span>
        <span className="text-xs font-bold text-faint bg-panel-2 rounded-full w-[38px] h-[38px] flex items-center justify-center shrink-0">
          VS
        </span>
        <span className="text-[19px] font-bold flex-1 text-center">
          {fixture.away_team}
        </span>
      </div>
      <p className="text-center text-faint text-xs mb-2">
        {kickoffLabel(fixture.kickoff)}
      </p>

      <div className="border-t border-white/10 pt-4 mt-3">
        <h4 className="m-0 text-sm font-semibold">1 · Match result</h4>
        <p className="mt-[3px] mb-3 text-xs text-muted">
          Will {CLUB ?? fixture.home_team} win, draw, or lose?
        </p>
        <div className="flex gap-2.5">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={result === o.key}
              className={
                'flex-1 py-[13px] rounded-[11px] border text-[13px] font-semibold tracking-[0.5px] cursor-pointer transition-colors ' +
                (result === o.key
                  ? 'bg-gold border-gold text-[#1a1205]'
                  : 'bg-panel-2 text-ink border-white/10 hover:border-white/20')
              }
              onClick={() => {
                setResult(o.key);
                dirty();
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 pt-4 mt-3">
        <h4 className="m-0 text-sm font-semibold">2 &amp; 3 · Final score</h4>
        <p className="mt-[3px] mb-3 text-xs text-muted">
          Predict the full-time score for both teams.
        </p>
        <div className="flex items-center justify-center gap-[18px]">
          <Stepper
            label={fixture.home_team}
            value={home}
            onChange={(n) => {
              setHome(n);
              dirty();
            }}
          />
          <span className="text-[26px] text-faint mb-9">:</span>
          <Stepper
            label={fixture.away_team}
            value={away}
            onChange={(n) => {
              setAway(n);
              dirty();
            }}
          />
        </div>
      </div>

      {error && (
        <p className="text-flag text-[13px] text-center mt-3.5">{error}</p>
      )}

      <button
        className="mt-5 h-[50px] border-0 rounded-xl bg-gold text-[#1a1205] text-[15px] font-bold cursor-pointer enabled:hover:brightness-105 disabled:opacity-70 disabled:cursor-default"
        onClick={submit}
        disabled={busy}
      >
        {busy
          ? 'Saving…'
          : saved
            ? 'Saved ✓'
            : existing
              ? 'Update my call'
              : 'Submit my call'}
      </button>
    </section>
  );
}

// --- Right column: scoring guide -------------------------------------------
export function ScoringGuide() {
  return (
    <div style={{ padding: "16px 12px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <span style={{ fontSize: "20px" }}>⚡</span>
        <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
          Scoring Guide
        </h2>
      </div>

      {/* Guide rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {SCORING_RULES.map((rule) => (
          <div
            key={rule.title}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "12px",
              display: "flex",
              gap: "12px",
              alignItems: "flex-start",
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background:
                  rule.color === "green"
                    ? "rgba(16,185,129,0.2)"
                    : rule.color === "orange"
                      ? "rgba(239,68,68,0.2)"
                      : rule.color === "gold"
                        ? "rgba(217,119,6,0.2)"
                        : "rgba(20,184,166,0.2)",
                color:
                  rule.color === "green"
                    ? "#10b981"
                    : rule.color === "orange"
                      ? "#ef4444"
                      : rule.color === "gold"
                        ? "#d97706"
                        : "#14b8a6",
                fontSize: "16px",
              }}
            >
              {rule.icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: "8px",
                  marginBottom: "4px",
                }}
              >
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 500 }}>
                  {rule.title}
                </h3>
                <span
                  style={{
                    color:
                      rule.color === "green"
                        ? "#10b981"
                        : rule.color === "orange"
                          ? "#ef4444"
                          : rule.color === "gold"
                            ? "#fbbf24"
                            : "#14b8a6",
                    fontSize: "13px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  +{rule.points} pts
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                {rule.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Maximum box — Man City's actual badge gold (#FFC659), since this is
          the one celebratory/bonus highlight on the page. */}
      <div
        style={{
          marginTop: "16px",
          padding: "16px",
          border: "2px solid rgba(255,198,89,0.4)",
          borderRadius: "12px",
          textAlign: "center",
          background: "rgba(55,48,44,0.5)",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.5)",
            marginBottom: "8px",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Maximum per fixture
        </div>
        <div
          style={{
            fontSize: "32px",
            fontWeight: 700,
            color: "#ffc659",
            marginBottom: "6px",
          }}
        >
          50 pts
        </div>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
          3 correct (30) + Perfect Call bonus (20)
        </div>
      </div>

      {/* Join Anytime explainer */}
      <div
        style={{
          marginTop: "16px",
          padding: "12px",
          background: "rgba(20,184,166,0.1)",
          border: "1px solid rgba(20,184,166,0.3)",
          borderRadius: "12px",
          display: "flex",
          gap: "8px",
          alignItems: "flex-start",
        }}
      >
        <div style={{ fontSize: "16px", flexShrink: 0 }}>⬆️⬆️</div>
        <div>
          <div
            style={{ fontSize: "13px", fontWeight: 600, color: "#14b8a6" }}
          >
            Join Anytime
          </div>
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: "12px",
              color: "rgba(255,255,255,0.6)",
              lineHeight: "1.4",
            }}
          >
            New players automatically receive <strong>12 pts</strong> for every
            fixture missed before joining — keeping you competitive all season.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Page ------------------------------------------------------------------
export default function MakeYourCall() {
  const { fixtures, loading } = useFixtures();
  const { predictions, getPrediction } = usePredictions();
  const { leaderboard } = useLeaderboard();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openFixtures = fixtures
    .filter(isOpen)
    .sort((a, b) => a.gameweek - b.gameweek);

  const selectedOpen =
    (selectedId ? openFixtures.find((f) => f.id === selectedId) : undefined) ??
    openFixtures[0] ??
    null;

  const myPoints =
    leaderboard.find((s) => s.user_id === user?.id)?.total_points ?? 0;

  const perfectCalls = fixtures.filter((f) => {
    if (f.status !== 'finished' || f.home_score == null || f.away_score == null) {
      return false;
    }
    const p = predictions[f.id];
    return p
      ? scorePrediction(p, {
          home_score: f.home_score,
          away_score: f.away_score,
        }).perfect
      : false;
  }).length;

  const predictedCount = Object.keys(predictions).length;
  const season = fixtures[0]?.season ?? '2025/26';

  if (loading && fixtures.length === 0) {
    return <div className="p-10 text-muted">Loading fixtures…</div>;
  }

  return (
    <div>
      <header className="flex items-center justify-between gap-6 mb-[26px] flex-wrap">
        <div className="flex items-center gap-4">
          <ClubBadge size={56} />
          <div>
            <h1 className="m-0 text-3xl font-bold tracking-[-0.6px] text-ink">
              Make Your Call
            </h1>
            <p className="mt-1 text-faint text-sm">
              {CLUB ?? 'Your Club'} · {season} · All Fixtures
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 bg-panel border border-white/10 rounded-card py-3.5 px-2">
          <div className="flex flex-col items-center px-[18px] min-w-[78px] border-l border-white/10 first:border-l-0">
            <span className="text-[26px] font-bold text-gold leading-[1.1]">
              {myPoints}
            </span>
            <span className="text-[11px] text-muted mt-1 whitespace-nowrap">
              My Points
            </span>
          </div>
          <div className="flex flex-col items-center px-[18px] min-w-[78px] border-l border-white/10 first:border-l-0">
            <span className="text-[26px] font-bold text-gold leading-[1.1]">
              {perfectCalls}
            </span>
            <span className="text-[11px] text-muted mt-1 whitespace-nowrap">
              Perfect Calls
            </span>
          </div>
          <div className="flex flex-col items-center px-[18px] min-w-[78px] border-l border-white/10 first:border-l-0">
            <span className="text-[26px] font-bold text-gold leading-[1.1]">
              {predictedCount}/{fixtures.length}
            </span>
            <span className="text-[11px] text-muted mt-1 whitespace-nowrap">
              Predicted
            </span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 min-[1100px]:grid-cols-[320px_minmax(0,1fr)_296px] gap-[18px] items-start">
        <FixturesColumn
          fixtures={fixtures}
          predictions={predictions}
          selectedId={selectedOpen?.id ?? null}
          onSelect={setSelectedId}
        />

        {selectedOpen ? (
          <PredictPanel
            key={selectedOpen.id}
            fixture={selectedOpen}
            existing={getPrediction(selectedOpen.id)}
          />
        ) : (
          <section className="bg-panel border border-white/10 rounded-card p-[18px] flex flex-col items-center justify-center text-center min-h-[280px] gap-2">
            <p className="text-base font-semibold m-0">No open fixtures right now</p>
            <p className="text-[13px] text-muted m-0 max-w-[280px]">
              When the next gameweek opens, pick it from the list to make your call.
            </p>
          </section>
        )}

        <ScoringGuide />
      </div>
    </div>
  );
}
