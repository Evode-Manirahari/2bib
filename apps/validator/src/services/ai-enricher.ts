/**
 * AI Error Enricher — uses the Anthropic Claude API to:
 *   1. enrichErrors: add plain-English explanations + fix suggestions to validation issues
 *   2. autoFix: return a corrected FHIR resource based on the validation errors
 */

import Anthropic from '@anthropic-ai/sdk';
import type { EnrichedError, FixResult, FhirResource } from '@pe/types';

// ── Client ────────────────────────────────────────────────────────────────────

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env['ANTHROPIC_API_KEY'],
    });
  }
  return _client;
}

// Exposed for tests
export function resetClient(): void {
  _client = null;
}

// ── Models ────────────────────────────────────────────────────────────────────

const ENRICH_MODEL = process.env['ANTHROPIC_ENRICH_MODEL'] ?? 'claude-haiku-4-5-20251001';
const FIX_MODEL = process.env['ANTHROPIC_FIX_MODEL'] ?? 'claude-sonnet-4-6';

// ── enrichErrors ──────────────────────────────────────────────────────────────

export async function enrichErrors(
  resource: unknown,
  errors: EnrichedError[],
): Promise<EnrichedError[]> {
  if (errors.length === 0) return errors;
  if (!process.env['ANTHROPIC_API_KEY']) {
    console.warn('[ai-enricher] ANTHROPIC_API_KEY not set — skipping enrichment');
    return errors;
  }

  const systemPrompt = `You are a FHIR R4 conformance expert. Your job is to enhance validation error messages with clear explanations and actionable fix suggestions for developers.

Respond ONLY with a valid JSON array. No markdown, no extra text. Each element must match this exact shape:
{
  "severity": "<same as input>",
  "category": "<same as input>",
  "path": "<same as input>",
  "message": "<improved, plain-English explanation of what is wrong>",
  "suggestion": "<concrete, specific steps to fix this error>",
  "igLink": "<URL to HL7 specification page, or null if not applicable>"
}`;

  const userPrompt = `FHIR Resource:
\`\`\`json
${JSON.stringify(resource, null, 2)}
\`\`\`

Validation Errors (${errors.length} total):
\`\`\`json
${JSON.stringify(errors, null, 2)}
\`\`\`

Return the enhanced errors JSON array with all ${errors.length} elements.`;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: ENRICH_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('');

    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found in response');

    const enriched = JSON.parse(jsonMatch[0]) as EnrichedError[];
    if (!Array.isArray(enriched) || enriched.length !== errors.length) {
      throw new Error('Response array length mismatch');
    }

    return enriched;
  } catch (err) {
    console.warn('[ai-enricher] enrichErrors failed:', (err as Error).message);
    // Return original errors with a note that enrichment failed
    return errors.map((e) => ({
      ...e,
      suggestion: e.suggestion ?? 'AI enrichment unavailable — check ANTHROPIC_API_KEY and model availability.',
    }));
  }
}

// ── autoFix ───────────────────────────────────────────────────────────────────

export async function autoFix(
  resource: unknown,
  errors: EnrichedError[],
): Promise<FixResult> {
  const resourceType =
    typeof resource === 'object' && resource !== null
      ? ((resource as Record<string, unknown>)['resourceType'] as string | undefined) ?? 'Resource'
      : 'Resource';

  if (!process.env['ANTHROPIC_API_KEY']) {
    return {
      explanation: 'AI auto-fix is unavailable. Set ANTHROPIC_API_KEY to enable this feature.',
      correctedResource: resource as FhirResource,
      changesApplied: [],
    };
  }

  const systemPrompt = `You are a FHIR R4 expert developer. Given a FHIR ${resourceType} resource and its validation errors, produce a corrected version of the resource that resolves all errors.

Respond ONLY with a valid JSON object in this exact shape — no markdown, no extra text:
{
  "explanation": "<one sentence summary of all changes made>",
  "correctedResource": { <the complete corrected FHIR resource> },
  "changesApplied": ["<change 1>", "<change 2>", ...]
}`;

  const userPrompt = `FHIR ${resourceType} Resource:
\`\`\`json
${JSON.stringify(resource, null, 2)}
\`\`\`

Validation Errors to Fix:
\`\`\`json
${JSON.stringify(errors, null, 2)}
\`\`\`

Return the corrected resource JSON object.`;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: FIX_MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('');

    // Extract JSON object from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON object found in response');

    const result = JSON.parse(jsonMatch[0]) as FixResult;

    if (!result.correctedResource || !result.changesApplied) {
      throw new Error('Response missing required fields');
    }

    return result;
  } catch (err) {
    console.warn('[ai-enricher] autoFix failed:', (err as Error).message);
    return {
      explanation: `Auto-fix failed: ${(err as Error).message}`,
      correctedResource: resource as FhirResource,
      changesApplied: [],
    };
  }
}
