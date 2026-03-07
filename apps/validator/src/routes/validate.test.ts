import request from 'supertest';
import app from '../app';

// ── Mock services ─────────────────────────────────────────────────────────────

jest.mock('../services/hl7-validator', () => ({
  isJavaAvailable: jest.fn().mockReturnValue(false),
  ensureJar: jest.fn().mockResolvedValue(false),
  validateWithHl7: jest.fn().mockImplementation(async (resource: unknown, profile?: string) => {
    // Delegate to actual structural validator for realism
    const { validateStructural } = jest.requireActual('../services/structural') as {
      validateStructural: (r: unknown, p?: string) => Record<string, unknown>;
    };
    return { ...validateStructural(resource, profile), engine: 'structural' };
  }),
}));

jest.mock('../services/ai-enricher', () => ({
  enrichErrors: jest.fn().mockImplementation(async (_resource: unknown, errors: unknown[]) => errors),
  autoFix: jest.fn().mockResolvedValue({
    explanation: 'Changed gender to "unknown".',
    correctedResource: { resourceType: 'Patient', id: 'p1', gender: 'unknown' },
    changesApplied: ['Set Patient.gender to "unknown"'],
  }),
}));

// ── Sample data ───────────────────────────────────────────────────────────────

const validPatient = {
  resourceType: 'Patient',
  id: 'p1',
  name: [{ family: 'Smith', given: ['John'] }],
  gender: 'male',
  birthDate: '1990-06-15',
};

const invalidPatient = {
  resourceType: 'Patient',
  gender: 'not-valid',
  birthDate: '06/15/1990',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('validator');
  });
});

describe('GET /validate/profiles', () => {
  it('returns profile list', async () => {
    const res = await request(app).get('/validate/profiles');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.profiles)).toBe(true);
    expect(res.body.profiles.length).toBeGreaterThan(0);
    expect(res.body.profiles[0]).toHaveProperty('id');
    expect(res.body.profiles[0]).toHaveProperty('name');
    expect(res.body.profiles[0]).toHaveProperty('description');
  });
});

describe('POST /validate', () => {
  it('returns 400 when body is missing resource', async () => {
    const res = await request(app).post('/validate').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when resource is not an object', async () => {
    const res = await request(app).post('/validate').send({ resource: 'not-an-object' });
    expect(res.status).toBe(400);
  });

  it('validates a valid Patient successfully', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ resource: validPatient });

    expect(res.status).toBe(200);
    expect(res.body.isValid).toBe(true);
    expect(res.body.errorCount).toBe(0);
    expect(res.body.engine).toBe('structural');
    expect(res.body).toHaveProperty('durationMs');
  });

  it('returns errors for an invalid Patient', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ resource: invalidPatient });

    expect(res.status).toBe(200);
    expect(res.body.isValid).toBe(false);
    expect(res.body.errorCount).toBeGreaterThan(0);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors[0]).toHaveProperty('severity');
    expect(res.body.errors[0]).toHaveProperty('category');
    expect(res.body.errors[0]).toHaveProperty('path');
    expect(res.body.errors[0]).toHaveProperty('message');
  });

  it('returns errors with suggestion when enrich=true', async () => {
    // enrichErrors mock just passes through — still check response shape
    const res = await request(app)
      .post('/validate')
      .send({ resource: invalidPatient, enrich: true });

    expect(res.status).toBe(200);
    expect(res.body.isValid).toBe(false);
  });

  it('uses structural mode when mode=structural', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ resource: validPatient, mode: 'structural' });

    expect(res.status).toBe(200);
    expect(res.body.engine).toBe('structural');
  });

  it('returns 400 for invalid mode value', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ resource: validPatient, mode: 'invalid-mode' });

    expect(res.status).toBe(400);
  });

  it('validates a Bundle correctly', async () => {
    const bundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [{ resource: validPatient, request: { method: 'POST', url: 'Patient' } }],
    };
    const res = await request(app).post('/validate').send({ resource: bundle });
    expect(res.status).toBe(200);
    expect(res.body.isValid).toBe(true);
  });

  it('includes profile in response when provided', async () => {
    const profile = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient';
    const res = await request(app)
      .post('/validate')
      .send({ resource: validPatient, profile });

    expect(res.status).toBe(200);
    // profile mismatch warning expected since validPatient has no meta.profile
    expect(res.body.warningCount).toBeGreaterThanOrEqual(1);
  });
});

describe('POST /validate/fix', () => {
  it('returns 400 when resource is missing', async () => {
    const res = await request(app).post('/validate/fix').send({});
    expect(res.status).toBe(400);
  });

  it('returns a corrected resource when errors are provided', async () => {
    const errors = [
      { severity: 'error', category: 'INVALID_VALUE', path: 'Patient.gender', message: 'Invalid gender.' },
    ];
    const res = await request(app)
      .post('/validate/fix')
      .send({ resource: invalidPatient, errors });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('explanation');
    expect(res.body).toHaveProperty('correctedResource');
    expect(res.body).toHaveProperty('changesApplied');
  });

  it('validates first when no errors provided', async () => {
    const res = await request(app)
      .post('/validate/fix')
      .send({ resource: invalidPatient });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('correctedResource');
  });

  it('returns isValid=true message for already-valid resource', async () => {
    // mock validateWithHl7 to return isValid=true for this test
    const { validateWithHl7 } = jest.requireMock('../services/hl7-validator') as {
      validateWithHl7: jest.Mock;
    };
    validateWithHl7.mockResolvedValueOnce({
      isValid: true,
      errorCount: 0,
      warningCount: 0,
      errors: [],
      engine: 'structural',
      durationMs: 1,
    });

    const res = await request(app)
      .post('/validate/fix')
      .send({ resource: validPatient });

    expect(res.status).toBe(200);
    expect(res.body.explanation).toContain('already valid');
    expect(res.body.changesApplied).toEqual([]);
  });
});

describe('404', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/unknown-route');
    expect(res.status).toBe(404);
  });
});
