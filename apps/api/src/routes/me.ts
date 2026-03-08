import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '@pe/db';

export const meRouter: IRouter = Router();

meRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const auth = req.auth!;

    const apiKey = await prisma.apiKey.findUnique({
      where: { id: auth.apiKeyId },
      select: {
        id: true,
        prefix: true,
        tier: true,
        callCount: true,
        rateLimit: true,
        projectId: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });

    if (!apiKey) {
      res.status(404).json({ error: 'API key not found', code: 'NOT_FOUND' });
      return;
    }

    res.json(apiKey);
  } catch (err) {
    next(err);
  }
});
