import { useState, useEffect, useCallback } from "react";
import { API } from "./config";
import type { Fixture, FixtureDraft, LeaderboardEntry, Load } from "./types";
import { isObj, pickLeaderboard, pickTeams, readError } from "./utils";
/* ==================================================================
   All admin data: fixtures + leaderboard + teams, plus the mutations
   (settle / create / update) that the Fixtures tab drives. Components
   stay presentational; this is the single seam to the API.
==================================================================== */
export function useAdminData() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [fxState, setFxState] = useState<Load>("loading");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbState, setLbState] = useState<Load>("loading");
  const [teams, setTeams] = useState<string[]>([]);
  const [teamsReady, setTeamsReady] = useState(false);

 const loadFixtures = useCallback(async () => {
   setFxState("loading");
   try {
     const res = await fetch(API.fixtures, { credentials: "include" });
     if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

     const json: unknown = await res.json();

     const arr =
       isObj(json) && Array.isArray(json.fixtures)
         ? (json.fixtures as Fixture[])
         : Array.isArray(json)
           ? (json as Fixture[])
           : [];
     setFixtures(arr);
     setFxState("ready");
   } catch{
     setFxState("error");
   }
 }, []);

  const loadLeaderboard = useCallback(async () => {
    setLbState("loading");
    try {
      const res = await fetch(API.leaderboard, { credentials: "include" });
      if (!res.ok) throw new Error();
      setLeaderboard(pickLeaderboard(await res.json()));
      setLbState("ready");
    } catch {
      setLbState("error");
    }
  }, []);

  // Team list for the fixture dropdowns. Prefers your seeded `teams` table;
  // silently falls back to PREMIER_LEAGUE_TEAMS if the endpoint isn't there.
  const loadTeams = useCallback(async () => {
    try {
      const res = await fetch(API.teams, { credentials: "include" });
      if (!res.ok) throw new Error();
      const t = pickTeams(await res.json());
      if (t.length) {
        setTeams(t);
        setTeamsReady(true);
      }
    } catch {
      /* fall back to PREMIER_LEAGUE_TEAMS */
    }
  }, []);

  useEffect(() => {
    void loadFixtures();
    void loadLeaderboard();
    void loadTeams();
  }, [loadFixtures, loadLeaderboard, loadTeams]);

  const settle = useCallback(
    async (id: string, homeScore: number, awayScore: number) => {
      const res = await fetch(API.settle(id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ home_score: homeScore, away_score: awayScore }),
      });
      if (!res.ok) throw new Error(await readError(res, "Settle failed"));
      // Settling changes scores, so refresh both fixtures and standings.
      await Promise.all([loadFixtures(), loadLeaderboard()]);
    },
    [loadFixtures, loadLeaderboard],
  );

  const createFixture = useCallback(
    async (draft: FixtureDraft) => {
      const res = await fetch(API.fixtures, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error(await readError(res, "Couldn't add fixture"));
      await loadFixtures();
    },
    [loadFixtures],
  );

  const updateFixture = useCallback(
    async (id: string, draft: FixtureDraft) => {
      const res = await fetch(API.fixture(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error(await readError(res, "Couldn't update fixture"));
      // Metadata edit doesn't touch scores, so only fixtures need refreshing.
      await loadFixtures();
    },
    [loadFixtures],
  );
  return {
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
  };
}
