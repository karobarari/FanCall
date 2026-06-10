import type { ClubResult } from "../lib/result";

const OPTIONS: { key: ClubResult; label: string }[] = [
  { key: "WIN", label: "Win" },
  { key: "DRAW", label: "Draw" },
  { key: "LOSE", label: "Lose" },
];

export function ResultSelector({
  value,
  onChange,
  disabled,
}: {
  value: ClubResult | null;
  onChange: (v: ClubResult) => void;
  disabled?: boolean;
}) {
  return (
    <div className="result-selector" role="group" aria-label="Predicted result">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          disabled={disabled}
          aria-pressed={value === o.key}
          className={`result-btn${value === o.key ? " is-active" : ""}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
