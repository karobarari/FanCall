import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiGet, apiPost } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

// --- Server-shaped types (snake_case to match the API responses) -----------
export interface Fixture {
  id: string;
  season: string;
  gameweek: number;
  home_team: string;
  away_team: string;
  kickoff: string; // ISO string
  home_score: number | null;
  away_score: number | null;
  status: "upcoming" | "finished";
}

export interface Prediction {
  home: number;
  away: number;
  result_pred: "home" | "draw" | "away";
}

export interface Standing {
  user_id: string;
  display_name: string | null;
  total_points: number;
  rank: number;
}

interface PredictionRow {
  fixture_id: string;
  home_pred: number;
  away_pred: number;
  result_pred: "home" | "draw" | "away";
}

interface DataContextValue {
  fixtures: Fixture[];
  predictions: Record<string, Prediction>;
  leaderboard: Standing[];
  loading: boolean;
  refresh: () => Promise<void>;
  hasPrediction: (fixtureId: string) => boolean;
  getPrediction: (fixtureId: string) => Prediction | undefined;
  savePrediction: (
    fixtureId: string,
    home: number,
    away: number,
    result_pred: "home" | "draw" | "away",
  ) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>(
    {},
  );
  const [leaderboard, setLeaderboard] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [f, p, l] = await Promise.all([
        apiGet<{ fixtures: Fixture[] }>("/fixtures"),
        apiGet<{ predictions: PredictionRow[] }>("/predictions"),
        apiGet<{ leaderboard: Standing[] }>("/leaderboard"),
      ]);
      setFixtures(f.fixtures);
      const map: Record<string, Prediction> = {};
      for (const row of p.predictions) {
        map[row.fixture_id] = {
          home: row.home_pred,
          away: row.away_pred,
          result_pred: row.result_pred,
        };
      }
      setPredictions(map);
      setLeaderboard(l.leaderboard);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch on login; clear on logout.
  useEffect(() => {
    if (user) {
      refresh().catch(() => {
        // Errors are intentionally swallowed here — individual screens can
        // surface their own; refresh() can be called again to retry.
      });
    } else {
      setFixtures([]);
      setPredictions({});
      setLeaderboard([]);
    }
  }, [user, refresh]);

  const savePrediction = useCallback(
    async (
      fixtureId: string,
      home: number,
      away: number,
      result_pred: "home" | "draw" | "away",
    ) => {
      await apiPost("/predictions", {
        fixture_id: fixtureId,
        home_pred: home,
        away_pred: away,
        result_pred,
      });
      setPredictions((prev) => ({
        ...prev,
        [fixtureId]: { home, away, result_pred },
      }));
    },
    [],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      fixtures,
      predictions,
      leaderboard,
      loading,
      refresh,
      hasPrediction: (id) => Boolean(predictions[id]),
      getPrediction: (id) => predictions[id],
      savePrediction,
    }),
    [fixtures, predictions, leaderboard, loading, refresh, savePrediction],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}

// --- Focused hooks ---------------------------------------------------------

export function useFixtures() {
  const { fixtures, loading, refresh } = useData();
  return { fixtures, loading, refresh };
}

export function usePredictions() {
  const { predictions, hasPrediction, getPrediction, savePrediction } =
    useData();
  return { predictions, hasPrediction, getPrediction, savePrediction };
}

export function useLeaderboard() {
  const { leaderboard, loading, refresh } = useData();
  return { leaderboard, loading, refresh };
}
