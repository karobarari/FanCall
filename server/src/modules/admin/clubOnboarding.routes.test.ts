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

describe('club onboarding routes (live integration)', () => {
  beforeAll(async () => {
    teamId = await getTeamId();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('GET /api/admin/clubs/:teamId/connect-link', () => {
    it('rejects an unauthenticated request', async () => {
      const res = await request(app).get(`/api/admin/clubs/${teamId}/connect-link`);
      expect(res.status).toBe(401);
    });

    it('rejects a non-admin', async () => {
      const player = await playerAgent();
      const res = await player.get(`/api/admin/clubs/${teamId}/connect-link`);
      expect(res.status).toBe(403);
    });

    it('404s for an unknown team', async () => {
      const admin = await adminAgent();
      const res = await admin.get('/api/admin/clubs/00000000-0000-0000-0000-000000000000/connect-link');
      expect(res.status).toBe(404);
    });

    it('returns a Stripe Connect authorize URL carrying the team id as state', async () => {
      const admin = await adminAgent();
      const res = await admin.get(`/api/admin/clubs/${teamId}/connect-link`);
      expect(res.status).toBe(200);
      expect(typeof res.body.url).toBe('string');
      const url = new URL(res.body.url);
      expect(url.hostname).toBe('connect.stripe.com');
      expect(url.searchParams.get('state')).toBe(teamId);
    });
  });

  describe('GET /api/admin/clubs/connect/callback', () => {
    it('rejects a request with no code or state', async () => {
      const res = await request(app).get('/api/admin/clubs/connect/callback');
      expect(res.status).toBe(400);
    });

    it('rejects a non-uuid state', async () => {
      const res = await request(app)
        .get('/api/admin/clubs/connect/callback')
        .query({ code: 'ac_test_code', state: 'not-a-uuid' });
      expect(res.status).toBe(400);
    });

    it('404s for an unknown team in state', async () => {
      const res = await request(app)
        .get('/api/admin/clubs/connect/callback')
        .query({ code: 'ac_test_code', state: '00000000-0000-0000-0000-000000000000' });
      expect(res.status).toBe(404);
    });

    // The actual token exchange (exchangeConnectCode) is a real network call
    // to Stripe and can't be verified without a live account — covered up to
    // that boundary above; the exchange itself is out of scope here.
  });
});
