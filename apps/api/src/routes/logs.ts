import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import { prisma } from '@pe/db';

export const logsRouter: IRouter = Router();

logsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const projectId = req.auth!.projectId;
  const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt((req.query['pageSize'] as string) ?? '20', 10)),
  );
  const skip = (page - 1) * pageSize;

  try {
    const [data, total] = await Promise.all([
      prisma.requestLog.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          method: true,
          path: true,
          statusCode: true,
          durationMs: true,
          payerTarget: true,
          resourceType: true,
          error: true,
          createdAt: true,
        },
      }),
      prisma.requestLog.count({ where: { projectId } }),
    ]);

    res.json({
      data,
      total,
      page,
      pageSize,
      hasMore: skip + data.length < total,
    });
  } catch (err) {
    next(err);
  }
});
