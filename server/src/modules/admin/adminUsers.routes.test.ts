import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { app, pool, resetDb, agent } from '../../testUtils';

async function adminAgent() {
  const client = agent();
  await client.post('/api/auth/signup').send({
    email: 'admin@test.dev',
    password: 'correct-horse',
    displayName: 'admin_1',
  });
  return client;
}

async function playerAgent(email = 'player@test.dev', displayName = 'player_1') {
  const client = agent();
  await client.post('/api/auth/signup').send({
    email,
    password: 'correct-horse',
    displayName,
  });
  return client;
}

describe('admin users routes (live integration)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('GET /api/admin/users', () => {
    it('rejects an unauthenticated request', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(401);
    });

    it('rejects a non-admin', async () => {
      const player = await playerAgent();
      const res = await player.get('/api/admin/users');
      expect(res.status).toBe(403);
    });

    it('lists every account with team, paid and active status', async () => {
      const admin = await adminAgent();
      await playerAgent();

      const res = await admin.get('/api/admin/users');
      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(2);
      const player = res.body.users.find((u: { email: string }) => u.email === 'player@test.dev');
      expect(player).toMatchObject({
        display_name: 'player_1',
        team_name: 'Manchester City',
        paid: false,
        is_active: true,
      });
      expect(typeof player.created_at).toBe('string');
    });
  });

  describe('PATCH /api/admin/users/:id', () => {
    it('rejects a non-admin', async () => {
      const player = await playerAgent();
      const me = await player.get('/api/auth/me');
      const res = await player
        .patch(`/api/admin/users/${me.body.user.id}`)
        .send({ displayName: 'renamed' });
      expect(res.status).toBe(403);
    });

    it("edits another user's username", async () => {
      const admin = await adminAgent();
      const player = await playerAgent();
      const me = await player.get('/api/auth/me');

      const res = await admin
        .patch(`/api/admin/users/${me.body.user.id}`)
        .send({ displayName: 'player_renamed' });
      expect(res.status).toBe(200);
      expect(res.body.user.display_name).toBe('player_renamed');

      const check = await player.get('/api/auth/me');
      expect(check.body.user.display_name).toBe('player_renamed');
    });

    it('rejects a duplicate username, case-insensitively', async () => {
      const admin = await adminAgent();
      await playerAgent('bob@test.dev', 'bob_1');
      const alice = await playerAgent('alice@test.dev', 'alice_1');
      const me = await alice.get('/api/auth/me');

      const res = await admin
        .patch(`/api/admin/users/${me.body.user.id}`)
        .send({ displayName: 'BOB_1' });
      expect(res.status).toBe(409);
    });

    it('404s on an unknown user id', async () => {
      const admin = await adminAgent();
      const res = await admin
        .patch('/api/admin/users/00000000-0000-0000-0000-000000000000')
        .send({ displayName: 'ghost_1' });
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/admin/users/:id/status', () => {
    it('rejects a non-admin', async () => {
      const player = await playerAgent();
      const me = await player.get('/api/auth/me');
      const res = await player
        .patch(`/api/admin/users/${me.body.user.id}/status`)
        .send({ is_active: false });
      expect(res.status).toBe(403);
    });

    it('deactivates a user: blocked from login, dropped from the leaderboard, then reversible', async () => {
      const admin = await adminAgent();
      const player = await playerAgent();
      const me = await player.get('/api/auth/me');
      const userId = me.body.user.id;

      // Present on the leaderboard while active.
      const beforeLb = await request(app).get('/api/leaderboard');
      expect(beforeLb.body.leaderboard.some((r: { user_id: string }) => r.user_id === userId)).toBe(
        true
      );

      const deactivate = await admin
        .patch(`/api/admin/users/${userId}/status`)
        .send({ is_active: false });
      expect(deactivate.status).toBe(200);
      expect(deactivate.body.user.is_active).toBe(false);

      // Dropped from the leaderboard.
      const afterLb = await request(app).get('/api/leaderboard');
      expect(afterLb.body.leaderboard.some((r: { user_id: string }) => r.user_id === userId)).toBe(
        false
      );

      // Can't log in anymore.
      const loginAttempt = await request(app)
        .post('/api/auth/login')
        .send({ email: 'player@test.dev', password: 'correct-horse' });
      expect(loginAttempt.status).toBe(403);

      // Reactivate reverses both.
      const reactivate = await admin
        .patch(`/api/admin/users/${userId}/status`)
        .send({ is_active: true });
      expect(reactivate.status).toBe(200);
      expect(reactivate.body.user.is_active).toBe(true);

      const loginAgain = await request(app)
        .post('/api/auth/login')
        .send({ email: 'player@test.dev', password: 'correct-horse' });
      expect(loginAgain.status).toBe(200);

      const restoredLb = await request(app).get('/api/leaderboard');
      expect(
        restoredLb.body.leaderboard.some((r: { user_id: string }) => r.user_id === userId)
      ).toBe(true);
    });

    it("blocks an already-signed-in deactivated user from making predictions", async () => {
      const admin = await adminAgent();
      const player = await playerAgent();
      const me = await player.get('/api/auth/me');

      await admin.patch(`/api/admin/users/${me.body.user.id}/status`).send({ is_active: false });

      const res = await player.get('/api/predictions');
      expect(res.status).toBe(403);
    });

    it("rejects an admin trying to deactivate their own account", async () => {
      const admin = await adminAgent();
      const me = await admin.get('/api/auth/me');
      const res = await admin
        .patch(`/api/admin/users/${me.body.user.id}/status`)
        .send({ is_active: false });
      expect(res.status).toBe(400);
    });

    it('rejects a malformed status body', async () => {
      const admin = await adminAgent();
      const player = await playerAgent();
      const me = await player.get('/api/auth/me');
      const res = await admin
        .patch(`/api/admin/users/${me.body.user.id}/status`)
        .send({ is_active: 'nope' });
      expect(res.status).toBe(400);
    });
  });
});
