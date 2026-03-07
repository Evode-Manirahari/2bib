import request from 'supertest';
import app from '../app';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../services/api-key', () => ({
  lookupAndVerifyKey: jest.fn().mockResolvedValue({
    id: 'key-001',
    key: 'hashed',
    prefix: 'pe_test_',
    tier: 'STARTER',
    rateLimit: 1000,
    callCount: 0,
    userId: 'user-001',
    projectId: 'proj-001',
    revokedAt: null,
    createdAt: new Date(),
    lastUsedAt: null,
    user: { id: 'user-001', email: 'test@pe.dev', name: 'Test', plan: 'FREE' },
  }),
  incrementCallCount: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/redis', () => ({
  redis: {
    incr: jest.fn().mockResolvedValue(1),
    expireat: jest.fn().mockResolvedValue(1),
    quit: jest.fn(),
  },
}));

jest.mock('@pe/db', () => ({
  prisma: {
    requestLog: { create: jest.fn().mockResolvedValue({}) },
    validationLog: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
    workflowRun: {
      create: jest.fn().mockResolvedValue({
        id: 'run-001',
        workflowName: 'pa-happy-path',
        status: 'RUNNING',
        createdAt: new Date('2024-01-01'),
      }),
      update: jest.fn().mockResolvedValue({
        id: 'run-001',
        workflowName: 'pa-happy-path',
        status: 'PASSED',
        createdAt: new Date('2024-01-01'),
      }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'run-001',
          workflowName: 'pa-happy-path',
          status: 'PASSED',
          steps: [],
          durationMs: 50,
          createdAt: new Date('2024-01-01'),
        },
      ]),
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue({
        id: 'run-001',
        workflowName: 'pa-happy-path',
        status: 'PASSED',
        steps: [],
        durationMs: 50,
        createdAt: new Date('2024-01-01'),
      }),
    },
  },
}));

jest.mock('../services/workflow-runner', () => ({
  listTemplates: jest.fn().mockReturnValue([
    { name: 'pa-happy-path', description: 'Happy path PA workflow', file: 'pa-happy-path.yaml' },
    { name: 'fhir-validate-bundle', description: 'Validate a FHIR bundle', file: 'fhir-validate-bundle.yaml' },
  ]),
  loadTemplate: jest.fn().mockImplementation((name: string) => {
    if (name === 'nonexistent') throw new Error('not found');
    return {
      name: 'pa-happy-path',
      description: 'Happy path',
      vars: { payerId: 'uhc-commercial' },
      steps: [
        {
          name: 'validate',
          action: 'validate',
          input: { resource: { resourceType: 'Patient' } },
          assert: { isValid: 'true' },
        },
      ],
    };
  }),
  runWorkflow: jest.fn().mockResolvedValue({
    workflowName: 'pa-happy-path',
    status: 'PASSED',
    steps: [
      { name: 'validate', action: 'validate', status: 'pass', durationMs: 42, output: { isValid: true } },
    ],
    durationMs: 50,
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const AUTH = { Authorization: 'Bearer pe_test_abc123' };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /v1/workflows/templates', () => {
  it('returns list of templates', async () => {
    const res = await request(app).get('/v1/workflows/templates').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.templates)).toBe(true);
    expect(res.body.templates).toHaveLength(2);
    expect(res.body.templates[0]).toHaveProperty('name');
    expect(res.body.templates[0]).toHaveProperty('description');
    expect(res.body.templates[0]).toHaveProperty('file');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/v1/workflows/templates');
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/workflows/templates/:name', () => {
  it('returns template by name', async () => {
    const res = await request(app)
      .get('/v1/workflows/templates/pa-happy-path')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.template).toHaveProperty('name');
    expect(res.body.template).toHaveProperty('steps');
  });

  it('returns 404 for unknown template', async () => {
    const res = await request(app)
      .get('/v1/workflows/templates/nonexistent')
      .set(AUTH);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TEMPLATE_NOT_FOUND');
  });
});

describe('POST /v1/workflows/run', () => {
  it('returns 400 when neither templateName nor template provided', async () => {
    const res = await request(app).post('/v1/workflows/run').set(AUTH).send({});
    expect(res.status).toBe(400);
  });

  it('runs a workflow by templateName and returns PASSED', async () => {
    const res = await request(app)
      .post('/v1/workflows/run')
      .set(AUTH)
      .send({ templateName: 'pa-happy-path' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PASSED');
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('steps');
    expect(res.body).toHaveProperty('durationMs');
  });

  it('runs an inline template', async () => {
    const template = {
      name: 'inline-test',
      steps: [{ name: 'validate', action: 'validate', input: { resource: { resourceType: 'Patient' } } }],
    };
    const res = await request(app)
      .post('/v1/workflows/run')
      .set(AUTH)
      .send({ template });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PASSED');
  });

  it('accepts vars override', async () => {
    const res = await request(app)
      .post('/v1/workflows/run')
      .set(AUTH)
      .send({ templateName: 'pa-happy-path', vars: { payerId: 'override-payer' } });

    expect(res.status).toBe(200);
  });

  it('returns 404 when templateName not found', async () => {
    const { loadTemplate } = jest.requireMock('../services/workflow-runner') as {
      loadTemplate: jest.Mock;
    };
    loadTemplate.mockImplementationOnce(() => {
      throw new Error('Workflow template not found: nonexistent');
    });

    const res = await request(app)
      .post('/v1/workflows/run')
      .set(AUTH)
      .send({ templateName: 'nonexistent' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TEMPLATE_NOT_FOUND');
  });

  it('returns 422 when workflow fails assertions', async () => {
    const { runWorkflow } = jest.requireMock('../services/workflow-runner') as {
      runWorkflow: jest.Mock;
    };
    runWorkflow.mockResolvedValueOnce({
      workflowName: 'pa-happy-path',
      status: 'FAILED',
      steps: [
        {
          name: 'validate',
          action: 'validate',
          status: 'fail',
          durationMs: 10,
          error: 'assert.isValid: expected "true", got "false"',
        },
      ],
      durationMs: 15,
    });
    const { prisma } = jest.requireMock('@pe/db') as {
      prisma: { workflowRun: { update: jest.Mock } };
    };
    prisma.workflowRun.update.mockResolvedValueOnce({
      id: 'run-002',
      workflowName: 'pa-happy-path',
      status: 'FAILED',
      createdAt: new Date('2024-01-01'),
    });

    const res = await request(app)
      .post('/v1/workflows/run')
      .set(AUTH)
      .send({ templateName: 'pa-happy-path' });

    expect(res.status).toBe(422);
    expect(res.body.status).toBe('FAILED');
  });
});

describe('GET /v1/workflows', () => {
  it('returns paginated list of workflow runs', async () => {
    const res = await request(app).get('/v1/workflows').set(AUTH);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('hasMore');
  });

  it('accepts pagination params', async () => {
    const res = await request(app).get('/v1/workflows?page=2&pageSize=5').set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(5);
  });
});

describe('GET /v1/workflows/:id', () => {
  it('returns a specific workflow run', async () => {
    const res = await request(app).get('/v1/workflows/run-001').set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('run-001');
    expect(res.body.workflowName).toBe('pa-happy-path');
  });

  it('returns 404 for unknown run id', async () => {
    const { prisma } = jest.requireMock('@pe/db') as {
      prisma: { workflowRun: { findFirst: jest.Mock } };
    };
    prisma.workflowRun.findFirst.mockResolvedValueOnce(null);

    const res = await request(app).get('/v1/workflows/nonexistent-id').set(AUTH);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
