import express from 'express';
import request from 'supertest';
import { authenticate } from './auth';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@pe/db', () => ({
  prisma: {
    apiKey: {
      findMany: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

import { prisma } from '@pe/db';
import bcrypt from 'bcryptjs';

const mockFindMany = prisma.apiKey.findMany as jest.Mock;
const mockCompare = bcrypt.compare as unknown as jest.Mock;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(authenticate);
  app.get('/test', (req, res) => res.json(req.auth ?? null));
  return app;
}

const fakeApiKey = {
  id: 'key-1',
  key: 'hashed',
  prefix: 'pe_test_abc123',
  tier: 'FREE',
  rateLimit: 1000,
  callCount: 0,
  userId: 'user-1',
  projectId: 'proj-1',
  revokedAt: null,
  user: { id: 'user-1', email: 'test@pe.dev', name: 'Test', plan: 'FREE' },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('authenticate middleware', () => {
  describe('missing / malformed header', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const res = await request(buildApp()).get('/test');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when header does not start with Bearer', async () => {
      const res = await request(buildApp())
        .get('/test')
        .set('Authorization', 'Basic abc123');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 for empty key after Bearer', async () => {
      const res = await request(buildApp())
        .get('/test')
        .set('Authorization', 'Bearer ');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('key lookup', () => {
    it('returns 401 when no DB record matches prefix', async () => {
      mockFindMany.mockResolvedValue([]);
      const res = await request(buildApp())
        .get('/test')
        .set('Authorization', 'Bearer pe_test_unknownkey000000000000000000');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when bcrypt compare fails', async () => {
      mockFindMany.mockResolvedValue([fakeApiKey]);
      mockCompare.mockResolvedValue(false);
      const res = await request(buildApp())
        .get('/test')
        .set('Authorization', 'Bearer pe_test_abc123wronghex000000000000000');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('valid key', () => {
    it('sets req.auth and calls next on valid key', async () => {
      mockFindMany.mockResolvedValue([fakeApiKey]);
      mockCompare.mockResolvedValue(true);

      const res = await request(buildApp())
        .get('/test')
        .set('Authorization', 'Bearer pe_test_abc123validhex000000000000000');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        apiKeyId: 'key-1',
        userId: 'user-1',
        projectId: 'proj-1',
        tier: 'FREE',
        rateLimit: 1000,
      });
    });

    it('queries DB with correct 14-char prefix', async () => {
      mockFindMany.mockResolvedValue([fakeApiKey]);
      mockCompare.mockResolvedValue(true);
      const rawKey = 'pe_test_abc123validhex000000000000000';

      await request(buildApp())
        .get('/test')
        .set('Authorization', `Bearer ${rawKey}`);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ prefix: rawKey.slice(0, 14) }),
        }),
      );
    });
  });
});
