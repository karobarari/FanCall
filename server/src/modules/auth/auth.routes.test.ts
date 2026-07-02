import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { app, pool, resetDb, getAnyTeamId, agent } from '../../testUtils';
import request from 'supertest';

describe('auth routes (live integration)', () => {
  let teamId: string;

  beforeEach(async () => {
    await resetDb();
    teamId = await getAnyTeamId();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('POST /api/auth/signup', () => {
    it('creates an account and returns the user with their team', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'correct-horse',
        displayName: 'alice_1',
        team_id: teamId,
      });

      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({
        email: 'alice@test.dev',
        display_name: 'alice_1',
        team_id: teamId,
      });
      expect(typeof res.body.user.team_name).toBe('string');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('rejects an invalid email', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        email: 'not-an-email',
        password: 'correct-horse',
        displayName: 'alice_1',
        team_id: teamId,
      });
      expect(res.status).toBe(400);
    });

    it('rejects a password under 8 characters', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'short',
        displayName: 'alice_1',
        team_id: teamId,
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
          team_id: teamId,
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/username/i);
      },
    );

    it('rejects a missing team_id', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'correct-horse',
        displayName: 'alice_1',
      });
      expect(res.status).toBe(400);
    });

    it('rejects an unknown team_id', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'correct-horse',
        displayName: 'alice_1',
        team_id: '00000000-0000-0000-0000-000000000000',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/team/i);
    });

    it('rejects a duplicate email with 409', async () => {
      await request(app).post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'correct-horse',
        displayName: 'alice_1',
        team_id: teamId,
      });
      const res = await request(app).post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'another-pass',
        displayName: 'alice_2',
        team_id: teamId,
      });
      expect(res.status).toBe(409);
    });

    it('rejects a duplicate username case-insensitively with 409', async () => {
      await request(app).post('/api/auth/signup').send({
        email: 'alice@test.dev',
        password: 'correct-horse',
        displayName: 'alice_1',
        team_id: teamId,
      });
      const res = await request(app).post('/api/auth/signup').send({
        email: 'someoneelse@test.dev',
        password: 'another-pass',
        displayName: 'ALICE_1',
        team_id: teamId,
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
        team_id: teamId,
      });
    });

    it('logs in with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'alice@test.dev', password: 'correct-horse' });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('alice@test.dev');
      expect(res.body.user.team_name).toBeTruthy();
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
        team_id: teamId,
      });

      const me = await client.get('/api/auth/me');
      expect(me.status).toBe(200);
      expect(me.body.user.email).toBe('alice@test.dev');

      await client.post('/api/auth/logout').send({});
      const afterLogout = await client.get('/api/auth/me');
      expect(afterLogout.status).toBe(401);
    });
  });
});
