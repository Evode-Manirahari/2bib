import { Router, type IRouter, type Request, type Response } from 'express';
import axios from 'axios';
import { createHash } from 'crypto';
import { prisma } from '@pe/db';
import type { ValidationResult, FixResult } from '@pe/types';

export const validateRouter: IRouter = Router();

const VALIDATOR_URL = process.env['VALIDATOR_URL'] ?? 'http://localhost:3010';

// ── Helpers ───────────────────────────────────────────────────────────────────

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

async function persistValidationLog(
  projectId: string,
  resourceType: string,
  result: ValidationResult,
  inputHash: string,
): Promise<void> {
  try {
    await prisma.validationLog.create({
      data: {
        projectId,
        resourceType,
        profile: result.profile ?? null,
        isValid: result.isValid,
        errorCount: result.errorCount,
        warningCount: result.warningCount,
        errors: result.errors as unknown as object,
        inputHash,
        durationMs: result.durationMs,
      },
    });
  } catch (err) {
    // Fire-and-forget — never fail the request due to logging
    console.error('[validate] Failed to persist ValidationLog:', (err as Error).message);
  }
}

// ── GET /v1/validate/profiles ─────────────────────────────────────────────────

validateRouter.get('/profiles', async (req: Request, res: Response) => {
  try {
    const response = await axios.get<unknown>(`${VALIDATOR_URL}/validate/profiles`, {
      timeout: 10_000,
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    res.status(502).json({
      error: 'Validator service unavailable',
      code: 'VALIDATOR_UNAVAILABLE',
      details: (err as Error).message,
    });
  }
});

// ── POST /v1/validate ─────────────────────────────────────────────────────────

validateRouter.post('/', async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  if (!body['resource'] || typeof body['resource'] !== 'object') {
    res.status(400).json({ error: 'Request body must include a "resource" object', code: 'BAD_REQUEST' });
    return;
  }

  const resource = body['resource'] as Record<string, unknown>;
  const resourceType = (resource['resourceType'] as string | undefined) ?? 'Unknown';
  const inputHash = sha256(JSON.stringify(resource));

  // Check cache: if we've validated this exact resource before, return cached result
  // (Only for FREE tier to save Claude costs — STARTER+ always re-enriches)
  const tier = req.auth?.tier;
  const projectId = req.auth?.projectId ?? '';

  try {
    if (tier === 'FREE') {
      const cached = await prisma.validationLog.findFirst({
        where: { inputHash, projectId },
        orderBy: { createdAt: 'desc' },
      });
      if (cached) {
        res.set('X-Validation-Cache', 'HIT');
        res.json({
          isValid: cached.isValid,
          errorCount: cached.errorCount,
          warningCount: cached.warningCount,
          errors: cached.errors,
          profile: cached.profile ?? undefined,
          durationMs: cached.durationMs,
          cached: true,
        });
        return;
      }
    }

    // Forward to validator service
    const response = await axios.post<ValidationResult>(
      `${VALIDATOR_URL}/validate`,
      body,
      { timeout: 120_000, validateStatus: () => true },
    );

    if (response.status !== 200) {
      res.status(response.status).json(response.data);
      return;
    }

    const result = response.data;

    // Persist in background
    void persistValidationLog(projectId, resourceType, result, inputHash);

    res.set('X-Validation-Cache', 'MISS');
    res.json(result);
  } catch (err) {
    res.status(502).json({
      error: 'Validator service unavailable',
      code: 'VALIDATOR_UNAVAILABLE',
      details: (err as Error).message,
    });
  }
});

// ── POST /v1/validate/fix ─────────────────────────────────────────────────────

validateRouter.post('/fix', async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  if (!body['resource'] || typeof body['resource'] !== 'object') {
    res.status(400).json({ error: 'Request body must include a "resource" object', code: 'BAD_REQUEST' });
    return;
  }

  try {
    const response = await axios.post<FixResult>(
      `${VALIDATOR_URL}/validate/fix`,
      body,
      { timeout: 120_000, validateStatus: () => true },
    );
    res.status(response.status).json(response.data);
  } catch (err) {
    res.status(502).json({
      error: 'Validator service unavailable',
      code: 'VALIDATOR_UNAVAILABLE',
      details: (err as Error).message,
    });
  }
});
