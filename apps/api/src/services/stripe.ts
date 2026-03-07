import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env['STRIPE_SECRET_KEY'];
    if (!key) throw new Error('STRIPE_SECRET_KEY not set');
    _stripe = new Stripe(key, { apiVersion: '2026-02-25.clover' });
  }
  return _stripe;
}

// For tests
export function resetStripeClient(): void {
  _stripe = null;
}

// Tier → Stripe price ID map (from env)
export function getPriceId(tier: string): string | undefined {
  const map: Record<string, string | undefined> = {
    STARTER: process.env['STRIPE_PRICE_STARTER'],
    GROWTH: process.env['STRIPE_PRICE_GROWTH'],
    ENTERPRISE: process.env['STRIPE_PRICE_ENTERPRISE'],
  };
  return map[tier];
}

// Plan label from price ID (reverse lookup)
export function planFromPriceId(priceId: string): string {
  if (priceId === process.env['STRIPE_PRICE_STARTER']) return 'STARTER';
  if (priceId === process.env['STRIPE_PRICE_GROWTH']) return 'GROWTH';
  if (priceId === process.env['STRIPE_PRICE_ENTERPRISE']) return 'ENTERPRISE';
  return 'FREE';
}

// Rate limits per tier
export const TIER_RATE_LIMITS: Record<string, number> = {
  FREE: 1_000,
  STARTER: 50_000,
  GROWTH: 500_000,
  ENTERPRISE: 10_000_000,
};

// Create or retrieve Stripe customer for a user
export async function getOrCreateCustomer(userId: string, email: string, name?: string | null): Promise<string> {
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { peUserId: userId },
  });
  return customer.id;
}

// Create a checkout session for tier upgrade
export async function createCheckoutSession(opts: {
  customerId: string;
  priceId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    customer: opts.customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: opts.priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: { peUserId: opts.userId },
    subscription_data: {
      metadata: { peUserId: opts.userId },
    },
  });
  return session.url ?? '';
}

// Create a billing portal session
export async function createPortalSession(customerId: string, returnUrl: string): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

// Report metered usage to Stripe via meter events (Stripe SDK v20+)
export async function reportUsage(eventName: string, stripeCustomerId: string, quantity: number, timestamp?: string): Promise<void> {
  const stripe = getStripe();
  await stripe.v2.billing.meterEvents.create({
    event_name: eventName,
    payload: {
      stripe_customer_id: stripeCustomerId,
      value: String(quantity),
    },
    ...(timestamp ? { timestamp } : {}),
  });
}
