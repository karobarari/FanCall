import { useNavigate } from 'react-router-dom';
import { fixtures, usePredictions } from '../data/store';

export default function Fixtures() {
  const navigate = useNavigate();
  const { hasPrediction } = usePredictions();

  return (
    <div className="screen">
      <h1 className="title">Fixtures</h1>
      <p className="muted">Gameweek 12</p>

      <div className="list">
        {fixtures.map((f) => {
          const done = hasPrediction(f.id);
          return (
            <button
              key={f.id}
              className="row"
              onClick={() => navigate(`/predict/${f.id}`)}
            >
              <span>
                <span className="match">
                  {f.home} v {f.away}
                </span>
                <span className="kickoff" style={{ display: 'block' }}>
                  {f.kickoff}
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
