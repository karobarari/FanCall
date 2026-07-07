import {
  Users,
  PoundSterling,
  Calendar,
  Star,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { StatCard } from "../components/StatCard";
import { ChartCard } from "../components/ChartCard";
import { EmptyState } from "../components/EmptyState";
import { Loading, ErrorBlock } from "../components/Status";
import type { Fixture, LeaderboardEntry, Load } from "../types";
import { truncate } from "../utils";

// recharts takes these as inline JS style/props, not CSS classes, so they
// can't pick up the .theme-light CSS-variable cascade the rest of the app
// uses — hardcoded to the light theme's City-navy palette directly.
const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid rgba(0,40,94,0.12)",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 4px 16px rgba(0,40,94,0.12)",
} as const;

export function OverviewTab({
  fixtures,
  fxState,
  leaderboard,
  lbState,
  onRetryLeaderboard,
}: {
  fixtures: Fixture[];
  fxState: Load;
  leaderboard: LeaderboardEntry[];
  lbState: Load;
  onRetryLeaderboard: () => void;
}) {
  const lbReady = lbState === "ready";
  const lbText = (fn: () => string) =>
    lbState === "loading" ? "\u2026" : lbState === "error" ? "\u2014" : fn();

  const completedCount = fixtures.filter((f) => f.status === "finished").length;
  const nextFixture = fixtures.find((f) => f.status !== "finished");
  const fixturesValue =
    fxState === "loading"
      ? "\u2026"
      : fxState === "error"
        ? "\u2014"
        : `${completedCount} / ${fixtures.length}`;
  const fixturesSub =
    fxState !== "ready"
      ? "From your fixtures"
      : nextFixture
        ? `Next: GW${nextFixture.gameweek} ${nextFixture.home_team} vs ${nextFixture.away_team}`
        : "All fixtures settled";

  const playersValue = lbText(() => String(leaderboard.length));
  const avgValue = lbText(() => {
    if (leaderboard.length === 0) return "0";
    const sum = leaderboard.reduce((s, p) => s + p.total_points, 0);
    return String(Math.round(sum / leaderboard.length));
  });
  const leader = lbReady && leaderboard.length ? leaderboard[0] : null;
  const leaderValue = lbText(() => (leader ? (leader.display_name ?? "Unnamed") : "\u2014"));
  const leaderSub = leader ? `${leader.total_points} points` : undefined;

  const topPlayers = [...leaderboard]
    .sort((a, b) => b.total_points - a.total_points)
    .slice(0, 8)
    .map((p) => ({
      name: p.display_name ?? "Unnamed",
      points: p.total_points,
    }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={Users}
          label="Players Playing FanCall"
          value={playersValue}
          sub="Registered players"
        />
        {/* TODO(payments): Total Revenue from settled transactions. */}
        <StatCard
          icon={PoundSterling}
          label="Total Revenue"
          value={"\u2014"}
          sub="Awaiting payments"
          muted
        />
        <StatCard
          icon={Calendar}
          label="Fixtures Completed"
          value={fixturesValue}
          sub={fixturesSub}
        />
        {/* TODO(stats): leaderboard has no perfect-call count — expose one and wire here. */}
        <StatCard
          icon={Star}
          label="Perfect Calls"
          value={"\u2014"}
          sub="Awaiting stats endpoint"
          muted
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Points Per Player"
          value={avgValue}
          sub="Across all players"
        />
        <StatCard
          icon={Trophy}
          label="Current Leader"
          value={leaderValue}
          sub={leaderSub}
          valueClass="text-gold"
          iconClass="text-gold"
          accent="gold"
        />
      </div>

      <ChartCard title="Top Players by Points" subtitle="Current standings \u2014 top 8 players">
        {lbState === "loading" ? (
          <Loading label="Loading standings\u2026" />
        ) : lbState === "error" ? (
          <ErrorBlock label="Couldn't load standings." onRetry={onRetryLeaderboard} />
        ) : topPlayers.length === 0 ? (
          <Loading label="No players yet." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={topPlayers}
              margin={{ top: 8, right: 8, left: -16, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(0,40,94,0.08)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tickFormatter={truncate}
                interval={0}
                tick={{ fill: "rgba(0,40,94,0.55)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, "auto"]}
                width={32}
                tick={{ fill: "rgba(0,40,94,0.5)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(0,40,94,0.05)" }}
                contentStyle={tooltipStyle}
                labelStyle={{ color: "#3d5578" }}
                itemStyle={{ color: "#00285e" }}
              />
              <Bar dataKey="points" radius={[6, 6, 0, 0]}>
                {topPlayers.map((p, i) => (
                  <Cell
                    key={p.name}
                    fill={i === 0 ? "var(--color-gold, #1f7dbd)" : "rgba(0,40,94,0.14)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* TODO(payments): replace with a real cumulative-revenue area chart once
          a transactions endpoint exists (sum amount over time). */}
      <EmptyState
        title="Cumulative Revenue"
        lines={[
          "Payments aren't integrated yet, so there's no revenue to chart.",
          "TODO(payments): wire a transactions endpoint and render the area chart here.",
        ]}
      />
    </div>
  );
}
