import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { app, pool, resetDb, getAnyTeamId, agent } from '../../testUtils';

function futureIso(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

async function createFixture(
  admin: ReturnType<typeof agent>,
  overrides: Partial<{ kickoff: string; home_team: string; away_team: string; gameweek: number }> = {},
) {
  const res = await admin.post('/api/fixtures').send({
    season: '2025/26',
    gameweek: overrides.gameweek ?? 1,
    home_team: overrides.home_team ?? 'Arsenal',
    away_team: overrides.away_team ?? 'Chelsea',
    kickoff: overrides.kickoff ?? futureIso(24),
  });
  return res.body.fixture.id as string;
}

describe('predictions routes (live integration)', () => {
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

  describe('GET /api/predictions', () => {
    it('rejects an unauthenticated request', async () => {
      const res = await request(app).get('/api/predictions');
      expect(res.status).toBe(401);
    });

    it('only returns the signed-in user\'s own predictions', async () => {
      const admin = await newUser('admin@test.dev', 'admin_1');
      const fixtureId = await createFixture(admin);

      const alice = await newUser('alice@test.dev', 'alice_1');
      const bob = await newUser('bob@test.dev', 'bob_1');

      await alice.post('/api/predictions').send({
        fixture_id: fixtureId,
        home_pred: 2,
        away_pred: 1,
        result_pred: 'home',
      });

      const aliceView = await alice.get('/api/predictions');
      const bobView = await bob.get('/api/predictions');
      expect(aliceView.body.predictions).toHaveLength(1);
      expect(bobView.body.predictions).toHaveLength(0);
    });
  });

  describe('POST /api/predictions', () => {
    it('rejects an unauthenticated request', async () => {
      const res = await request(app).post('/api/predictions').send({
        fixture_id: '00000000-0000-0000-0000-000000000000',
        home_pred: 1,
        away_pred: 1,
        result_pred: 'draw',
      });
      expect(res.status).toBe(401);
    });

    it('rejects an invalid body', async () => {
      const alice = await newUser('alice@test.dev', 'alice_1');
      const cases = [
        { fixture_id: 'not-a-uuid', home_pred: 1, away_pred: 1, result_pred: 'draw' },
        { fixture_id: '00000000-0000-0000-0000-000000000000', home_pred: -1, away_pred: 1, result_pred: 'draw' },
        {
          fixture_id: '00000000-0000-0000-0000-000000000000',
          home_pred: 1,
          away_pred: 1,
          result_pred: 'sideways',
        },
      ];
      for (const body of cases) {
        const res = await alice.post('/api/predictions').send(body);
        expect(res.status).toBe(400);
      }
    });

    it('404s for an unknown fixture', async () => {
      const alice = await newUser('alice@test.dev', 'alice_1');
      const res = await alice.post('/api/predictions').send({
        fixture_id: '00000000-0000-0000-0000-000000000000',
        home_pred: 1,
        away_pred: 1,
        result_pred: 'draw',
      });
      expect(res.status).toBe(404);
    });

    it('accepts a prediction on an upcoming fixture', async () => {
      const admin = await newUser('admin@test.dev', 'admin_1');
      const fixtureId = await createFixture(admin);
      const alice = await newUser('alice@test.dev', 'alice_1');

      const res = await alice.post('/api/predictions').send({
        fixture_id: fixtureId,
        home_pred: 2,
        away_pred: 1,
        result_pred: 'home',
      });
      expect(res.status).toBe(200);
      expect(res.body.prediction).toMatchObject({
        fixture_id: fixtureId,
        home_pred: 2,
        away_pred: 1,
        result_pred: 'home',
      });
    });

    it('rejects a prediction once the fixture has locked (kickoff passed)', async () => {
      // Directly seed a fixture with a past kickoff — the create-fixture zod
      // schema doesn't forbid it, and predictions.service checks kickoff at
      // submit time regardless of how the fixture got there.
      const { rows } = await pool.query<{ id: string }>(
        `insert into fixtures (season, gameweek, home_team, away_team, kickoff, status)
         values ('2025/26', 1, 'Arsenal', 'Chelsea', now() - interval '1 hour', 'upcoming')
         returning id`,
      );
      const alice = await newUser('alice@test.dev', 'alice_1');
      const res = await alice.post('/api/predictions').send({
        fixture_id: rows[0].id,
        home_pred: 2,
        away_pred: 1,
        result_pred: 'home',
      });
      expect(res.status).toBe(409);
    });

    it('upserts — submitting twice updates the same row rather than duplicating', async () => {
      const admin = await newUser('admin@test.dev', 'admin_1');
      const fixtureId = await createFixture(admin);
      const alice = await newUser('alice@test.dev', 'alice_1');

      await alice.post('/api/predictions').send({
        fixture_id: fixtureId,
        home_pred: 1,
        away_pred: 1,
        result_pred: 'draw',
      });
      await alice.post('/api/predictions').send({
        fixture_id: fixtureId,
        home_pred: 3,
        away_pred: 0,
        result_pred: 'home',
      });

      const list = await alice.get('/api/predictions');
      expect(list.body.predictions).toHaveLength(1);
      expect(list.body.predictions[0]).toMatchObject({ home_pred: 3, away_pred: 0, result_pred: 'home' });
    });
  });
});
