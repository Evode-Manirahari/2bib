import express, { type Application, type Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { authenticate } from './middleware/auth';
import { rateLimiter } from './middleware/rate-limit';
import { requestLogger } from './middleware/request-logger';
import { errorHandler } from './middleware/error-handler';

import { healthRouter } from './routes/health';
import { metricsRouter, httpRequestsTotal, httpRequestDurationMs } from './routes/metrics';
import { meRouter } from './routes/me';
import { logsRouter } from './routes/logs';
import { fhirRouter } from './routes/fhir';
import { validateRouter } from './routes/validate';
import { paRouter } from './routes/pa';
import { workflowsRouter } from './routes/workflows';
import { billingRouter } from './routes/billing';

const app: Application = express();

// ── Security & parsing ────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Pe-Payer-Target'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  }),
);

// Stripe webhook needs raw body — must be registered BEFORE express.json()
app.use('/v1/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Request duration tracking (for /metrics) ──────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const route = (req.route?.path as string | undefined) ?? req.path;
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    httpRequestsTotal.inc(labels);
    httpRequestDurationMs.observe(labels, Date.now() - start);
  });
  next();
});

// ── Public routes ─────────────────────────────────────────────────────────────
app.use('/health', healthRouter);
app.use('/v1/health', healthRouter);
app.use('/metrics', metricsRouter);

// Public billing routes (no auth required)
app.get('/v1/billing/plans', (req, res, next) => billingRouter(req, res, next));
app.post('/v1/billing/webhook', (req, res, next) => billingRouter(req, res, next));

// ── Authenticated v1 router ───────────────────────────────────────────────────
const v1: Router = express.Router();
v1.use(authenticate);
v1.use(rateLimiter);
v1.use(requestLogger);

v1.use('/me', meRouter);
v1.use('/logs', logsRouter);
v1.use('/fhir', fhirRouter);
v1.use('/validate', validateRouter);
v1.use('/pa', paRouter);
v1.use('/workflows', workflowsRouter);
v1.use('/billing', billingRouter);

app.use('/v1', v1);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
