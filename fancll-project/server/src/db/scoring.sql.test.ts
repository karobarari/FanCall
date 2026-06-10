import { Pool } from "pg";
import { describe, it, expect, beforeEach, afterAll } from "@jest/globals";

// SQL tests run against fancall_test, NEVER the dev DB — settle_fixture writes
// rows, so we use a throwaway database the tests can truncate freely.
const pool = new Pool({
  host: "localhost",
  user: "karod",
  database: "fancall_test",
  // password comes from PGPASSWORD env var when you run the tests
});

afterAll(async () => {
  await pool.end();
});

// Helper: call the live score_prediction function and return its integer result.
async function score(
  result: string,
  homePred: number,
  awayPred: number,
  actualHome: number,
  actualAway: number,
): Promise<number> {
  const { rows } = await pool.query(
    "SELECT score_prediction($1, $2, $3, $4, $5) AS pts",
    [result, homePred, awayPred, actualHome, actualAway],
  );
  return rows[0].pts;
}

describe("score_prediction (live SQL) — canonical anchors", () => {
  it("perfect call scores 50", async () => {
    expect(await score("home", 2, 1, 2, 1)).toBe(50);
  });
  it("result right, both scores wrong scores 20", async () => {
    expect(await score("home", 2, 1, 3, 0)).toBe(20);
  });
  it("all three calls wrong scores the floor of 15", async () => {
    expect(await score("away", 0, 5, 3, 0)).toBe(15);
  });
  it("perfect draw scores 50", async () => {
    expect(await score("draw", 1, 1, 1, 1)).toBe(50);
  });
});

describe("score_prediction (live SQL) — independent calls", () => {
  it("both scores right but result call wrong misses the bonus (25)", async () => {
    expect(await score("away", 2, 1, 2, 1)).toBe(25);
  });
  it("self-contradictory pick scored as entered (25)", async () => {
    expect(await score("draw", 2, 1, 2, 1)).toBe(25);
  });
  it("correct result via wrong scoreline (20)", async () => {
    expect(await score("home", 1, 0, 4, 2)).toBe(20);
  });
});

describe("score_prediction (live SQL) — parity with TS port", () => {
  // The same cases the TS suite asserts, run against the live function.
  // If these ever diverge, the SQL and the TS port have drifted apart.
  const cases: [string, number, number, number, number, number][] = [
    ["home", 2, 1, 2, 1, 50],
    ["home", 2, 1, 3, 0, 20],
    ["away", 0, 5, 3, 0, 15],
    ["draw", 1, 1, 1, 1, 50],
    ["away", 0, 3, 0, 2, 25],
    ["home", 5, 0, 1, 1, 15],
  ];
  it.each(cases)(
    "score_prediction(%s,%i,%i, %i,%i) = %i",
    async (r, hp, ap, ah, aa, expected) => {
      expect(await score(r, hp, ap, ah, aa)).toBe(expected);
    },
  );
});

describe("settle_fixture (live SQL) — integration", () => {
  // Seed a fixture + predictions, settle, read back the scores table.
  // beforeEach truncates so each test starts clean.

  const FIXTURE = "bbbbbbbb-0000-4000-8000-000000000001";
  const ALICE = "cccccccc-0000-4000-8000-00000000aaaa";
  const BOB = "cccccccc-0000-4000-8000-00000000bbbb";

  beforeEach(async () => {
    // Order matters: scores/predictions reference fixtures + users.
    await pool.query("TRUNCATE scores, predictions, fixtures, users CASCADE");

    await pool.query(
      `INSERT INTO users (id, email, display_name, password_hash)
       VALUES ($1, 'alice@test.dev', 'Alice', 'x'),
              ($2, 'bob@test.dev', 'Bob', 'x')`,
      [ALICE, BOB],
    );

    await pool.query(
      `INSERT INTO fixtures
         (id, season, gameweek, home_team, away_team, kickoff, status)
       VALUES ($1, '2025/26', 1, 'Arsenal', 'Chelsea',
               now() - interval '2 hours', 'upcoming')`,
      [FIXTURE],
    );

   await pool.query(
      `INSERT INTO predictions
         (user_id, fixture_id, home_pred, away_pred, result_pred)
       VALUES ($1, $2, 2, 1, 'home'),
              ($3, $2, 0, 5, 'away')`,
      [ALICE, FIXTURE, BOB],
    );
  });

  it("settles and writes scored rows for every prediction", async () => {
    await pool.query("SELECT settle_fixture($1, $2, $3)", [FIXTURE, 2, 1]);

    const { rows } = await pool.query(
      `SELECT user_id, points FROM scores
        WHERE fixture_id = $1 ORDER BY points DESC`,
      [FIXTURE],
    );

    expect(rows).toEqual([
      { user_id: ALICE, points: 50 }, // perfect
      { user_id: BOB, points: 15 }, // all wrong (floor)
    ]);
  });

  it("marks the fixture finished with the final score", async () => {
    await pool.query("SELECT settle_fixture($1, $2, $3)", [FIXTURE, 2, 1]);

    const { rows } = await pool.query(
      "SELECT home_score, away_score, status FROM fixtures WHERE id = $1",
      [FIXTURE],
    );
    expect(rows[0]).toEqual({
      home_score: 2,
      away_score: 1,
      status: "finished",
    });
  });

  it("re-settling with a corrected score updates points (idempotent)", async () => {
    await pool.query("SELECT settle_fixture($1, $2, $3)", [FIXTURE, 2, 1]);
    // Correct the result to 0-5: now Bob is perfect, Alice all wrong.
    await pool.query("SELECT settle_fixture($1, $2, $3)", [FIXTURE, 0, 5]);

    const { rows } = await pool.query(
      `SELECT user_id, points FROM scores
        WHERE fixture_id = $1 ORDER BY points DESC`,
      [FIXTURE],
    );
    expect(rows).toEqual([
      { user_id: BOB, points: 50 }, // now perfect for 0-5
      { user_id: ALICE, points: 15 }, // now all wrong
    ]);
  });
});