import { CQLEvaluator, QuestionnaireLoader, QuestionnaireResponseBuilder, DTREngine } from '../src/dtr';
import type { Questionnaire, PatientBundle } from '../src/dtr';

process.env['DTR_SANDBOX_MODE'] = 'true';

const mockBundle: PatientBundle = {
  patient: {
    resourceType: 'Patient',
    id: 'p1',
    birthDate: '1980-06-15',
    gender: 'male',
  },
  conditions: [
    {
      resourceType: 'Condition',
      id: 'c1',
      code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: 'C34.10', display: 'Lung cancer' }] },
    } as import('@pe/types').FhirResource,
  ],
  medications: [
    { resourceType: 'MedicationRequest', id: 'm1' } as import('@pe/types').FhirResource,
  ],
  serviceRequest: {
    resourceType: 'ServiceRequest',
    id: 'sr1',
    authoredOn: '2026-03-01',
    code: { coding: [{ code: '71250', display: 'CT thorax' }] },
  },
};

const mockQuestionnaire: Questionnaire = {
  resourceType: 'Questionnaire',
  id: 'test-q',
  status: 'active',
  url: 'http://example.com/Questionnaire/test-q',
  item: [
    {
      linkId: 'patient-age',
      text: 'Patient age',
      type: 'integer',
      required: true,
      extension: [{ url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression', valueExpression: { language: 'text/cql', expression: 'AgeInYears()' } }],
    },
    {
      linkId: 'patient-gender',
      text: 'Patient gender',
      type: 'choice',
      required: true,
      extension: [{ url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression', valueExpression: { language: 'text/cql', expression: 'Patient.gender' } }],
    },
    {
      linkId: 'has-condition',
      text: 'Has condition',
      type: 'boolean',
      required: true,
      extension: [{ url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression', valueExpression: { language: 'text/cql', expression: 'exists([Condition])' } }],
    },
    {
      linkId: 'service-date',
      text: 'Service date',
      type: 'date',
      required: true,
      extension: [{ url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression', valueExpression: { language: 'text/cql', expression: 'ServiceRequest.authoredOn' } }],
    },
    {
      linkId: 'unanswered-item',
      text: 'Something we cannot auto-populate',
      type: 'string',
      required: false,
    },
  ],
};

describe('CQLEvaluator', () => {
  let evaluator: CQLEvaluator;

  beforeEach(() => {
    evaluator = new CQLEvaluator(mockBundle);
  });

  it('evaluates AgeInYears', () => {
    const age = evaluator.evaluate('AgeInYears()') as number;
    expect(age).toBeGreaterThan(40);
    expect(age).toBeLessThan(60);
  });

  it('evaluates Patient.gender', () => {
    expect(evaluator.evaluate('Patient.gender')).toBe('male');
  });

  it('evaluates exists([Condition]) as true', () => {
    expect(evaluator.evaluate('exists([Condition])')).toBe(true);
  });

  it('evaluates exists([Condition]) as false when no conditions', () => {
    const ev = new CQLEvaluator({ ...mockBundle, conditions: [] });
    expect(ev.evaluate('exists([Condition])')).toBe(false);
  });

  it('evaluates ServiceRequest.authoredOn', () => {
    expect(evaluator.evaluate('ServiceRequest.authoredOn')).toBe('2026-03-01');
  });

  it('evaluates exists([MedicationRequest])', () => {
    expect(evaluator.evaluate('exists([MedicationRequest])')).toBe(true);
  });

  it('returns null for unknown expression', () => {
    expect(evaluator.evaluate('SomeUnknownExpression()')).toBeNull();
  });

  it('returns true/false literals', () => {
    expect(evaluator.evaluate('true')).toBe(true);
    expect(evaluator.evaluate('false')).toBe(false);
  });
});

describe('QuestionnaireLoader', () => {
  it('loads sandbox questionnaire for any payer', async () => {
    const loader = new QuestionnaireLoader('uhc-commercial');
    const q = await loader.load();
    expect(q.resourceType).toBe('Questionnaire');
    expect(q.status).toBe('active');
    expect(q.item?.length).toBeGreaterThan(0);
  });
});

describe('QuestionnaireResponseBuilder', () => {
  let builder: QuestionnaireResponseBuilder;

  beforeEach(() => {
    builder = new QuestionnaireResponseBuilder(mockBundle);
  });

  it('auto-populates CQL-backed questions', () => {
    const gap = builder.autoPopulate(mockQuestionnaire);
    expect(gap.answered.length).toBeGreaterThanOrEqual(4);
    expect(gap.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('leaves non-CQL items unanswered', () => {
    const gap = builder.autoPopulate(mockQuestionnaire);
    const unansweredIds = gap.unanswered.map((i) => i.linkId);
    expect(unansweredIds).toContain('unanswered-item');
  });

  it('builds patient age answer as integer', () => {
    const gap = builder.autoPopulate(mockQuestionnaire);
    const ageAnswer = gap.answered.find((a) => a.linkId === 'patient-age');
    expect(ageAnswer).toBeDefined();
    expect(ageAnswer?.answer?.[0]?.valueInteger).toBeGreaterThan(0);
  });

  it('builds gender answer as valueCoding', () => {
    const gap = builder.autoPopulate(mockQuestionnaire);
    const genderAnswer = gap.answered.find((a) => a.linkId === 'patient-gender');
    expect(genderAnswer?.answer?.[0]?.valueCoding?.display).toBe('male');
  });

  it('builds QuestionnaireResponse with provenance extension', () => {
    const gap = builder.autoPopulate(mockQuestionnaire);
    const qr = builder.buildResponse(mockQuestionnaire, gap.answered);
    expect(qr.resourceType).toBe('QuestionnaireResponse');
    expect(qr.status).toBe('completed');
    expect(qr.extension?.some((e) => e.url === 'pe:correlation-id')).toBe(true);
  });

  it('merges AI answers into response', () => {
    const gap = builder.autoPopulate(mockQuestionnaire);
    const aiAnswer = { linkId: 'unanswered-item', answer: [{ valueString: 'AI inferred value' }] };
    const qr = builder.buildResponse(mockQuestionnaire, gap.answered, [aiAnswer]);
    const found = qr.item.find((i) => i.linkId === 'unanswered-item');
    expect(found).toBeDefined();
  });
});

describe('DTREngine', () => {
  it('runs full DTR pipeline in sandbox mode', async () => {
    const engine = new DTREngine('aetna-commercial');
    const result = await engine.run(mockBundle);

    expect(result.questionnaireResponse.resourceType).toBe('QuestionnaireResponse');
    expect(result.gapResult.confidence).toBeGreaterThanOrEqual(0);
    expect(result.gapResult.answered.length).toBeGreaterThan(0);
  });

  it('returns confidence score between 0 and 1', async () => {
    const engine = new DTREngine('cigna-commercial');
    const { gapResult } = await engine.run(mockBundle);
    expect(gapResult.confidence).toBeGreaterThanOrEqual(0);
    expect(gapResult.confidence).toBeLessThanOrEqual(1);
  });
});
