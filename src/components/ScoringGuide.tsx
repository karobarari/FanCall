// Scoring Guide — displays the 6 point rules to help fans understand scoring.
// All values are skeleton-locked; no config needed.

interface GuideRow {
  icon: string;
  title: string;
  description: string;
  points: number;
  color: "green" | "orange" | "gold" | "teal";
}

const SCORING_RULES: GuideRow[] = [
  {
    icon: "✓",
    title: "Correct Prediction",
    description: "Each of the 3 predictions you get right",
    points: 10,
    color: "green",
  },
  {
    icon: "✕",
    title: "Incorrect Prediction",
    description: "You still earn points even if wrong",
    points: 5,
    color: "orange",
  },
  {
    icon: "○",
    title: "Missed Fixture",
    description: "Per question if no prediction submitted",
    points: 4,
    color: "teal",
  },
  {
    icon: "★",
    title: "Perfect Call Bonus",
    description: "All 3 correct — bonus on top of 30 pts",
    points: 20,
    color: "gold",
  },
];

export function ScoringGuide() {
  return (
    <div style={{ padding: "16px 12px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <span style={{ fontSize: "20px" }}>⚡</span>
        <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
          Scoring Guide
        </h2>
      </div>

      {/* Guide rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {SCORING_RULES.map((rule) => (
          <div
            key={rule.title}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "12px",
              display: "flex",
              gap: "12px",
              alignItems: "flex-start",
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background:
                  rule.color === "green"
                    ? "rgba(16,185,129,0.2)"
                    : rule.color === "orange"
                      ? "rgba(239,68,68,0.2)"
                      : rule.color === "gold"
                        ? "rgba(217,119,6,0.2)"
                        : "rgba(20,184,166,0.2)",
                color:
                  rule.color === "green"
                    ? "#10b981"
                    : rule.color === "orange"
                      ? "#ef4444"
                      : rule.color === "gold"
                        ? "#d97706"
                        : "#14b8a6",
                fontSize: "16px",
              }}
            >
              {rule.icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: "8px",
                  marginBottom: "4px",
                }}
              >
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 500 }}>
                  {rule.title}
                </h3>
                <span
                  style={{
                    color:
                      rule.color === "green"
                        ? "#10b981"
                        : rule.color === "orange"
                          ? "#ef4444"
                          : rule.color === "gold"
                            ? "#fbbf24"
                            : "#14b8a6",
                    fontSize: "13px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  +{rule.points} pts
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                {rule.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Maximum box */}
      <div
        style={{
          marginTop: "16px",
          padding: "16px",
          border: "2px solid rgba(217,119,6,0.4)",
          borderRadius: "12px",
          textAlign: "center",
          background: "rgba(55,48,44,0.5)",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.5)",
            marginBottom: "8px",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Maximum per fixture
        </div>
        <div
          style={{
            fontSize: "32px",
            fontWeight: 700,
            color: "#fbbf24",
            marginBottom: "6px",
          }}
        >
          50 pts
        </div>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
          3 correct (30) + Perfect Call bonus (20)
        </div>
      </div>

      {/* Join Anytime explainer */}
      <div
        style={{
          marginTop: "16px",
          padding: "12px",
          background: "rgba(20,184,166,0.1)",
          border: "1px solid rgba(20,184,166,0.3)",
          borderRadius: "12px",
          display: "flex",
          gap: "8px",
          alignItems: "flex-start",
        }}
      >
        <div style={{ fontSize: "16px", flexShrink: 0 }}>⬆️⬆️</div>
        <div>
          <div
            style={{ fontSize: "13px", fontWeight: 600, color: "#14b8a6" }}
          >
            Join Anytime
          </div>
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: "12px",
              color: "rgba(255,255,255,0.6)",
              lineHeight: "1.4",
            }}
          >
            New players automatically receive <strong>12 pts</strong> for every
            fixture missed before joining — keeping you competitive all season.
          </p>
        </div>
      </div>
    </div>
  );
}
