import {
  buildReference,
  parseReference,
  buildMeta,
  buildCoding,
  buildCodeableConcept,
  extractResourceType,
  isBundle,
  isOperationOutcome,
  extractBundleEntries,
  buildOperationOutcome,
  hasErrors,
  buildFhirSearchUrl,
  FHIR_SYSTEMS,
} from './index';

describe('buildReference', () => {
  it('builds a FHIR reference string', () => {
    expect(buildReference('Patient', '123')).toEqual({ reference: 'Patient/123' });
  });

  it('includes display when provided', () => {
    expect(buildReference('Patient', '123', 'John Doe')).toEqual({
      reference: 'Patient/123',
      display: 'John Doe',
    });
  });
});

describe('parseReference', () => {
  it('parses a valid reference', () => {
    expect(parseReference('Patient/123')).toEqual({ resourceType: 'Patient', id: '123' });
  });

  it('returns null for invalid reference', () => {
    expect(parseReference('invalid')).toBeNull();
    expect(parseReference('')).toBeNull();
  });
});

describe('buildMeta', () => {
  it('wraps single profile in array', () => {
    expect(buildMeta('http://example.com/profile')).toEqual({
      profile: ['http://example.com/profile'],
    });
  });

  it('accepts array of profiles', () => {
    expect(buildMeta(['a', 'b'])).toEqual({ profile: ['a', 'b'] });
  });
});

describe('buildCoding', () => {
  it('builds a coding with system and code', () => {
    const coding = buildCoding(FHIR_SYSTEMS.ICD10, 'E11.9');
    expect(coding.system).toBe(FHIR_SYSTEMS.ICD10);
    expect(coding.code).toBe('E11.9');
  });

  it('includes display when provided', () => {
    const coding = buildCoding(FHIR_SYSTEMS.ICD10, 'E11.9', 'Type 2 diabetes');
    expect(coding.display).toBe('Type 2 diabetes');
  });
});

describe('buildCodeableConcept', () => {
  it('builds a CodeableConcept with one coding', () => {
    const cc = buildCodeableConcept(FHIR_SYSTEMS.SNOMED, '44054006', 'Diabetes mellitus type 2');
    expect(cc.coding).toHaveLength(1);
    expect(cc.text).toBe('Diabetes mellitus type 2');
  });
});

describe('extractResourceType', () => {
  it('extracts resourceType from a FHIR resource', () => {
    expect(extractResourceType({ resourceType: 'Patient', id: '123' })).toBe('Patient');
  });

  it('returns undefined for non-objects', () => {
    expect(extractResourceType(null)).toBeUndefined();
    expect(extractResourceType('string')).toBeUndefined();
    expect(extractResourceType(42)).toBeUndefined();
  });
});

describe('isBundle / isOperationOutcome', () => {
  it('identifies a Bundle', () => {
    expect(isBundle({ resourceType: 'Bundle', type: 'searchset' })).toBe(true);
    expect(isBundle({ resourceType: 'Patient' })).toBe(false);
  });

  it('identifies an OperationOutcome', () => {
    expect(
      isOperationOutcome({ resourceType: 'OperationOutcome', issue: [] }),
    ).toBe(true);
  });
});

describe('extractBundleEntries', () => {
  const bundle = {
    resourceType: 'Bundle' as const,
    type: 'searchset' as const,
    entry: [
      { resource: { resourceType: 'Patient', id: '1' } },
      { resource: { resourceType: 'Patient', id: '2' } },
      { resource: { resourceType: 'Condition', id: '3' } },
    ],
  };

  it('extracts all entries when no filter', () => {
    expect(extractBundleEntries(bundle)).toHaveLength(3);
  });

  it('filters by resourceType', () => {
    expect(extractBundleEntries(bundle, 'Patient')).toHaveLength(2);
    expect(extractBundleEntries(bundle, 'Condition')).toHaveLength(1);
  });
});

describe('buildOperationOutcome', () => {
  it('builds a valid OperationOutcome', () => {
    const oo = buildOperationOutcome('error', 'required', 'Missing field');
    expect(oo.resourceType).toBe('OperationOutcome');
    expect(oo.issue[0].severity).toBe('error');
    expect(oo.issue[0].diagnostics).toBe('Missing field');
  });
});

describe('hasErrors', () => {
  it('returns true when outcome has error issues', () => {
    const oo = buildOperationOutcome('error', 'required', 'Missing field');
    expect(hasErrors(oo)).toBe(true);
  });

  it('returns false for warnings only', () => {
    const oo = buildOperationOutcome('warning', 'informational', 'Advisory');
    expect(hasErrors(oo)).toBe(false);
  });
});

describe('buildFhirSearchUrl', () => {
  it('builds a FHIR search URL with query params', () => {
    const url = buildFhirSearchUrl('http://localhost:8080/fhir', 'Patient', {
      family: 'Smith',
      _count: '10',
    });
    expect(url).toContain('/fhir/Patient');
    expect(url).toContain('family=Smith');
    expect(url).toContain('_count=10');
  });

  it('handles array params', () => {
    const url = buildFhirSearchUrl('http://localhost:8080/fhir', 'Condition', {
      code: ['E11.9', 'E11.65'],
    });
    expect(url).toContain('code=E11.9');
    expect(url).toContain('code=E11.65');
  });
});
