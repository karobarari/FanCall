import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { app, pool, resetDb, agent, getTeamId } from '../../testUtils';

let teamId: string;

async function adminAgent() {
  const client = agent();
  await client.post('/api/auth/signup').send({
    email: 'admin@test.dev',
    password: 'correct-horse',
    displayName: 'admin_1',
    teamId,
  });
  return client;
}

async function playerAgent() {
  const client = agent();
  await client.post('/api/auth/signup').send({
    email: 'player@test.dev',
    password: 'correct-horse',
    displayName: 'player_1',
    teamId,
  });
  return client;
}

function futureIso(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

describe('fixtures routes (live integration)', () => {
  beforeAll(async () => {
    teamId = await getTeamId();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('GET /api/fixtures', () => {
    it('rejects an unauthenticated request', async () => {
      const res = await request(app).get('/api/fixtures');
      expect(res.status).toBe(401);
    });

    it('returns an empty list on a clean DB', async () => {
      const admin = await adminAgent();
      const res = await admin.get('/api/fixtures');
      expect(res.status).toBe(200);
      expect(res.body.fixtures).toEqual([]);
    });

    it('filters by season and gameweek', async () => {
      const admin = await adminAgent();
      await admin.post('/api/fixtures').send({
        season: '2025/26',
        gameweek: 1,
        home_team: 'Arsenal',
        away_team: 'Chelsea',
        kickoff: futureIso(24),
      });
      await admin.post('/api/fixtures').send({
        season: '2025/26',
        gameweek: 2,
        home_team: 'Liverpool',
        away_team: 'Everton',
        kickoff: futureIso(48),
      });

      const gw1 = await admin.get('/api/fixtures?gameweek=1');
      expect(gw1.body.fixtures).toHaveLength(1);
      expect(gw1.body.fixtures[0].home_team).toBe('Arsenal');
    });

    it("scopes a non-admin fan to fixtures their own club is playing in", async () => {
      const admin = await adminAgent();
      // Man City (the test team every agent signs up under) vs Chelsea —
      // the fan's own club is playing.
      const mine = await admin.post('/api/fixtures').send({
        season: '2025/26',
        gameweek: 1,
        home_team: 'Manchester City',
        away_team: 'Chelsea',
        kickoff: futureIso(24),
      });
      // Two other clubs neither fan follows.
      await admin.post('/api/fixtures').send({
        season: '2025/26',
        gameweek: 1,
        home_team: 'Liverpool',
        away_team: 'Everton',
        kickoff: futureIso(24),
      });

      const player = await playerAgent();
      const res = await player.get('/api/fixtures');
      expect(res.body.fixtures).toHaveLength(1);
      expect(res.body.fixtures[0].id).toBe(mine.body.fixture.id);

      // Admin still sees every club's fixtures, for management.
      const adminView = await admin.get('/api/fixtures');
      expect(adminView.body.fixtures).toHaveLength(2);
    });
  });

  describe('POST /api/fixtures (create, admin-only)', () => {
    const draft = {
      season: '2025/26',
      gameweek: 1,
      home_team: 'Arsenal',
      away_team: 'Chelsea',
      kickoff: futureIso(24),
    };

    it('rejects an unauthenticated request', async () => {
      const res = await request(app).post('/api/fixtures').send(draft);
      expect(res.status).toBe(401);
    });

    it('rejects a non-admin user', async () => {
      const player = await playerAgent();
      const res = await player.post('/api/fixtures').send(draft);
      expect(res.status).toBe(403);
    });

    it('creates a fixture as admin', async () => {
      const admin = await adminAgent();
      const res = await admin.post('/api/fixtures').send(draft);
      expect(res.status).toBe(201);
      expect(res.body.fixture).toMatchObject({
        season: '2025/26',
        gameweek: 1,
        home_team: 'Arsenal',
        away_team: 'Chelsea',
        status: 'upcoming',
      });
      expect(typeof res.body.fixture.home_team_id).toBe('string');
      expect(typeof res.body.fixture.away_team_id).toBe('string');
    });

    it('rejects an unknown team name', async () => {
      const admin = await adminAgent();
      const res = await admin
        .post('/api/fixtures')
        .send({ ...draft, home_team: 'Not A Real Club' });
      expect(res.status).toBe(400);
    });

    it('rejects identical home and away teams', async () => {
      const admin = await adminAgent();
      const res = await admin
        .post('/api/fixtures')
        .send({ ...draft, away_team: 'Arsenal' });
      expect(res.status).toBe(400);
    });

    it('rejects a duplicate fixture identity with 409', async () => {
      const admin = await adminAgent();
      await admin.post('/api/fixtures').send(draft);
      const res = await admin.post('/api/fixtures').send(draft);
      expect(res.status).toBe(409);
    });
  });

  describe('PATCH /api/fixtures/:id (edit, admin-only)', () => {
    async function createDraftFixture(admin: ReturnType<typeof agent>) {
      const res = await admin.post('/api/fixtures').send({
        season: '2025/26',
        gameweek: 1,
        home_team: 'Arsenal',
        away_team: 'Chelsea',
        kickoff: futureIso(24),
      });
      return res.body.fixture.id as string;
    }

    it('rejects a non-admin user', async () => {
      const admin = await adminAgent();
      const id = await createDraftFixture(admin);
      const player = await playerAgent();
      const res = await player.patch(`/api/fixtures/${id}`).send({ gameweek: 2 });
      expect(res.status).toBe(403);
    });

    it('updates fixture metadata as admin', async () => {
      const admin = await adminAgent();
      const id = await createDraftFixture(admin);
      const res = await admin.patch(`/api/fixtures/${id}`).send({ gameweek: 5 });
      expect(res.status).toBe(200);
      expect(res.body.fixture.gameweek).toBe(5);
    });

    it('defaults to unlocked, and can be locked and unlocked independently of other fields', async () => {
      const admin = await adminAgent();
      const id = await createDraftFixture(admin);

      const created = await admin.get('/api/fixtures');
      const fixture = created.body.fixtures.find((f: { id: string }) => f.id === id);
      expect(fixture.locked).toBe(false);

      const locked = await admin.patch(`/api/fixtures/${id}`).send({ locked: true });
      expect(locked.status).toBe(200);
      expect(locked.body.fixture.locked).toBe(true);

      const unlocked = await admin.patch(`/api/fixtures/${id}`).send({ locked: false });
      expect(unlocked.status).toBe(200);
      expect(unlocked.body.fixture.locked).toBe(false);
    });

    it('refuses to edit a finished fixture', async () => {
      const admin = await adminAgent();
      const id = await createDraftFixture(admin);
      await admin.post(`/api/fixtures/${id}/settle`).send({ home_score: 2, away_score: 1 });

      const res = await admin.patch(`/api/fixtures/${id}`).send({ gameweek: 9 });
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/fixtures/:id/settle (admin-only)', () => {
    it('rejects a non-admin user', async () => {
      const admin = await adminAgent();
      const created = await admin.post('/api/fixtures').send({
        season: '2025/26',
        gameweek: 1,
        home_team: 'Arsenal',
        away_team: 'Chelsea',
        kickoff: futureIso(24),
      });
      const player = await playerAgent();
      const res = await player
        .post(`/api/fixtures/${created.body.fixture.id}/settle`)
        .send({ home_score: 2, away_score: 1 });
      expect(res.status).toBe(403);
    });

    it('404s for an unknown fixture id', async () => {
      const admin = await adminAgent();
      const res = await admin
        .post('/api/fixtures/00000000-0000-0000-0000-000000000000/settle')
        .send({ home_score: 2, away_score: 1 });
      expect(res.status).toBe(404);
    });

    it('settles a fixture, flipping it to finished with the recorded score', async () => {
      const admin = await adminAgent();
      const created = await admin.post('/api/fixtures').send({
        season: '2025/26',
        gameweek: 1,
        home_team: 'Arsenal',
        away_team: 'Chelsea',
        kickoff: futureIso(24),
      });
      const id = created.body.fixture.id;

      const res = await admin.post(`/api/fixtures/${id}/settle`).send({ home_score: 3, away_score: 1 });
      expect(res.status).toBe(200);
      expect(res.body.fixture).toMatchObject({
        status: 'finished',
        home_score: 3,
        away_score: 1,
      });
    });
  });
});
