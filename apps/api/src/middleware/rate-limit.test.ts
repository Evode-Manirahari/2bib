import express from 'express';
import request from 'supertest';
import { rateLimiter } from './rate-limit';

// ── Mock Redis ────────────────────────────────────────────────────────────────

const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
};

jest.mock('../services/redis', () => ({
  getRedis: () => mockRedis,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApp(rateLimit = 100) {
  const app = express();
  app.use(express.json());
  // Inject auth context
  app.use((req, _res, next) => {
    req.auth = {
      apiKeyId: 'key-1',
      userId: 'user-1',
      projectId: 'proj-1',
      tier: 'FREE',
      rateLimit,
    };
    next();
  });
  app.use(rateLimiter);
  app.get('/test', (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRedis.expire.mockResolvedValue(1);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('rateLimiter middleware', () => {
  it('skips rate limiting when req.auth is absent', async () => {
    const app = express();
    app.use(rateLimiter);
    app.get('/test', (_req, res) => res.status(200).json({ ok: true }));

    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(mockRedis.incr).not.toHaveBeenCalled();
  });

  it('sets rate limit headers on first request', async () => {
    mockRedis.incr.mockResolvedValue(1);

    const res = await request(buildApp(100)).get('/test');

    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('100');
    expect(res.headers['x-ratelimit-remaining']).toBe('99');
  });

  it('sets TTL on first call (incr returns 1)', async () => {
    mockRedis.incr.mockResolvedValue(1);

    await request(buildApp(100)).get('/test');

    expect(mockRedis.expire).toHaveBeenCalledTimes(1);
  });

  it('does not reset TTL on subsequent calls', async () => {
    mockRedis.incr.mockResolvedValue(50);

    await request(buildApp(100)).get('/test');

    expect(mockRedis.expire).not.toHaveBeenCalled();
  });

  it('returns 429 when limit is exceeded', async () => {
    mockRedis.incr.mockResolvedValue(101);

    const res = await request(buildApp(100)).get('/test');

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(res.body.retryAfter).toBeGreaterThan(0);
  });

  it('sets remaining to 0 when exactly at limit', async () => {
    mockRedis.incr.mockResolvedValue(100);

    const res = await request(buildApp(100)).get('/test');

    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('fails open when Redis throws', async () => {
    mockRedis.incr.mockRejectedValue(new Error('Redis down'));

    const res = await request(buildApp(100)).get('/test');

    expect(res.status).toBe(200);
  });
});
