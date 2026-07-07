import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { app, pool, resetDb, agent, getTeamId } from '../../testUtils';

describe('POST /api/payment/pay (live integration)', () => {
  let teamId: string;

  beforeAll(async () => {
    teamId = await getTeamId();
  });

  beforeEach(async () => {
    await resetDb();
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
      teamId,
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
      teamId,
    });

    await client.post('/api/payment/pay').send({});
    const second = await client.post('/api/payment/pay').send({});
    expect(second.status).toBe(200);
    expect(second.body.user.paid).toBe(true);
  });

  it('grants a real entitlement, not just the users.paid flag — predictions unlock', async () => {
    const client = agent();
    await client.post('/api/auth/signup').send({
      email: 'alice@test.dev',
      password: 'correct-horse',
      displayName: 'alice_1',
      teamId,
    });

    const before = await client.get('/api/predictions');
    expect(before.status).toBe(402);

    await client.post('/api/payment/pay').send({});

    const after = await client.get('/api/predictions');
    expect(after.status).toBe(200);
  });
});

describe('GET /api/payment/plans (live integration)', () => {
  let teamId: string;

  beforeAll(async () => {
    teamId = await getTeamId();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/payment/plans');
    expect(res.status).toBe(401);
  });

  it("is empty when the fan's club has no configured plans", async () => {
    const client = agent();
    await client.post('/api/auth/signup').send({
      email: 'alice@test.dev',
      password: 'correct-horse',
      displayName: 'alice_1',
      teamId,
    });
    const res = await client.get('/api/payment/plans');
    expect(res.status).toBe(200);
    expect(res.body.plans).toEqual([]);
  });

  it("lists only the fan's own club's direct/subscription plans, not the season-ticket channel", async () => {
    await pool.query(
      `insert into club_plans (team_id, channel, price_pence, billing_interval) values
         ($1, 'direct', 1500, 'one_time'),
         ($1, 'subscription', 150, 'monthly'),
         ($1, 'season_ticket_addon', 1000, 'one_time')`,
      [teamId]
    );
    const client = agent();
    await client.post('/api/auth/signup').send({
      email: 'alice@test.dev',
      password: 'correct-horse',
      displayName: 'alice_1',
      teamId,
    });
    const res = await client.get('/api/payment/plans');
    expect(res.status).toBe(200);
    expect(res.body.plans.map((p: { channel: string }) => p.channel).sort()).toEqual([
      'direct',
      'subscription',
    ]);
  });
});

describe('POST /api/payment/checkout (live integration)', () => {
  let teamId: string;

  beforeAll(async () => {
    teamId = await getTeamId();
  });

  beforeEach(async () => {
    await resetDb();
  });

  // teams is seed data resetDb() deliberately never truncates (see its
  // comment in testUtils.ts) — but the "club is connected" test below has
  // to mutate teams.stripe_account_id to exercise that path, so undo it
  // here or the mutation leaks into every future run of this suite.
  afterEach(async () => {
    await pool.query(`update teams set stripe_account_id = null where id = $1`, [teamId]);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/payment/checkout').send({ channel: 'direct' });
    expect(res.status).toBe(401);
  });

  it('rejects an invalid channel', async () => {
    const client = agent();
    await client.post('/api/auth/signup').send({
      email: 'alice@test.dev',
      password: 'correct-horse',
      displayName: 'alice_1',
      teamId,
    });
    const res = await client.post('/api/payment/checkout').send({ channel: 'season_ticket_addon' });
    expect(res.status).toBe(400);
  });

  it("409s when the fan's club hasn't connected Stripe yet", async () => {
    const client = agent();
    await client.post('/api/auth/signup').send({
      email: 'alice@test.dev',
      password: 'correct-horse',
      displayName: 'alice_1',
      teamId,
    });
    const res = await client.post('/api/payment/checkout').send({ channel: 'direct' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/connected their Stripe/i);
  });

  it("409s when the club is connected but hasn't configured that channel", async () => {
    await pool.query(`update teams set stripe_account_id = 'acct_fake_test' where id = $1`, [teamId]);

    const client = agent();
    await client.post('/api/auth/signup').send({
      email: 'alice@test.dev',
      password: 'correct-horse',
      displayName: 'alice_1',
      teamId,
    });
    const res = await client.post('/api/payment/checkout').send({ channel: 'direct' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/not configured/i);
  });
});

describe('POST /api/payment/redeem (live integration)', () => {
  let teamId: string;
  let otherTeamId: string;

  beforeAll(async () => {
    teamId = await getTeamId();
    otherTeamId = await getTeamId('Arsenal');
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await pool.end();
  });

  async function newUser(email: string, displayName: string) {
    const client = agent();
    await client.post('/api/auth/signup').send({ email, password: 'correct-horse', displayName, teamId });
    return client;
  }

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/payment/redeem').send({ code: 'ABC123' });
    expect(res.status).toBe(401);
  });

  it('404s for an unknown code', async () => {
    const alice = await newUser('alice@test.dev', 'alice_1');
    const res = await alice.post('/api/payment/redeem').send({ code: 'NOT-A-REAL-CODE' });
    expect(res.status).toBe(404);
  });

  it('redeems a valid code and unlocks predictions', async () => {
    await pool.query(`insert into redemption_codes (code, team_id) values ('WELCOME2026', $1)`, [teamId]);

    const alice = await newUser('alice@test.dev', 'alice_1');
    const before = await alice.get('/api/predictions');
    expect(before.status).toBe(402);

    const res = await alice.post('/api/payment/redeem').send({ code: 'WELCOME2026' });
    expect(res.status).toBe(200);

    const after = await alice.get('/api/predictions');
    expect(after.status).toBe(200);

    const me = await alice.get('/api/auth/me');
    expect(me.body.user.paid).toBe(true);
  });

  it('rejects a code already redeemed by someone else', async () => {
    await pool.query(`insert into redemption_codes (code, team_id) values ('ONE-USE-ONLY', $1)`, [teamId]);
    const alice = await newUser('alice@test.dev', 'alice_1');
    await alice.post('/api/payment/redeem').send({ code: 'ONE-USE-ONLY' });

    const bob = await newUser('bob@test.dev', 'bob_1');
    const res = await bob.post('/api/payment/redeem').send({ code: 'ONE-USE-ONLY' });
    expect(res.status).toBe(409);
  });

  it("rejects a code for a different club", async () => {
    await pool.query(`insert into redemption_codes (code, team_id) values ('ARSENAL-ONLY', $1)`, [
      otherTeamId,
    ]);
    const alice = await newUser('alice@test.dev', 'alice_1'); // signed up under teamId (Man City)
    const res = await alice.post('/api/payment/redeem').send({ code: 'ARSENAL-ONLY' });
    expect(res.status).toBe(400);
  });

  it('rejects an expired code', async () => {
    await pool.query(
      `insert into redemption_codes (code, team_id, expires_at) values ('EXPIRED-CODE', $1, now() - interval '1 day')`,
      [teamId]
    );
    const alice = await newUser('alice@test.dev', 'alice_1');
    const res = await alice.post('/api/payment/redeem').send({ code: 'EXPIRED-CODE' });
    expect(res.status).toBe(410);
  });
});
