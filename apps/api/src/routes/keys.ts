import { Router, type IRouter, type Request, type Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma, Tier } from '@pe/db';

export const keysRouter: IRouter = Router();

// ── POST /v1/keys/rotate ──────────────────────────────────────────────────────
// Revokes the current API key and issues a fresh one (same tier/rateLimit).

keysRouter.post('/rotate', async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return;
  }

  try {
    const existing = await prisma.apiKey.findUnique({
      where: { id: req.auth.apiKeyId },
    });

    if (!existing || existing.revokedAt) {
      res.status(404).json({ error: 'API key not found', code: 'NOT_FOUND' });
      return;
    }

    // Revoke old key
    await prisma.apiKey.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    // Generate replacement
    const rawKey = `pe_live_${crypto.randomBytes(20).toString('hex')}`;
    const displayPrefix = rawKey.slice(0, 14);
    const hashedKey = await bcrypt.hash(rawKey, 10);

    const newKey = await prisma.apiKey.create({
      data: {
        key: hashedKey,
        prefix: displayPrefix,
        tier: existing.tier as Tier,
        rateLimit: existing.rateLimit,
        userId: existing.userId,
        projectId: existing.projectId,
      },
    });

    res.status(201).json({
      rawKey,
      prefix: newKey.prefix,
      id: newKey.id,
      createdAt: newKey.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to rotate key', code: 'INTERNAL_ERROR', details: (err as Error).message });
  }
});
