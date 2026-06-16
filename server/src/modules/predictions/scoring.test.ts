import { describe, it, expect } from "@jest/globals";

import {
  scorePrediction,
  resultFromScore,
  scoreFixture,
  scoreFixtureForUser,
  userTotal,
  rankLeaderboard,
  CORRECT,
  WRONG,
  PERFECT_BONUS,
  NO_SCORE,
  type Prediction,
} from "./scoring";

describe("resultFromScore", () => {
  it("home win when home > away", () => {
    expect(resultFromScore(2, 1)).toBe("home");
  });
  it("away win when home < away", () => {
    expect(resultFromScore(0, 3)).toBe("away");
  });
  it("draw when equal", () => {
    expect(resultFromScore(1, 1)).toBe("draw");
  });
  it("0-0 is a draw", () => {
    expect(resultFromScore(0, 0)).toBe("draw");
  });
});

describe("scorePrediction — canonical anchors", () => {
  it("perfect call scores 50 (10+10+10+20)", () => {
    expect(scorePrediction("home", 2, 1, 2, 1)).toBe(50);
  });
  it("result right, both scores wrong scores 20 (10+5+5)", () => {
    expect(scorePrediction("home", 2, 1, 3, 0)).toBe(20);
  });
  it("all three calls wrong scores the floor of 15 (5+5+5)", () => {
    expect(scorePrediction("away", 0, 5, 3, 0)).toBe(15);
  });
  it("perfect draw scores 50", () => {
    expect(scorePrediction("draw", 1, 1, 1, 1)).toBe(50);
  });
});

describe("scorePrediction — independent calls", () => {
  it("wrong result + one correct score (5+10+5 = 20)", () => {
    expect(scorePrediction("home", 2, 1, 2, 3)).toBe(20);
  });
  it("both scores right but result call wrong still misses the bonus (5+10+10 = 25)", () => {
    expect(scorePrediction("away", 2, 1, 2, 1)).toBe(25);
  });
  it("self-contradictory pick is scored exactly as entered (5+10+10 = 25)", () => {
    expect(scorePrediction("draw", 2, 1, 2, 1)).toBe(25);
  });
  it("correct result via wrong scoreline (10+5+5 = 20)", () => {
    expect(scorePrediction("home", 1, 0, 4, 2)).toBe(20);
  });
});

describe("scorePrediction — boundaries", () => {
  it("never returns less than the 15 floor for a submitted prediction", () => {
    expect(scorePrediction("home", 5, 0, 1, 1)).toBe(15);
  });
  it("bonus only fires when ALL three are correct, not two (10+10+5 = 25)", () => {
    // predict away 0-3, actual 0-2 => away win.
    // result: away == away -> 10; home: 0 == 0 -> 10; away: 3 != 2 -> 5 = 25.
    expect(scorePrediction("away", 0, 3, 0, 2)).toBe(25);
  });
  it("exposes the point constants", () => {
    expect(CORRECT).toBe(10);
    expect(WRONG).toBe(5);
    expect(PERFECT_BONUS).toBe(20);
  });
});

// --- Whole-fixture scoring -------------------------------------------------

describe("scoreFixture", () => {
  const preds: Prediction[] = [
    { userId: "alice", resultPred: "home", homePred: 2, awayPred: 1 }, // perfect
    { userId: "bob", resultPred: "home", homePred: 3, awayPred: 0 }, // result only
    { userId: "carol", resultPred: "away", homePred: 0, awayPred: 5 }, // all wrong
  ];
  const result = { homeScore: 2, awayScore: 1 };

  it("scores every prediction in the fixture", () => {
    expect(scoreFixture(preds, result)).toEqual([
      { userId: "alice", points: 50 },
      { userId: "bob", points: 20 },
      { userId: "carol", points: 15 },
    ]);
  });

  it("returns one row per prediction", () => {
    expect(scoreFixture(preds, result)).toHaveLength(3);
  });

  it("empty fixture (no predictions) scores nothing", () => {
    expect(scoreFixture([], result)).toEqual([]);
  });

  // VOID FIXTURE: never played -> everyone scores 0, NOT the 15 floor.
  it("void fixture (null result) scores every prediction 0", () => {
    expect(scoreFixture(preds, null)).toEqual([
      { userId: "alice", points: 0 },
      { userId: "bob", points: 0 },
      { userId: "carol", points: 0 },
    ]);
  });

  it("void fixture: even a would-be-perfect call scores 0", () => {
    const perfect: Prediction[] = [
      { userId: "alice", resultPred: "home", homePred: 2, awayPred: 1 },
    ];
    expect(scoreFixture(perfect, null)[0].points).toBe(0);
  });
});

// --- Per-user single fixture, incl. missing prediction ---------------------

describe("scoreFixtureForUser", () => {
  const pred: Prediction = {
    userId: "alice",
    resultPred: "home",
    homePred: 2,
    awayPred: 1,
  };
  const result = { homeScore: 2, awayScore: 1 };

  it("scores a submitted prediction normally", () => {
    expect(scoreFixtureForUser(pred, result)).toBe(50);
  });

  // MISSING PREDICTION: fan didn't submit -> 0, NOT 15.
  it("missing prediction (null) scores 0, not the 15 floor", () => {
    expect(scoreFixtureForUser(null, result)).toBe(NO_SCORE);
    expect(scoreFixtureForUser(null, result)).toBe(0);
  });

  it("void fixture scores 0 even with a prediction", () => {
    expect(scoreFixtureForUser(pred, null)).toBe(0);
  });

  it("both missing scores 0", () => {
    expect(scoreFixtureForUser(null, null)).toBe(0);
  });

  it("a submitted-but-all-wrong prediction still earns the 15 floor", () => {
    const wrong: Prediction = {
      userId: "bob",
      resultPred: "away",
      homePred: 0,
      awayPred: 5,
    };
    // distinguishes 15 (submitted, wrong) from 0 (didn't submit)
    expect(scoreFixtureForUser(wrong, result)).toBe(15);
  });
});

// --- Totals across many fixtures ------------------------------------------

describe("userTotal", () => {
  const result = { homeScore: 2, awayScore: 1 };

  it("sums points across fixtures", () => {
    const total = userTotal([
      {
        prediction: {
          userId: "a",
          resultPred: "home",
          homePred: 2,
          awayPred: 1,
        },
        result,
      }, // 50
      {
        prediction: {
          userId: "a",
          resultPred: "home",
          homePred: 3,
          awayPred: 0,
        },
        result,
      }, // 20
    ]);
    expect(total).toBe(70);
  });

  it("skips void fixtures (they add 0)", () => {
    const total = userTotal([
      {
        prediction: {
          userId: "a",
          resultPred: "home",
          homePred: 2,
          awayPred: 1,
        },
        result,
      }, // 50
      {
        prediction: {
          userId: "a",
          resultPred: "home",
          homePred: 2,
          awayPred: 1,
        },
        result: null,
      }, // 0
    ]);
    expect(total).toBe(50);
  });

  it("skips missing predictions (they add 0)", () => {
    const total = userTotal([
      {
        prediction: {
          userId: "a",
          resultPred: "home",
          homePred: 2,
          awayPred: 1,
        },
        result,
      }, // 50
      { prediction: null, result }, // 0, didn't submit
    ]);
    expect(total).toBe(50);
  });

  it("empty history totals 0", () => {
    expect(userTotal([])).toBe(0);
  });

  it("a fan who submitted wrong calls outscores a no-show (15 vs 0)", () => {
    const guesser = userTotal([
      {
        prediction: {
          userId: "a",
          resultPred: "away",
          homePred: 0,
          awayPred: 5,
        },
        result,
      }, // 15
    ]);
    const noShow = userTotal([{ prediction: null, result }]); // 0
    expect(guesser).toBe(15);
    expect(noShow).toBe(0);
    expect(guesser).toBeGreaterThan(noShow);
  });
});

// --- Leaderboard ranking ---------------------------------------------------

describe("rankLeaderboard", () => {
  it("ranks highest points first", () => {
    const board = rankLeaderboard([
      { userId: "a", points: 20 },
      { userId: "b", points: 50 },
      { userId: "c", points: 35 },
    ]);
    expect(board.map((r) => r.userId)).toEqual(["b", "c", "a"]);
    expect(board.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("ties share the lower rank, next rank skips (1,2,2,4)", () => {
    const board = rankLeaderboard([
      { userId: "a", points: 50 },
      { userId: "b", points: 30 },
      { userId: "c", points: 30 },
      { userId: "d", points: 10 },
    ]);
    expect(board.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it("does not mutate the input array", () => {
    const input = [
      { userId: "a", points: 10 },
      { userId: "b", points: 50 },
    ];
    rankLeaderboard(input);
    expect(input.map((r) => r.userId)).toEqual(["a", "b"]);
  });

  it("empty leaderboard returns empty", () => {
    expect(rankLeaderboard([])).toEqual([]);
  });

  it("all tied all rank 1", () => {
    const board = rankLeaderboard([
      { userId: "a", points: 25 },
      { userId: "b", points: 25 },
    ]);
    expect(board.map((r) => r.rank)).toEqual([1, 1]);
  });
});
