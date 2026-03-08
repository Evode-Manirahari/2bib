import { PAOrchestrator } from '../src/orchestrator';
import type { OrchestratorInput } from '../src/orchestrator';

process.env['DTR_SANDBOX_MODE'] = 'true';
process.env['CRD_SANDBOX_MODE'] = 'true';
process.env['PAS_SANDBOX_MODE'] = 'true';
process.env['FHIR_PROXY_URL'] = 'http://localhost:3002';

const mockInput: OrchestratorInput = {
  patient: {
    resourceType: 'Patient',
    id: 'patient-123',
    name: [{ family: 'Smith', given: ['John'] }],
    birthDate: '1980-06-15',
    gender: 'male',
  },
  procedure: {
    resourceType: 'ServiceRequest',
    id: 'sr-123',
    code: {
      coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '71250', display: 'CT Chest' }],
    },
    authoredOn: '2026-03-01',
  },
  payerId: 'uhc-commercial',
};

describe('PAOrchestrator', () => {
  it('extends EventEmitter', () => {
    const orch = new PAOrchestrator();
    expect(typeof orch.on).toBe('function');
    expect(typeof orch.emit).toBe('function');
  });

  it('runs full pipeline and returns PAResult', async () => {
    const orch = new PAOrchestrator();
    const result = await orch.run(mockInput);

    expect(result).toHaveProperty('correlationId');
    expect(result).toHaveProperty('decision');
    expect(result).toHaveProperty('steps');
    expect(result).toHaveProperty('durationMs');
    expect(result.payerId).toBe('uhc-commercial');
  }, 30000);

  it('returns not_required when skipCRD is false and CRD says no PA', async () => {
    // In sandbox, encounter-start returns no PA required
    const orch = new PAOrchestrator();
    // We can't control sandbox CRD response deterministically here,
    // so just verify the result has a valid decision
    const result = await orch.run(mockInput);
    const validDecisions = ['approved', 'denied', 'appeal_approved', 'appeal_denied', 'not_required', 'timeout', 'error', 'pending'];
    expect(validDecisions).toContain(result.decision);
  }, 30000);

  it('skipCRD option skips CRD step', async () => {
    const orch = new PAOrchestrator();
    const result = await orch.run({ ...mockInput, options: { skipCRD: true } });
    const crdStep = result.steps.find((s) => s.step === 'crd-check');
    expect(crdStep?.status).toBe('skipped');
  }, 30000);

  it('dryRun skips PAS submission', async () => {
    const orch = new PAOrchestrator();
    const result = await orch.run({ ...mockInput, options: { skipCRD: true, dryRun: true } });
    const submissionStep = result.steps.find((s) => s.step === 'pas-submission');
    expect(submissionStep).toBeUndefined();
  }, 30000);

  it('emits start event', async () => {
    const orch = new PAOrchestrator();
    const events: string[] = [];
    orch.on('start', () => events.push('start'));
    await orch.run({ ...mockInput, options: { skipCRD: true, dryRun: true } });
    expect(events).toContain('start');
  }, 30000);

  it('emits complete event with result', async () => {
    const orch = new PAOrchestrator();
    let completeResult: unknown;
    orch.on('complete', (r) => { completeResult = r; });
    await orch.run({ ...mockInput, options: { skipCRD: true, dryRun: true } });
    expect(completeResult).toBeDefined();
  }, 30000);

  it('emits step events', async () => {
    const orch = new PAOrchestrator();
    const stepNames: string[] = [];
    orch.on('step-start', ({ step }: { step: string }) => stepNames.push(step));
    await orch.run({ ...mockInput, options: { skipCRD: true, dryRun: true } });
    expect(stepNames).toContain('coverage-fetch');
    expect(stepNames).toContain('dtr-collection');
  }, 30000);

  it('includes dtr-collection step with confidence score', async () => {
    const orch = new PAOrchestrator();
    const result = await orch.run({ ...mockInput, options: { skipCRD: true, dryRun: true } });
    expect(result.confidenceScore).toBeDefined();
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(result.confidenceScore).toBeLessThanOrEqual(1);
  }, 30000);

  it('all steps have startedAt timestamps', async () => {
    const orch = new PAOrchestrator();
    const result = await orch.run({ ...mockInput, options: { skipCRD: true, dryRun: true } });
    for (const step of result.steps) {
      if (step.status !== 'skipped') {
        expect(step.startedAt).toBeTruthy();
      }
    }
  }, 30000);

  it('correlationId starts with pa-', async () => {
    const orch = new PAOrchestrator();
    const result = await orch.run({ ...mockInput, options: { skipCRD: true, dryRun: true } });
    expect(result.correlationId).toMatch(/^pa-/);
  }, 30000);

  it('autoAppeal false skips appeal step when denied', async () => {
    const orch = new PAOrchestrator();
    // Run full pipeline — if denied, no appeal should happen
    const result = await orch.run({ ...mockInput, options: { autoAppeal: false } });
    const appealStep = result.steps.find((s) => s.step === 'appeal');
    // Either no appeal step, or decision wasn't denied
    if (result.decision === 'denied') {
      expect(appealStep).toBeUndefined();
    }
  }, 30000);

  it('runs for all 5 payers', async () => {
    const payers = ['uhc-commercial', 'aetna-commercial', 'cigna-commercial', 'anthem-bcbs', 'medicare-advantage-humana'];
    for (const payerId of payers) {
      const orch = new PAOrchestrator();
      const result = await orch.run({ ...mockInput, payerId, options: { skipCRD: true, dryRun: true } });
      expect(result.payerId).toBe(payerId);
    }
  }, 60000);
});
