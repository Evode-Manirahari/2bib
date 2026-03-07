import express from 'express';
import request from 'supertest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRequest = jest.fn();
jest.mock('../services/hapi-client', () => ({
  getHapiClient: () => ({ request: mockRequest }),
  _resetHapiClient: jest.fn(),
}));

const mockGetCached = jest.fn<Promise<string | null>, [string]>();
const mockSetCached = jest.fn<Promise<void>, [string, string, number]>();
const mockInvalidate = jest.fn<Promise<void>, [string]>();

jest.mock('../services/cache', () => ({
  getCached: (...args: [string]) => mockGetCached(...args),
  setCached: (...args: [string, string, number]) => mockSetCached(...args),
  invalidateByPattern: (...args: [string]) => mockInvalidate(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

import { fhirRouter } from './fhir';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/fhir', fhirRouter);
  return app;
}

const fakePatient = {
  resourceType: 'Patient',
  id: 'pat-1',
  name: [{ family: 'Smith' }],
};

const fakeBundle = {
  resourceType: 'Bundle',
  type: 'searchset',
  total: 1,
  entry: [{ resource: fakePatient }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSetCached.mockResolvedValue(undefined);
  mockInvalidate.mockResolvedValue(undefined);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /fhir/:resourceType', () => {
  it('cache miss → calls HAPI → X-Cache: MISS → caches result', async () => {
    mockGetCached.mockResolvedValue(null);
    mockRequest.mockResolvedValue({ status: 200, data: fakeBundle });

    const res = await request(buildApp()).get('/fhir/Patient');

    expect(res.status).toBe(200);
    expect(res.headers['x-cache']).toBe('MISS');
    expect(res.body.resourceType).toBe('Bundle');
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockSetCached).toHaveBeenCalledTimes(1);
  });

  it('cache hit → returns cached data → X-Cache: HIT → HAPI not called', async () => {
    mockGetCached.mockResolvedValue(JSON.stringify(fakeBundle));

    const res = await request(buildApp()).get('/fhir/Patient');

    expect(res.status).toBe(200);
    expect(res.headers['x-cache']).toBe('HIT');
    expect(res.body.resourceType).toBe('Bundle');
    expect(mockRequest).not.toHaveBeenCalled();
    expect(mockSetCached).not.toHaveBeenCalled();
  });

  it('includes query params in HAPI request', async () => {
    mockGetCached.mockResolvedValue(null);
    mockRequest.mockResolvedValue({ status: 200, data: fakeBundle });

    await request(buildApp()).get('/fhir/Patient?family=Smith&_count=10');

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ family: 'Smith', _count: '10' }),
      }),
    );
  });

  it('forwards HAPI 404 OperationOutcome as-is', async () => {
    mockGetCached.mockResolvedValue(null);
    const outcome = {
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'not-found', diagnostics: 'Not found' }],
    };
    mockRequest.mockResolvedValue({ status: 404, data: outcome });

    const res = await request(buildApp()).get('/fhir/Patient/unknown-id');

    expect(res.status).toBe(404);
    expect(res.body.resourceType).toBe('OperationOutcome');
    expect(mockSetCached).not.toHaveBeenCalled();
  });
});

describe('GET /fhir/:resourceType/:id', () => {
  it('reads a single resource with caching', async () => {
    mockGetCached.mockResolvedValue(null);
    mockRequest.mockResolvedValue({ status: 200, data: fakePatient });

    const res = await request(buildApp()).get('/fhir/Patient/pat-1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('pat-1');
    expect(mockSetCached).toHaveBeenCalledTimes(1);
  });
});

describe('POST /fhir/:resourceType (create)', () => {
  it('forwards body to HAPI, returns 201, invalidates resourceType cache, X-Cache: BYPASS', async () => {
    mockRequest.mockResolvedValue({ status: 201, data: { ...fakePatient, id: 'new-id' } });

    const res = await request(buildApp())
      .post('/fhir/Patient')
      .send(fakePatient);

    expect(res.status).toBe(201);
    expect(res.headers['x-cache']).toBe('BYPASS');
    expect(mockGetCached).not.toHaveBeenCalled();
    expect(mockInvalidate).toHaveBeenCalledWith('fhir:GET:/fhir/Patient*');
  });
});

describe('PUT /fhir/:resourceType/:id (update)', () => {
  it('forwards update and invalidates cache', async () => {
    mockRequest.mockResolvedValue({ status: 200, data: fakePatient });

    await request(buildApp())
      .put('/fhir/Patient/pat-1')
      .send(fakePatient);

    expect(mockInvalidate).toHaveBeenCalledWith('fhir:GET:/fhir/Patient*');
  });
});

describe('DELETE /fhir/:resourceType/:id', () => {
  it('deletes resource and invalidates cache', async () => {
    mockRequest.mockResolvedValue({ status: 204, data: {} });

    const res = await request(buildApp()).delete('/fhir/Patient/pat-1');

    expect(res.status).toBe(204);
    expect(mockInvalidate).toHaveBeenCalledWith('fhir:GET:/fhir/Patient*');
  });
});

describe('HAPI unreachable', () => {
  it('returns 503 FHIR OperationOutcome when HAPI connection fails', async () => {
    mockGetCached.mockResolvedValue(null);
    const networkError = new Error('connect ECONNREFUSED') as Error & {
      isAxiosError: boolean;
      response: undefined;
    };
    networkError.isAxiosError = true;
    networkError.response = undefined;
    mockRequest.mockRejectedValue(networkError);

    const res = await request(buildApp()).get('/fhir/Patient');

    expect(res.status).toBe(503);
    expect(res.body.resourceType).toBe('OperationOutcome');
    expect(res.body.issue[0].code).toBe('transient');
  });
});
