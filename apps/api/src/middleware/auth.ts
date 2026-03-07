import type { Request, Response, NextFunction } from 'express';
import { lookupAndVerifyKey, incrementCallCount } from '../services/api-key';

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Missing or invalid Authorization header',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) {
    res.status(401).json({ error: 'Empty API key', code: 'UNAUTHORIZED' });
    return;
  }

  try {
    const apiKey = await lookupAndVerifyKey(rawKey);
    if (!apiKey) {
      res.status(401).json({ error: 'Invalid API key', code: 'UNAUTHORIZED' });
      return;
    }

    req.auth = {
      apiKeyId: apiKey.id,
      userId: apiKey.userId,
      projectId: apiKey.projectId,
      tier: apiKey.tier as 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE',
      rateLimit: apiKey.rateLimit,
    };

    // Fire-and-forget lifetime call counter
    incrementCallCount(apiKey.id).catch((err: Error) => {
      console.error('[auth] incrementCallCount failed:', err.message);
    });

    next();
  } catch (err) {
    next(err);
  }
}
