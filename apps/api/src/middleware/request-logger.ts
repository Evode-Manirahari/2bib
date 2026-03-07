import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@pe/db';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();

  res.on('finish', () => {
    if (!req.auth?.projectId) return;

    const durationMs = Date.now() - startedAt;

    prisma.requestLog
      .create({
        data: {
          projectId: req.auth.projectId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs,
          payerTarget: (req.headers['x-pe-payer-target'] as string) ?? null,
          resourceType: (req.params['resourceType'] as string) ?? null,
        },
      })
      .catch((err: Error) => {
        console.error('[request-logger] Failed to write log:', err.message);
      });
  });

  next();
}
