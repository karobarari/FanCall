import { useAuth } from '../auth/AuthContext';
import { useLeaderboard } from '../data/store';
import { CLUB } from '../lib/result';

export default function Leaderboard() {
  const { user } = useAuth();
  const { leaderboard, loading } = useLeaderboard();
  const me = leaderboard.find((r) => r.user_id === user?.id);

  return (
    <div>
      <header className="flex items-center justify-between gap-6 mb-[26px] flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full ring-2 ring-city-gold bg-white text-navy font-extrabold flex items-center justify-center text-[17px]">
            MC
          </div>
          <div>
            <h1 className="m-0 text-3xl font-bold tracking-[-0.6px] text-ink">
              Leaderboard
            </h1>
            <p className="mt-1 text-faint text-sm">
              {CLUB ?? 'Your Club'} · Season standings
            </p>
          </div>
        </div>
        {me && (
          <div className="flex items-center gap-3.5 bg-panel border border-white/10 rounded-card py-3 px-5">
            <span className="text-xl font-extrabold text-gold">#{me.rank}</span>
            <span className="text-sm text-muted">{me.total_points} pts</span>
          </div>
        )}
      </header>

      <section className="bg-panel border border-white/10 rounded-card p-[18px] max-w-[640px]">
        {loading && leaderboard.length === 0 ? (
          <p className="text-faint text-[13px]">Loading…</p>
        ) : leaderboard.length === 0 ? (
          <p className="text-faint text-[13px]">
            No players yet — be the first to make a call.
          </p>
        ) : (
          <ol className="list-none m-0 p-0 flex flex-col gap-1.5">
            {leaderboard.map((r) => (
              <li
                key={r.user_id}
                className={
                  'flex items-center gap-3.5 py-[13px] px-3.5 rounded-[10px] bg-panel-2 border ' +
                  (r.user_id === user?.id ? 'border-gold bg-gold/15' : 'border-transparent')
                }
              >
                <span className="w-[26px] font-bold text-faint text-center">{r.rank}</span>
                <span className="flex-1 text-sm font-medium">
                  {r.display_name ?? 'Unknown'}
                </span>
                <span className="font-bold text-gold">{r.total_points}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
