import { buildFhirClaim, buildFhirClaimResponse } from './claim-fhir';

// ── buildFhirClaim tests ──────────────────────────────────────────────────────

describe('buildFhirClaim', () => {
  it('resourceType is Claim', () => {
    const claim = buildFhirClaim({ patientRef: 'Patient/123', payerName: 'TestPayer' });
    expect(claim['resourceType']).toBe('Claim');
  });

  it('use is preauthorization', () => {
    const claim = buildFhirClaim({ patientRef: 'Patient/123', payerName: 'TestPayer' });
    expect(claim['use']).toBe('preauthorization');
  });

  it('has patient reference', () => {
    const claim = buildFhirClaim({ patientRef: 'Patient/abc', payerName: 'TestPayer' });
    const patient = claim['patient'] as { reference: string };
    expect(patient.reference).toBe('Patient/abc');
  });

  it('includes diagnosis when icd10 is provided', () => {
    const claim = buildFhirClaim({
      patientRef: 'Patient/123',
      payerName: 'TestPayer',
      icd10: 'C34.10',
    });
    const diagnosis = claim['diagnosis'] as unknown[];
    expect(Array.isArray(diagnosis)).toBe(true);
    expect(diagnosis.length).toBeGreaterThan(0);
    const diag = diagnosis[0] as { diagnosisCodeableConcept: { coding: { code: string }[] } };
    expect(diag.diagnosisCodeableConcept.coding[0]!.code).toBe('C34.10');
  });

  it('does not include diagnosis when icd10 is not provided', () => {
    const claim = buildFhirClaim({ patientRef: 'Patient/123', payerName: 'TestPayer' });
    expect(claim['diagnosis']).toBeUndefined();
  });

  it('includes item when cptCode is provided', () => {
    const claim = buildFhirClaim({
      patientRef: 'Patient/123',
      payerName: 'TestPayer',
      cptCode: '99213',
    });
    const items = claim['item'] as unknown[];
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
    const item = items[0] as { productOrService: { coding: { code: string }[] } };
    expect(item.productOrService.coding[0]!.code).toBe('99213');
  });

  it('uses provided id if given', () => {
    const claim = buildFhirClaim({
      id: 'custom-id-123',
      patientRef: 'Patient/123',
      payerName: 'TestPayer',
    });
    expect(claim['id']).toBe('custom-id-123');
  });

  it('generates a uuid if no id is provided', () => {
    const claim = buildFhirClaim({ patientRef: 'Patient/123', payerName: 'TestPayer' });
    expect(typeof claim['id']).toBe('string');
    expect((claim['id'] as string).length).toBeGreaterThan(0);
  });
});

// ── buildFhirClaimResponse tests ──────────────────────────────────────────────

describe('buildFhirClaimResponse', () => {
  const baseOpts = {
    claimId: 'claim-abc',
    payerName: 'TestPayer',
    outcome: 'complete' as const,
    disposition: 'Prior authorization approved',
  };

  it('resourceType is ClaimResponse', () => {
    const resp = buildFhirClaimResponse(baseOpts);
    expect(resp['resourceType']).toBe('ClaimResponse');
  });

  it('has outcome field', () => {
    const resp = buildFhirClaimResponse(baseOpts);
    expect(resp['outcome']).toBe('complete');
  });

  it('has disposition field', () => {
    const resp = buildFhirClaimResponse(baseOpts);
    expect(resp['disposition']).toBe('Prior authorization approved');
  });

  it('links to claim via request.reference', () => {
    const resp = buildFhirClaimResponse(baseOpts);
    const request = resp['request'] as { reference: string };
    expect(request.reference).toBe('Claim/claim-abc');
  });

  it('includes error with denialCode when provided', () => {
    const resp = buildFhirClaimResponse({
      ...baseOpts,
      outcome: 'error',
      disposition: 'Prior authorization denied',
      denialCode: 'MISSING_DOCS',
      denialDescription: 'Missing documentation',
    });
    const errors = resp['error'] as unknown[];
    expect(Array.isArray(errors)).toBe(true);
    expect(errors.length).toBeGreaterThan(0);
    const err = errors[0] as { code: { coding: { code: string }[] } };
    expect(err.code.coding[0]!.code).toBe('MISSING_DOCS');
  });

  it('does not include error when no denialCode', () => {
    const resp = buildFhirClaimResponse(baseOpts);
    expect(resp['error']).toBeUndefined();
  });

  it('generates a uuid if no id is provided', () => {
    const resp = buildFhirClaimResponse(baseOpts);
    expect(typeof resp['id']).toBe('string');
    expect((resp['id'] as string).length).toBeGreaterThan(0);
  });

  it('uses provided id if given', () => {
    const resp = buildFhirClaimResponse({ ...baseOpts, id: 'resp-custom-id' });
    expect(resp['id']).toBe('resp-custom-id');
  });
});
