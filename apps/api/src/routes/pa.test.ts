import request from 'supertest';
import app from '../app';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../services/api-key', () => ({
  lookupAndVerifyKey: jest.fn().mockResolvedValue({
    id: 'key1',
    key: 'hashed',
    prefix: 'pe_test_',
    tier: 'STARTER',
    rateLimit: 1000,
    callCount: 5,
    userId: 'user1',
    projectId: 'proj1',
    revokedAt: null,
    createdAt: new Date(),
    lastUsedAt: null,
    user: { id: 'user1', email: 'test@pe.dev', name: 'Test', plan: 'FREE' },
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
    validationLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock('axios');
import axios from 'axios';
const mockedAxios = jest.mocked(axios);

// ── Helpers ───────────────────────────────────────────────────────────────────

const AUTH_HEADER = { Authorization: 'Bearer pe_test_abc123' };

const mockSimulation = {
  id: 'sim-123',
  projectId: 'proj1',
  payerProfile: 'aetna-commercial',
  status: 'APPROVED',
  claim: { resourceType: 'Claim' },
  timeline: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /v1/pa/payers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('proxies to simulator and returns payers', async () => {
    mockedAxios.request = jest.fn().mockResolvedValueOnce({
      status: 200,
      data: { payers: [{ id: 'aetna-commercial', name: 'Aetna Commercial' }] },
    });

    const res = await request(app)
      .get('/v1/pa/payers')
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.payers)).toBe(true);
  });
});

describe('POST /v1/pa/submit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('proxies to simulator with projectId injected', async () => {
    mockedAxios.request = jest.fn().mockResolvedValueOnce({
      status: 201,
      data: mockSimulation,
    });

    const res = await request(app)
      .post('/v1/pa/submit')
      .set(AUTH_HEADER)
      .send({ payerProfile: 'aetna-commercial' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('sim-123');

    // Verify projectId was injected
    const callArgs = (mockedAxios.request as jest.Mock).mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(callArgs.data.projectId).toBe('proj1');
  });

  it('injects projectId from auth into submit body', async () => {
    mockedAxios.request = jest.fn().mockResolvedValueOnce({
      status: 201,
      data: { ...mockSimulation, projectId: 'proj1' },
    });

    await request(app)
      .post('/v1/pa/submit')
      .set(AUTH_HEADER)
      .send({ payerProfile: 'aetna-commercial', patientRef: 'Patient/123' });

    const callArgs = (mockedAxios.request as jest.Mock).mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(callArgs.data.projectId).toBe('proj1');
    expect(callArgs.data.patientRef).toBe('Patient/123');
  });
});

describe('GET /v1/pa/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('proxies to simulator and returns simulation', async () => {
    mockedAxios.request = jest.fn().mockResolvedValueOnce({
      status: 200,
      data: mockSimulation,
    });

    const res = await request(app)
      .get('/v1/pa/sim-123')
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('sim-123');
  });
});

describe('POST /v1/pa/:id/info', () => {
  beforeEach(() => jest.clearAllMocks());

  it('proxies info submission to simulator', async () => {
    mockedAxios.request = jest.fn().mockResolvedValueOnce({
      status: 200,
      data: { ...mockSimulation, status: 'RE_REVIEW' },
    });

    const res = await request(app)
      .post('/v1/pa/sim-123/info')
      .set(AUTH_HEADER)
      .send({ documents: ['doc1.pdf'] });

    expect(res.status).toBe(200);
  });
});

describe('POST /v1/pa/:id/appeal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('proxies appeal submission to simulator', async () => {
    mockedAxios.request = jest.fn().mockResolvedValueOnce({
      status: 200,
      data: { ...mockSimulation, status: 'APPEAL_SUBMITTED' },
    });

    const res = await request(app)
      .post('/v1/pa/sim-123/appeal')
      .set(AUTH_HEADER)
      .send({ reason: 'Medical necessity established' });

    expect(res.status).toBe(200);
  });
});

describe('GET /v1/pa/:id/timeline', () => {
  beforeEach(() => jest.clearAllMocks());

  it('proxies timeline request to simulator', async () => {
    mockedAxios.request = jest.fn().mockResolvedValueOnce({
      status: 200,
      data: {
        id: 'sim-123',
        currentStatus: 'APPROVED',
        timeline: [],
        total: 0,
      },
    });

    const res = await request(app)
      .get('/v1/pa/sim-123/timeline')
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.currentStatus).toBe('APPROVED');
    expect(Array.isArray(res.body.timeline)).toBe(true);
  });
});

describe('Simulator unavailable', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 502 when simulator is down', async () => {
    mockedAxios.request = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await request(app)
      .get('/v1/pa/sim-123')
      .set(AUTH_HEADER);

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('SIMULATOR_UNAVAILABLE');
  });
});
