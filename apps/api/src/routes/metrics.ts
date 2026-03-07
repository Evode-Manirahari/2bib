import { Router, type IRouter } from 'express';
import client from 'prom-client';

const registry = new client.Registry();
registry.setDefaultLabels({ app: 'pe-api' });
client.collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new client.Counter({
  name: 'pe_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const httpRequestDurationMs = new client.Histogram({
  name: 'pe_http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [10, 25, 50, 100, 200, 500, 1000, 2000, 5000],
  registers: [registry],
});

export const metricsRouter: IRouter = Router();

metricsRouter.get('/', async (_req, res) => {
  try {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  } catch (err) {
    res.status(500).end(String(err));
  }
});
