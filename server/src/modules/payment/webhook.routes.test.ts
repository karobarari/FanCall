import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import Stripe from 'stripe';
import { app, pool, resetDb, agent, getTeamId } from '../../testUtils';

// jest.setup.ts sets a fake (but real-shaped) STRIPE_WEBHOOK_SECRET. Signing
// with it here and verifying via the actual route exercises real, local
// HMAC signature verification — Stripe.webhooks.generateTestHeaderString()
// and the route's stripe.webhooks.constructEvent() never touch the network,
// so this is a genuine end-to-end test of the webhook handler, not a mock.
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

function sign(payload: string): string {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
}

function fakeEvent(type: string, data: object): string {
  return JSON.stringify({
    id: 'evt_test_1',
    object: 'event',
    type,
    data: { object: data },
  });
}

describe('POST /api/payment/webhook (live integration)', () => {
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

  async function newUser(email: string, displayName: string) {
    const client = agent();
    const res = await client.post('/api/auth/signup').send({ email, password: 'correct-horse', displayName, teamId });
    return { client, userId: res.body.user.id as string };
  }

  it('rejects a request with no stripe-signature header', async () => {
    const res = await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .send(fakeEvent('checkout.session.completed', {}));
    expect(res.status).toBe(400);
  });

  it('rejects a tampered/invalid signature', async () => {
    const payload = fakeEvent('checkout.session.completed', {});
    const res = await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', sign(payload) + 'tampered')
      .send(payload);
    expect(res.status).toBe(400);
  });

  it('checkout.session.completed (direct channel) grants an entitlement and records a payment', async () => {
    const { client, userId } = await newUser('alice@test.dev', 'alice_1');

    const before = await client.get('/api/predictions');
    expect(before.status).toBe(402);

    const payload = fakeEvent('checkout.session.completed', {
      id: 'cs_test_1',
      client_reference_id: `${userId}:${teamId}:direct`,
      payment_intent: 'pi_test_1',
      amount_total: 1500,
      customer: 'cus_test_1',
      subscription: null,
    });
    const res = await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', sign(payload))
      .send(payload);
    expect(res.status).toBe(200);

    const after = await client.get('/api/predictions');
    expect(after.status).toBe(200);

    const { rows } = await pool.query('select * from payments where user_id = $1', [userId]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ channel: 'direct', amount_pence: 1500, status: 'paid' });
  });

  it('checkout.session.completed (subscription channel) creates a subscription and grants an entitlement', async () => {
    const { client, userId } = await newUser('alice@test.dev', 'alice_1');

    const payload = fakeEvent('checkout.session.completed', {
      id: 'cs_test_2',
      client_reference_id: `${userId}:${teamId}:subscription`,
      payment_intent: null,
      amount_total: 150,
      customer: 'cus_test_2',
      subscription: 'sub_test_1',
    });
    const res = await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', sign(payload))
      .send(payload);
    expect(res.status).toBe(200);

    const after = await client.get('/api/predictions');
    expect(after.status).toBe(200);

    const { rows } = await pool.query('select * from subscriptions where user_id = $1', [userId]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ stripe_subscription_id: 'sub_test_1', status: 'active' });
  });

  it('invoice.paid refreshes the subscription period and keeps the entitlement active', async () => {
    const { client, userId } = await newUser('alice@test.dev', 'alice_1');

    const created = fakeEvent('checkout.session.completed', {
      id: 'cs_test_4',
      client_reference_id: `${userId}:${teamId}:subscription`,
      payment_intent: null,
      amount_total: 150,
      customer: 'cus_test_4',
      subscription: 'sub_test_3',
    });
    await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', sign(created))
      .send(created);

    const periodEndUnix = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const invoicePaid = fakeEvent('invoice.paid', {
      id: 'in_test_1',
      parent: { subscription_details: { subscription: 'sub_test_3' } },
      lines: { data: [{ period: { start: Math.floor(Date.now() / 1000), end: periodEndUnix } }] },
    });
    const res = await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', sign(invoicePaid))
      .send(invoicePaid);
    expect(res.status).toBe(200);

    expect((await client.get('/api/predictions')).status).toBe(200);

    const { rows } = await pool.query(
      'select current_period_end from subscriptions where stripe_subscription_id = $1',
      ['sub_test_3']
    );
    expect(new Date(rows[0].current_period_end).getTime()).toBe(periodEndUnix * 1000);
  });

  it('customer.subscription.deleted revokes the entitlement', async () => {
    const { client, userId } = await newUser('alice@test.dev', 'alice_1');

    // Create the subscription first, same as the checkout.session.completed test above.
    const created = fakeEvent('checkout.session.completed', {
      id: 'cs_test_3',
      client_reference_id: `${userId}:${teamId}:subscription`,
      payment_intent: null,
      amount_total: 150,
      customer: 'cus_test_3',
      subscription: 'sub_test_2',
    });
    await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', sign(created))
      .send(created);

    expect((await client.get('/api/predictions')).status).toBe(200);

    const deleted = fakeEvent('customer.subscription.deleted', {
      id: 'sub_test_2',
      status: 'canceled',
    });
    const res = await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', sign(deleted))
      .send(deleted);
    expect(res.status).toBe(200);

    expect((await client.get('/api/predictions')).status).toBe(402);
  });

  it('accepts (and no-ops) an event type it does not act on', async () => {
    const payload = fakeEvent('payment_intent.created', { id: 'pi_test_irrelevant' });
    const res = await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', sign(payload))
      .send(payload);
    expect(res.status).toBe(200);
  });
});
