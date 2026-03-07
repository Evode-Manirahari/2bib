import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import type { HealthResponse } from '@pe/types';
import { validateRouter } from './routes';
import { errorHandler } from './middleware';

const app: Application = express();

// ── Security & parsing ────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const response: HealthResponse = {
    status: 'ok',
    service: 'validator',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
  res.json(response);
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/validate', validateRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
