import { useState } from "react";
import { RotateCw } from "lucide-react";
import { TABS, PREMIER_LEAGUE_TEAMS } from "./admin/config";
import { useAdminData } from "./admin/useAdminData";
import { OverviewTab } from "./admin/tabs/OverviewTab";
import { FixturesTab } from "./admin/tabs/FixturesTab";
import { PlayersTab } from "./admin/tabs/PlayersTab";
import { TransactionsTab } from "./admin/tabs/TransactionsTab";

/* ==================================================================
   Admin dashboard — backed by LIVE data from the API.

   WIRED (real data):
     - Fixtures tab: list, settle, create (POST /api/fixtures),
       edit metadata (PATCH /api/fixtures/:id)
     - Overview: Players Playing, Avg Points, Current Leader, Top Players
       chart, Fixtures Completed
     - Players tab: name / points / rank             GET /api/leaderboard

   NOT WIRED — left empty with TODOs (no endpoint exists yet):
     - TODO(payments): Total Revenue, Avg Transaction, Cumulative Revenue, Transactions tab
     - TODO(stats):    Perfect Calls count (leaderboard doesn't expose it)
     - TODO(users):    Players tab columns Club / Played / Perfect Calls / Joined,
                       and "Add New Player"

   Structure:
     admin/config.ts        endpoints + constants + tab defs
     admin/types.ts         shared types
     admin/utils.ts         pure formatting / response-parsing helpers
     admin/useAdminData.ts  fetching state + mutations (the API seam)
     admin/components/*     presentational primitives + FixtureForm
     admin/tabs/*           Overview / Fixtures / Players / Transactions
==================================================================== */
export default function Admin() {
  const [tab, setTab] = useState("overview");

  const {
    fixtures,
    fxState,
    leaderboard,
    lbState,
    teams,
    teamsReady,
    loadFixtures,
    loadLeaderboard,
    settle,
    createFixture,
    updateFixture,
    toggleLock,
  } = useAdminData();

  // Dropdown options: live teams (or PL fallback), merged with any team names
  // already present in fixtures so existing rows stay selectable on edit.
  const teamOptions = Array.from(
    new Set([
      ...(teamsReady ? teams : PREMIER_LEAGUE_TEAMS),
      ...fixtures.flatMap((f) => [f.home_team, f.away_team]),
    ]),
  )
    .filter((s) => s !== "")
    .sort((a, b) => a.localeCompare(b));

  return (
    <div>
      {/* Header */}
      <header className="flex items-center justify-between gap-6 mb-6 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full ring-2 ring-city-gold bg-white text-navy font-extrabold flex items-center justify-center text-[17px]">
            MC
          </div>
          <div>
            <h1 className="m-0 text-3xl font-bold tracking-[-0.6px] text-ink">
              Admin Dashboard
            </h1>
            <p className="mt-1 text-faint text-sm">
              Manage Manchester City fixtures, track players and revenue
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            void loadFixtures();
            void loadLeaderboard();
          }}
          className="flex items-center gap-2 rounded-xl border border-white/15 text-ink px-4 py-2.5 text-sm font-semibold hover:bg-white/5 transition"
        >
          <RotateCw size={16} /> Refresh
        </button>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {TABS.map((t) => {
          const active = t.id === tab;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition border ${
                active
                  ? "bg-white/[0.06] text-gold border-gold/30"
                  : "text-muted hover:text-ink border-transparent"
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {tab === "overview" ? (
        <OverviewTab
          fixtures={fixtures}
          fxState={fxState}
          leaderboard={leaderboard}
          lbState={lbState}
          onRetryLeaderboard={loadLeaderboard}
        />
      ) : tab === "fixtures" ? (
        <FixturesTab
          fixtures={fixtures}
          teams={teamOptions}
          state={fxState}
          onSettle={settle}
          onCreate={createFixture}
          onUpdate={updateFixture}
          onToggleLock={toggleLock}
          onRetry={loadFixtures}
        />
      ) : tab === "transactions" ? (
        <TransactionsTab />
      ) : (
        <PlayersTab leaderboard={leaderboard} state={lbState} onRetry={loadLeaderboard} />
      )}
    </div>
  );
}
