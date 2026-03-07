import express from 'express';
import request from 'supertest';
import type { AuthContext } from '../types/express';
import { meRouter } from './me';

const authCtx: AuthContext = {
  apiKeyId: 'key-1',
  userId: 'user-1',
  projectId: 'proj-1',
  tier: 'FREE',
  rateLimit: 1000,
};

function buildApp() {
  const app = express();
  app.use((req, _res, next) => {
    req.auth = authCtx;
    next();
  });
  app.use('/v1/me', meRouter);
  return app;
}

describe('GET /v1/me', () => {
  it('returns the auth context for the current key', async () => {
    const res = await request(buildApp()).get('/v1/me');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      apiKeyId: 'key-1',
      userId: 'user-1',
      projectId: 'proj-1',
      tier: 'FREE',
      rateLimit: 1000,
    });
  });
});
