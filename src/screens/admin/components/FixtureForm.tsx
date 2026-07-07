import { useState } from "react";
import { DEFAULT_SEASON } from "../config";
import type { Fixture, FixtureDraft } from "../types";
import { toLocalInput } from "../utils";

const formInput =
  "w-full bg-[#07101d] border border-white/10 rounded-[10px] px-3 py-2.5 text-ink text-sm outline-none focus:border-white/30 placeholder:text-faint";

// Reusable create/edit form for a fixture's metadata (never the score).
// Manages its own field state; the parent closes it on a successful submit.
export function FixtureForm({
  initial,
  teams,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Fixture;
  teams: string[];
  submitLabel: string;
  onSubmit: (draft: FixtureDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [season, setSeason] = useState(initial?.season ?? DEFAULT_SEASON);
  const [gameweek, setGameweek] = useState(initial ? String(initial.gameweek) : "");
  const [home, setHome] = useState(initial?.home_team ?? "");
  const [away, setAway] = useState(initial?.away_team ?? "");
  const [kickoff, setKickoff] = useState(initial ? toLocalInput(initial.kickoff) : "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const gw = Number(gameweek);
    if (
      season.trim() === "" ||
      home.trim() === "" ||
      away.trim() === "" ||
      kickoff === ""
    ) {
      setError("Fill in every field.");
      return;
    }
    if (!Number.isInteger(gw) || gw < 1) {
      setError("Gameweek must be a whole number (1 or more).");
      return;
    }
    if (home.trim() === away.trim()) {
      setError("Home and away teams must differ.");
      return;
    }
    const d = new Date(kickoff);
    if (Number.isNaN(d.getTime())) {
      setError("Invalid kickoff date/time.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        season: season.trim(),
        gameweek: gw,
        home_team: home.trim(),
        away_team: away.trim(),
        kickoff: d.toISOString(),
      });
      // success -> parent unmounts this form
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-[120px]">
          <label className="block text-[12px] text-faint mb-1.5">Season</label>
          <input
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            placeholder="2025/26"
            className={formInput}
          />
        </div>
        <div className="w-[80px]">
          <label className="block text-[12px] text-faint mb-1.5">GW</label>
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={gameweek}
            onChange={(e) => setGameweek(e.target.value)}
            placeholder="1"
            className={formInput}
          />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-[12px] text-faint mb-1.5">Home team</label>
          <select
            value={home}
            onChange={(e) => setHome(e.target.value)}
            className={formInput}
          >
            <option value="">Home team</option>
            {teams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <span className="text-faint pb-2.5">vs</span>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-[12px] text-faint mb-1.5">Away team</label>
          <select
            value={away}
            onChange={(e) => setAway(e.target.value)}
            className={formInput}
          >
            <option value="">Away team</option>
            {teams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[210px]">
          <label className="block text-[12px] text-faint mb-1.5">Kickoff</label>
          <input
            type="datetime-local"
            value={kickoff}
            onChange={(e) => setKickoff(e.target.value)}
            className={formInput}
          />
        </div>
        <button
          onClick={submit}
          disabled={submitting}
          className="bg-city-gold text-navy font-semibold rounded-[10px] px-4 py-2.5 text-sm disabled:opacity-60 whitespace-nowrap"
        >
          {submitting ? "Saving\u2026" : submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="text-muted hover:text-ink text-sm px-2 py-2.5"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-red-400 text-[13px] m-0 mt-2">{error}</p>}
    </div>
  );
}
