import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma, Tier } from '@pe/db';
import { sendWelcomeEmail } from '../services/email';

export const registerRouter: IRouter = Router();

registerRouter.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, name } = req.body as { email?: string; name?: string };

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email is required', code: 'INVALID_EMAIL' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Upsert user by email
    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {},
      create: {
        email: normalizedEmail,
        name: name?.trim() ?? null,
      },
    });

    // Upsert default project
    let project = await prisma.project.findFirst({
      where: { userId: user.id, name: 'Default Project' },
    });

    if (!project) {
      project = await prisma.project.create({
        data: {
          name: 'Default Project',
          userId: user.id,
          fhirVersion: 'R4',
        },
      });
    }

    // Check if user already has an active (non-revoked) key
    const existingKey = await prisma.apiKey.findFirst({
      where: { userId: user.id, revokedAt: null },
    });

    if (existingKey) {
      // Return the prefix only — raw key was already shown once
      res.json({
        alreadyExists: true,
        prefix: existingKey.prefix,
        userId: user.id,
        projectId: project.id,
        message: 'An API key already exists for this email. Check your records for the full key.',
      });
      return;
    }

    // Generate new key: pe_live_ + 40 hex chars
    const rawKey = `pe_live_${crypto.randomBytes(20).toString('hex')}`;
    const displayPrefix = rawKey.slice(0, 14); // "pe_live_abc123"
    const hashedKey = await bcrypt.hash(rawKey, 10);

    await prisma.apiKey.create({
      data: {
        key: hashedKey,
        prefix: displayPrefix,
        tier: Tier.FREE,
        rateLimit: 1000,
        userId: user.id,
        projectId: project.id,
      },
    });

    // Fire-and-forget welcome email
    sendWelcomeEmail(normalizedEmail, displayPrefix).catch((e: Error) => {
      console.error('[register] Failed to send welcome email:', e.message);
    });

    res.status(201).json({
      rawKey,
      prefix: displayPrefix,
      userId: user.id,
      projectId: project.id,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /v1/register/reset ───────────────────────────────────────────────────
// Recovers access by revoking the old key and issuing a new one.
// Email = proof of ownership (sandbox-appropriate for developer platform).

registerRouter.post('/reset', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email is required', code: 'INVALID_EMAIL' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      // Don't reveal whether email exists — just say "if found, a new key was issued"
      res.status(200).json({ message: 'If that email has an account, a new key has been issued. Check your inbox.' });
      return;
    }

    // Revoke all existing active keys
    await prisma.apiKey.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Issue new key
    const rawKey = `pe_live_${crypto.randomBytes(20).toString('hex')}`;
    const displayPrefix = rawKey.slice(0, 14);
    const hashedKey = await bcrypt.hash(rawKey, 10);

    const project = await prisma.project.findFirst({ where: { userId: user.id } });

    await prisma.apiKey.create({
      data: {
        key: hashedKey,
        prefix: displayPrefix,
        tier: Tier.FREE,
        rateLimit: 1000,
        userId: user.id,
        projectId: project!.id,
      },
    });

    res.status(201).json({
      rawKey,
      prefix: displayPrefix,
      reset: true,
    });
  } catch (err) {
    next(err);
  }
});
