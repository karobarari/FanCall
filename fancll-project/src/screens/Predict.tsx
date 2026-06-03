import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fixtures, usePredictions } from '../data/store';

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
    <div className="stepper">
      <span className="team">{label}</span>
      <div className="score-box">{value}</div>
      <div className="step-btns">
        <button className="step-btn" onClick={() => onChange(Math.max(0, value - 1))}>
          −
        </button>
        <button className="step-btn" onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  );
}

export default function Predict() {
  const navigate = useNavigate();
  const { fixtureId } = useParams<{ fixtureId: string }>();
  const fixture = fixtures.find((f) => f.id === fixtureId);
  const { getPrediction, savePrediction } = usePredictions();

  const existing = fixtureId ? getPrediction(fixtureId) : undefined;
  const [home, setHome] = useState(existing ? existing.home : 0);
  const [away, setAway] = useState(existing ? existing.away : 0);

  if (!fixture) {
    return (
      <div className="screen">
        <p className="muted">Fixture not found.</p>
        <button className="btn" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>
    );
  }

  const submit = () => {
    savePrediction(fixture.id, home, away);
    navigate(-1);
  };

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back" onClick={() => navigate(-1)}>
          ‹ Back
        </button>
        <h1 className="title" style={{ fontSize: 16 }}>
          Predict
        </h1>
        <span style={{ width: 48 }} />
      </div>

      <div className="match-bar">
        <div className="match" style={{ fontWeight: 500 }}>
          {fixture.home} v {fixture.away}
        </div>
        <div className="kickoff">{fixture.kickoff}</div>
      </div>

      <div className="score-row">
        <Stepper label={fixture.home} value={home} onChange={setHome} />
        <span className="colon">:</span>
        <Stepper label={fixture.away} value={away} onChange={setAway} />
      </div>

      <p className="muted" style={{ textAlign: 'center', marginTop: 24 }}>
        Locks at kickoff
      </p>

      <div className="spacer" />
      <button className="btn" onClick={submit}>
        Submit prediction
      </button>
    </div>
  );
}
