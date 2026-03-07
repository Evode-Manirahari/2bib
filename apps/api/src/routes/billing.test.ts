import express from 'express';
import request from 'supertest';
import type { AuthContext } from '../types/express';

// ── Mock @pe/db ───────────────────────────────────────────────────────────────

jest.mock('@pe/db', () => ({
  prisma: {
    user: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    apiKey: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { prisma } from '@pe/db';
const mockUserFindUniqueOrThrow = prisma.user.findUniqueOrThrow as jest.Mock;
const mockUserUpdate = prisma.user.update as jest.Mock;
const mockTransaction = prisma.$transaction as jest.Mock;

// ── Mock stripe service ───────────────────────────────────────────────────────

const mockGetStripe = jest.fn();
const mockGetOrCreateCustomer = jest.fn();
const mockCreateCheckoutSession = jest.fn();
const mockCreatePortalSession = jest.fn();
const mockGetPriceId = jest.fn();
const mockPlanFromPriceId = jest.fn();
const mockResetStripeClient = jest.fn();

jest.mock('../services/stripe', () => ({
  getStripe: () => mockGetStripe(),
  getOrCreateCustomer: (...args: unknown[]) => mockGetOrCreateCustomer(...args),
  createCheckoutSession: (...args: unknown[]) => mockCreateCheckoutSession(...args),
  createPortalSession: (...args: unknown[]) => mockCreatePortalSession(...args),
  getPriceId: (tier: string) => mockGetPriceId(tier),
  planFromPriceId: (priceId: string) => mockPlanFromPriceId(priceId),
  resetStripeClient: () => mockResetStripeClient(),
  TIER_RATE_LIMITS: {
    FREE: 1_000,
    STARTER: 50_000,
    GROWTH: 500_000,
    ENTERPRISE: 10_000_000,
  },
}));

import { billingRouter } from './billing';

// ── Helpers ───────────────────────────────────────────────────────────────────

const authCtx: AuthContext = {
  apiKeyId: 'key-1',
  userId: 'user-1',
  projectId: 'proj-1',
  tier: 'STARTER',
  rateLimit: 50_000,
};

function buildApp(withAuth = true) {
  const app = express();
  // Webhook needs raw body
  app.use('/v1/billing/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());
  if (withAuth) {
    app.use((req, _res, next) => {
      req.auth = authCtx;
      next();
    });
  }
  app.use('/v1/billing', billingRouter);
  return app;
}

const fakeUser = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'Test User',
  plan: 'PRO',
  stripeCustomerId: 'cus_existing_123',
  stripeSubId: 'sub_123',
  stripePriceId: 'price_starter_abc',
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default transaction mock: run all operations
  mockTransaction.mockImplementation(async (ops: Promise<unknown>[]) => {
    return Promise.all(ops);
  });
  mockUserUpdate.mockResolvedValue(fakeUser);
});

// ── GET /v1/billing/plans ─────────────────────────────────────────────────────

describe('GET /v1/billing/plans', () => {
  it('returns 200 with array of 4 plans (no auth needed)', async () => {
    const res = await request(buildApp(false)).get('/v1/billing/plans');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.plans)).toBe(true);
    expect(res.body.plans).toHaveLength(4);
    expect(res.body.plans[0]).toMatchObject({ tier: 'FREE' });
    expect(res.body.plans[1]).toMatchObject({ tier: 'STARTER' });
    expect(res.body.plans[2]).toMatchObject({ tier: 'GROWTH' });
    expect(res.body.plans[3]).toMatchObject({ tier: 'ENTERPRISE' });
  });
});

// ── POST /v1/billing/checkout ─────────────────────────────────────────────────

describe('POST /v1/billing/checkout', () => {
  it('returns 401 without auth', async () => {
    const res = await request(buildApp(false))
      .post('/v1/billing/checkout')
      .send({ tier: 'STARTER' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when tier is missing', async () => {
    const res = await request(buildApp()).post('/v1/billing/checkout').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  it('returns 400 when tier is invalid', async () => {
    const res = await request(buildApp())
      .post('/v1/billing/checkout')
      .send({ tier: 'FREE' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  it('returns 503 when STRIPE_PRICE_STARTER not configured', async () => {
    mockGetPriceId.mockReturnValue(undefined);

    const res = await request(buildApp())
      .post('/v1/billing/checkout')
      .send({ tier: 'STARTER' });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('BILLING_NOT_CONFIGURED');
  });

  it('returns 200 with checkout URL when user already has a Stripe customer', async () => {
    mockGetPriceId.mockReturnValue('price_starter_abc');
    mockUserFindUniqueOrThrow.mockResolvedValue(fakeUser);
    mockCreateCheckoutSession.mockResolvedValue('https://checkout.stripe.com/pay/sess_abc');

    const res = await request(buildApp())
      .post('/v1/billing/checkout')
      .send({ tier: 'STARTER' });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://checkout.stripe.com/pay/sess_abc');
    // Should NOT create a new customer since one exists
    expect(mockGetOrCreateCustomer).not.toHaveBeenCalled();
  });

  it('creates Stripe customer when none exists, then returns URL', async () => {
    mockGetPriceId.mockReturnValue('price_starter_abc');
    mockUserFindUniqueOrThrow.mockResolvedValue({ ...fakeUser, stripeCustomerId: null });
    mockGetOrCreateCustomer.mockResolvedValue('cus_new_456');
    mockUserUpdate.mockResolvedValue({ ...fakeUser, stripeCustomerId: 'cus_new_456' });
    mockCreateCheckoutSession.mockResolvedValue('https://checkout.stripe.com/pay/sess_new');

    const res = await request(buildApp())
      .post('/v1/billing/checkout')
      .send({ tier: 'STARTER' });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://checkout.stripe.com/pay/sess_new');
    expect(mockGetOrCreateCustomer).toHaveBeenCalledWith('user-1', 'user@example.com', 'Test User');
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { stripeCustomerId: 'cus_new_456' },
    });
  });
});

// ── POST /v1/billing/portal ───────────────────────────────────────────────────

describe('POST /v1/billing/portal', () => {
  it('returns 401 without auth', async () => {
    const res = await request(buildApp(false)).post('/v1/billing/portal');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when user has no Stripe customer', async () => {
    mockUserFindUniqueOrThrow.mockResolvedValue({ ...fakeUser, stripeCustomerId: null });

    const res = await request(buildApp()).post('/v1/billing/portal');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NO_SUBSCRIPTION');
  });

  it('returns 200 with portal URL', async () => {
    mockUserFindUniqueOrThrow.mockResolvedValue(fakeUser);
    mockCreatePortalSession.mockResolvedValue('https://billing.stripe.com/portal/sess_abc');

    const res = await request(buildApp()).post('/v1/billing/portal');

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://billing.stripe.com/portal/sess_abc');
    expect(mockCreatePortalSession).toHaveBeenCalledWith('cus_existing_123', expect.stringContaining('/dashboard'));
  });
});

// ── GET /v1/billing/status ────────────────────────────────────────────────────

describe('GET /v1/billing/status', () => {
  it('returns 401 without auth', async () => {
    const res = await request(buildApp(false)).get('/v1/billing/status');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns subscription status with correct fields', async () => {
    mockUserFindUniqueOrThrow.mockResolvedValue(fakeUser);

    const res = await request(buildApp()).get('/v1/billing/status');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      plan: 'PRO',
      tier: 'STARTER',
      stripeCustomerId: 'cus_existing_123',
      hasActiveSubscription: true,
      stripeSubId: 'sub_123',
    });
  });

  it('returns hasActiveSubscription=false when no stripeSubId', async () => {
    mockUserFindUniqueOrThrow.mockResolvedValue({ ...fakeUser, stripeSubId: null });

    const res = await request(buildApp()).get('/v1/billing/status');

    expect(res.status).toBe(200);
    expect(res.body.hasActiveSubscription).toBe(false);
    expect(res.body.stripeSubId).toBeNull();
  });
});

// ── POST /v1/billing/webhook ──────────────────────────────────────────────────

const mockWebhooksConstructEvent = jest.fn();
const mockSubscriptionsRetrieve = jest.fn();

const fakeStripeInstance = {
  webhooks: { constructEvent: mockWebhooksConstructEvent },
  subscriptions: { retrieve: mockSubscriptionsRetrieve },
};

describe('POST /v1/billing/webhook', () => {
  beforeEach(() => {
    mockGetStripe.mockReturnValue(fakeStripeInstance);
    process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test_secret';
  });

  afterEach(() => {
    delete process.env['STRIPE_WEBHOOK_SECRET'];
  });

  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await request(buildApp(false))
      .post('/v1/billing/webhook')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing stripe-signature');
  });

  it('returns 400 when webhook secret is not configured', async () => {
    delete process.env['STRIPE_WEBHOOK_SECRET'];

    const res = await request(buildApp(false))
      .post('/v1/billing/webhook')
      .set('stripe-signature', 't=123,v1=abc')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(400);
  });

  it('returns 400 when signature verification fails', async () => {
    mockWebhooksConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });

    const res = await request(buildApp(false))
      .post('/v1/billing/webhook')
      .set('stripe-signature', 't=123,v1=bad_sig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Webhook signature verification failed');
  });

  it('handles checkout.session.completed and updates user and API keys', async () => {
    const fakeEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { peUserId: 'user-1' },
          subscription: 'sub_new_123',
        },
      },
    };
    mockWebhooksConstructEvent.mockReturnValue(fakeEvent);
    mockPlanFromPriceId.mockReturnValue('STARTER');
    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ price: { id: 'price_starter_abc' } }] },
    });
    mockTransaction.mockResolvedValue([{}, {}]);

    const res = await request(buildApp(false))
      .post('/v1/billing/webhook')
      .set('stripe-signature', 't=123,v1=valid_sig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify(fakeEvent)));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('handles customer.subscription.updated and updates plan/tier', async () => {
    const fakeEvent = {
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          status: 'active',
          metadata: { peUserId: 'user-1' },
          items: { data: [{ price: { id: 'price_growth_xyz' } }] },
        },
      },
    };
    mockWebhooksConstructEvent.mockReturnValue(fakeEvent);
    mockPlanFromPriceId.mockReturnValue('GROWTH');
    mockTransaction.mockResolvedValue([{}, {}]);

    const res = await request(buildApp(false))
      .post('/v1/billing/webhook')
      .set('stripe-signature', 't=123,v1=valid_sig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify(fakeEvent)));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('handles customer.subscription.deleted and resets user to FREE', async () => {
    const fakeEvent = {
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_123',
          metadata: { peUserId: 'user-1' },
          items: { data: [] },
        },
      },
    };
    mockWebhooksConstructEvent.mockReturnValue(fakeEvent);
    mockTransaction.mockResolvedValue([{}, {}]);

    const res = await request(buildApp(false))
      .post('/v1/billing/webhook')
      .set('stripe-signature', 't=123,v1=valid_sig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify(fakeEvent)));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('returns 200 for unhandled event types', async () => {
    const fakeEvent = {
      type: 'payment_intent.created',
      data: { object: {} },
    };
    mockWebhooksConstructEvent.mockReturnValue(fakeEvent);

    const res = await request(buildApp(false))
      .post('/v1/billing/webhook')
      .set('stripe-signature', 't=123,v1=valid_sig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify(fakeEvent)));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    // No DB operations for unhandled events
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
