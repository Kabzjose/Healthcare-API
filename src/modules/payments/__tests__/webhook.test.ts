/**
 * Stripe webhook security tests.
 *
 * The webhook endpoint is security-critical: it must reject any request that
 * doesn't have a valid Stripe-Signature header. These tests prove that the
 * signature verification guard works correctly without requiring a live Stripe
 * connection.
 *
 * Note: The route uses express.raw() so the body must be sent as a raw string,
 * not parsed JSON. supertest handles this correctly when Content-Type is set.
 */
import request from 'supertest';
import app from '../../../app';
import { clearTestData } from '../../../__tests__/helpers/testDb';

describe('Stripe Webhook Security', () => {
  afterEach(async () => {
    await clearTestData();
  });

  it('rejects a webhook request with no Stripe-Signature header', async () => {
    const res = await request(app)
      .post('/payments/webhook')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ fake: 'payload' }));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/missing stripe signature/i);
  });

  it('rejects a webhook request with a tampered/invalid signature', async () => {
    const res = await request(app)
      .post('/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 'v1=tampered_invalid_signature_value_that_stripe_would_reject')
      .send(JSON.stringify({ type: 'checkout.session.completed', data: {} }));

    // Stripe's constructEvent throws when signature is invalid → 400
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
