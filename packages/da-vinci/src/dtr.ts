// ── Da Vinci DTR Engine ────────────────────────────────────────────────────────
// Documentation Templates and Rules — CQL-based Questionnaire auto-population

import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { getPayerEndpoint } from './payer-registry';
import type { FhirResource } from '@pe/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QuestionnaireItem {
  linkId: string;
  text: string;
  type: 'boolean' | 'string' | 'integer' | 'date' | 'choice' | 'open-choice' | 'attachment';
  required?: boolean;
  answerValueSet?: string;
  extension?: Array<{
    url: string;
    valueExpression?: { language: string; expression: string };
  }>;
  item?: QuestionnaireItem[];
}

export interface Questionnaire extends FhirResource {
  resourceType: 'Questionnaire';
  url?: string;
  status: 'draft' | 'active' | 'retired';
  title?: string;
  item?: QuestionnaireItem[];
}

export interface QuestionnaireAnswer {
  linkId: string;
  text?: string;
  answer?: Array<{
    valueBoolean?: boolean;
    valueString?: string;
    valueInteger?: number;
    valueDate?: string;
    valueCoding?: { system?: string; code?: string; display?: string };
  }>;
  item?: QuestionnaireAnswer[];
}

export interface QuestionnaireResponse extends FhirResource {
  resourceType: 'QuestionnaireResponse';
  questionnaire?: string;
  status: 'in-progress' | 'completed';
  item: QuestionnaireAnswer[];
  extension?: Array<{ url: string; valueString?: string; valueBoolean?: boolean }>;
}

export interface GapDetectionResult {
  unanswered: QuestionnaireItem[];
  answered: QuestionnaireAnswer[];
  confidence: number;
}

export interface PatientBundle {
  patient?: FhirResource & { birthDate?: string; gender?: string };
  conditions?: FhirResource[];
  medications?: FhirResource[];
  procedures?: FhirResource[];
  documentReferences?: Array<FhirResource & { content?: Array<{ attachment?: { data?: string; contentType?: string } }> }>;
  coverage?: FhirResource;
  serviceRequest?: FhirResource & {
    authoredOn?: string;
    code?: { coding?: Array<{ code?: string; display?: string; system?: string }> };
  };
}

// ── CQL Evaluator ─────────────────────────────────────────────────────────────

export class CQLEvaluator {
  private readonly bundle: PatientBundle;

  constructor(bundle: PatientBundle) {
    this.bundle = bundle;
  }

  evaluate(expression: string): unknown {
    const expr = expression.trim();

    // Age calculation
    if (expr.match(/AgeInYears/i)) {
      return this.calculateAge();
    }

    // Gender
    if (expr.match(/Patient\.gender/i)) {
      return this.bundle.patient?.gender ?? null;
    }

    // BirthDate
    if (expr.match(/Patient\.birthDate/i)) {
      return this.bundle.patient?.birthDate ?? null;
    }

    // Condition existence
    if (expr.match(/exists\s*\(.*Condition/i) || expr.match(/Condition.*exists/i)) {
      return (this.bundle.conditions?.length ?? 0) > 0;
    }

    // Medication existence
    if (expr.match(/exists\s*\(.*Medication/i) || expr.match(/MedicationRequest.*exists/i)) {
      return (this.bundle.medications?.length ?? 0) > 0;
    }

    // Diagnosis codes — value set membership
    if (expr.match(/in.*DiagnosisValueSet/i) || expr.match(/ICD/i)) {
      const codes = this.extractIcd10Codes();
      return codes.length > 0 ? codes[0] : null;
    }

    // Procedure date
    if (expr.match(/ServiceRequest.*authoredOn/i) || expr.match(/procedure.*date/i)) {
      return (this.bundle.serviceRequest as { authoredOn?: string } | undefined)?.authoredOn ?? null;
    }

    // Coverage member ID
    if (expr.match(/Coverage.*subscriberId/i) || expr.match(/memberId/i)) {
      const cov = this.bundle.coverage as Record<string, unknown> | undefined;
      return cov?.['subscriberId'] ?? cov?.['id'] ?? null;
    }

    // Boolean true/false literals
    if (expr === 'true') return true;
    if (expr === 'false') return false;

    return null;
  }

  private calculateAge(): number | null {
    const birthDate = this.bundle.patient?.birthDate;
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  }

  private extractIcd10Codes(): string[] {
    const codes: string[] = [];
    for (const condition of this.bundle.conditions ?? []) {
      const c = condition as unknown as Record<string, unknown>;
      const cc = c['code'] as { coding?: Array<{ code?: string }> } | undefined;
      if (cc?.coding) {
        for (const coding of cc.coding) {
          if (coding.code) codes.push(coding.code);
        }
      }
    }
    return codes;
  }
}

// ── Questionnaire Loader ───────────────────────────────────────────────────────

export class QuestionnaireLoader {
  private readonly payerId: string;

  constructor(payerId: string) {
    this.payerId = payerId;
  }

  async load(questionnaireUrl?: string): Promise<Questionnaire> {
    // Sandbox mode — return a deterministic questionnaire
    if (process.env['DTR_SANDBOX_MODE'] === 'true' || !process.env['DTR_LIVE_MODE']) {
      return this.sandboxQuestionnaire();
    }

    const payer = getPayerEndpoint(this.payerId);
    const url = questionnaireUrl ?? `${payer.dtrUrl}/Questionnaire/pa-questionnaire`;

    const response = await axios.get<Questionnaire>(url, {
      headers: { Accept: 'application/fhir+json' },
      timeout: 15_000,
    });
    return response.data;
  }

  private sandboxQuestionnaire(): Questionnaire {
    return {
      resourceType: 'Questionnaire',
      id: `sandbox-q-${this.payerId}`,
      status: 'active',
      title: `PA Questionnaire — ${this.payerId}`,
      item: [
        {
          linkId: 'patient-age',
          text: 'Patient age in years',
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
          linkId: 'diagnosis-present',
          text: 'Is a qualifying diagnosis present?',
          type: 'boolean',
          required: true,
          extension: [{ url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression', valueExpression: { language: 'text/cql', expression: 'exists([Condition])' } }],
        },
        {
          linkId: 'prior-treatment',
          text: 'Has prior treatment been attempted?',
          type: 'boolean',
          required: true,
        },
        {
          linkId: 'clinical-notes',
          text: 'Relevant clinical notes summary',
          type: 'string',
          required: false,
        },
        {
          linkId: 'service-date',
          text: 'Requested service date',
          type: 'date',
          required: true,
          extension: [{ url: 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-initialExpression', valueExpression: { language: 'text/cql', expression: 'ServiceRequest.authoredOn' } }],
        },
      ],
    };
  }
}

// ── Questionnaire Response Builder ────────────────────────────────────────────

export class QuestionnaireResponseBuilder {
  private readonly evaluator: CQLEvaluator;
  private readonly bundle: PatientBundle;

  constructor(bundle: PatientBundle) {
    this.bundle = bundle;
    this.evaluator = new CQLEvaluator(bundle);
  }

  autoPopulate(questionnaire: Questionnaire): GapDetectionResult {
    const answered: QuestionnaireAnswer[] = [];
    const unanswered: QuestionnaireItem[] = [];

    for (const item of questionnaire.item ?? []) {
      const result = this.tryAnswerItem(item);
      if (result) {
        answered.push(result);
      } else {
        unanswered.push(item);
      }
    }

    const total = (questionnaire.item ?? []).length;
    const confidence = total > 0 ? answered.length / total : 0;

    return { answered, unanswered, confidence };
  }

  private tryAnswerItem(item: QuestionnaireItem): QuestionnaireAnswer | null {
    // Try CQL expression first
    const cqlExtension = item.extension?.find(
      (e) => e.url.includes('initialExpression') && e.valueExpression?.language === 'text/cql',
    );

    if (cqlExtension?.valueExpression) {
      const value = this.evaluator.evaluate(cqlExtension.valueExpression.expression);
      if (value !== null && value !== undefined) {
        return this.buildAnswer(item, value);
      }
    }

    return null;
  }

  private buildAnswer(item: QuestionnaireItem, value: unknown): QuestionnaireAnswer {
    const answer: QuestionnaireAnswer = { linkId: item.linkId, text: item.text };

    switch (item.type) {
      case 'boolean':
        answer.answer = [{ valueBoolean: Boolean(value) }];
        break;
      case 'integer':
        answer.answer = [{ valueInteger: Number(value) }];
        break;
      case 'date':
        answer.answer = [{ valueDate: String(value) }];
        break;
      case 'choice':
        answer.answer = [{ valueCoding: { display: String(value) } }];
        break;
      default:
        answer.answer = [{ valueString: String(value) }];
    }

    return answer;
  }

  buildResponse(
    questionnaire: Questionnaire,
    answered: QuestionnaireAnswer[],
    aiAnswers: QuestionnaireAnswer[] = [],
  ): QuestionnaireResponse {
    const correlationId = `dtr-${Date.now()}`;
    return {
      resourceType: 'QuestionnaireResponse',
      id: correlationId,
      questionnaire: questionnaire.url ?? `Questionnaire/${questionnaire.id ?? 'unknown'}`,
      status: 'completed',
      item: [...answered, ...aiAnswers],
      extension: [
        { url: 'pe:correlation-id', valueString: correlationId },
        { url: 'pe:auto-populated-count', valueString: String(answered.length) },
        { url: 'pe:ai-inferred-count', valueString: String(aiAnswers.length) },
      ],
    };
  }
}

// ── AI Gap Filler ─────────────────────────────────────────────────────────────

export class AIGapFiller {
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async fillGaps(
    unanswered: QuestionnaireItem[],
    bundle: PatientBundle,
  ): Promise<QuestionnaireAnswer[]> {
    if (unanswered.length === 0) return [];

    // Extract clinical notes from DocumentReferences
    const clinicalNotes = this.extractClinicalNotes(bundle);
    const clinicalContext = clinicalNotes.length > 0
      ? clinicalNotes.join('\n---\n')
      : 'No clinical notes available.';

    const questionsText = unanswered
      .map((q, i) => `${i + 1}. [${q.linkId}] ${q.text} (type: ${q.type})`)
      .join('\n');

    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a clinical documentation specialist helping complete a prior authorization questionnaire.

Based on the following clinical notes, answer these unanswered questionnaire items. Return a JSON array.

Clinical Notes:
${clinicalContext}

Unanswered Questions:
${questionsText}

Return a JSON array with objects: { "linkId": string, "text": string, "value": string|boolean|number, "confidence": "high"|"medium"|"low" }
Only answer questions you can infer from the clinical notes. Skip questions with no evidence.`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') return [];

    try {
      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const answers = JSON.parse(jsonMatch[0]) as Array<{
        linkId: string;
        text: string;
        value: unknown;
        confidence: string;
      }>;

      return answers.map((a) => {
        const item = unanswered.find((q) => q.linkId === a.linkId);
        const answer: QuestionnaireAnswer = {
          linkId: a.linkId,
          text: a.text,
          answer: this.buildAnswerValue(a.value, item?.type ?? 'string'),
          item: [
            {
              linkId: `${a.linkId}-provenance`,
              answer: [{ valueString: `ai-inferred:confidence=${a.confidence}` }],
            },
          ],
        };
        return answer;
      });
    } catch {
      return [];
    }
  }

  private buildAnswerValue(
    value: unknown,
    type: string,
  ): QuestionnaireAnswer['answer'] {
    switch (type) {
      case 'boolean':
        return [{ valueBoolean: Boolean(value) }];
      case 'integer':
        return [{ valueInteger: Number(value) }];
      case 'date':
        return [{ valueDate: String(value) }];
      default:
        return [{ valueString: String(value) }];
    }
  }

  private extractClinicalNotes(bundle: PatientBundle): string[] {
    const notes: string[] = [];
    for (const doc of bundle.documentReferences ?? []) {
      for (const content of doc.content ?? []) {
        if (content.attachment?.data) {
          try {
            const decoded = Buffer.from(content.attachment.data, 'base64').toString('utf-8');
            notes.push(decoded.slice(0, 2000));
          } catch {
            // skip
          }
        }
      }
    }
    return notes;
  }
}

// ── DTR Engine (top-level orchestrator) ───────────────────────────────────────

export class DTREngine {
  private readonly loader: QuestionnaireLoader;
  private readonly gapFiller: AIGapFiller;

  constructor(payerId: string) {
    this.loader = new QuestionnaireLoader(payerId);
    this.gapFiller = new AIGapFiller();
  }

  async run(bundle: PatientBundle, questionnaireUrl?: string): Promise<{
    questionnaireResponse: QuestionnaireResponse;
    gapResult: GapDetectionResult;
  }> {
    const questionnaire = await this.loader.load(questionnaireUrl);
    const builder = new QuestionnaireResponseBuilder(bundle);
    const gapResult = builder.autoPopulate(questionnaire);

    let aiAnswers: QuestionnaireAnswer[] = [];
    if (gapResult.unanswered.length > 0) {
      try {
        aiAnswers = await this.gapFiller.fillGaps(gapResult.unanswered, bundle);
      } catch {
        // fail-open: continue without AI answers
      }
    }

    const questionnaireResponse = builder.buildResponse(questionnaire, gapResult.answered, aiAnswers);
    return { questionnaireResponse, gapResult };
  }
}
