import type { Request, Response, NextFunction } from 'express';
import { getRedis } from '../services/redis';

function todayKey(apiKeyId: string): string {
  const d = new Date();
  const date = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `ratelimit:${apiKeyId}:${date}`;
}

function secondsUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}

export async function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.auth) {
    next();
    return;
  }

  const { apiKeyId, rateLimit } = req.auth;
  const key = todayKey(apiKeyId);
  const ttl = secondsUntilMidnightUTC();

  try {
    const redis = getRedis();
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, ttl);
    }

    const remaining = Math.max(0, rateLimit - current);
    res.setHeader('X-RateLimit-Limit', String(rateLimit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(ttl));

    if (current > rateLimit) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMITED',
        retryAfter: ttl,
      });
      return;
    }
  } catch (err) {
    // Redis unavailable — fail open
    console.warn('[rate-limit] Redis error, allowing request:', (err as Error).message);
  }

  next();
}
