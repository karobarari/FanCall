import { useNavigate } from 'react-router-dom';
import { useFixtures, usePredictions } from '../data/store';

// Cheap, locale-aware kickoff formatting.
function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Fixtures() {
  const navigate = useNavigate();
  const { fixtures, loading } = useFixtures();
  const { hasPrediction } = usePredictions();

  if (loading && fixtures.length === 0) {
    return (
      <div className="screen">
        <p className="muted">Loading fixtures…</p>
      </div>
    );
  }

  // Show the earliest gameweek that still has upcoming matches.
  const upcoming = fixtures.filter((f) => f.status === 'upcoming');
  const currentGw = upcoming[0]?.gameweek;
  const inGameweek = upcoming.filter((f) => f.gameweek === currentGw);

  return (
    <div className="screen">
      <h1 className="title">Fixtures</h1>
      <p className="muted">{currentGw ? `Gameweek ${currentGw}` : 'No upcoming fixtures'}</p>

      <div className="list">
        {inGameweek.map((f) => {
          const done = hasPrediction(f.id);
          return (
            <button
              key={f.id}
              className="row"
              onClick={() => navigate(`/predict/${f.id}`)}
            >
              <span>
                <span className="match">
                  {f.home_team} v {f.away_team}
                </span>
                <span className="kickoff" style={{ display: 'block' }}>
                  {formatKickoff(f.kickoff)}
                </span>
              </span>
              <span className={done ? 'chip done' : 'chip'}>
                {done ? 'Done ✓' : 'Predict'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
