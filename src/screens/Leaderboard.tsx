import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useLeaderboard, type Standing } from '../data/store';
import { apiGet } from '../lib/api';
import ClubBadge from '../components/ClubBadge';
import { SkeletonRows } from '../components/Skeleton';
import CountUp from '../components/CountUp';
import CrestWatermark from '../components/CrestWatermark';
import Avatar from '../components/Avatar';

// How long a rank-change arrow stays visible before fading back out — long
// enough to notice, short enough to read as transient rather than a
// permanent part of the row.
const RANK_INDICATOR_MS = 4000;

// The cross-club "League" scope is the multi-tenant/platform view. It's
// disabled for now (single-club product); flip this to re-expose the League
// tab. When false, the screen shows only the club leaderboard and the scope
// tab bar is hidden.
const LEAGUE_LEADERBOARD_ENABLED = false;

type Scope = 'club' | 'league';

// Tracks a leaderboard's own previous ranks so a settle/refresh that moves
// someone shows a "moved up/down" arrow, instead of the list just
// re-sorting silently. Each scope (club vs league) gets its own instance,
// so switching tabs never misfires an arrow using the other scope's ranks.
function useRankDeltas(leaderboard: Standing[]): Map<string, number> {
  const prevRanksRef = useRef<Map<string, number> | null>(null);
  const [rankDeltas, setRankDeltas] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (leaderboard.length === 0) return;
    const nextRanks = new Map(leaderboard.map((r) => [r.user_id, r.rank]));
    const prevRanks = prevRanksRef.current;

    if (prevRanks) {
      const deltas = new Map<string, number>();
      for (const [userId, rank] of nextRanks) {
        const prevRank = prevRanks.get(userId);
        if (prevRank !== undefined && prevRank !== rank) {
          deltas.set(userId, prevRank - rank); // positive = moved up
        }
      }
      if (deltas.size > 0) {
        setRankDeltas(deltas);
        const timer = setTimeout(() => setRankDeltas(new Map()), RANK_INDICATOR_MS);
        prevRanksRef.current = nextRanks;
        return () => clearTimeout(timer);
      }
    }
    prevRanksRef.current = nextRanks;
  }, [leaderboard]);

  return rankDeltas;
}

function ScopeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'rounded-xl px-4 py-2 text-sm font-medium transition border ' +
        (active
          ? 'bg-white/[0.06] text-gold border-gold/30'
          : 'text-muted hover:text-ink border-transparent')
      }
    >
      {children}
    </button>
  );
}

export default function Leaderboard() {
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>('club');

  const { leaderboard: clubLeaderboard, loading: clubLoading } = useLeaderboard();
  const [leagueLeaderboard, setLeagueLeaderboard] = useState<Standing[]>([]);
  const [leagueLoading, setLeagueLoading] = useState(false);

  useEffect(() => {
    if (scope !== 'league') return;
    let cancelled = false;
    setLeagueLoading(true);
    apiGet<{ leaderboard: Standing[] }>('/leaderboard?scope=league')
      .then((data) => {
        if (!cancelled) setLeagueLeaderboard(data.leaderboard);
      })
      .catch(() => {
        // Left as an empty list — the existing "no players yet" empty state
        // covers this without a separate error message.
      })
      .finally(() => {
        if (!cancelled) setLeagueLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const clubRankDeltas = useRankDeltas(clubLeaderboard);
  const leagueRankDeltas = useRankDeltas(leagueLeaderboard);

  const leaderboard = scope === 'club' ? clubLeaderboard : leagueLeaderboard;
  const loading = scope === 'club' ? clubLoading : leagueLoading;
  const rankDeltas = scope === 'club' ? clubRankDeltas : leagueRankDeltas;
  const me = leaderboard.find((r) => r.user_id === user?.id);

  return (
    <div className={scope === 'league' ? 'theme-platform' : undefined}>
      <header className="relative flex items-center justify-between gap-6 mb-[26px] flex-wrap">
        <CrestWatermark className="w-48 h-48 -top-6 right-4" />
        <div className="flex items-center gap-4">
          <ClubBadge size={56} logoUrl={user?.team_logo_url} alt={user?.team_name} />
          <div>
            <h1 className="m-0 text-3xl font-bold tracking-[-0.6px] text-ink">
              Leaderboard
            </h1>
            <p className="mt-1 text-faint text-sm">
              {scope === 'club'
                ? `${user?.team_name ?? 'Your Club'} · Club standings`
                : 'RYG-FanCall League · All clubs'}
            </p>
          </div>
        </div>
        {me && (
          <div className="flex items-center gap-3.5 bg-panel border border-white/10 rounded-card py-3 px-5">
            <span className="text-xl font-extrabold text-gold">#{me.rank}</span>
            <span className="text-sm text-muted">
              <CountUp value={me.total_points} /> pts
            </span>
          </div>
        )}
      </header>

      {LEAGUE_LEADERBOARD_ENABLED && (
        <div className="flex gap-2 mb-4">
          <ScopeTab active={scope === 'club'} onClick={() => setScope('club')}>
            My Club
          </ScopeTab>
          <ScopeTab active={scope === 'league'} onClick={() => setScope('league')}>
            League
          </ScopeTab>
        </div>
      )}

      <section className="bg-panel border border-white/10 rounded-card p-[18px] max-w-[640px]">
        {loading && leaderboard.length === 0 ? (
          <SkeletonRows rows={5} />
        ) : leaderboard.length === 0 ? (
          <p className="text-faint text-[13px]">
            No players yet — be the first to make a call.
          </p>
        ) : (
          <ol className="list-none m-0 p-0 flex flex-col gap-1.5">
            {leaderboard.map((r) => {
              const delta = rankDeltas.get(r.user_id);
              return (
                <li
                  key={r.user_id}
                  className={
                    'flex items-center gap-3.5 py-[13px] px-3.5 rounded-[10px] bg-panel-2 border ' +
                    (r.user_id === user?.id ? 'border-gold bg-gold/15' : 'border-transparent')
                  }
                >
                  <span className="w-[26px] font-bold text-faint text-center">{r.rank}</span>
                  {delta !== undefined && (
                    <span
                      className={
                        'rank-indicator text-[11px] font-bold ' +
                        (delta > 0 ? 'text-green' : 'text-flag')
                      }
                    >
                      {delta > 0 ? '▲' : '▼'}
                      {Math.abs(delta)}
                    </span>
                  )}
                  <Avatar
                    name={r.display_name ?? 'Unknown'}
                    avatar={r.avatar}
                    avatarUrl={r.avatar_url}
                    size={34}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">
                      {r.display_name ?? 'Unknown'}
                    </span>
                    {scope === 'league' && (
                      <span className="flex items-center gap-1.5 text-xs text-muted mt-0.5 min-w-0">
                        <ClubBadge size={14} logoUrl={r.team_logo_url} alt={r.team_name} />
                        <span className="truncate">{r.team_name}</span>
                      </span>
                    )}
                  </span>
                  <CountUp value={r.total_points} className="font-bold text-gold shrink-0" />
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
