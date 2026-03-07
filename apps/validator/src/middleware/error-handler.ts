import type { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('[validator:error]', err.stack);
  res.status(500).json({
    resourceType: 'OperationOutcome',
    issue: [
      {
        severity: 'error',
        code: 'exception',
        diagnostics: err.message ?? 'Internal server error',
      },
    ],
  });
}
