import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useLeaderboard } from '../data/store';

export default function Leaderboard() {
  const { user, logout } = useAuth();
  const { leaderboard, loading } = useLeaderboard();
  const [signingOut, setSigningOut] = useState(false);

  const me = leaderboard.find((r) => r.user_id === user?.id);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logout();
      // RequireAuth handles the redirect to /.
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <h1 className="title">Leaderboard</h1>
        <button
          className="ghost"
          onClick={handleLogout}
          disabled={signingOut}
          style={{ padding: '4px 0', fontSize: 14 }}
        >
          {signingOut ? 'Signing out…' : 'Log out'}
        </button>
      </div>

      {loading && leaderboard.length === 0 ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          {me && (
            <div className="metric">
              <div>
                <div className="muted">
                  {me.display_name ?? 'You'} · Rank {me.rank}
                </div>
                <div className="value">{me.total_points} pts</div>
              </div>
              <div className="avatar">me</div>
            </div>
          )}

          <div className="list">
            {leaderboard.map((r) => (
              <div
                key={r.user_id}
                className={r.user_id === user?.id ? 'row static me' : 'row static'}
              >
                <span className="match">
                  {r.rank} · {r.display_name ?? 'Unknown'}
                </span>
                <span className="muted">{r.total_points}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
