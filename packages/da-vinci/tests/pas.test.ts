import { PARequestBuilder, X12Bridge, PASubmitter, PAPoller, AppealBuilder } from '../src/pas';
import type { PASInput, PASBundle } from '../src/pas';
import type { FhirResource } from '@pe/types';

process.env['PAS_SANDBOX_MODE'] = 'true';

const mockInput: PASInput = {
  patient: {
    resourceType: 'Patient',
    id: 'patient-1',
    name: [{ family: 'Smith', given: ['John'] }],
    birthDate: '1980-06-15',
    gender: 'male',
  },
  coverage: {
    resourceType: 'Coverage',
    id: 'coverage-1',
    subscriberId: 'UHC12345',
    payor: [{ reference: 'Organization/uhc', display: 'UnitedHealthcare' }],
  },
  procedure: {
    resourceType: 'ServiceRequest',
    id: 'sr-1',
    code: {
      coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '71250', display: 'CT thorax' }],
    },
    authoredOn: '2026-03-01',
    requester: { reference: 'Practitioner/doc-1', display: 'Dr. House' },
  },
  payerId: 'uhc-commercial',
  correlationId: 'test-corr-123',
};

describe('PARequestBuilder', () => {
  let builder: PARequestBuilder;
  let bundle: PASBundle;

  beforeEach(() => {
    builder = new PARequestBuilder();
    bundle = builder.build(mockInput);
  });

  it('builds a Bundle with type collection', () => {
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('collection');
  });

  it('uses provided correlationId as bundle ID', () => {
    expect(bundle.id).toBe('test-corr-123');
  });

  it('includes Claim resource', () => {
    const claim = bundle.entry.find((e) => e.resource.resourceType === 'Claim');
    expect(claim).toBeDefined();
    expect((claim?.resource as unknown as Record<string, unknown>)?.['use']).toBe('preauthorization');
  });

  it('includes Patient resource', () => {
    const patient = bundle.entry.find((e) => e.resource.resourceType === 'Patient');
    expect(patient).toBeDefined();
  });

  it('includes Coverage resource', () => {
    const coverage = bundle.entry.find((e) => e.resource.resourceType === 'Coverage');
    expect(coverage).toBeDefined();
  });

  it('includes ServiceRequest resource', () => {
    const sr = bundle.entry.find((e) => e.resource.resourceType === 'ServiceRequest');
    expect(sr).toBeDefined();
  });

  it('adds pe:correlation-id extension to Claim', () => {
    const claim = bundle.entry.find((e) => e.resource.resourceType === 'Claim');
    const extensions = (claim?.resource as unknown as Record<string, unknown>)?.['extension'] as Array<{ url: string; valueString?: string }>;
    const corrExt = extensions?.find((e) => e.url === 'pe:correlation-id');
    expect(corrExt?.valueString).toBe('test-corr-123');
  });

  it('includes documentation when provided', () => {
    const docInput = { ...mockInput, documentation: { resourceType: 'QuestionnaireResponse', status: 'completed', item: [] } as import('../src/dtr').QuestionnaireResponse };
    const docBundle = builder.build(docInput);
    const qr = docBundle.entry.find((e) => e.resource.resourceType === 'QuestionnaireResponse');
    expect(qr).toBeDefined();
  });

  it('generates unique correlationId when not provided', () => {
    const b1 = builder.build({ ...mockInput, correlationId: undefined });
    const b2 = builder.build({ ...mockInput, correlationId: undefined });
    expect(b1.id).not.toBe(b2.id);
  });
});

describe('X12Bridge', () => {
  let bridge: X12Bridge;
  let bundle: PASBundle;

  beforeEach(() => {
    bridge = new X12Bridge();
    bundle = new PARequestBuilder().build(mockInput);
  });

  it('produces valid X12 transaction', () => {
    const tx = bridge.translate(bundle);
    expect(tx.interchangeControlNumber).toBeTruthy();
    expect(tx.segments.length).toBeGreaterThan(10);
    expect(tx.raw).toContain('ISA');
  });

  it('contains ST segment with 278', () => {
    const tx = bridge.translate(bundle);
    const st = tx.segments.find((s) => s.id === 'ST');
    expect(st?.elements[0]).toBe('278');
  });

  it('contains patient name in NM1 segment', () => {
    const tx = bridge.translate(bundle);
    const nm1s = tx.segments.filter((s) => s.id === 'NM1');
    const patientNm1 = nm1s.find((s) => s.elements[0] === 'QC');
    expect(patientNm1?.elements[2]).toBe('Smith');
  });

  it('contains CPT code in SV1 segment', () => {
    const tx = bridge.translate(bundle);
    const sv1 = tx.segments.find((s) => s.id === 'SV1');
    expect(sv1?.elements[0]).toContain('71250');
  });

  it('ends with IEA segment', () => {
    const tx = bridge.translate(bundle);
    const last = tx.segments[tx.segments.length - 1];
    expect(last?.id).toBe('IEA');
  });
});

describe('PASubmitter', () => {
  it('submits and returns approved or pending in sandbox', async () => {
    const submitter = new PASubmitter('uhc-commercial');
    const bundle = new PARequestBuilder().build(mockInput);
    const result = await submitter.submit(bundle);

    expect(['approved', 'pending']).toContain(result.decision);
    expect(result.correlationId).toBe('test-corr-123');
  });

  it('returns correlationId from bundle ID', async () => {
    const submitter = new PASubmitter('aetna-commercial');
    const bundle = new PARequestBuilder().build({ ...mockInput, correlationId: 'my-corr' });
    const result = await submitter.submit(bundle);
    expect(result.correlationId).toBe('my-corr');
  });
});

describe('PAPoller', () => {
  it('polls and returns a decision in sandbox mode (fast)', async () => {
    const poller = new PAPoller('uhc-commercial', 10, 5000);
    const decision = await poller.poll('test-corr-123');
    expect(['approved', 'denied']).toContain(decision);
  });

  it('calls onStatus callback', async () => {
    const poller = new PAPoller('uhc-commercial', 10, 5000);
    const statuses: string[] = [];
    await poller.poll('test-corr-123', undefined, (d) => statuses.push(d));
    expect(statuses.length).toBeGreaterThan(0);
  });
});

describe('AppealBuilder', () => {
  it('builds appeal bundle from denial', async () => {
    const appealBuilder = new AppealBuilder();
    const bundle = new PARequestBuilder().build(mockInput);
    const denialResponse: FhirResource = {
      resourceType: 'ClaimResponse',
      id: 'denial-1',
    };

    const appealBundle = await appealBuilder.build(bundle, denialResponse, ['Patient has documented medical necessity']);
    expect(appealBundle.resourceType).toBe('Bundle');
    expect(appealBundle.type).toBe('collection');
    expect(appealBundle.id).toContain('appeal-');
  });

  it('appeal claim has pe:appeal extension', async () => {
    const appealBuilder = new AppealBuilder();
    const bundle = new PARequestBuilder().build(mockInput);
    const appealBundle = await appealBuilder.build(bundle, { resourceType: 'ClaimResponse' });

    const appealClaim = appealBundle.entry?.find((e) => e.resource?.resourceType === 'Claim');
    const extensions = (appealClaim?.resource as unknown as Record<string, unknown>)?.['extension'] as Array<{ url: string; valueBoolean?: boolean }>;
    const appealExt = extensions?.find((e) => e.url === 'pe:appeal');
    expect(appealExt?.valueBoolean).toBe(true);
  });
});
