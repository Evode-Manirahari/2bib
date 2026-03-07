import { Router, type IRouter, type Request, type Response } from 'express';

export const meRouter: IRouter = Router();

meRouter.get('/', (req: Request, res: Response) => {
  const auth = req.auth!;
  res.json({
    apiKeyId: auth.apiKeyId,
    userId: auth.userId,
    projectId: auth.projectId,
    tier: auth.tier,
    rateLimit: auth.rateLimit,
  });
});
