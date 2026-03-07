import { validateStructural } from './structural';

// ── Helpers ───────────────────────────────────────────────────────────────────

const validPatient = {
  resourceType: 'Patient',
  id: 'p1',
  name: [{ use: 'official', family: 'Smith', given: ['John'] }],
  gender: 'male',
  birthDate: '1990-06-15',
};

const validCondition = {
  resourceType: 'Condition',
  id: 'c1',
  clinicalStatus: {
    coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }],
  },
  code: {
    coding: [{ system: 'http://snomed.info/sct', code: '363346000', display: 'Malignant neoplasm' }],
  },
  subject: { reference: 'Patient/p1' },
};

const validBundle = {
  resourceType: 'Bundle',
  type: 'transaction',
  entry: [
    { resource: { resourceType: 'Patient', id: 'p1' }, request: { method: 'POST', url: 'Patient' } },
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('validateStructural()', () => {
  describe('basic structure', () => {
    it('rejects null input', () => {
      const r = validateStructural(null);
      expect(r.isValid).toBe(false);
      expect(r.errors[0]!.severity).toBe('fatal');
    });

    it('rejects an array', () => {
      const r = validateStructural([validPatient]);
      expect(r.isValid).toBe(false);
      expect(r.errors[0]!.severity).toBe('fatal');
    });

    it('rejects a primitive', () => {
      const r = validateStructural('not-an-object');
      expect(r.isValid).toBe(false);
    });

    it('rejects missing resourceType', () => {
      const r = validateStructural({ id: 'x' });
      expect(r.isValid).toBe(false);
      const e = r.errors[0]!;
      expect(e.severity).toBe('fatal');
      expect(e.category).toBe('MISSING_REQUIRED');
      expect(e.message).toContain('resourceType');
    });

    it('rejects non-string resourceType', () => {
      const r = validateStructural({ resourceType: 42 });
      expect(r.isValid).toBe(false);
      expect(r.errors[0]!.category).toBe('WRONG_TYPE');
    });

    it('warns on unknown resourceType', () => {
      const r = validateStructural({ resourceType: 'FakeResource' });
      const warning = r.errors.find((e) => e.severity === 'warning' && e.category === 'INVALID_VALUE');
      expect(warning).toBeDefined();
    });
  });

  describe('Patient', () => {
    it('accepts a valid Patient', () => {
      const r = validateStructural(validPatient);
      expect(r.isValid).toBe(true);
      expect(r.errorCount).toBe(0);
    });

    it('warns when Patient has no name or identifier', () => {
      const r = validateStructural({ resourceType: 'Patient' });
      const w = r.errors.find((e) => e.severity === 'warning');
      expect(w).toBeDefined();
      expect(w!.message).toContain('name or identifier');
    });

    it('rejects invalid gender', () => {
      const r = validateStructural({ ...validPatient, gender: 'nonbinary' });
      const e = r.errors.find((e) => e.path.includes('gender'));
      expect(e).toBeDefined();
      expect(e!.severity).toBe('error');
      expect(e!.category).toBe('INVALID_VALUE');
    });

    it('accepts valid genders', () => {
      for (const gender of ['male', 'female', 'other', 'unknown']) {
        const r = validateStructural({ ...validPatient, gender });
        const genderError = r.errors.find((e) => e.path.includes('gender') && e.severity === 'error');
        expect(genderError).toBeUndefined();
      }
    });

    it('rejects invalid birthDate format', () => {
      const r = validateStructural({ ...validPatient, birthDate: '06/15/1990' });
      const e = r.errors.find((e) => e.path.includes('birthDate'));
      expect(e).toBeDefined();
      expect(e!.category).toBe('INVALID_VALUE');
    });

    it('accepts YYYY-MM birthDate', () => {
      const r = validateStructural({ ...validPatient, birthDate: '1990-06' });
      const e = r.errors.find((e) => e.path.includes('birthDate') && e.severity === 'error');
      expect(e).toBeUndefined();
    });

    it('warns on name entry without family or text', () => {
      const r = validateStructural({ ...validPatient, name: [{ use: 'official', given: ['John'] }] });
      const w = r.errors.find((e) => e.path.includes('name[0]'));
      expect(w).toBeDefined();
    });
  });

  describe('Condition', () => {
    it('accepts a valid Condition', () => {
      const r = validateStructural(validCondition);
      expect(r.isValid).toBe(true);
    });

    it('errors on missing clinicalStatus', () => {
      const { clinicalStatus: _, ...withoutStatus } = validCondition;
      const r = validateStructural(withoutStatus);
      expect(r.isValid).toBe(false);
      const e = r.errors.find((e) => e.path.includes('clinicalStatus'));
      expect(e).toBeDefined();
    });

    it('errors on missing code', () => {
      const { code: _, ...withoutCode } = validCondition;
      const r = validateStructural(withoutCode);
      expect(r.isValid).toBe(false);
    });

    it('errors on missing subject', () => {
      const { subject: _, ...withoutSubject } = validCondition;
      const r = validateStructural(withoutSubject);
      expect(r.isValid).toBe(false);
    });

    it('errors when clinicalStatus has no coding', () => {
      const r = validateStructural({ ...validCondition, clinicalStatus: { text: 'active' } });
      const e = r.errors.find((e) => e.path.includes('clinicalStatus'));
      expect(e).toBeDefined();
    });
  });

  describe('Bundle', () => {
    it('accepts a valid transaction bundle', () => {
      const r = validateStructural(validBundle);
      expect(r.isValid).toBe(true);
    });

    it('errors on invalid bundle type', () => {
      const r = validateStructural({ ...validBundle, type: 'invalid-type' });
      const e = r.errors.find((e) => e.path.includes('Bundle.type'));
      expect(e).toBeDefined();
      expect(e!.severity).toBe('error');
    });

    it('warns when transaction bundle has no entry', () => {
      const { entry: _, ...noEntry } = validBundle;
      const r = validateStructural(noEntry);
      const w = r.errors.find((e) => e.path.includes('entry'));
      expect(w).toBeDefined();
    });

    it('errors on entry missing request in transaction bundle', () => {
      const r = validateStructural({
        ...validBundle,
        entry: [{ resource: { resourceType: 'Patient' } }], // no request
      });
      const e = r.errors.find((e) => e.path.includes('request'));
      expect(e).toBeDefined();
    });
  });

  describe('MedicationRequest', () => {
    const validMedReq = {
      resourceType: 'MedicationRequest',
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '1876356' }] },
      subject: { reference: 'Patient/p1' },
    };

    it('accepts a valid MedicationRequest', () => {
      const r = validateStructural(validMedReq);
      expect(r.isValid).toBe(true);
    });

    it('errors on invalid intent', () => {
      const r = validateStructural({ ...validMedReq, intent: 'invalid-intent' });
      const e = r.errors.find((e) => e.path.includes('intent'));
      expect(e).toBeDefined();
    });

    it('errors when medication[x] is missing', () => {
      const { medicationCodeableConcept: _, ...noMed } = validMedReq;
      const r = validateStructural(noMed);
      const e = r.errors.find((e) => e.message.includes('medicationCodeableConcept'));
      expect(e).toBeDefined();
    });
  });

  describe('profile declaration', () => {
    it('warns when profile is requested but not in meta', () => {
      const r = validateStructural(validPatient, 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient');
      const w = r.errors.find((e) => e.category === 'PROFILE_MISMATCH');
      expect(w).toBeDefined();
    });

    it('does not warn when resource has meta.profile', () => {
      const withProfile = {
        ...validPatient,
        meta: { profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'] },
      };
      const r = validateStructural(withProfile, 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient');
      const w = r.errors.find((e) => e.category === 'PROFILE_MISMATCH');
      expect(w).toBeUndefined();
    });
  });

  describe('metrics', () => {
    it('durationMs is a non-negative number', () => {
      const r = validateStructural(validPatient);
      expect(r.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('correctly counts errors and warnings', () => {
      const r = validateStructural({
        resourceType: 'Patient',
        gender: 'invalid',
        birthDate: 'not-a-date',
      });
      expect(r.errorCount).toBeGreaterThanOrEqual(2);
      expect(r.warningCount).toBeGreaterThanOrEqual(1); // no name/identifier warning
    });
  });
});
