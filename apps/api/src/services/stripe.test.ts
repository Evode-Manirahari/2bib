// ── Mock Stripe ───────────────────────────────────────────────────────────────

const mockCustomersCreate = jest.fn();
const mockCheckoutSessionsCreate = jest.fn();
const mockBillingPortalSessionsCreate = jest.fn();
const mockMeterEventsCreate = jest.fn();
const mockWebhooksConstructEvent = jest.fn();

const mockStripeInstance = {
  customers: { create: mockCustomersCreate },
  checkout: { sessions: { create: mockCheckoutSessionsCreate } },
  billingPortal: { sessions: { create: mockBillingPortalSessionsCreate } },
  v2: { billing: { meterEvents: { create: mockMeterEventsCreate } } },
  webhooks: { constructEvent: mockWebhooksConstructEvent },
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripeInstance);
});

import Stripe from 'stripe';
import {
  getStripe,
  resetStripeClient,
  getPriceId,
  planFromPriceId,
  TIER_RATE_LIMITS,
  getOrCreateCustomer,
  createCheckoutSession,
  createPortalSession,
  reportUsage,
} from './stripe';


const MockedStripe = Stripe as jest.MockedClass<typeof Stripe>;

beforeEach(() => {
  jest.clearAllMocks();
  resetStripeClient();
  delete process.env['STRIPE_SECRET_KEY'];
  delete process.env['STRIPE_PRICE_STARTER'];
  delete process.env['STRIPE_PRICE_GROWTH'];
  delete process.env['STRIPE_PRICE_ENTERPRISE'];
});

// ── getStripe() ───────────────────────────────────────────────────────────────

describe('getStripe()', () => {
  it('throws when STRIPE_SECRET_KEY is not set', () => {
    expect(() => getStripe()).toThrow('STRIPE_SECRET_KEY not set');
  });

  it('returns a Stripe instance when key is set', () => {
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_abc';
    const stripe = getStripe();
    expect(stripe).toBe(mockStripeInstance);
    expect(MockedStripe).toHaveBeenCalledWith('sk_test_abc', { apiVersion: '2026-02-25.clover' });
  });

  it('caches the instance — called twice returns the same object', () => {
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_abc';
    const first = getStripe();
    const second = getStripe();
    expect(first).toBe(second);
    expect(MockedStripe).toHaveBeenCalledTimes(1);
  });
});

// ── getPriceId() ──────────────────────────────────────────────────────────────

describe('getPriceId()', () => {
  it('returns the STARTER price from env', () => {
    process.env['STRIPE_PRICE_STARTER'] = 'price_starter_123';
    expect(getPriceId('STARTER')).toBe('price_starter_123');
  });

  it('returns the GROWTH price from env', () => {
    process.env['STRIPE_PRICE_GROWTH'] = 'price_growth_456';
    expect(getPriceId('GROWTH')).toBe('price_growth_456');
  });

  it('returns undefined for FREE tier (not in map)', () => {
    expect(getPriceId('FREE')).toBeUndefined();
  });

  it('returns undefined when env var is not set for a tier', () => {
    expect(getPriceId('STARTER')).toBeUndefined();
  });
});

// ── planFromPriceId() ─────────────────────────────────────────────────────────

describe('planFromPriceId()', () => {
  beforeEach(() => {
    process.env['STRIPE_PRICE_STARTER'] = 'price_starter_123';
    process.env['STRIPE_PRICE_GROWTH'] = 'price_growth_456';
    process.env['STRIPE_PRICE_ENTERPRISE'] = 'price_ent_789';
  });

  it('returns STARTER for the starter price ID', () => {
    expect(planFromPriceId('price_starter_123')).toBe('STARTER');
  });

  it('returns GROWTH for the growth price ID', () => {
    expect(planFromPriceId('price_growth_456')).toBe('GROWTH');
  });

  it('returns ENTERPRISE for the enterprise price ID', () => {
    expect(planFromPriceId('price_ent_789')).toBe('ENTERPRISE');
  });

  it('returns FREE for an unknown price ID', () => {
    expect(planFromPriceId('price_unknown_000')).toBe('FREE');
  });
});

// ── TIER_RATE_LIMITS ──────────────────────────────────────────────────────────

describe('TIER_RATE_LIMITS', () => {
  it('has correct rate limit for FREE', () => {
    expect(TIER_RATE_LIMITS['FREE']).toBe(1_000);
  });

  it('has correct rate limit for STARTER', () => {
    expect(TIER_RATE_LIMITS['STARTER']).toBe(50_000);
  });

  it('has correct rate limit for GROWTH', () => {
    expect(TIER_RATE_LIMITS['GROWTH']).toBe(500_000);
  });

  it('has correct rate limit for ENTERPRISE', () => {
    expect(TIER_RATE_LIMITS['ENTERPRISE']).toBe(10_000_000);
  });
});

// ── getOrCreateCustomer() ─────────────────────────────────────────────────────

describe('getOrCreateCustomer()', () => {
  beforeEach(() => {
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_abc';
  });

  it('calls stripe.customers.create and returns the customer id', async () => {
    mockCustomersCreate.mockResolvedValue({ id: 'cus_test_123' });

    const customerId = await getOrCreateCustomer('user-1', 'user@example.com', 'Test User');

    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: 'user@example.com',
      name: 'Test User',
      metadata: { peUserId: 'user-1' },
    });
    expect(customerId).toBe('cus_test_123');
  });

  it('passes undefined for name when null is provided', async () => {
    mockCustomersCreate.mockResolvedValue({ id: 'cus_test_456' });

    await getOrCreateCustomer('user-2', 'user2@example.com', null);

    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: 'user2@example.com',
      name: undefined,
      metadata: { peUserId: 'user-2' },
    });
  });
});

// ── createCheckoutSession() ───────────────────────────────────────────────────

describe('createCheckoutSession()', () => {
  beforeEach(() => {
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_abc';
  });

  it('calls stripe.checkout.sessions.create and returns url', async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/session_abc' });

    const url = await createCheckoutSession({
      customerId: 'cus_test_123',
      priceId: 'price_starter_123',
      userId: 'user-1',
      successUrl: 'https://app.example.com/success',
      cancelUrl: 'https://app.example.com/cancel',
    });

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith({
      customer: 'cus_test_123',
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: 'price_starter_123', quantity: 1 }],
      success_url: 'https://app.example.com/success',
      cancel_url: 'https://app.example.com/cancel',
      metadata: { peUserId: 'user-1' },
      subscription_data: { metadata: { peUserId: 'user-1' } },
    });
    expect(url).toBe('https://checkout.stripe.com/pay/session_abc');
  });

  it('returns empty string when session url is null', async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({ url: null });

    const url = await createCheckoutSession({
      customerId: 'cus_test_123',
      priceId: 'price_starter_123',
      userId: 'user-1',
      successUrl: 'https://app.example.com/success',
      cancelUrl: 'https://app.example.com/cancel',
    });

    expect(url).toBe('');
  });
});

// ── createPortalSession() ─────────────────────────────────────────────────────

describe('createPortalSession()', () => {
  beforeEach(() => {
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_abc';
  });

  it('calls stripe.billingPortal.sessions.create and returns url', async () => {
    mockBillingPortalSessionsCreate.mockResolvedValue({ url: 'https://billing.stripe.com/portal/session_xyz' });

    const url = await createPortalSession('cus_test_123', 'https://app.example.com/dashboard');

    expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith({
      customer: 'cus_test_123',
      return_url: 'https://app.example.com/dashboard',
    });
    expect(url).toBe('https://billing.stripe.com/portal/session_xyz');
  });
});

// ── reportUsage() ─────────────────────────────────────────────────────────────

describe('reportUsage()', () => {
  beforeEach(() => {
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_abc';
  });

  it('calls stripe.v2.billing.meterEvents.create with correct args', async () => {
    mockMeterEventsCreate.mockResolvedValue({});

    await reportUsage('api_calls', 'cus_test_123', 100);

    expect(mockMeterEventsCreate).toHaveBeenCalledWith({
      event_name: 'api_calls',
      payload: {
        stripe_customer_id: 'cus_test_123',
        value: '100',
      },
    });
  });

  it('includes timestamp when provided', async () => {
    mockMeterEventsCreate.mockResolvedValue({});

    await reportUsage('api_calls', 'cus_test_123', 50, '2024-01-01T00:00:00Z');

    expect(mockMeterEventsCreate).toHaveBeenCalledWith({
      event_name: 'api_calls',
      payload: {
        stripe_customer_id: 'cus_test_123',
        value: '50',
      },
      timestamp: '2024-01-01T00:00:00Z',
    });
  });
});
