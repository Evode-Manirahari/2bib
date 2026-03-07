import { Router, type IRouter } from 'express';
import type { HealthResponse } from '@pe/types';

export const healthRouter: IRouter = Router();

healthRouter.get('/', (_req, res) => {
  const response: HealthResponse = {
    status: 'ok',
    service: 'api',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.0.1',
    uptime: process.uptime(),
  };
  res.json(response);
});
