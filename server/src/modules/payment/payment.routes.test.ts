import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { app, pool, resetDb, agent } from '../../testUtils';

describe('POST /api/payment/pay (live integration)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/payment/pay').send({});
    expect(res.status).toBe(401);
  });

  it('marks the signed-in user paid', async () => {
    const client = agent();
    const signup = await client.post('/api/auth/signup').send({
      email: 'alice@test.dev',
      password: 'correct-horse',
      displayName: 'alice_1',
    });
    expect(signup.body.user.paid).toBe(false);

    const res = await client.post('/api/payment/pay').send({});
    expect(res.status).toBe(200);
    expect(res.body.user.paid).toBe(true);

    const me = await client.get('/api/auth/me');
    expect(me.body.user.paid).toBe(true);
  });

  it('is idempotent — paying twice stays paid', async () => {
    const client = agent();
    await client.post('/api/auth/signup').send({
      email: 'alice@test.dev',
      password: 'correct-horse',
      displayName: 'alice_1',
    });

    await client.post('/api/payment/pay').send({});
    const second = await client.post('/api/payment/pay').send({});
    expect(second.status).toBe(200);
    expect(second.body.user.paid).toBe(true);
  });
});
