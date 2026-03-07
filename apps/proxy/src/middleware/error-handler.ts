import type { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  console.error('[proxy:error]', err.stack);

  // Always respond with a FHIR OperationOutcome
  res.status(statusCode).json({
    resourceType: 'OperationOutcome',
    issue: [
      {
        severity: 'fatal',
        code: 'exception',
        diagnostics: err.message ?? 'Internal server error',
      },
    ],
  });
}
