import request from 'supertest';
import app from '../app';

// ── Mocks ──────────────────────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────────

const AUTH_HEADER = { Authorization: 'Bearer pe_test_abc123' };

const validPatient = {
  resourceType: 'Patient',
  name: [{ family: 'Smith' }],
  gender: 'male',
};

const mockValidResult = {
  isValid: true,
  errorCount: 0,
  warningCount: 0,
  errors: [],
  engine: 'structural',
  durationMs: 5,
};

const mockInvalidResult = {
  isValid: false,
  errorCount: 1,
  warningCount: 0,
  errors: [{ severity: 'error', category: 'INVALID_VALUE', path: 'Patient.gender', message: 'Invalid gender.' }],
  engine: 'structural',
  durationMs: 5,
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GET /v1/validate/profiles', () => {
  it('proxies to validator service', async () => {
    mockedAxios.get = jest.fn().mockResolvedValueOnce({
      status: 200,
      data: { profiles: [{ id: 'structural', name: 'Structural' }] },
    });

    const res = await request(app)
      .get('/v1/validate/profiles')
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.profiles)).toBe(true);
  });

  it('returns 502 when validator is unavailable', async () => {
    mockedAxios.get = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await request(app)
      .get('/v1/validate/profiles')
      .set(AUTH_HEADER);

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('VALIDATOR_UNAVAILABLE');
  });
});

describe('POST /v1/validate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when resource is missing', async () => {
    const res = await request(app)
      .post('/v1/validate')
      .set(AUTH_HEADER)
      .send({});

    expect(res.status).toBe(400);
  });

  it('proxies to validator and returns result', async () => {
    mockedAxios.post = jest.fn().mockResolvedValueOnce({
      status: 200,
      data: mockValidResult,
    });

    const res = await request(app)
      .post('/v1/validate')
      .set(AUTH_HEADER)
      .send({ resource: validPatient });

    expect(res.status).toBe(200);
    expect(res.body.isValid).toBe(true);
    expect(res.body.errorCount).toBe(0);
  });

  it('forwards invalid result from validator', async () => {
    mockedAxios.post = jest.fn().mockResolvedValueOnce({
      status: 200,
      data: mockInvalidResult,
    });

    const res = await request(app)
      .post('/v1/validate')
      .set(AUTH_HEADER)
      .send({ resource: validPatient, enrich: true });

    expect(res.status).toBe(200);
    expect(res.body.isValid).toBe(false);
    expect(res.body.errorCount).toBe(1);
  });

  it('returns 502 when validator service is down', async () => {
    mockedAxios.post = jest.fn().mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(app)
      .post('/v1/validate')
      .set(AUTH_HEADER)
      .send({ resource: validPatient });

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('VALIDATOR_UNAVAILABLE');
  });

  it('returns cached result for FREE tier duplicate', async () => {
    const { prisma } = jest.requireMock('@pe/db') as {
      prisma: { validationLog: { findFirst: jest.Mock; create: jest.Mock } };
    };
    prisma.validationLog.findFirst.mockResolvedValueOnce({
      isValid: true,
      errorCount: 0,
      warningCount: 0,
      errors: [],
      profile: null,
      durationMs: 3,
    });

    // Downgrade to FREE tier for this test
    const { lookupAndVerifyKey } = jest.requireMock('../services/api-key') as {
      lookupAndVerifyKey: jest.Mock;
    };
    lookupAndVerifyKey.mockResolvedValueOnce({
      id: 'key1',
      key: 'hashed',
      prefix: 'pe_test_',
      tier: 'FREE',
      rateLimit: 1000,
      callCount: 5,
      userId: 'user1',
      projectId: 'proj1',
      revokedAt: null,
      createdAt: new Date(),
      lastUsedAt: null,
      user: { id: 'user1', email: 'test@pe.dev', name: 'Test', plan: 'FREE' },
    });

    const res = await request(app)
      .post('/v1/validate')
      .set(AUTH_HEADER)
      .send({ resource: validPatient });

    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(true);
    expect(res.get('X-Validation-Cache')).toBe('HIT');
  });
});

describe('POST /v1/validate/fix', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when resource is missing', async () => {
    const res = await request(app)
      .post('/v1/validate/fix')
      .set(AUTH_HEADER)
      .send({});

    expect(res.status).toBe(400);
  });

  it('proxies fix request to validator', async () => {
    mockedAxios.post = jest.fn().mockResolvedValueOnce({
      status: 200,
      data: {
        explanation: 'Fixed gender.',
        correctedResource: { ...validPatient, gender: 'unknown' },
        changesApplied: ['Set gender to unknown'],
      },
    });

    const res = await request(app)
      .post('/v1/validate/fix')
      .set(AUTH_HEADER)
      .send({ resource: validPatient });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('explanation');
    expect(res.body).toHaveProperty('correctedResource');
    expect(res.body).toHaveProperty('changesApplied');
  });

  it('returns 502 when validator service is down', async () => {
    mockedAxios.post = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await request(app)
      .post('/v1/validate/fix')
      .set(AUTH_HEADER)
      .send({ resource: validPatient });

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('VALIDATOR_UNAVAILABLE');
  });
});
