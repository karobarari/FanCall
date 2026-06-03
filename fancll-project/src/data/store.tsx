import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

// --- Types -----------------------------------------------------------------
export interface User {
  id: string;
  name: string;
}
export interface Score {
  home: number;
  away: number;
}
export interface Fixture {
  id: string;
  home: string;
  away: string;
  kickoff: string;
}
export interface FinishedFixture {
  id: string;
  home: string;
  away: string;
  result: Score;
}
export interface Prediction {
  home: number;
  away: number;
}
export interface Standing extends User {
  points: number;
  rank: number;
}

// --- Fake auth: pretend this person is logged in ---------------------------
export const currentUser: User = { id: 'u_you', name: 'You' };

const users: User[] = [
  currentUser,
  { id: 'u_sam', name: 'Sam' },
  { id: 'u_priya', name: 'Priya' },
  { id: 'u_jordan', name: 'Jordan' },
  { id: 'u_alex', name: 'Alex' },
];

// --- Upcoming fixtures: no result yet, these are what you predict ----------
export const fixtures: Fixture[] = [
  { id: 'f1', home: 'Arsenal', away: 'Chelsea', kickoff: 'Sat 15:00' },
  { id: 'f2', home: 'Spurs', away: 'Leeds', kickoff: 'Sat 17:30' },
  { id: 'f3', home: 'Everton', away: 'Forest', kickoff: 'Sun 14:00' },
  { id: 'f4', home: 'Newcastle', away: 'Brighton', kickoff: 'Sun 16:30' },
];

// --- Finished fixtures: have a real result, these feed the leaderboard ------
// In production you'd merge these into `fixtures` once each match ends.
const finished: FinishedFixture[] = [
  { id: 'p1', home: 'Liverpool', away: 'Villa', result: { home: 3, away: 1 } },
  { id: 'p2', home: 'Man City', away: 'Wolves', result: { home: 2, away: 0 } },
  { id: 'p3', home: 'Brentford', away: 'Fulham', result: { home: 1, away: 1 } },
];

// Seeded predictions so standings aren't empty on first run.
const seed: { userId: string; fixtureId: string; home: number; away: number }[] = [
  ['u_you', 'p1', 3, 1], ['u_you', 'p2', 1, 0], ['u_you', 'p3', 1, 1],
  ['u_sam', 'p1', 2, 1], ['u_sam', 'p2', 2, 0], ['u_sam', 'p3', 2, 1],
  ['u_priya', 'p1', 1, 1], ['u_priya', 'p2', 3, 1], ['u_priya', 'p3', 0, 0],
  ['u_jordan', 'p1', 3, 0], ['u_jordan', 'p2', 1, 1], ['u_jordan', 'p3', 2, 2],
  ['u_alex', 'p1', 0, 2], ['u_alex', 'p2', 1, 0], ['u_alex', 'p3', 1, 1],
].map(([userId, fixtureId, home, away]) => ({
  userId: userId as string,
  fixtureId: fixtureId as string,
  home: home as number,
  away: away as number,
}));

// --- Scoring (pure, easy to unit test) -------------------------------------
// 3 = exact score, 1 = right outcome (win/draw/loss), 0 = wrong.
export function scorePrediction(
  prediction: Prediction | undefined,
  result: Score | undefined
): number {
  if (!prediction || !result) return 0;
  if (prediction.home === result.home && prediction.away === result.away) return 3;
  const guess = Math.sign(prediction.home - prediction.away);
  const actual = Math.sign(result.home - result.away);
  return guess === actual ? 1 : 0;
}

// Sum each user's points across all finished fixtures, ranked high to low.
export function buildLeaderboard(): Standing[] {
  const byId: Record<string, Score> = Object.fromEntries(
    finished.map((f) => [f.id, f.result])
  );
  const totals = users.map((u) => {
    const points = seed
      .filter((p) => p.userId === u.id)
      .reduce((sum, p) => sum + scorePrediction(p, byId[p.fixtureId]), 0);
    return { ...u, points };
  });
  return totals
    .sort((a, b) => b.points - a.points)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

// --- Live predictions for upcoming fixtures (in-memory only) ---------------
interface PredictionsCtx {
  predictions: Record<string, Prediction>;
  hasPrediction: (fixtureId: string) => boolean;
  getPrediction: (fixtureId: string) => Prediction | undefined;
  savePrediction: (fixtureId: string, home: number, away: number) => void;
}

const PredictionsContext = createContext<PredictionsCtx | null>(null);

const STORAGE_KEY = 'fancall:predictions';

function loadPredictions(): Record<string, Prediction> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Prediction>) : {};
  } catch {
    return {};
  }
}

export function PredictionsProvider({ children }: { children: ReactNode }) {
  // Lazy initializer runs once, reading any saved predictions.
  const [predictions, setPredictions] = useState<Record<string, Prediction>>(
    loadPredictions
  );

  // Write back whenever predictions change.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(predictions));
    } catch {
      // storage full or unavailable — fail quietly for the skeleton
    }
  }, [predictions]);

  const value = useMemo<PredictionsCtx>(
    () => ({
      predictions,
      hasPrediction: (id) => Boolean(predictions[id]),
      getPrediction: (id) => predictions[id],
      savePrediction: (id, home, away) =>
        setPredictions((prev) => ({ ...prev, [id]: { home, away } })),
    }),
    [predictions]
  );

  return (
    <PredictionsContext.Provider value={value}>
      {children}
    </PredictionsContext.Provider>
  );
}

export function usePredictions(): PredictionsCtx {
  const ctx = useContext(PredictionsContext);
  if (!ctx) throw new Error('usePredictions must be used inside PredictionsProvider');
  return ctx;
}
