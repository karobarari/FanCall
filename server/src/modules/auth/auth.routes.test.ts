import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { app, pool, resetDb, agent } from '../../testUtils';
import { PILOT_TEAM_NAME } from '../../config/pilotTeam';
import request from 'supertest';

describe('auth routes (live integration)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('POST /api/auth/signup', () => {
    it('creates an account, auto-assigned to the pilot team', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'correct-horse',
        displayName: 'alice_1',
      });

      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({
        email: 'alice@test.dev',
        display_name: 'alice_1',
        team_name: PILOT_TEAM_NAME,
        paid: false,
        is_admin: false,
      });
      expect(typeof res.body.user.team_id).toBe('string');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('auto-marks the admin account as paid and admin (jest.setup.ts pins ADMIN_EMAIL to admin@test.dev)', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        email: 'admin@test.dev',
        password: 'correct-horse',
        displayName: 'admin_1',
      });
      expect(res.body.user.paid).toBe(true);
      expect(res.body.user.is_admin).toBe(true);
    });

    it('rejects an invalid email', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        email: 'not-an-email',
        password: 'correct-horse',
        displayName: 'alice_1',
      });
      expect(res.status).toBe(400);
    });

    it('rejects a password under 8 characters', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'short',
        displayName: 'alice_1',
      });
      expect(res.status).toBe(400);
    });

    it.each(['ab', 'has spaces', 'way-too-long-a-username-for-this'])(
      'rejects an invalid username %p',
      async (displayName) => {
        const res = await request(app).post('/api/auth/signup').send({
          email: 'alice@test.dev',
          password: 'correct-horse',
          displayName,
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/username/i);
      },
    );

    it('rejects a duplicate email with 409', async () => {
      await request(app).post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'correct-horse',
        displayName: 'alice_1',
      });
      const res = await request(app).post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'another-pass',
        displayName: 'alice_2',
      });
      expect(res.status).toBe(409);
    });

    it('rejects a duplicate username case-insensitively with 409', async () => {
      await request(app).post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'correct-horse',
        displayName: 'alice_1',
      });
      const res = await request(app).post('/api/auth/signup').send({
        email: 'someoneelse@test.dev',
        password: 'another-pass',
        displayName: 'ALICE_1',
      });
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'correct-horse',
        displayName: 'alice_1',
      });
    });

    it('logs in with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'alice@test.dev', password: 'correct-horse' });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('alice@test.dev');
      expect(res.body.user.team_name).toBe(PILOT_TEAM_NAME);
      expect(res.body.user.is_admin).toBe(false);
    });

    it('rejects the wrong password with the same message as an unknown email', async () => {
      const wrongPassword = await request(app)
        .post('/api/auth/login')
        .send({ email: 'alice@test.dev', password: 'not-the-password' });
      const unknownEmail = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@test.dev', password: 'whatever123' });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body.error).toBe(unknownEmail.body.error);
    });
  });

  describe('GET /api/auth/me and logout', () => {
    it('rejects an unauthenticated request', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns the signed-in user, then 401 after logout', async () => {
      const client = agent();
      await client.post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'correct-horse',
        displayName: 'alice_1',
      });

      const me = await client.get('/api/auth/me');
      expect(me.status).toBe(200);
      expect(me.body.user.email).toBe('alice@test.dev');
      expect(me.body.user.is_admin).toBe(false);

      await client.post('/api/auth/logout').send({});
      const afterLogout = await client.get('/api/auth/me');
      expect(afterLogout.status).toBe(401);
    });

    it('reflects is_admin true for the admin account', async () => {
      const client = agent();
      await client.post('/api/auth/signup').send({
        email: 'admin@test.dev',
        password: 'correct-horse',
        displayName: 'admin_1',
      });
      const me = await client.get('/api/auth/me');
      expect(me.body.user.is_admin).toBe(true);
    });
  });

  describe('PATCH /api/auth/me', () => {
    it('rejects an unauthenticated request', async () => {
      const res = await request(app).patch('/api/auth/me').send({ displayName: 'alice_2' });
      expect(res.status).toBe(401);
    });

    it('updates the username', async () => {
      const client = agent();
      await client.post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'correct-horse',
        displayName: 'alice_1',
      });

      const res = await client.patch('/api/auth/me').send({ displayName: 'alice_2' });
      expect(res.status).toBe(200);
      expect(res.body.user.display_name).toBe('alice_2');

      const me = await client.get('/api/auth/me');
      expect(me.body.user.display_name).toBe('alice_2');
    });

    it('rejects an invalid username', async () => {
      const client = agent();
      await client.post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'correct-horse',
        displayName: 'alice_1',
      });

      const res = await client.patch('/api/auth/me').send({ displayName: 'ab' });
      expect(res.status).toBe(400);
    });

    it('rejects a username already taken by another account, case-insensitively', async () => {
      await request(app).post('/api/auth/signup').send({
        email: 'bob@test.dev',
        password: 'correct-horse',
        displayName: 'bob_1',
      });
      const client = agent();
      await client.post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'correct-horse',
        displayName: 'alice_1',
      });

      const res = await client.patch('/api/auth/me').send({ displayName: 'BOB_1' });
      expect(res.status).toBe(409);
    });

    it('sets a preset avatar, then clears it back to null', async () => {
      const client = agent();
      await client.post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'correct-horse',
        displayName: 'alice_1',
      });

      const set = await client.patch('/api/auth/me').send({ avatar: 'sky-ball' });
      expect(set.status).toBe(200);
      expect(set.body.user.avatar).toBe('sky-ball');

      const me = await client.get('/api/auth/me');
      expect(me.body.user.avatar).toBe('sky-ball');

      const cleared = await client.patch('/api/auth/me').send({ avatar: null });
      expect(cleared.status).toBe(200);
      expect(cleared.body.user.avatar).toBeNull();
    });

    it.each(['sky-unknown', 'neon-ball', 'not_a_preset', ''])(
      'rejects an invalid avatar preset %p',
      async (avatar) => {
        const client = agent();
        await client.post('/api/auth/signup').send({
          email: 'alice@test.dev',
          password: 'correct-horse',
          displayName: 'alice_1',
        });
        const res = await client.patch('/api/auth/me').send({ avatar });
        expect(res.status).toBe(400);
      },
    );

    it('rejects an empty body with nothing to update', async () => {
      const client = agent();
      await client.post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'correct-horse',
        displayName: 'alice_1',
      });
      const res = await client.patch('/api/auth/me').send({});
      expect(res.status).toBe(400);
    });

    it('updates username and avatar together in one request', async () => {
      const client = agent();
      await client.post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'correct-horse',
        displayName: 'alice_1',
      });
      const res = await client
        .patch('/api/auth/me')
        .send({ displayName: 'alice_2', avatar: 'gold-crown' });
      expect(res.status).toBe(200);
      expect(res.body.user.display_name).toBe('alice_2');
      expect(res.body.user.avatar).toBe('gold-crown');
    });
  });

  describe('PATCH /api/auth/me/password', () => {
    it('rejects an unauthenticated request', async () => {
      const res = await request(app)
        .patch('/api/auth/me/password')
        .send({ currentPassword: 'correct-horse', newPassword: 'new-password-1' });
      expect(res.status).toBe(401);
    });

    it('changes the password and the old one stops working', async () => {
      const client = agent();
      await client.post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'correct-horse',
        displayName: 'alice_1',
      });

      const res = await client
        .patch('/api/auth/me/password')
        .send({ currentPassword: 'correct-horse', newPassword: 'new-password-1' });
      expect(res.status).toBe(200);

      const oldLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'alice@test.dev', password: 'correct-horse' });
      expect(oldLogin.status).toBe(401);

      const newLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'alice@test.dev', password: 'new-password-1' });
      expect(newLogin.status).toBe(200);
    });

    it('rejects the wrong current password', async () => {
      const client = agent();
      await client.post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'correct-horse',
        displayName: 'alice_1',
      });

      const res = await client
        .patch('/api/auth/me/password')
        .send({ currentPassword: 'wrong-password', newPassword: 'new-password-1' });
      expect(res.status).toBe(401);
    });

    it('rejects a new password under 8 characters', async () => {
      const client = agent();
      await client.post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'correct-horse',
        displayName: 'alice_1',
      });

      const res = await client
        .patch('/api/auth/me/password')
        .send({ currentPassword: 'correct-horse', newPassword: 'short' });
      expect(res.status).toBe(400);
    });
  });
});
