import { createClient, PeClient, PeApiError } from './index';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => data,
    status: 200,
  });
}

function mockError(status: number, error: string, code?: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ error, code }),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

// ---- createClient / constructor ----

test('createClient returns a PeClient instance', () => {
  const client = createClient({ apiKey: 'test-key' });
  expect(client).toBeInstanceOf(PeClient);
});

test('PeClient constructor throws without apiKey', () => {
  expect(() => new PeClient({ apiKey: '' })).toThrow('apiKey is required');
});

test('PeClient constructor accepts custom baseUrl and timeout', () => {
  const client = new PeClient({ apiKey: 'key', baseUrl: 'http://custom:9000', timeout: 5000 });
  expect(client).toBeInstanceOf(PeClient);
});

// ---- PeApiError ----

test('PeApiError has correct name, message, status, and code', () => {
  const err = new PeApiError('Not found', 404, 'NOT_FOUND');
  expect(err.name).toBe('PeApiError');
  expect(err.message).toBe('Not found');
  expect(err.status).toBe(404);
  expect(err.code).toBe('NOT_FOUND');
});

test('PeApiError without code has undefined code', () => {
  const err = new PeApiError('Server error', 500);
  expect(err.code).toBeUndefined();
});

// ---- client.me() ----

test('client.me() calls GET /v1/me and returns data', async () => {
  const client = createClient({ apiKey: 'test-key' });
  const fixture = { id: 'key-1', prefix: 'pe_test_', tier: 'STARTER', callCount: 42, rateLimit: 1000, projectId: 'proj-1', createdAt: '2024-01-01' };
  mockOk(fixture);
  const result = await client.me();
  expect(result.tier).toBe('STARTER');
  expect(result.callCount).toBe(42);
  const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('http://localhost:3001/v1/me');
  expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer test-key');
});

// ---- client.logs() ----

test('client.logs() with no params calls GET /v1/logs', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ data: [], total: 0, page: 1, pageSize: 20, hasMore: false });
  const result = await client.logs();
  expect(result.total).toBe(0);
  const [url] = mockFetch.mock.calls[0] as [string];
  expect(url).toBe('http://localhost:3001/v1/logs');
});

test('client.logs() with params appends query string', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ data: [], total: 5, page: 2, pageSize: 10, hasMore: false });
  await client.logs({ page: 2, pageSize: 10, method: 'GET', minStatus: 200, maxStatus: 299 });
  const [url] = mockFetch.mock.calls[0] as [string];
  expect(url).toContain('page=2');
  expect(url).toContain('pageSize=10');
  expect(url).toContain('method=GET');
  expect(url).toContain('minStatus=200');
  expect(url).toContain('maxStatus=299');
});

// ---- fhir.search() ----

test('client.fhir.search() with no params calls GET /v1/fhir/:type', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ resourceType: 'Bundle', type: 'searchset', total: 0, entry: [] });
  const result = await client.fhir.search('Patient');
  expect(result.resourceType).toBe('Bundle');
  const [url] = mockFetch.mock.calls[0] as [string];
  expect(url).toBe('http://localhost:3001/v1/fhir/Patient');
});

test('client.fhir.search() with params appends query string', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ resourceType: 'Bundle', type: 'searchset', total: 1 });
  await client.fhir.search('Observation', { _count: 10, _page: 1 });
  const [url] = mockFetch.mock.calls[0] as [string];
  expect(url).toContain('_count=10');
  expect(url).toContain('_page=1');
});

// ---- fhir.read() ----

test('client.fhir.read() calls GET /v1/fhir/:type/:id', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ resourceType: 'Patient', id: 'patient-1' });
  const result = await client.fhir.read('Patient', 'patient-1');
  expect(result['id']).toBe('patient-1');
  const [url] = mockFetch.mock.calls[0] as [string];
  expect(url).toBe('http://localhost:3001/v1/fhir/Patient/patient-1');
});

// ---- fhir.create() ----

test('client.fhir.create() calls POST /v1/fhir/:type with resource body', async () => {
  const client = createClient({ apiKey: 'test-key' });
  const resource = { resourceType: 'Patient', name: [{ family: 'Smith' }] };
  mockOk({ ...resource, id: 'new-id' });
  const result = await client.fhir.create(resource);
  expect(result['id']).toBe('new-id');
  const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('http://localhost:3001/v1/fhir/Patient');
  expect(opts.method).toBe('POST');
});

// ---- fhir.update() ----

test('client.fhir.update() calls PUT /v1/fhir/:type/:id', async () => {
  const client = createClient({ apiKey: 'test-key' });
  const resource = { resourceType: 'Patient', id: 'patient-1', name: [{ family: 'Jones' }] };
  mockOk(resource);
  await client.fhir.update(resource);
  const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('http://localhost:3001/v1/fhir/Patient/patient-1');
  expect(opts.method).toBe('PUT');
});

// ---- fhir.transaction() ----

test('client.fhir.transaction() calls POST /v1/fhir/Bundle', async () => {
  const client = createClient({ apiKey: 'test-key' });
  const bundle = { resourceType: 'Bundle', type: 'transaction', entry: [] };
  mockOk({ resourceType: 'Bundle', type: 'transaction-response' });
  await client.fhir.transaction(bundle);
  const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('http://localhost:3001/v1/fhir/Bundle');
  expect(opts.method).toBe('POST');
});

// ---- validate.validate() ----

test('client.validate.validate() posts resource and returns ValidationResult', async () => {
  const client = createClient({ apiKey: 'test-key' });
  const fixture = { isValid: true, errorCount: 0, warningCount: 0, errors: [], durationMs: 50 };
  mockOk(fixture);
  const resource = { resourceType: 'Patient', id: 'p1' };
  const result = await client.validate.validate(resource);
  expect(result.isValid).toBe(true);
  const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('http://localhost:3001/v1/validate');
  expect(opts.method).toBe('POST');
});

test('client.validate.validate() with profile, enrich, and mode options', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ isValid: false, errorCount: 2, warningCount: 1, errors: [], durationMs: 100 });
  const resource = { resourceType: 'Observation' };
  await client.validate.validate(resource, { profile: 'us-core', enrich: true, mode: 'hl7' });
  const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
  const body = JSON.parse(opts.body as string);
  expect(body.profile).toBe('us-core');
  expect(body.enrich).toBe(true);
  expect(body.mode).toBe('hl7');
});

// ---- validate.fix() ----

test('client.validate.fix() without errors sends resource only', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ explanation: 'Fixed missing fields', correctedResource: {}, changesApplied: ['added id'] });
  const resource = { resourceType: 'Patient' };
  const result = await client.validate.fix(resource);
  expect(result.explanation).toBe('Fixed missing fields');
  const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('http://localhost:3001/v1/validate/fix');
  const body = JSON.parse(opts.body as string);
  expect(body.errors).toBeUndefined();
});

test('client.validate.fix() with errors includes errors in body', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ explanation: 'Fixed', correctedResource: {}, changesApplied: [] });
  const errors = [{ path: 'id', message: 'missing' }];
  await client.validate.fix({ resourceType: 'Patient' }, errors);
  const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
  const body = JSON.parse(opts.body as string);
  expect(body.errors).toEqual(errors);
});

// ---- validate.profiles() ----

test('client.validate.profiles() calls GET /v1/validate/profiles', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ profiles: [{ id: 'us-core', name: 'US Core', description: 'US Core profiles', requiresJava: false }] });
  const result = await client.validate.profiles();
  expect(result.profiles).toHaveLength(1);
  const [url] = mockFetch.mock.calls[0] as [string];
  expect(url).toBe('http://localhost:3001/v1/validate/profiles');
});

// ---- pa.payers() ----

test('client.pa.payers() calls GET /v1/pa/payers', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ payers: [{ id: 'aetna', name: 'Aetna', autoApproveRate: 0.7, appealSuccessRate: 0.3, requiresPeerToPeer: false, denialReasons: [] }] });
  const result = await client.pa.payers();
  expect(result.payers[0].name).toBe('Aetna');
  const [url] = mockFetch.mock.calls[0] as [string];
  expect(url).toBe('http://localhost:3001/v1/pa/payers');
});

// ---- pa.submit() ----

test('client.pa.submit() posts to /v1/pa/submit with options', async () => {
  const client = createClient({ apiKey: 'test-key' });
  const fixture = { id: 'pa-1', projectId: 'proj-1', payerProfile: 'aetna', currentStatus: 'SUBMITTED', timeline: [], createdAt: '2024-01-01', updatedAt: '2024-01-01' };
  mockOk(fixture);
  const result = await client.pa.submit({ payerId: 'aetna', icd10: 'M54.5', cptCode: '27447', scenario: 'approval' });
  expect(result.id).toBe('pa-1');
  const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('http://localhost:3001/v1/pa/submit');
  const body = JSON.parse(opts.body as string);
  expect(body.payerId).toBe('aetna');
  expect(body.icd10).toBe('M54.5');
});

// ---- pa.get() ----

test('client.pa.get() calls GET /v1/pa/:id', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ id: 'pa-1', currentStatus: 'APPROVED', timeline: [] });
  const result = await client.pa.get('pa-1');
  expect(result.id).toBe('pa-1');
  const [url] = mockFetch.mock.calls[0] as [string];
  expect(url).toBe('http://localhost:3001/v1/pa/pa-1');
});

// ---- pa.submitInfo() ----

test('client.pa.submitInfo() posts additional info to /v1/pa/:id/info', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ id: 'pa-1', currentStatus: 'PENDED_FOR_INFO', timeline: [] });
  await client.pa.submitInfo('pa-1', 'Here is the extra info');
  const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('http://localhost:3001/v1/pa/pa-1/info');
  const body = JSON.parse(opts.body as string);
  expect(body.additionalInfo).toBe('Here is the extra info');
});

// ---- pa.appeal() ----

test('client.pa.appeal() posts reason and optional scenario', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ id: 'pa-1', currentStatus: 'APPEAL_SUBMITTED', timeline: [] });
  await client.pa.appeal('pa-1', 'Medically necessary', 'appeal_approved');
  const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('http://localhost:3001/v1/pa/pa-1/appeal');
  const body = JSON.parse(opts.body as string);
  expect(body.reason).toBe('Medically necessary');
  expect(body.scenario).toBe('appeal_approved');
});

test('client.pa.appeal() without scenario omits scenario from body', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ id: 'pa-1', currentStatus: 'APPEAL_SUBMITTED', timeline: [] });
  await client.pa.appeal('pa-1', 'Necessary');
  const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
  const body = JSON.parse(opts.body as string);
  expect(body.scenario).toBeUndefined();
});

// ---- pa.timeline() ----

test('client.pa.timeline() calls GET /v1/pa/:id/timeline', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ id: 'pa-1', currentStatus: 'APPROVED', timeline: [{ status: 'SUBMITTED', timestamp: '2024-01-01' }], total: 1 });
  const result = await client.pa.timeline('pa-1');
  expect(result.total).toBe(1);
  const [url] = mockFetch.mock.calls[0] as [string];
  expect(url).toBe('http://localhost:3001/v1/pa/pa-1/timeline');
});

// ---- workflows.templates() ----

test('client.workflows.templates() calls GET /v1/workflows/templates', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ templates: [{ name: 'basic', description: 'Basic workflow', file: 'basic.yaml' }] });
  const result = await client.workflows.templates();
  expect(result.templates[0].name).toBe('basic');
  const [url] = mockFetch.mock.calls[0] as [string];
  expect(url).toBe('http://localhost:3001/v1/workflows/templates');
});

// ---- workflows.template(name) ----

test('client.workflows.template() calls GET /v1/workflows/templates/:name', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ template: { name: 'basic', steps: [] } });
  const result = await client.workflows.template('basic');
  expect(result.template.name).toBe('basic');
  const [url] = mockFetch.mock.calls[0] as [string];
  expect(url).toBe('http://localhost:3001/v1/workflows/templates/basic');
});

// ---- workflows.run() ----

test('client.workflows.run() with templateName', async () => {
  const client = createClient({ apiKey: 'test-key' });
  const fixture = { id: 'run-1', projectId: 'proj-1', workflowName: 'basic', status: 'PASSED', steps: [], createdAt: '2024-01-01' };
  mockOk(fixture);
  const result = await client.workflows.run({ templateName: 'basic' });
  expect(result.id).toBe('run-1');
  const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('http://localhost:3001/v1/workflows/run');
  const body = JSON.parse(opts.body as string);
  expect(body.templateName).toBe('basic');
});

test('client.workflows.run() with inline template', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ id: 'run-2', projectId: 'proj-1', workflowName: 'inline', status: 'RUNNING', steps: [], createdAt: '2024-01-01' });
  const template = { name: 'inline', steps: [{ name: 'step1', action: 'fhir.read' }] };
  await client.workflows.run({ template, vars: { patientId: 'p1' } });
  const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
  const body = JSON.parse(opts.body as string);
  expect(body.template.name).toBe('inline');
  expect(body.vars).toEqual({ patientId: 'p1' });
});

// ---- workflows.list() ----

test('client.workflows.list() with no params calls GET /v1/workflows', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ data: [], total: 0, page: 1, pageSize: 20, hasMore: false });
  const result = await client.workflows.list();
  expect(result.total).toBe(0);
  const [url] = mockFetch.mock.calls[0] as [string];
  expect(url).toBe('http://localhost:3001/v1/workflows');
});

test('client.workflows.list() with params appends query string', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ data: [], total: 0, page: 2, pageSize: 5, hasMore: false });
  await client.workflows.list({ page: 2, pageSize: 5 });
  const [url] = mockFetch.mock.calls[0] as [string];
  expect(url).toContain('page=2');
  expect(url).toContain('pageSize=5');
});

// ---- workflows.get() ----

test('client.workflows.get() calls GET /v1/workflows/:id', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockOk({ id: 'run-1', projectId: 'proj-1', workflowName: 'basic', status: 'PASSED', steps: [], createdAt: '2024-01-01' });
  const result = await client.workflows.get('run-1');
  expect(result.id).toBe('run-1');
  const [url] = mockFetch.mock.calls[0] as [string];
  expect(url).toBe('http://localhost:3001/v1/workflows/run-1');
});

// ---- Error handling ----

test('non-ok response throws PeApiError with correct status and message', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockError(404, 'Resource not found', 'NOT_FOUND');
  await expect(client.me()).rejects.toMatchObject({
    name: 'PeApiError',
    status: 404,
    message: 'Resource not found',
    code: 'NOT_FOUND',
  });
});

test('non-ok response without error field uses HTTP status as message', async () => {
  const client = createClient({ apiKey: 'test-key' });
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 500,
    json: async () => ({}),
  });
  await expect(client.me()).rejects.toMatchObject({
    name: 'PeApiError',
    status: 500,
  });
});

test('401 unauthorized throws PeApiError with status 401', async () => {
  const client = createClient({ apiKey: 'bad-key' });
  mockError(401, 'Unauthorized', 'UNAUTHORIZED');
  await expect(client.me()).rejects.toMatchObject({
    status: 401,
    code: 'UNAUTHORIZED',
  });
});

// ---- Timeout handling ----

test('request times out and aborts when timeout exceeded', async () => {
  const client = new PeClient({ apiKey: 'test-key', timeout: 50 });
  mockFetch.mockImplementationOnce((_url: string, opts: RequestInit) => {
    return new Promise((_resolve, reject) => {
      const signal = opts.signal as AbortSignal;
      signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted', 'AbortError')));
    });
  });
  await expect(client.me()).rejects.toThrow();
});

// ---- Authorization header ----

test('all requests include the Authorization header with Bearer token', async () => {
  const client = createClient({ apiKey: 'my-secret-key' });
  mockOk({});
  await client.me();
  const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
  expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer my-secret-key');
});

// ---- Custom baseUrl ----

test('custom baseUrl is used for requests', async () => {
  const client = new PeClient({ apiKey: 'key', baseUrl: 'https://api.pe.dev' });
  mockOk({ id: 'k1' });
  await client.me();
  const [url] = mockFetch.mock.calls[0] as [string];
  expect(url).toBe('https://api.pe.dev/v1/me');
});
