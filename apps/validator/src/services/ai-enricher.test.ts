import Anthropic from '@anthropic-ai/sdk';
import { enrichErrors, autoFix, resetClient } from './ai-enricher';
import type { EnrichedError } from '@pe/types';

jest.mock('@anthropic-ai/sdk');

const MockedAnthropic = jest.mocked(Anthropic);

const sampleResource = {
  resourceType: 'Patient',
  id: 'p1',
  gender: 'invalid-gender',
};

const sampleErrors: EnrichedError[] = [
  {
    severity: 'error',
    category: 'INVALID_VALUE',
    path: 'Patient.gender',
    message: 'Invalid gender value: "invalid-gender".',
  },
];

function mockMessageCreate(responseText: string) {
  const mockCreate = jest.fn().mockResolvedValue({
    content: [{ type: 'text', text: responseText }],
  });
  MockedAnthropic.mockImplementation(() => ({
    messages: { create: mockCreate },
  }) as unknown as Anthropic);
  return mockCreate;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetClient();
  process.env['ANTHROPIC_API_KEY'] = 'test-key';
});

afterEach(() => {
  delete process.env['ANTHROPIC_API_KEY'];
});

describe('enrichErrors()', () => {
  it('returns original errors when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env['ANTHROPIC_API_KEY'];
    const result = await enrichErrors(sampleResource, sampleErrors);
    expect(result).toEqual(sampleErrors);
  });

  it('returns original errors when errors array is empty', async () => {
    const result = await enrichErrors(sampleResource, []);
    expect(result).toEqual([]);
  });

  it('returns enriched errors from Claude response', async () => {
    const enrichedResponse = JSON.stringify([
      {
        severity: 'error',
        category: 'INVALID_VALUE',
        path: 'Patient.gender',
        message: 'The gender field contains an invalid code "invalid-gender".',
        suggestion: 'Use one of the valid FHIR gender codes: male, female, other, unknown.',
        igLink: 'https://hl7.org/fhir/R4/patient.html#Patient.gender',
      },
    ]);
    mockMessageCreate(enrichedResponse);

    const result = await enrichErrors(sampleResource, sampleErrors);
    expect(result).toHaveLength(1);
    expect(result[0]!.suggestion).toContain('male, female, other, unknown');
    expect(result[0]!.igLink).toContain('hl7.org');
  });

  it('falls back to original errors with note when Claude returns invalid JSON', async () => {
    mockMessageCreate('I cannot process this request.');

    const result = await enrichErrors(sampleResource, sampleErrors);
    expect(result).toHaveLength(1);
    expect(result[0]!.suggestion).toBeDefined();
  });

  it('falls back to original errors when Claude throws', async () => {
    MockedAnthropic.mockImplementation(() => ({
      messages: { create: jest.fn().mockRejectedValue(new Error('API error')) },
    }) as unknown as Anthropic);

    const result = await enrichErrors(sampleResource, sampleErrors);
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe('error'); // original preserved
  });

  it('handles multiple errors correctly', async () => {
    const errors: EnrichedError[] = [
      { severity: 'error', category: 'MISSING_REQUIRED', path: 'Patient.name', message: 'Missing name.' },
      { severity: 'warning', category: 'INVALID_VALUE', path: 'Patient.gender', message: 'Invalid gender.' },
    ];
    const enrichedResponse = JSON.stringify([
      { severity: 'error', category: 'MISSING_REQUIRED', path: 'Patient.name', message: 'Missing name.', suggestion: 'Add a name array.', igLink: null },
      { severity: 'warning', category: 'INVALID_VALUE', path: 'Patient.gender', message: 'Invalid gender.', suggestion: 'Use male/female/other/unknown.', igLink: null },
    ]);
    mockMessageCreate(enrichedResponse);

    const result = await enrichErrors(sampleResource, errors);
    expect(result).toHaveLength(2);
  });
});

describe('autoFix()', () => {
  it('returns an unfixed result when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env['ANTHROPIC_API_KEY'];
    const result = await autoFix(sampleResource, sampleErrors);
    expect(result.correctedResource).toEqual(sampleResource);
    expect(result.changesApplied).toEqual([]);
    expect(result.explanation).toContain('ANTHROPIC_API_KEY');
  });

  it('returns corrected resource from Claude', async () => {
    const fixResponse = JSON.stringify({
      explanation: 'Changed gender from "invalid-gender" to "unknown".',
      correctedResource: { resourceType: 'Patient', id: 'p1', gender: 'unknown' },
      changesApplied: ['Set Patient.gender to "unknown"'],
    });
    mockMessageCreate(fixResponse);

    const result = await autoFix(sampleResource, sampleErrors);
    expect(result.explanation).toContain('gender');
    expect((result.correctedResource as unknown as Record<string, unknown>)['gender']).toBe('unknown');
    expect(result.changesApplied).toHaveLength(1);
  });

  it('handles Claude returning non-JSON gracefully', async () => {
    mockMessageCreate('I cannot fix this resource.');

    const result = await autoFix(sampleResource, sampleErrors);
    expect(result.correctedResource).toEqual(sampleResource);
    expect(result.explanation).toContain('failed');
  });

  it('handles Claude API error gracefully', async () => {
    MockedAnthropic.mockImplementation(() => ({
      messages: { create: jest.fn().mockRejectedValue(new Error('rate limited')) },
    }) as unknown as Anthropic);

    const result = await autoFix(sampleResource, sampleErrors);
    expect(result.correctedResource).toEqual(sampleResource);
    expect(result.changesApplied).toEqual([]);
  });

  it('handles resource with unknown resourceType gracefully', async () => {
    const fixResponse = JSON.stringify({
      explanation: 'No changes needed.',
      correctedResource: { id: 'x' },
      changesApplied: [],
    });
    mockMessageCreate(fixResponse);

    const result = await autoFix({ id: 'x' }, sampleErrors);
    expect(result).toBeDefined();
  });
});
