import * as fs from 'fs';
import * as yaml from 'js-yaml';
import axios from 'axios';
import { interpolate, listTemplates, loadTemplate, runWorkflow } from './workflow-runner';
import type { WorkflowTemplate } from './workflow-runner';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
}));

jest.mock('js-yaml');

jest.mock('axios');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedYaml = yaml as jest.Mocked<typeof yaml>;
const mockedAxios = axios as jest.Mocked<typeof axios>;

// ── Sample template ───────────────────────────────────────────────────────────

const sampleTemplate: WorkflowTemplate = {
  name: 'test-workflow',
  description: 'A test workflow',
  vars: { payerId: 'uhc-commercial' },
  steps: [
    {
      name: 'validate-patient',
      action: 'validate',
      input: { resource: { resourceType: 'Patient', id: 'p1' } },
      assert: { isValid: 'true' },
    },
    {
      name: 'submit-pa',
      action: 'pa-submit',
      input: { payerId: '{{ vars.payerId }}', patientRef: 'Patient/p1' },
      assert: { currentStatus: 'SUBMITTED' },
    },
  ],
};

// ── interpolate() ─────────────────────────────────────────────────────────────

describe('interpolate()', () => {
  const vars = { payerId: 'uhc-commercial', patientRef: 'Patient/abc' };
  const stepOutputs = { 'submit-pa': { output: { id: 'sim-001', currentStatus: 'SUBMITTED' } } };

  it('resolves {{ vars.x }} references', () => {
    expect(interpolate('{{ vars.payerId }}', vars, {})).toBe('uhc-commercial');
  });

  it('resolves {{ steps.name.output.field }} references', () => {
    expect(interpolate('{{ steps.submit-pa.output.id }}', vars, stepOutputs)).toBe('sim-001');
  });

  it('resolves nested object values', () => {
    const result = interpolate(
      { id: '{{ steps.submit-pa.output.id }}', payer: '{{ vars.payerId }}' },
      vars,
      stepOutputs,
    ) as Record<string, string>;
    expect(result['id']).toBe('sim-001');
    expect(result['payer']).toBe('uhc-commercial');
  });

  it('resolves array items', () => {
    const result = interpolate(['{{ vars.payerId }}', 'static'], vars, {}) as string[];
    expect(result[0]).toBe('uhc-commercial');
    expect(result[1]).toBe('static');
  });

  it('passes through non-string primitives unchanged', () => {
    expect(interpolate(42, vars, {})).toBe(42);
    expect(interpolate(true, vars, {})).toBe(true);
    expect(interpolate(null, vars, {})).toBe(null);
  });

  it('returns empty string for unknown references', () => {
    expect(interpolate('{{ vars.unknown }}', vars, {})).toBe('');
  });
});

// ── listTemplates() ───────────────────────────────────────────────────────────

describe('listTemplates()', () => {
  beforeEach(() => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readdirSync.mockReturnValue(['pa-happy-path.yaml', 'other.yaml'] as unknown as ReturnType<typeof fs.readdirSync>);
    mockedFs.readFileSync.mockReturnValue('name: pa-happy-path\ndescription: Test\nsteps: []' as unknown as ReturnType<typeof fs.readFileSync>);
    mockedYaml.load.mockReturnValue({ name: 'pa-happy-path', description: 'Test', steps: [] });
  });

  it('returns a list of templates', () => {
    const templates = listTemplates();
    expect(templates).toHaveLength(2);
    expect(templates[0]).toHaveProperty('name');
    expect(templates[0]).toHaveProperty('description');
    expect(templates[0]).toHaveProperty('file');
  });

  it('returns empty array when directory does not exist', () => {
    mockedFs.existsSync.mockReturnValue(false);
    expect(listTemplates()).toEqual([]);
  });

  it('filters non-yaml files', () => {
    mockedFs.readdirSync.mockReturnValue(['template.yaml', 'readme.txt', 'template.yml'] as unknown as ReturnType<typeof fs.readdirSync>);
    const templates = listTemplates();
    expect(templates).toHaveLength(2);
  });
});

// ── loadTemplate() ────────────────────────────────────────────────────────────

describe('loadTemplate()', () => {
  beforeEach(() => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('yaml content' as unknown as ReturnType<typeof fs.readFileSync>);
    mockedYaml.load.mockReturnValue(sampleTemplate);
  });

  it('loads template by file name', () => {
    const tpl = loadTemplate('pa-happy-path.yaml');
    expect(tpl.name).toBe('test-workflow');
  });

  it('loads template by name without extension', () => {
    const tpl = loadTemplate('pa-happy-path');
    expect(tpl.name).toBe('test-workflow');
  });

  it('throws when template not found', () => {
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.readdirSync.mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);
    expect(() => loadTemplate('nonexistent')).toThrow('not found');
  });
});

// ── runWorkflow() ─────────────────────────────────────────────────────────────

describe('runWorkflow()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns PASSED when all steps pass assertions', async () => {
    mockedAxios.post = jest.fn()
      .mockResolvedValueOnce({ data: { isValid: true, errorCount: 0 } })  // validate
      .mockResolvedValueOnce({ data: { id: 'sim-001', currentStatus: 'SUBMITTED' } }); // pa-submit

    const result = await runWorkflow(sampleTemplate);
    expect(result.status).toBe('PASSED');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]!.status).toBe('pass');
    expect(result.steps[1]!.status).toBe('pass');
  });

  it('returns FAILED when an assertion fails', async () => {
    mockedAxios.post = jest.fn()
      .mockResolvedValueOnce({ data: { isValid: false, errorCount: 3 } }); // validate fails assertion

    const result = await runWorkflow(sampleTemplate);
    expect(result.status).toBe('FAILED');
    expect(result.steps[0]!.status).toBe('fail');
    expect(result.steps[0]!.error).toContain('assert.isValid');
    // Subsequent steps should be skipped
    expect(result.steps[1]!.status).toBe('skip');
  });

  it('returns ERROR when a step throws', async () => {
    mockedAxios.post = jest.fn().mockRejectedValueOnce(new Error('connection refused'));

    const result = await runWorkflow(sampleTemplate);
    expect(result.status).toBe('ERROR');
    expect(result.steps[0]!.status).toBe('error');
    expect(result.steps[0]!.error).toContain('connection refused');
  });

  it('applies override vars over template vars', async () => {
    const capturedArgs: unknown[] = [];
    mockedAxios.post = jest.fn().mockImplementation((_url, data) => {
      capturedArgs.push(data);
      return Promise.resolve({ data: { isValid: true, errorCount: 0, currentStatus: 'SUBMITTED' } });
    });

    const templateWithVarStep: WorkflowTemplate = {
      name: 'var-test',
      vars: { payerId: 'default-payer' },
      steps: [
        {
          name: 'submit',
          action: 'pa-submit',
          input: { payerId: '{{ vars.payerId }}' },
        },
      ],
    };

    await runWorkflow(templateWithVarStep, { payerId: 'override-payer' });
    expect((capturedArgs[0] as Record<string, string>)['payerId']).toBe('override-payer');
  });

  it('resolves step output references', async () => {
    const capturedUrls: string[] = [];
    mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: { id: 'sim-123', currentStatus: 'SUBMITTED' } });
    mockedAxios.get = jest.fn().mockImplementation((url: string) => {
      capturedUrls.push(url);
      return Promise.resolve({ data: { currentStatus: 'APPROVED' } });
    });

    const tpl: WorkflowTemplate = {
      name: 'ref-test',
      steps: [
        { name: 'submit', action: 'pa-submit', input: { payerId: 'uhc' } },
        { name: 'check', action: 'pa-status', input: { id: '{{ steps.submit.output.id }}' } },
      ],
    };

    await runWorkflow(tpl);
    expect(capturedUrls[0]).toContain('sim-123');
  });

  it('includes durationMs in result', async () => {
    mockedAxios.post = jest.fn().mockResolvedValue({ data: { isValid: true } });
    const result = await runWorkflow({ name: 'quick', steps: [] });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('handles workflow with no steps', async () => {
    const result = await runWorkflow({ name: 'empty', steps: [] });
    expect(result.status).toBe('PASSED');
    expect(result.steps).toHaveLength(0);
  });

  it('handles pa-appeal action', async () => {
    mockedAxios.post = jest.fn().mockResolvedValue({ data: { currentStatus: 'APPEAL_SUBMITTED' } });

    const tpl: WorkflowTemplate = {
      name: 'appeal-test',
      steps: [{ name: 'appeal', action: 'pa-appeal', input: { id: 'sim-001', reason: 'More docs' } }],
    };

    const result = await runWorkflow(tpl);
    expect(result.steps[0]!.status).toBe('pass');
  });

  it('handles pa-info action', async () => {
    mockedAxios.post = jest.fn().mockResolvedValue({ data: { currentStatus: 'RE_REVIEW' } });

    const tpl: WorkflowTemplate = {
      name: 'info-test',
      steps: [{ name: 'info', action: 'pa-info', input: { id: 'sim-001' } }],
    };

    const result = await runWorkflow(tpl);
    expect(result.steps[0]!.status).toBe('pass');
  });

  it('errors on unknown action', async () => {
    const tpl: WorkflowTemplate = {
      name: 'bad-action',
      steps: [{ name: 'x', action: 'fhir-search', input: {} }],
    };
    // fhir-search is declared in union but has no executor — falls to default throw
    // Actually let's test an entirely unknown action via type cast
    const badTpl = {
      name: 'bad',
      steps: [{ name: 'x', action: 'unknown-action' as 'validate', input: {} }],
    } as WorkflowTemplate;

    const result = await runWorkflow(badTpl);
    expect(result.status).toBe('ERROR');
    expect(result.steps[0]!.status).toBe('error');
  });
});
