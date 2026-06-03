import { buildLeaderboard, currentUser } from '../data/store';

export default function Leaderboard() {
  const standings = buildLeaderboard();
  const me = standings.find((r) => r.id === currentUser.id)!;

  return (
    <div className="screen">
      <h1 className="title">Leaderboard</h1>

      <div className="metric">
        <div>
          <div className="muted">You · Rank {me.rank}</div>
          <div className="value">{me.points} pts</div>
        </div>
        <div className="avatar">me</div>
      </div>

      <div className="list">
        {standings.map((r) => (
          <div
            key={r.id}
            className={r.id === currentUser.id ? 'row static me' : 'row static'}
          >
            <span className="match">
              {r.rank} · {r.name}
            </span>
            <span className="muted">{r.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
