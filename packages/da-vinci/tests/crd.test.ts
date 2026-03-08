import { CdsHooksClient } from '../src/crd';
import { getPayerEndpoint, listPayers } from '../src/payer-registry';

// Force sandbox mode
process.env['CRD_SANDBOX_MODE'] = 'true';

describe('Payer Registry', () => {
  it('lists 5 payers', () => {
    const payers = listPayers();
    expect(payers).toHaveLength(5);
  });

  it('returns UHC endpoint', () => {
    const payer = getPayerEndpoint('uhc-commercial');
    expect(payer.name).toBe('UnitedHealthcare Commercial');
    expect(payer.crdUrl).toContain('uhc.com');
  });

  it('throws for unknown payer', () => {
    expect(() => getPayerEndpoint('unknown-payer')).toThrow('Unknown payer');
  });

  it('each payer has required fields', () => {
    for (const payer of listPayers()) {
      expect(payer.payerId).toBeDefined();
      expect(payer.crdUrl).toBeDefined();
      expect(payer.tokenUrl).toBeDefined();
      expect(payer.supportedHooks.length).toBeGreaterThan(0);
    }
  });
});

describe('CdsHooksClient', () => {
  let client: CdsHooksClient;

  beforeEach(() => {
    client = new CdsHooksClient('uhc-commercial');
  });

  it('returns access token in sandbox mode', async () => {
    const token = await client.getAccessToken();
    expect(token).toContain('sandbox-token');
  });

  it('caches token on second call', async () => {
    const t1 = await client.getAccessToken();
    const t2 = await client.getAccessToken();
    expect(t1).toBe(t2);
  });

  it('builds prefetch bundle', () => {
    const patient = { resourceType: 'Patient', id: 'p1' };
    const prefetch = client.buildPrefetch({ patient });
    expect(prefetch['patient']).toEqual(patient);
  });

  it('builds hook request with hookInstance', () => {
    const req = client.buildHookRequest('order-sign', { patientId: 'p1' });
    expect(req.hook).toBe('order-sign');
    expect(req.hookInstance).toBeTruthy();
    expect(req.context.patientId).toBe('p1');
  });

  it('parses pa-required from card extension', () => {
    const response = {
      cards: [
        {
          summary: 'Prior Authorization Required',
          indicator: 'critical' as const,
          source: { label: 'uhc' },
          extension: {
            'pa-required': true,
            'documentation-needed': ['Clinical notes', 'Diagnosis docs'],
          },
        },
      ],
    };
    const result = client.parseResponse(response);
    expect(result.paRequired).toBe(true);
    expect(result.documentationNeeded).toHaveLength(2);
  });

  it('parses pa-not-required', () => {
    const response = {
      cards: [
        {
          summary: 'No Prior Authorization Required',
          indicator: 'info' as const,
          source: { label: 'uhc' },
          extension: { 'pa-required': false },
        },
      ],
    };
    const result = client.parseResponse(response);
    expect(result.paRequired).toBe(false);
  });

  it('calls order-sign hook and returns CrdResult', async () => {
    const result = await client.callHook('order-sign', { patientId: 'p1' });
    expect(result).toHaveProperty('paRequired');
    expect(result).toHaveProperty('documentationNeeded');
    expect(result).toHaveProperty('alternatives');
    expect(result).toHaveProperty('rawCards');
  });

  it('callHook for encounter-start returns no PA required in sandbox', async () => {
    const result = await client.callHook('encounter-start', { patientId: 'p1' });
    expect(result.paRequired).toBe(false);
  });

  it('parses alternatives from card extension', () => {
    const response = {
      cards: [
        {
          summary: 'Consider alternatives',
          indicator: 'info' as const,
          source: { label: 'uhc' },
          extension: {
            'pa-required': false,
            alternatives: [{ system: 'http://snomed.info/sct', code: '12345', display: 'Alt procedure' }],
          },
        },
      ],
    };
    const result = client.parseResponse(response);
    expect(result.alternatives).toHaveLength(1);
    expect(result.alternatives[0]?.display).toBe('Alt procedure');
  });

  it('creates client for each payer', () => {
    const payers = ['uhc-commercial', 'aetna-commercial', 'cigna-commercial', 'anthem-bcbs', 'medicare-advantage-humana'];
    for (const payerId of payers) {
      const c = new CdsHooksClient(payerId);
      expect(c).toBeDefined();
    }
  });

  it('returns sandbox documentation-needed items', async () => {
    const result = await client.callHook('order-dispatch', { patientId: 'p1' });
    expect(result.documentationNeeded.length).toBeGreaterThan(0);
  });
});
