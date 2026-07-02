import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { app, pool, resetDb, getAnyTeamId, agent } from '../../testUtils';

function futureIso(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  total_points: number;
  rank: number;
}

describe('GET /api/leaderboard (live integration)', () => {
  let teamId: string;

  beforeEach(async () => {
    await resetDb();
    teamId = await getAnyTeamId();
  });

  afterAll(async () => {
    await pool.end();
  });

  async function newUser(email: string, displayName: string) {
    const client = agent();
    await client.post('/api/auth/signup').send({
      email,
      password: 'correct-horse',
      displayName,
      team_id: teamId,
    });
    return client;
  }

  it('is public and empty when no users exist', async () => {
    const res = await request(app).get('/api/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.leaderboard).toEqual([]);
  });

  it('lists every signed-up user, even with zero predictions', async () => {
    await newUser('alice@test.dev', 'alice_1');
    const res = await request(app).get('/api/leaderboard');
    expect(res.body.leaderboard).toHaveLength(1);
    expect(res.body.leaderboard[0]).toMatchObject({ display_name: 'alice_1', total_points: 0 });
  });

  it('ranks a perfect call above a missed (unpredicted) finished fixture', async () => {
    const admin = await newUser('admin@test.dev', 'admin_1');
    const alice = await newUser('alice@test.dev', 'alice_1');
    const bob = await newUser('bob@test.dev', 'bob_1');
    void bob; // signs up so the leaderboard has a fan who never predicts

    const created = await admin.post('/api/fixtures').send({
      season: '2025/26',
      gameweek: 1,
      home_team: 'Arsenal',
      away_team: 'Chelsea',
      kickoff: futureIso(24),
    });
    const fixtureId = created.body.fixture.id;

    // Alice predicts the exact result; Bob never submits.
    await alice.post('/api/predictions').send({
      fixture_id: fixtureId,
      home_pred: 2,
      away_pred: 1,
      result_pred: 'home',
    });

    await admin.post(`/api/fixtures/${fixtureId}/settle`).send({ home_score: 2, away_score: 1 });

    const res = await request(app).get('/api/leaderboard');
    const board: LeaderboardEntry[] = res.body.leaderboard;
    const aliceRow = board.find((r) => r.display_name === 'alice_1')!;
    const bobRow = board.find((r) => r.display_name === 'bob_1')!;

    expect(aliceRow.total_points).toBe(50); // perfect call: 10+10+10+20 bonus
    expect(bobRow.total_points).toBe(12); // missed-fixture credit: 4 pts x 3 calls
    expect(aliceRow.rank).toBeLessThan(bobRow.rank);
  });
});
