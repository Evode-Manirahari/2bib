import 'dotenv/config';
import express, { type Application } from 'express';
import cors from 'cors';
import { PAOrchestrator } from './orchestrator';

const app: Application = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env['PORT'] ?? 3005;

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'pa-agent', timestamp: new Date().toISOString() });
});

// ── POST /run ─────────────────────────────────────────────────────────────────

app.post('/run', async (req, res) => {
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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`PA Agent running on :${PORT}`);
  });
}

export { PAOrchestrator };
export { app };
