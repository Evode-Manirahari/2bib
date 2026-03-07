import { Router, type IRouter, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '@pe/db';
import {
  getStripe,
  getOrCreateCustomer,
  createCheckoutSession,
  createPortalSession,
  getPriceId,
  planFromPriceId,
  TIER_RATE_LIMITS,
} from '../services/stripe';

export const billingRouter: IRouter = Router();

const DASHBOARD_URL = process.env['DASHBOARD_URL'] ?? 'http://localhost:3000';

// ── GET /v1/billing/plans ─────────────────────────────────────────────────────
// Public — no auth required. Returns available plans.

billingRouter.get('/plans', (_req: Request, res: Response) => {
  res.json({
    plans: [
      { tier: 'FREE', price: 0, callsPerDay: 1_000, features: ['FHIR Proxy', 'Validator', 'PA Simulator'] },
      { tier: 'STARTER', price: 2900, callsPerDay: 50_000, features: ['Everything in Free', 'AI Enrichment', 'Workflow Runner', 'Priority Support'] },
      { tier: 'GROWTH', price: 9900, callsPerDay: 500_000, features: ['Everything in Starter', 'Custom Payer Profiles', 'SLA 99.9%', 'Dedicated Slack'] },
      { tier: 'ENTERPRISE', price: null, callsPerDay: null, features: ['Unlimited', 'Custom contracts', 'On-prem option', 'HIPAA BAA'] },
    ],
  });
});

// ── POST /v1/billing/checkout ─────────────────────────────────────────────────
// Requires auth (standard Bearer token from req.auth set by authenticate middleware).
// Body: { tier: 'STARTER' | 'GROWTH' | 'ENTERPRISE' }

billingRouter.post('/checkout', async (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  const { tier } = req.body as { tier?: string };
  if (!tier || !['STARTER', 'GROWTH', 'ENTERPRISE'].includes(tier)) {
    res.status(400).json({ error: 'Invalid tier. Must be STARTER, GROWTH, or ENTERPRISE', code: 'BAD_REQUEST' });
    return;
  }

  const priceId = getPriceId(tier);
  if (!priceId) {
    res.status(503).json({ error: `Stripe price not configured for tier ${tier}`, code: 'BILLING_NOT_CONFIGURED' });
    return;
  }

  try {
    // Load user to get/create Stripe customer
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth.userId } });

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      customerId = await getOrCreateCustomer(user.id, user.email, user.name);
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
    }

    const url = await createCheckoutSession({
      customerId,
      priceId,
      userId: user.id,
      successUrl: `${DASHBOARD_URL}/dashboard?billing=success`,
      cancelUrl: `${DASHBOARD_URL}/dashboard?billing=cancelled`,
    });

    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create checkout session', code: 'INTERNAL_ERROR', details: (err as Error).message });
  }
});

// ── POST /v1/billing/portal ───────────────────────────────────────────────────
// Requires auth. Creates a Stripe billing portal session.

billingRouter.post('/portal', async (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth.userId } });

    if (!user.stripeCustomerId) {
      res.status(400).json({ error: 'No active subscription found', code: 'NO_SUBSCRIPTION' });
      return;
    }

    const url = await createPortalSession(user.stripeCustomerId, `${DASHBOARD_URL}/dashboard`);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create portal session', code: 'INTERNAL_ERROR', details: (err as Error).message });
  }
});

// ── GET /v1/billing/status ────────────────────────────────────────────────────
// Requires auth. Returns current subscription status.

billingRouter.get('/status', async (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth.userId } });
    res.json({
      plan: user.plan,
      tier: req.auth.tier,
      stripeCustomerId: user.stripeCustomerId ?? null,
      hasActiveSubscription: !!user.stripeSubId,
      stripeSubId: user.stripeSubId ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch billing status', code: 'INTERNAL_ERROR' });
  }
});

// ── POST /v1/billing/webhook ──────────────────────────────────────────────────
// Raw body required — Stripe signature verification.
// Handles: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted

billingRouter.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];

  if (!sig || !webhookSecret) {
    res.status(400).json({ error: 'Missing stripe-signature or webhook secret' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (err) {
    res.status(400).json({ error: `Webhook signature verification failed: ${(err as Error).message}` });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.['peUserId'];
        const subId = session.subscription as string | null;

        if (userId && subId) {
          // Retrieve subscription to get price ID
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(subId);
          const price = sub.items.data[0]?.price.id ?? '';
          const tier = planFromPriceId(price);
          const rateLimit = TIER_RATE_LIMITS[tier] ?? 1_000;

          await prisma.$transaction([
            prisma.user.update({
              where: { id: userId },
              data: { plan: tier === 'FREE' ? 'FREE' : tier === 'ENTERPRISE' ? 'ENTERPRISE' : 'PRO', stripeSubId: subId, stripePriceId: price },
            }),
            // Update all API keys for this user to the new tier/rateLimit
            prisma.apiKey.updateMany({
              where: { userId, revokedAt: null },
              data: { tier: tier as 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE', rateLimit },
            }),
          ]);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.['peUserId'];
        const price = sub.items.data[0]?.price.id ?? '';
        const tier = planFromPriceId(price);
        const rateLimit = TIER_RATE_LIMITS[tier] ?? 1_000;
        const status = sub.status;

        if (userId) {
          const planMap: Record<string, 'FREE' | 'PRO' | 'ENTERPRISE'> = {
            FREE: 'FREE', STARTER: 'PRO', GROWTH: 'PRO', ENTERPRISE: 'ENTERPRISE',
          };
          const newPlan = status === 'active' || status === 'trialing' ? (planMap[tier] ?? 'FREE') : 'FREE';
          const newTier = status === 'active' || status === 'trialing' ? tier : 'FREE';
          const newRateLimit = status === 'active' || status === 'trialing' ? rateLimit : TIER_RATE_LIMITS['FREE']!;

          await prisma.$transaction([
            prisma.user.update({
              where: { id: userId },
              data: { plan: newPlan, stripeSubId: sub.id, stripePriceId: price },
            }),
            prisma.apiKey.updateMany({
              where: { userId, revokedAt: null },
              data: { tier: newTier as 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE', rateLimit: newRateLimit },
            }),
          ]);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.['peUserId'];

        if (userId) {
          await prisma.$transaction([
            prisma.user.update({
              where: { id: userId },
              data: { plan: 'FREE', stripeSubId: null, stripePriceId: null },
            }),
            prisma.apiKey.updateMany({
              where: { userId, revokedAt: null },
              data: { tier: 'FREE', rateLimit: TIER_RATE_LIMITS['FREE']! },
            }),
          ]);
        }
        break;
      }

      default:
        // Ignore unhandled events
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[billing/webhook] Handler error:', (err as Error).message);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});
