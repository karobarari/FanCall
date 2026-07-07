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
  type ClubResult,
} from '../lib/result';
import { scorePrediction } from '../lib/scoring';
import ClubBadge from '../components/ClubBadge';
import CountUp from '../components/CountUp';
import { SkeletonRows } from '../components/Skeleton';
import CrestWatermark from '../components/CrestWatermark';

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
            const scored =
              pred && f.home_score != null && f.away_score != null
                ? scorePrediction(pred, {
                    home_score: f.home_score,
                    away_score: f.away_score,
                  })
                : null;
            badge = scored ? (
              scored.perfect ? (
                <span className="perfect-badge text-[11px] font-bold py-1 px-[9px] rounded-full whitespace-nowrap shrink-0 text-navy bg-city-gold">
                  ✨ {scored.points} pts
                </span>
              ) : (
                <span className="text-[11px] font-semibold py-1 px-[9px] rounded-full whitespace-nowrap shrink-0 text-gold bg-gold/15">
                  {scored.points} pts
                </span>
              )
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
  teamId,
}: {
  fixture: Fixture;
  existing: Prediction | undefined;
  teamId: string;
}) {
  const { savePrediction } = usePredictions();
  const [home, setHome] = useState(existing ? existing.home : 0);
  const [away, setAway] = useState(existing ? existing.away : 0);
  const [result, setResult] = useState<ClubResult | null>(
    existing ? toClubResult(existing.result_pred, clubIsHome(fixture, teamId)) : null,
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
        toResultPred(result, clubIsHome(fixture, teamId)),
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
          Will {clubIsHome(fixture, teamId) ? fixture.home_team : fixture.away_team} win, draw, or lose?
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
// Per-rule accent colours (icon + "+N pts"), independent of the light/dark
// theme — chosen deliberately saturated enough to read on either. Everything
// else in this component uses the app's text-ink/text-muted/bg-panel-2
// tokens instead of literal colours, so it re-themes along with everything
// else in .theme-light.
const RULE_ACCENT: Record<GuideRow['color'], string> = {
  green: '#0d9668',
  orange: '#dc2626',
  gold: '#b45309',
  teal: '#0d9488',
};
const RULE_ACCENT_BG: Record<GuideRow['color'], string> = {
  green: 'rgba(16,185,129,0.15)',
  orange: 'rgba(239,68,68,0.15)',
  gold: 'rgba(217,119,6,0.15)',
  teal: 'rgba(20,184,166,0.15)',
};

export function ScoringGuide() {
  return (
    <div className="p-4 px-3">
      {/* Header */}
      <div className="flex gap-2 items-center mb-4">
        <span className="text-xl">⚡</span>
        <h2 className="m-0 text-base font-semibold text-ink">Scoring Guide</h2>
      </div>

      {/* Guide rows */}
      <div className="flex flex-col gap-3">
        {SCORING_RULES.map((rule) => (
          <div
            key={rule.title}
            className="bg-panel-2 border border-white/10 rounded-xl p-3 flex gap-3 items-start"
          >
            {/* Icon */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base"
              style={{ background: RULE_ACCENT_BG[rule.color], color: RULE_ACCENT[rule.color] }}
            >
              {rule.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline gap-2 mb-1">
                <h3 className="m-0 text-sm font-medium text-ink">{rule.title}</h3>
                <span
                  className="text-[13px] font-semibold whitespace-nowrap"
                  style={{ color: RULE_ACCENT[rule.color] }}
                >
                  +{rule.points} pts
                </span>
              </div>
              <p className="m-0 text-[13px] text-muted">{rule.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Maximum box — Man City's actual badge gold (#FFC659), since this is
          the one celebratory/bonus highlight on the page. */}
      <div className="mt-4 p-4 rounded-xl text-center border-2 border-city-gold/40 bg-city-gold/10">
        <div className="text-xs text-muted mb-2 font-medium uppercase tracking-wide">
          Maximum per fixture
        </div>
        <div className="text-[32px] font-bold text-city-gold mb-1.5">50 pts</div>
        <div className="text-xs text-muted">3 correct (30) + Perfect Call bonus (20)</div>
      </div>

      {/* Join Anytime explainer */}
      <div className="mt-4 p-3 rounded-xl flex gap-2 items-start bg-[#14b8a6]/10 border border-[#14b8a6]/30">
        <div className="text-base shrink-0">⬆️⬆️</div>
        <div>
          <div className="text-[13px] font-semibold" style={{ color: RULE_ACCENT.teal }}>
            Join Anytime
          </div>
          <p className="mt-1 mb-0 text-xs text-muted leading-snug">
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
    return (
      <div className="bg-panel border border-white/10 rounded-card">
        <SkeletonRows rows={6} />
      </div>
    );
  }

  return (
    <div>
      <header className="relative flex items-center justify-between gap-6 mb-[26px] flex-wrap">
        <CrestWatermark className="w-48 h-48 -top-6 right-4" />
        <div className="flex items-center gap-4">
          <ClubBadge size={56} logoUrl={user?.team_logo_url} alt={user?.team_name} />
          <div>
            <h1 className="m-0 text-3xl font-bold tracking-[-0.6px] text-ink">
              Make Your Call
            </h1>
            <p className="mt-1 text-faint text-sm">
              {user?.team_name ?? 'Your Club'} · {season} · All Fixtures
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 bg-panel border border-white/10 rounded-card py-3.5 px-2">
          <div className="flex flex-col items-center px-[18px] min-w-[78px] border-l border-white/10 first:border-l-0">
            <CountUp value={myPoints} className="text-[26px] font-bold text-gold leading-[1.1]" />
            <span className="text-[11px] text-muted mt-1 whitespace-nowrap">
              My Points
            </span>
          </div>
          <div className="flex flex-col items-center px-[18px] min-w-[78px] border-l border-white/10 first:border-l-0">
            <CountUp value={perfectCalls} className="text-[26px] font-bold text-gold leading-[1.1]" />
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
            teamId={user!.team_id}
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
