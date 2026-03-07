import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[pa-simulator:error]', err.stack);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
}
