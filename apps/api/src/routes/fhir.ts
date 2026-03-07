import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';
import axios, { isAxiosError } from 'axios';

export const fhirRouter: IRouter = Router();

const PROXY_URL = process.env.PROXY_URL ?? 'http://localhost:3002';

fhirRouter.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUrl = `${PROXY_URL}/fhir${req.path}`;

    const response = await axios.request({
      method: req.method,
      url: targetUrl,
      params: req.query,
      data: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
      headers: {
        'Content-Type': 'application/fhir+json',
        Accept: 'application/fhir+json',
      },
      validateStatus: () => true,
    });

    // Forward cache header from proxy service
    const xCache = response.headers['x-cache'];
    if (xCache) res.set('X-Cache', xCache);

    res.status(response.status).json(response.data as unknown);
  } catch (err) {
    if (isAxiosError(err) && !err.response) {
      res.status(503).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'fatal',
            code: 'transient',
            diagnostics: 'FHIR proxy service unavailable',
          },
        ],
      });
      return;
    }
    next(err);
  }
});
