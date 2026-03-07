import { Router, type IRouter, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '@pe/db';
import { listTemplates, loadTemplate, runWorkflow } from '../services/workflow-runner';

export const workflowsRouter: IRouter = Router();

// ── GET /v1/workflows/templates ───────────────────────────────────────────────

workflowsRouter.get('/templates', (_req: Request, res: Response) => {
  const templates = listTemplates();
  res.json({ templates });
});

// ── GET /v1/workflows/templates/:name ─────────────────────────────────────────

workflowsRouter.get('/templates/:name', (req: Request, res: Response) => {
  const { name } = req.params as { name: string };
  try {
    const template = loadTemplate(name);
    res.json({ template });
  } catch {
    res.status(404).json({ error: `Template not found: ${name}`, code: 'TEMPLATE_NOT_FOUND' });
  }
});

// ── POST /v1/workflows/run ────────────────────────────────────────────────────

const RunBodySchema = z.object({
  templateName: z.string().optional(),
  template: z
    .object({
      name: z.string(),
      description: z.string().optional(),
      vars: z.record(z.unknown()).optional(),
      steps: z.array(
        z.object({
          name: z.string(),
          action: z.string(),
          input: z.record(z.unknown()).optional(),
          assert: z.record(z.unknown()).optional(),
        }),
      ),
    })
    .optional(),
  vars: z.record(z.unknown()).optional(),
});

workflowsRouter.post('/run', async (req: Request, res: Response) => {
  const parse = RunBodySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: 'Invalid request body',
      code: 'BAD_REQUEST',
      details: parse.error.flatten(),
    });
    return;
  }

  const { templateName, template: inlineTemplate, vars = {} } = parse.data;

  if (!templateName && !inlineTemplate) {
    res.status(400).json({
      error: 'Provide either "templateName" or "template"',
      code: 'BAD_REQUEST',
    });
    return;
  }

  const projectId = req.auth?.projectId ?? 'sandbox';

  try {
    // Load template
    let template: import('../services/workflow-runner').WorkflowTemplate;
    if (inlineTemplate) {
      template = inlineTemplate as import('../services/workflow-runner').WorkflowTemplate;
    } else {
      try {
        template = loadTemplate(templateName!);
      } catch {
        res.status(404).json({ error: `Template not found: ${templateName}`, code: 'TEMPLATE_NOT_FOUND' });
        return;
      }
    }

    // Persist a RUNNING record immediately
    const dbRecord = await prisma.workflowRun.create({
      data: {
        projectId,
        workflowName: template.name,
        status: 'RUNNING',
        steps: [],
      },
    });

    // Execute workflow
    const result = await runWorkflow(template, vars);

    // Update record with results
    const updated = await prisma.workflowRun.update({
      where: { id: dbRecord.id },
      data: {
        status: result.status,
        steps: result.steps as unknown as object,
        durationMs: result.durationMs,
      },
    });

    res.status(result.status === 'PASSED' ? 200 : 422).json({
      id: updated.id,
      workflowName: updated.workflowName,
      status: updated.status,
      steps: result.steps,
      durationMs: result.durationMs,
      createdAt: updated.createdAt,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Workflow execution failed',
      code: 'INTERNAL_ERROR',
      details: (err as Error).message,
    });
  }
});

// ── GET /v1/workflows ─────────────────────────────────────────────────────────

workflowsRouter.get('/', async (req: Request, res: Response) => {
  const projectId = req.auth?.projectId ?? 'sandbox';
  const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query['pageSize'] ?? '20'), 10)));

  try {
    const [runs, total] = await Promise.all([
      prisma.workflowRun.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.workflowRun.count({ where: { projectId } }),
    ]);

    res.json({
      data: runs,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list workflow runs', code: 'INTERNAL_ERROR' });
  }
});

// ── GET /v1/workflows/:id ─────────────────────────────────────────────────────

workflowsRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const projectId = req.auth?.projectId ?? 'sandbox';

  try {
    const run = await prisma.workflowRun.findFirst({
      where: { id, projectId },
    });

    if (!run) {
      res.status(404).json({ error: 'Workflow run not found', code: 'NOT_FOUND' });
      return;
    }

    res.json(run);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workflow run', code: 'INTERNAL_ERROR' });
  }
});
