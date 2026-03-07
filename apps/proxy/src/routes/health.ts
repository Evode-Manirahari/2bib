import { Router, type IRouter } from 'express';
import type { HealthResponse } from '@pe/types';

export const healthRouter: IRouter = Router();

healthRouter.get('/', (_req, res) => {
  const response: HealthResponse = {
    status: 'ok',
    service: 'proxy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
  res.json(response);
});
