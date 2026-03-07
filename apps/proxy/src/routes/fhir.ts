import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';
import { isAxiosError } from 'axios';
import { getHapiClient } from '../services/hapi-client';
import { getCached, setCached, invalidateByPattern } from '../services/cache';

export const fhirRouter: IRouter = Router();

/** Build a stable cache key from method + path + query params. */
function cacheKey(path: string, query: Record<string, unknown>): string {
  const qs = new URLSearchParams(query as Record<string, string>).toString();
  return `fhir:GET:${path}${qs ? '?' + qs : ''}`;
}

fhirRouter.use(async (req: Request, res: Response, next: NextFunction) => {
  const hapiPath = `/fhir${req.path}`;
  const isRead = req.method === 'GET';

  // ── Cache read ──────────────────────────────────────────────────────────────
  if (isRead) {
    const key = cacheKey(hapiPath, req.query as Record<string, unknown>);
    const cached = await getCached(key);
    if (cached !== null) {
      res.set('Content-Type', 'application/fhir+json');
      res.set('X-Cache', 'HIT');
      return res.status(200).json(JSON.parse(cached) as unknown);
    }
  }

  // ── Forward to HAPI FHIR ───────────────────────────────────────────────────
  try {
    const hapiClient = getHapiClient();
    const hapiResponse = await hapiClient.request({
      method: req.method,
      url: hapiPath,
      params: req.query,
      data: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
      validateStatus: () => true, // Never throw on 4xx/5xx — forward as-is
    });

    // ── Cache successful GET responses ───────────────────────────────────────
    if (isRead && hapiResponse.status >= 200 && hapiResponse.status < 300) {
      const key = cacheKey(hapiPath, req.query as Record<string, unknown>);
      await setCached(key, JSON.stringify(hapiResponse.data), 300);
    }

    // ── Invalidate cache on write operations ─────────────────────────────────
    if (!isRead) {
      const resourceType = req.path.split('/').filter(Boolean)[0];
      if (resourceType) {
        await invalidateByPattern(`fhir:GET:/fhir/${resourceType}*`);
      }
    }

    res.set('X-Cache', isRead ? 'MISS' : 'BYPASS');
    res.status(hapiResponse.status).json(hapiResponse.data as unknown);
  } catch (err) {
    if (isAxiosError(err) && !err.response) {
      // HAPI is unreachable — return a FHIR OperationOutcome
      res.status(503).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'fatal',
            code: 'transient',
            diagnostics: 'FHIR server unavailable',
          },
        ],
      });
      return;
    }
    next(err);
  }
});
