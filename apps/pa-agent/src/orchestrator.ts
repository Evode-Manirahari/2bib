// ── PA Orchestrator Agent ─────────────────────────────────────────────────────
// Autonomous Da Vinci CRD → DTR → PAS pipeline

import { EventEmitter } from 'events';
import axios from 'axios';
import {
  CdsHooksClient,
  DTREngine,
  PARequestBuilder,
  PASubmitter,
  PAPoller,
  AppealBuilder,
} from '@pe/da-vinci';
import type { FhirResource } from '@pe/types';
import type { PatientBundle } from '@pe/da-vinci';

// ── Types ─────────────────────────────────────────────────────────────────────

export type StepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error';
export type PADecision = 'approved' | 'denied' | 'appeal_approved' | 'appeal_denied' | 'not_required' | 'timeout' | 'error';

export interface StepAudit {
  step: string;
  status: StepStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  detail?: unknown;
  error?: string;
}

export interface PAResult {
  correlationId: string;
  payerId: string;
  decision: PADecision;
  durationMs: number;
  steps: StepAudit[];
  confidenceScore?: number;
  aiTokensUsed?: number;
}

export interface OrchestratorInput {
  patient: FhirResource & {
    id?: string;
    name?: Array<{ family?: string; given?: string[] }>;
    birthDate?: string;
    gender?: string;
  };
  procedure: FhirResource & {
    id?: string;
    code?: { coding?: Array<{ system?: string; code?: string; display?: string }> };
    authoredOn?: string;
    requester?: { reference?: string; display?: string };
  };
  payerId: string;
  options?: {
    skipCRD?: boolean;
    dryRun?: boolean;
    autoAppeal?: boolean;
  };
}

// ── PAOrchestrator ────────────────────────────────────────────────────────────

export class PAOrchestrator extends EventEmitter {
  private readonly fhirProxyUrl: string;

  constructor() {
    super();
    this.fhirProxyUrl = process.env['FHIR_PROXY_URL'] ?? 'http://localhost:3002';
  }

  async run(input: OrchestratorInput): Promise<PAResult> {
    const startTime = Date.now();
    const correlationId = `pa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const steps: StepAudit[] = [];
    let confidenceScore: number | undefined;

    const opts = input.options ?? {};

    this.emit('start', { correlationId, payerId: input.payerId });

    // ── Step 1: Coverage Fetch ───────────────────────────────────────────────
    let coverage: FhirResource | undefined;
    const step1 = this.startStep('coverage-fetch', steps);
    try {
      coverage = await this.fetchCoverage(input.patient.id ?? 'unknown');
      this.completeStep(step1, 'done', { coverageId: coverage?.id });
      this.emit('step', { step: 'coverage-fetch', status: 'done', coverage });
    } catch (err) {
      this.completeStep(step1, 'error', undefined, (err as Error).message);
      // Non-fatal: continue with minimal coverage
      coverage = { resourceType: 'Coverage', id: 'sandbox-coverage' };
      this.emit('step', { step: 'coverage-fetch', status: 'error', error: (err as Error).message });
    }

    // ── Step 2: CRD Check ────────────────────────────────────────────────────
    if (!opts.skipCRD) {
      const step2 = this.startStep('crd-check', steps);
      try {
        const crdClient = new CdsHooksClient(input.payerId);
        const crdResult = await crdClient.callHook(
          'order-sign',
          { patientId: input.patient.id ?? 'unknown' },
          { patient: input.patient, coverage },
        );

        this.completeStep(step2, 'done', { paRequired: crdResult.paRequired });
        this.emit('step', { step: 'crd-check', status: 'done', crdResult });

        if (!crdResult.paRequired) {
          return this.buildResult(correlationId, input.payerId, 'not_required', startTime, steps, confidenceScore);
        }
      } catch (err) {
        this.completeStep(step2, 'error', undefined, (err as Error).message);
        this.emit('step', { step: 'crd-check', status: 'error' });
        // continue — assume PA required if CRD fails
      }
    } else {
      steps.push({ step: 'crd-check', status: 'skipped', startedAt: new Date().toISOString() });
    }

    // ── Step 3: DTR Collection ───────────────────────────────────────────────
    let questionnaireResponse: import('@pe/da-vinci').QuestionnaireResponse | undefined;
    const step3 = this.startStep('dtr-collection', steps);
    try {
      const bundle: PatientBundle = {
        patient: input.patient as PatientBundle['patient'],
        coverage,
        serviceRequest: input.procedure as PatientBundle['serviceRequest'],
        documentReferences: await this.fetchDocumentReferences(input.patient.id ?? 'unknown'),
      };

      const dtr = new DTREngine(input.payerId);
      const dtrResult = await dtr.run(bundle);

      questionnaireResponse = dtrResult.questionnaireResponse;
      confidenceScore = dtrResult.gapResult.confidence;

      this.completeStep(step3, 'done', {
        confidence: confidenceScore,
        answeredCount: dtrResult.gapResult.answered.length,
        unansweredCount: dtrResult.gapResult.unanswered.length,
      });

      if (confidenceScore < 0.7) {
        this.emit('low-confidence', { score: confidenceScore, unanswered: dtrResult.gapResult.unanswered });
      }

      this.emit('step', { step: 'dtr-collection', status: 'done', confidence: confidenceScore });
    } catch (err) {
      this.completeStep(step3, 'error', undefined, (err as Error).message);
      this.emit('step', { step: 'dtr-collection', status: 'error' });
    }

    if (opts.dryRun) {
      return this.buildResult(correlationId, input.payerId, 'approved', startTime, steps, confidenceScore);
    }

    // ── Step 4: PAS Submission ───────────────────────────────────────────────
    const step4 = this.startStep('pas-submission', steps);
    let submissionResult: import('@pe/da-vinci').PASubmissionResult | undefined;
    try {
      const builder = new PARequestBuilder();
      const pasBundle = builder.build({
        patient: input.patient as import('@pe/da-vinci').PASInput['patient'],
        coverage: coverage as import('@pe/da-vinci').PASInput['coverage'],
        procedure: input.procedure as import('@pe/da-vinci').PASInput['procedure'],
        documentation: questionnaireResponse,
        payerId: input.payerId,
        correlationId,
      });

      const submitter = new PASubmitter(input.payerId);
      submissionResult = await submitter.submit(pasBundle);

      this.completeStep(step4, 'done', { decision: submissionResult.decision, correlationId });
      this.emit('step', { step: 'pas-submission', status: 'done', decision: submissionResult.decision });
    } catch (err) {
      this.completeStep(step4, 'error', undefined, (err as Error).message);
      this.emit('step', { step: 'pas-submission', status: 'error' });
      return this.buildResult(correlationId, input.payerId, 'error', startTime, steps, confidenceScore);
    }

    // Immediate approval
    if (submissionResult.decision === 'approved') {
      return this.buildResult(correlationId, input.payerId, 'approved', startTime, steps, confidenceScore);
    }

    // ── Step 5: Decision Polling ─────────────────────────────────────────────
    let finalDecision: PADecision = 'pending' as PADecision;
    if (submissionResult.decision === 'pending') {
      const step5 = this.startStep('decision-polling', steps);
      try {
        const poller = new PAPoller(input.payerId, 100, 60_000); // fast for non-prod
        const pollResult = await poller.poll(
          correlationId,
          submissionResult.pollingUrl,
          (d) => this.emit('poll', { decision: d }),
        );

        finalDecision = pollResult as PADecision;
        this.completeStep(step5, 'done', { finalDecision });
        this.emit('step', { step: 'decision-polling', status: 'done', decision: finalDecision });
      } catch (err) {
        this.completeStep(step5, 'error', undefined, (err as Error).message);
        finalDecision = 'timeout';
      }
    } else {
      finalDecision = submissionResult.decision as PADecision;
    }

    // ── Step 6: Appeal ───────────────────────────────────────────────────────
    if (finalDecision === 'denied' && opts.autoAppeal !== false) {
      const step6 = this.startStep('appeal', steps);
      try {
        const builder = new PARequestBuilder();
        const originalBundle = builder.build({
          patient: input.patient as import('@pe/da-vinci').PASInput['patient'],
          coverage: coverage as import('@pe/da-vinci').PASInput['coverage'],
          procedure: input.procedure as import('@pe/da-vinci').PASInput['procedure'],
          payerId: input.payerId,
          correlationId,
        });

        const appealBuilder = new AppealBuilder();
        const appealBundle = await appealBuilder.build(
          originalBundle,
          { resourceType: 'ClaimResponse', id: `denial-${correlationId}` },
        );

        const submitter = new PASubmitter(input.payerId);
        const appealResult = await submitter.submit(appealBundle as import('@pe/da-vinci').PASBundle);

        finalDecision = appealResult.decision === 'approved' ? 'appeal_approved' : 'appeal_denied';
        this.completeStep(step6, 'done', { appealDecision: finalDecision });
        this.emit('step', { step: 'appeal', status: 'done', decision: finalDecision });
      } catch (err) {
        this.completeStep(step6, 'error', undefined, (err as Error).message);
        finalDecision = 'appeal_denied';
      }
    }

    return this.buildResult(correlationId, input.payerId, finalDecision, startTime, steps, confidenceScore);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private startStep(name: string, steps: StepAudit[]): StepAudit {
    const step: StepAudit = { step: name, status: 'running', startedAt: new Date().toISOString() };
    steps.push(step);
    this.emit('step-start', { step: name });
    return step;
  }

  private completeStep(step: StepAudit, status: StepStatus, detail?: unknown, error?: string): void {
    step.status = status;
    step.completedAt = new Date().toISOString();
    step.durationMs = new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime();
    if (detail) step.detail = detail;
    if (error) step.error = error;
  }

  private buildResult(
    correlationId: string,
    payerId: string,
    decision: PADecision,
    startTime: number,
    steps: StepAudit[],
    confidenceScore?: number,
  ): PAResult {
    const result: PAResult = {
      correlationId,
      payerId,
      decision,
      durationMs: Date.now() - startTime,
      steps,
      confidenceScore,
    };
    this.emit('complete', result);
    return result;
  }

  private async fetchCoverage(patientId: string): Promise<FhirResource> {
    try {
      const response = await axios.get<{ entry?: Array<{ resource: FhirResource }> }>(
        `${this.fhirProxyUrl}/fhir/Coverage?patient=${patientId}`,
        { timeout: 10_000 },
      );
      return response.data.entry?.[0]?.resource ?? { resourceType: 'Coverage', id: `cov-${patientId}` };
    } catch {
      return { resourceType: 'Coverage', id: `cov-${patientId}` };
    }
  }

  private async fetchDocumentReferences(patientId: string): Promise<PatientBundle['documentReferences']> {
    try {
      const response = await axios.get<{ entry?: Array<{ resource: FhirResource }> }>(
        `${this.fhirProxyUrl}/fhir/DocumentReference?patient=${patientId}`,
        { timeout: 10_000 },
      );
      return (response.data.entry?.map((e) => e.resource) ?? []) as PatientBundle['documentReferences'];
    } catch {
      return [];
    }
  }
}
