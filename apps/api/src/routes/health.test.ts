import express from 'express';
import request from 'supertest';
import { healthRouter } from './health';

const app = express();
app.use('/health', healthRouter);

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('api');
    expect(res.body.timestamp).toBeTruthy();
  });
});
