import { Router, type IRouter, type Request, type Response } from 'express';
import axios from 'axios';
import { PAOrchestrator } from '@pe/pa-agent';

export const paRouter: IRouter = Router();

const PA_URL = process.env['PA_SIMULATOR_URL'] ?? 'http://localhost:3003';

// ── Helper: get project id header ─────────────────────────────────────────────

function getProjectHeader(req: Request): Record<string, string> {
  const projectId = req.auth?.projectId ?? 'sandbox';
  return { 'X-Pe-Project-Id': projectId };
}

// ── GET /payers ───────────────────────────────────────────────────────────────

paRouter.get('/payers', async (req: Request, res: Response) => {
  try {
    const response = await axios.request({
      method: 'GET',
      url: `${PA_URL}/pa/payers`,
      headers: getProjectHeader(req),
      validateStatus: () => true,
      timeout: 30000,
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    res.status(502).json({
      error: 'PA simulator unavailable',
      code: 'SIMULATOR_UNAVAILABLE',
      details: (err as Error).message,
    });
  }
});

// ── POST /submit ──────────────────────────────────────────────────────────────

paRouter.post('/submit', async (req: Request, res: Response) => {
  const body = { ...req.body, projectId: req.auth?.projectId ?? 'sandbox' };
  try {
    const response = await axios.request({
      method: 'POST',
      url: `${PA_URL}/pa/submit`,
      data: body,
      headers: { ...getProjectHeader(req), 'Content-Type': 'application/json' },
      validateStatus: () => true,
      timeout: 30000,
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    res.status(502).json({
      error: 'PA simulator unavailable',
      code: 'SIMULATOR_UNAVAILABLE',
      details: (err as Error).message,
    });
  }
});

// ── GET /:id ──────────────────────────────────────────────────────────────────

paRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  try {
    const response = await axios.request({
      method: 'GET',
      url: `${PA_URL}/pa/${id}`,
      headers: getProjectHeader(req),
      validateStatus: () => true,
      timeout: 30000,
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    res.status(502).json({
      error: 'PA simulator unavailable',
      code: 'SIMULATOR_UNAVAILABLE',
      details: (err as Error).message,
    });
  }
});

// ── POST /:id/info ────────────────────────────────────────────────────────────

paRouter.post('/:id/info', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  try {
    const response = await axios.request({
      method: 'POST',
      url: `${PA_URL}/pa/${id}/info`,
      data: req.body,
      headers: { ...getProjectHeader(req), 'Content-Type': 'application/json' },
      validateStatus: () => true,
      timeout: 30000,
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    res.status(502).json({
      error: 'PA simulator unavailable',
      code: 'SIMULATOR_UNAVAILABLE',
      details: (err as Error).message,
    });
  }
});

// ── POST /:id/appeal ──────────────────────────────────────────────────────────

paRouter.post('/:id/appeal', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  try {
    const response = await axios.request({
      method: 'POST',
      url: `${PA_URL}/pa/${id}/appeal`,
      data: req.body,
      headers: { ...getProjectHeader(req), 'Content-Type': 'application/json' },
      validateStatus: () => true,
      timeout: 30000,
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    res.status(502).json({
      error: 'PA simulator unavailable',
      code: 'SIMULATOR_UNAVAILABLE',
      details: (err as Error).message,
    });
  }
});

// ── POST /run — PA Orchestrator Agent ────────────────────────────────────────

paRouter.post('/run', async (req: Request, res: Response) => {
  const { patient, procedure, payerId, options } = req.body as {
    patient?: unknown;
    procedure?: unknown;
    payerId?: string;
    options?: unknown;
  };

  if (!patient || !procedure || !payerId) {
    return res.status(400).json({ error: 'patient, procedure, and payerId are required' });
  }

  try {
    const orchestrator = new PAOrchestrator();
    const result = await orchestrator.run({ patient, procedure, payerId, options } as Parameters<PAOrchestrator['run']>[0]);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /:id/timeline ─────────────────────────────────────────────────────────

paRouter.get('/:id/timeline', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  try {
    const response = await axios.request({
      method: 'GET',
      url: `${PA_URL}/pa/${id}/timeline`,
      headers: getProjectHeader(req),
      validateStatus: () => true,
      timeout: 30000,
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    res.status(502).json({
      error: 'PA simulator unavailable',
      code: 'SIMULATOR_UNAVAILABLE',
      details: (err as Error).message,
    });
  }
});
