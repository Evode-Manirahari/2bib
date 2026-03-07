import express from 'express';
import request from 'supertest';
import { logsRouter } from './logs';

// ── Mock @pe/db ───────────────────────────────────────────────────────────────

jest.mock('@pe/db', () => ({
  prisma: {
    requestLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import { prisma } from '@pe/db';
const mockFindMany = prisma.requestLog.findMany as jest.Mock;
const mockCount = prisma.requestLog.count as jest.Mock;

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use((req, _res, next) => {
    req.auth = {
      apiKeyId: 'key-1',
      userId: 'user-1',
      projectId: 'proj-1',
      tier: 'FREE',
      rateLimit: 1000,
    };
    next();
  });
  app.use('/v1/logs', logsRouter);
  return app;
}

const fakeLogs = [
  {
    id: 'log-1',
    method: 'GET',
    path: '/v1/fhir/Patient',
    statusCode: 200,
    durationMs: 42,
    payerTarget: null,
    resourceType: 'Patient',
    error: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
  },
];

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /v1/logs', () => {
  it('returns paginated logs with defaults (page=1, pageSize=20)', async () => {
    mockFindMany.mockResolvedValue(fakeLogs);
    mockCount.mockResolvedValue(1);

    const res = await request(buildApp()).get('/v1/logs');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(20);
    expect(res.body.hasMore).toBe(false);
  });

  it('respects page and pageSize query params', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(50);

    const res = await request(buildApp()).get('/v1/logs?page=3&pageSize=10');

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(3);
    expect(res.body.pageSize).toBe(10);
    // skip=20, data=[], total=50 → still more pages after page 3
    expect(res.body.hasMore).toBe(true);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });

  it('sets hasMore=true when more pages exist', async () => {
    mockFindMany.mockResolvedValue(fakeLogs);
    mockCount.mockResolvedValue(100);

    const res = await request(buildApp()).get('/v1/logs?page=1&pageSize=1');

    expect(res.body.hasMore).toBe(true);
  });

  it('clamps pageSize to max 100', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await request(buildApp()).get('/v1/logs?pageSize=999');

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it('filters logs by projectId from auth context', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await request(buildApp()).get('/v1/logs');

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: 'proj-1' } }),
    );
  });
});
