import {
  pick,
  randomDate,
  buildPatient,
  buildPractitioner,
  buildCondition,
  buildCoverage,
  buildMedicationRequest,
  buildTransactionBundle,
  generatePatientBundle,
  CONDITIONS,
  MEDICATIONS,
} from './generators';

describe('pick()', () => {
  it('returns an element from the array', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = pick(arr);
    expect(arr).toContain(result);
  });
});

describe('randomDate()', () => {
  it('returns a YYYY-MM-DD string', () => {
    const date = randomDate(30, 80);
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('produces a year within the expected range', () => {
    const now = new Date().getFullYear();
    const date = randomDate(30, 80);
    const year = parseInt(date.split('-')[0]!, 10);
    expect(year).toBeGreaterThanOrEqual(now - 80);
    expect(year).toBeLessThanOrEqual(now - 30);
  });
});

describe('buildPatient()', () => {
  const patient = buildPatient({
    id: 'p1',
    firstName: 'Jane',
    lastName: 'Doe',
    gender: 'female',
    birthDate: '1970-01-01',
    mrn: 'MRN123456',
    city: 'Boston',
    state: 'MA',
    zip: '02101',
  });

  it('sets resourceType to Patient', () => {
    expect(patient.resourceType).toBe('Patient');
  });

  it('has the correct id', () => {
    expect(patient.id).toBe('p1');
  });

  it('has MRN identifier', () => {
    expect(patient.identifier[0]!.system).toBe('urn:pe:sandbox:mrn');
    expect(patient.identifier[0]!.value).toBe('MRN123456');
  });

  it('sets gender and birthDate', () => {
    expect(patient.gender).toBe('female');
    expect(patient.birthDate).toBe('1970-01-01');
  });

  it('includes address with correct city/state', () => {
    expect(patient.address[0]!.city).toBe('Boston');
    expect(patient.address[0]!.state).toBe('MA');
    expect(patient.address[0]!.postalCode).toBe('02101');
    expect(patient.address[0]!.country).toBe('US');
  });
});

describe('buildPractitioner()', () => {
  const prac = buildPractitioner({ id: 'pr1', name: 'Dr. Sarah Chen' });

  it('sets resourceType to Practitioner', () => {
    expect(prac.resourceType).toBe('Practitioner');
  });

  it('has correct id', () => {
    expect(prac.id).toBe('pr1');
  });

  it('has NPI identifier', () => {
    expect(prac.identifier[0]!.system).toBe('http://hl7.org/fhir/sid/us-npi');
    expect(prac.identifier[0]!.value).toMatch(/^NPI\d+$/);
  });

  it('has MD qualification', () => {
    expect(prac.qualification[0]!.code.coding[0]!.code).toBe('MD');
  });
});

describe('buildCondition()', () => {
  const cond = buildCondition({
    id: 'c1',
    patientRef: 'urn:uuid:p1',
    practitionerRef: 'urn:uuid:pr1',
    icd10: 'C50.9',
    onsetDate: '2024-01-15',
  });

  it('sets resourceType to Condition', () => {
    expect(cond.resourceType).toBe('Condition');
  });

  it('has active clinical status', () => {
    expect(cond.clinicalStatus.coding[0]!.code).toBe('active');
  });

  it('has confirmed verification status', () => {
    expect(cond.verificationStatus.coding[0]!.code).toBe('confirmed');
  });

  it('includes ICD-10 coding', () => {
    const icd10Coding = cond.code.coding.find((c) =>
      c.system.includes('icd-10'),
    );
    expect(icd10Coding?.code).toBe('C50.9');
  });

  it('includes SNOMED coding', () => {
    const snomedCoding = cond.code.coding.find((c) =>
      c.system.includes('snomed'),
    );
    expect(snomedCoding?.code).toBe(CONDITIONS['C50.9']!.snomed);
  });

  it('sets patient subject reference', () => {
    expect(cond.subject.reference).toBe('urn:uuid:p1');
  });

  it('falls back gracefully for unknown ICD-10', () => {
    const unknown = buildCondition({
      id: 'cx',
      patientRef: 'urn:uuid:p1',
      practitionerRef: 'urn:uuid:pr1',
      icd10: 'Z99.999',
      onsetDate: '2024-01-01',
    });
    expect(unknown.resourceType).toBe('Condition');
    expect(unknown.code.coding[0]!.code).toBe('64572001'); // fallback snomed
  });
});

describe('buildCoverage()', () => {
  const cov = buildCoverage({
    id: 'cov1',
    patientRef: 'urn:uuid:p1',
    payerId: 'aetna-commercial',
    memberId: 'MEM1234567',
  });

  it('sets resourceType to Coverage', () => {
    expect(cov.resourceType).toBe('Coverage');
  });

  it('status is active', () => {
    expect(cov.status).toBe('active');
  });

  it('has correct payer display name', () => {
    expect(cov.payor[0]!.display).toBe('Aetna Commercial');
  });

  it('has subscriber ID', () => {
    expect(cov.subscriberId).toBe('MEM1234567');
  });

  it('uses payerId as display if unknown', () => {
    const unknown = buildCoverage({
      id: 'cov2',
      patientRef: 'urn:uuid:p1',
      payerId: 'custom-payer',
      memberId: 'MEM999',
    });
    expect(unknown.payor[0]!.display).toBe('custom-payer');
  });
});

describe('buildMedicationRequest()', () => {
  const medReq = buildMedicationRequest({
    id: 'm1',
    patientRef: 'urn:uuid:p1',
    practitionerRef: 'urn:uuid:pr1',
    icd10: 'C50.9',
  });

  it('sets resourceType to MedicationRequest', () => {
    expect(medReq.resourceType).toBe('MedicationRequest');
  });

  it('status is active and intent is order', () => {
    expect(medReq.status).toBe('active');
    expect(medReq.intent).toBe('order');
  });

  it('includes RxNorm code', () => {
    const coding = medReq.medicationCodeableConcept.coding[0]!;
    expect(coding.system).toContain('rxnorm');
    expect(coding.code).toBe(MEDICATIONS['C50.9']!.rxnorm);
  });

  it('includes IV route for C50.9', () => {
    const route = medReq.dosageInstruction[0]!.route.coding[0]!;
    expect(route.code).toBe('47625008'); // IV route SNOMED
  });

  it('includes oral route for C61', () => {
    const oral = buildMedicationRequest({
      id: 'm2',
      patientRef: 'urn:uuid:p1',
      practitionerRef: 'urn:uuid:pr1',
      icd10: 'C61',
    });
    const route = oral.dosageInstruction[0]!.route.coding[0]!;
    expect(route.code).toBe('26643006'); // oral route SNOMED
  });

  it('falls back for unknown ICD-10', () => {
    const unknown = buildMedicationRequest({
      id: 'm3',
      patientRef: 'urn:uuid:p1',
      practitionerRef: 'urn:uuid:pr1',
      icd10: 'Z99.999',
    });
    expect(unknown.resourceType).toBe('MedicationRequest');
  });
});

describe('buildTransactionBundle()', () => {
  const entries = [
    { resource: { resourceType: 'Patient', id: 'p1' } as Record<string, unknown>, method: 'POST', url: 'Patient' },
  ];
  const bundle = buildTransactionBundle(entries);

  it('sets resourceType to Bundle', () => {
    expect(bundle.resourceType).toBe('Bundle');
  });

  it('sets type to transaction', () => {
    expect(bundle.type).toBe('transaction');
  });

  it('wraps each entry with fullUrl and request', () => {
    expect(bundle.entry[0]!.fullUrl).toBe('urn:uuid:p1');
    expect(bundle.entry[0]!.request.method).toBe('POST');
    expect(bundle.entry[0]!.request.url).toBe('Patient');
  });
});

describe('generatePatientBundle()', () => {
  it('returns bundle and meta with required fields', () => {
    const result = generatePatientBundle({ icd10: 'C50.9', payerId: 'aetna-commercial' });
    expect(result.bundle.resourceType).toBe('Bundle');
    expect(result.bundle.type).toBe('transaction');
    expect(result.meta.patientId).toBeTruthy();
    expect(result.meta.name).toBeTruthy();
    expect(result.meta.icd10).toBe('C50.9');
    expect(result.meta.payerId).toBe('aetna-commercial');
    expect(result.meta.conditionDisplay).toBe(CONDITIONS['C50.9']!.display);
  });

  it('uses provided firstName/lastName/gender/birthDate', () => {
    const result = generatePatientBundle({
      firstName: 'Alice',
      lastName: 'Smith',
      gender: 'female',
      birthDate: '1980-05-10',
    });
    expect(result.meta.name).toBe('Alice Smith');
    expect(result.meta.gender).toBe('female');
    expect(result.meta.birthDate).toBe('1980-05-10');
  });

  it('generates 5 resources in the bundle', () => {
    const result = generatePatientBundle();
    expect((result.bundle.entry as unknown[]).length).toBe(5);
  });

  it('includes Patient, Practitioner, Condition, Coverage, MedicationRequest', () => {
    const result = generatePatientBundle();
    const entries = result.bundle.entry as Array<{ resource: Record<string, unknown> }>;
    const types = entries.map((e) => e.resource['resourceType'] as string);
    expect(types).toContain('Patient');
    expect(types).toContain('Practitioner');
    expect(types).toContain('Condition');
    expect(types).toContain('Coverage');
    expect(types).toContain('MedicationRequest');
  });

  it('generates unique patientIds across calls', () => {
    const a = generatePatientBundle();
    const b = generatePatientBundle();
    expect(a.meta.patientId).not.toBe(b.meta.patientId);
  });

  it('handles all known ICD-10 codes', () => {
    for (const icd10 of Object.keys(CONDITIONS)) {
      const result = generatePatientBundle({ icd10 });
      expect(result.meta.conditionDisplay).toBe(CONDITIONS[icd10]!.display);
    }
  });
});
