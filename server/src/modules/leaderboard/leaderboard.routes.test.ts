import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { app, pool, resetDb, agent, getTeamId } from '../../testUtils';

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

  beforeAll(async () => {
    teamId = await getTeamId();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await pool.end();
  });

  // Predictions require an active entitlement; grant every test user one
  // directly via SQL rather than round-tripping through the payment
  // endpoint, since these tests are about leaderboard math, not payments.
  async function newUser(email: string, displayName: string) {
    const client = agent();
    await client.post('/api/auth/signup').send({
      email,
      password: 'correct-horse',
      displayName,
      teamId,
    });
    await pool.query('update users set paid = true where email = $1', [email]);
    await pool.query(
      `insert into entitlements (user_id, team_id, channel, source)
       select id, team_id, 'demo', 'demo' from users where email = $1
       on conflict (user_id, team_id) do update set active = true`,
      [email]
    );
    return client;
  }

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/leaderboard');
    expect(res.status).toBe(401);
  });

  it('is empty when no other users exist', async () => {
    const alice = await newUser('alice@test.dev', 'alice_1');
    const res = await alice.get('/api/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.leaderboard).toHaveLength(1);
  });

  it('lists every signed-up user, even with zero predictions', async () => {
    const alice = await newUser('alice@test.dev', 'alice_1');
    const res = await alice.get('/api/leaderboard');
    expect(res.body.leaderboard).toHaveLength(1);
    expect(res.body.leaderboard[0]).toMatchObject({ display_name: 'alice_1', total_points: 0 });
  });

  it('ranks a perfect call above a missed (unpredicted) finished fixture', async () => {
    const admin = await newUser('admin@test.dev', 'admin_1');
    const alice = await newUser('alice@test.dev', 'alice_1');
    const bob = await newUser('bob@test.dev', 'bob_1');

    // Every test user signs up under the same club (getTeamId()'s default),
    // so the fixture has to be THAT club's match for Bob's missed-fixture
    // credit to apply — a fixture for a different club wouldn't count
    // against a fan who was never eligible to predict on it.
    const created = await admin.post('/api/fixtures').send({
      season: '2025/26',
      gameweek: 1,
      home_team: 'Manchester City',
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

    const res = await alice.get('/api/leaderboard');
    const board: LeaderboardEntry[] = res.body.leaderboard;
    const aliceRow = board.find((r) => r.display_name === 'alice_1')!;
    const bobRow = board.find((r) => r.display_name === 'bob_1')!;

    expect(aliceRow.total_points).toBe(50); // perfect call: 10+10+10+20 bonus
    expect(bobRow.total_points).toBe(12); // missed-fixture credit: 4 pts x 3 calls
    expect(aliceRow.rank).toBeLessThan(bobRow.rank);
  });

  it('scope=league pools every club together, unlike the default club scope', async () => {
    const admin = await newUser('admin@test.dev', 'admin_1');
    const mcFan = await newUser('mcfan@test.dev', 'mcfan_1');

    const arsenalId = await getTeamId('Arsenal');
    const arsenalFanClient = agent();
    await arsenalFanClient.post('/api/auth/signup').send({
      email: 'arsenalfan@test.dev',
      password: 'correct-horse',
      displayName: 'arsenalfan_1',
      teamId: arsenalId,
    });

    const club = await mcFan.get('/api/leaderboard?scope=club');
    expect(club.body.leaderboard.map((r: LeaderboardEntry) => r.display_name).sort()).toEqual([
      'admin_1',
      'mcfan_1',
    ]);

    const league = await mcFan.get('/api/leaderboard?scope=league');
    expect(league.body.leaderboard.map((r: LeaderboardEntry) => r.display_name).sort()).toEqual([
      'admin_1',
      'arsenalfan_1',
      'mcfan_1',
    ]);
  });

  it('rejects an invalid scope', async () => {
    const alice = await newUser('alice@test.dev', 'alice_1');
    const res = await alice.get('/api/leaderboard?scope=nonsense');
    expect(res.status).toBe(400);
  });
});
