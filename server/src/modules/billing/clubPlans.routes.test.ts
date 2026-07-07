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

describe('club plans routes (live integration)', () => {
  beforeAll(async () => {
    teamId = await getTeamId();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('GET /api/admin/clubs/:teamId/plans', () => {
    it('rejects an unauthenticated request', async () => {
      const res = await request(app).get(`/api/admin/clubs/${teamId}/plans`);
      expect(res.status).toBe(401);
    });

    it('rejects a non-admin', async () => {
      const player = await playerAgent();
      const res = await player.get(`/api/admin/clubs/${teamId}/plans`);
      expect(res.status).toBe(403);
    });

    it('404s for an unknown team', async () => {
      const admin = await adminAgent();
      const res = await admin.get('/api/admin/clubs/00000000-0000-0000-0000-000000000000/plans');
      expect(res.status).toBe(404);
    });

    it('is empty for a club with no configured plans', async () => {
      const admin = await adminAgent();
      const res = await admin.get(`/api/admin/clubs/${teamId}/plans`);
      expect(res.status).toBe(200);
      expect(res.body.plans).toEqual([]);
    });
  });

  describe('PUT /api/admin/clubs/:teamId/plans', () => {
    it('rejects a non-admin', async () => {
      const player = await playerAgent();
      const res = await player
        .put(`/api/admin/clubs/${teamId}/plans`)
        .send({ channel: 'direct', price_pence: 1500, billing_interval: 'one_time' });
      expect(res.status).toBe(403);
    });

    it('creates a plan for a channel', async () => {
      const admin = await adminAgent();
      const res = await admin
        .put(`/api/admin/clubs/${teamId}/plans`)
        .send({ channel: 'direct', price_pence: 1500, billing_interval: 'one_time' });
      expect(res.status).toBe(200);
      expect(res.body.plan).toMatchObject({
        team_id: teamId,
        channel: 'direct',
        price_pence: 1500,
        currency: 'gbp',
        billing_interval: 'one_time',
        active: true,
      });
    });

    it('upserts — putting the same channel again updates it instead of duplicating', async () => {
      const admin = await adminAgent();
      await admin
        .put(`/api/admin/clubs/${teamId}/plans`)
        .send({ channel: 'subscription', price_pence: 150, billing_interval: 'monthly' });
      const res = await admin
        .put(`/api/admin/clubs/${teamId}/plans`)
        .send({ channel: 'subscription', price_pence: 199, billing_interval: 'monthly' });
      expect(res.status).toBe(200);
      expect(res.body.plan.price_pence).toBe(199);

      const list = await admin.get(`/api/admin/clubs/${teamId}/plans`);
      expect(list.body.plans).toHaveLength(1);
    });

    it('supports multiple channels for the same club independently', async () => {
      const admin = await adminAgent();
      await admin
        .put(`/api/admin/clubs/${teamId}/plans`)
        .send({ channel: 'direct', price_pence: 1500, billing_interval: 'one_time' });
      await admin
        .put(`/api/admin/clubs/${teamId}/plans`)
        .send({ channel: 'subscription', price_pence: 150, billing_interval: 'monthly' });

      const list = await admin.get(`/api/admin/clubs/${teamId}/plans`);
      expect(list.body.plans).toHaveLength(2);
      expect(list.body.plans.map((p: { channel: string }) => p.channel).sort()).toEqual([
        'direct',
        'subscription',
      ]);
    });

    it('rejects an invalid channel', async () => {
      const admin = await adminAgent();
      const res = await admin
        .put(`/api/admin/clubs/${teamId}/plans`)
        .send({ channel: 'not_a_channel', price_pence: 1500, billing_interval: 'one_time' });
      expect(res.status).toBe(400);
    });

    it('rejects a negative price', async () => {
      const admin = await adminAgent();
      const res = await admin
        .put(`/api/admin/clubs/${teamId}/plans`)
        .send({ channel: 'direct', price_pence: -100, billing_interval: 'one_time' });
      expect(res.status).toBe(400);
    });

    it('404s for an unknown team', async () => {
      const admin = await adminAgent();
      const res = await admin
        .put('/api/admin/clubs/00000000-0000-0000-0000-000000000000/plans')
        .send({ channel: 'direct', price_pence: 1500, billing_interval: 'one_time' });
      expect(res.status).toBe(404);
    });
  });
});
