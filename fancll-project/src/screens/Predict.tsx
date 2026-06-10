import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFixtures, usePredictions } from "../data/store";
import { ResultSelector } from "../components/ResultSelector";
import { clubIsHome, toResultPred, type ClubResult } from "../lib/result";

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
        <button
          className="step-btn"
          onClick={() => onChange(Math.max(0, value - 1))}
        >
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
  const { fixtures, loading } = useFixtures();
  const { getPrediction, savePrediction } = usePredictions();

  const fixture = fixtures.find((f) => f.id === fixtureId);
  const existing = fixtureId ? getPrediction(fixtureId) : undefined;
  const [home, setHome] = useState(existing ? existing.home : 0);
  const [away, setAway] = useState(existing ? existing.away : 0);
  const [result, setResult] = useState<ClubResult | null>(
    existing ? null : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading && fixtures.length === 0) {
    return (
      <div className="screen">
        <p className="muted">Loading…</p>
      </div>
    );
  }

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

  const locked = new Date(fixture.kickoff).getTime() <= Date.now();

  async function submit() {
    if (!result) {
      setError("Pick Win, Draw, or Lose first.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result_pred = toResultPred(result, clubIsHome(fixture!));
      await savePrediction(fixture!.id, home, away, result_pred);
      navigate(-1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save prediction");
    } finally {
      setBusy(false);
    }
  }

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
          {fixture.home_team} v {fixture.away_team}
        </div>
        <div className="kickoff">
          {new Date(fixture.kickoff).toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      <ResultSelector value={result} onChange={setResult} disabled={false} />

      <div className="score-row">
        <Stepper label={fixture.home_team} value={home} onChange={setHome} />
        <span className="colon">:</span>
        <Stepper label={fixture.away_team} value={away} onChange={setAway} />
      </div>

      <p className="muted" style={{ textAlign: "center", marginTop: 24 }}>
        Locks at kickoff
      </p>

      {error && (
        <p
          style={{
            color: "#c0392b",
            textAlign: "center",
            fontSize: 13,
            margin: 0,
          }}
        >
          {error}
        </p>
      )}

      <div className="spacer" />
      <button className="btn" onClick={submit} disabled={busy}>
        {busy ? "Saving…" : "Submit prediction"}
      </button>
    </div>
  );
}
