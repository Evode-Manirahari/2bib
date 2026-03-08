// ── Da Vinci PAS Submission Engine ────────────────────────────────────────────
// Prior Authorization Support — FHIR R4 + X12 278 bridge

import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { getPayerEndpoint } from './payer-registry';
import type { FhirResource, FhirBundle } from '@pe/types';
import type { QuestionnaireResponse } from './dtr';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PASInput {
  patient: FhirResource & {
    id?: string;
    name?: Array<{ family?: string; given?: string[] }>;
    birthDate?: string;
    gender?: string;
  };
  coverage: FhirResource & {
    id?: string;
    subscriberId?: string;
    payor?: Array<{ reference?: string; display?: string }>;
  };
  procedure: FhirResource & {
    id?: string;
    code?: { coding?: Array<{ system?: string; code?: string; display?: string }> };
    authoredOn?: string;
    requester?: { reference?: string; display?: string };
  };
  documentation?: QuestionnaireResponse;
  payerId: string;
  correlationId?: string;
}

export interface PASBundle extends FhirBundle {
  type: 'collection';
  entry: Array<{
    fullUrl: string;
    resource: FhirResource;
  }>;
}

export interface X12Segment {
  id: string;
  elements: string[];
}

export interface X12Transaction {
  interchangeControlNumber: string;
  segments: X12Segment[];
  raw: string;
}

export type PADecision = 'approved' | 'denied' | 'pending' | 'error';

export interface PASubmissionResult {
  correlationId: string;
  decision: PADecision;
  claimResponseId?: string;
  pollingUrl?: string;
  message?: string;
  rawResponse?: unknown;
}

export interface AppealBundle extends FhirBundle {
  type: 'collection';
}

// ── PARequestBuilder ──────────────────────────────────────────────────────────

export class PARequestBuilder {
  build(input: PASInput): PASBundle {
    const claimId = uuidv4();
    const correlationId = input.correlationId ?? uuidv4();

    const procedure = input.procedure as unknown as Record<string, unknown>;
    const procedureCode = (procedure['code'] as { coding?: Array<{ system?: string; code?: string; display?: string }> } | undefined)?.coding?.[0];

    const claim: Record<string, unknown> = {
      resourceType: 'Claim',
      id: claimId,
      meta: {
        profile: ['http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claim'],
      },
      status: 'active',
      type: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }],
      },
      use: 'preauthorization',
      patient: { reference: `Patient/${input.patient.id ?? 'unknown'}` },
      created: new Date().toISOString(),
      insurer: {
        reference: `Organization/${input.payerId}`,
        display: input.payerId,
      },
      provider: { reference: input.procedure.requester?.reference ?? 'Practitioner/unknown' },
      priority: { coding: [{ code: 'normal' }] },
      insurance: [
        {
          sequence: 1,
          focal: true,
          coverage: { reference: `Coverage/${input.coverage.id ?? 'unknown'}` },
        },
      ],
      item: [
        {
          sequence: 1,
          productOrService: input.procedure.code ?? {
            coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: 'unknown' }],
          },
          servicedDate: input.procedure.authoredOn ?? new Date().toISOString().split('T')[0],
        },
      ],
      extension: [
        { url: 'pe:correlation-id', valueString: correlationId },
        { url: 'pe:procedure-display', valueString: procedureCode?.display ?? 'Unknown procedure' },
      ],
    };

    const entries: PASBundle['entry'] = [
      { fullUrl: `urn:uuid:${claimId}`, resource: claim as unknown as FhirResource },
      { fullUrl: `urn:uuid:${input.patient.id ?? uuidv4()}`, resource: input.patient },
      { fullUrl: `urn:uuid:${input.coverage.id ?? uuidv4()}`, resource: input.coverage },
      { fullUrl: `urn:uuid:${input.procedure.id ?? uuidv4()}`, resource: input.procedure },
    ];

    if (input.documentation) {
      entries.push({
        fullUrl: `urn:uuid:${input.documentation.id ?? uuidv4()}`,
        resource: input.documentation,
      });
    }

    return {
      resourceType: 'Bundle',
      type: 'collection',
      id: correlationId,
      entry: entries,
    };
  }
}

// ── X12 278 Bridge ────────────────────────────────────────────────────────────

export class X12Bridge {
  translate(bundle: PASBundle): X12Transaction {
    const icn = String(Date.now()).slice(-9);
    const claim = bundle.entry.find((e) => e.resource.resourceType === 'Claim')?.resource as
      | (FhirResource & Record<string, unknown>)
      | undefined;

    const patientEntry = bundle.entry.find((e) => e.resource.resourceType === 'Patient')?.resource as
      | (FhirResource & { name?: Array<{ family?: string; given?: string[] }>; birthDate?: string })
      | undefined;

    const patientName = patientEntry?.name?.[0];
    const patientLast = patientName?.family ?? 'UNKNOWN';
    const patientFirst = patientName?.given?.[0] ?? 'UNKNOWN';
    const dob = (patientEntry?.birthDate ?? '1900-01-01').replace(/-/g, '');

    const item = (claim?.['item'] as Array<{ productOrService?: { coding?: Array<{ code?: string }> }; servicedDate?: string }> | undefined)?.[0];
    const cptCode = item?.productOrService?.coding?.[0]?.code ?? '00000';
    const serviceDate = (item?.servicedDate ?? new Date().toISOString().split('T')[0]).replace(/-/g, '');

    const segments: X12Segment[] = [
      { id: 'ISA', elements: ['00', '', '00', '', 'ZZ', 'PE', '01', 'PAYER', new Date().toISOString().slice(2, 10).replace(/-/g, ''), '1200', '^', '00501', icn, '0', 'P', ':'] },
      { id: 'GS', elements: ['HS', 'PE', 'PAYER', new Date().toISOString().slice(0, 10).replace(/-/g, ''), '1200', '1', 'X', '005010X217'] },
      { id: 'ST', elements: ['278', '0001', '005010X217'] },
      { id: 'BHT', elements: ['0007', '13', bundle.id ?? icn, serviceDate, '', 'RQ'] },
      { id: 'HL', elements: ['1', '', '20', '1'] },
      { id: 'NM1', elements: ['X3', '2', 'PAYER', '', '', '', '', 'PI', 'PAYERID'] },
      { id: 'HL', elements: ['2', '1', '21', '1'] },
      { id: 'NM1', elements: ['1P', '2', 'PROVIDER', '', '', '', '', 'XX', '1234567890'] },
      { id: 'HL', elements: ['3', '2', '22', '0'] },
      { id: 'NM1', elements: ['QC', '1', patientLast, patientFirst, '', '', '', 'MI', 'MEMBERID'] },
      { id: 'DMG', elements: ['D8', dob, 'U'] },
      { id: 'HL', elements: ['4', '3', 'SS', '0'] },
      { id: 'UM', elements: ['SC', 'I', '', '', '', '', '', 'Y', 'N'] },
      { id: 'SV1', elements: [`HC:${cptCode}`, '', 'UN', '1', '', '', '1'] },
      { id: 'DTP', elements: ['472', 'D8', serviceDate] },
      { id: 'SE', elements: ['15', '0001'] },
      { id: 'GE', elements: ['1', '1'] },
      { id: 'IEA', elements: ['1', icn] },
    ];

    const raw = segments.map((s) => `${s.id}*${s.elements.join('*')}~`).join('\n');

    return { interchangeControlNumber: icn, segments, raw };
  }
}

// ── PASubmitter ───────────────────────────────────────────────────────────────

export class PASubmitter {
  private readonly payerId: string;

  constructor(payerId: string) {
    this.payerId = payerId;
  }

  async submit(bundle: PASBundle): Promise<PASubmissionResult> {
    const correlationId = bundle.id ?? uuidv4();

    // Sandbox mode
    if (process.env['PAS_SANDBOX_MODE'] === 'true' || !process.env['PAS_LIVE_MODE']) {
      return this.sandboxSubmit(correlationId);
    }

    const payer = getPayerEndpoint(this.payerId);
    try {
      const response = await axios.post<FhirResource>(
        `${payer.pasUrl}/$submit`,
        bundle,
        {
          headers: {
            'Content-Type': 'application/fhir+json',
            Accept: 'application/fhir+json',
          },
          timeout: 30_000,
          validateStatus: () => true,
        },
      );

      if (response.status === 200) {
        return {
          correlationId,
          decision: 'approved',
          claimResponseId: (response.data as unknown as Record<string, unknown>)['id'] as string | undefined,
          rawResponse: response.data,
        };
      }

      if (response.status === 202) {
        return {
          correlationId,
          decision: 'pending',
          pollingUrl: response.headers['content-location'] as string | undefined,
          rawResponse: response.data,
        };
      }

      return {
        correlationId,
        decision: 'error',
        message: `Payer returned ${response.status}`,
        rawResponse: response.data,
      };
    } catch (err) {
      return {
        correlationId,
        decision: 'error',
        message: (err as Error).message,
      };
    }
  }

  private sandboxSubmit(correlationId: string): PASubmissionResult {
    // 70% approval, 30% pending for sandbox
    const rand = Math.random();
    if (rand < 0.7) {
      return {
        correlationId,
        decision: 'approved',
        claimResponseId: `cr-${correlationId}`,
        message: 'Prior authorization approved (sandbox)',
      };
    }
    return {
      correlationId,
      decision: 'pending',
      pollingUrl: `/v1/pa/${correlationId}/status`,
      message: 'Decision pending (sandbox)',
    };
  }
}

// ── PAPoller ──────────────────────────────────────────────────────────────────

export class PAPoller {
  private readonly payerId: string;
  private readonly intervalMs: number;
  private readonly maxMs: number;

  constructor(payerId: string, intervalMs = 30_000, maxMs = 48 * 60 * 60 * 1000) {
    this.payerId = payerId;
    this.intervalMs = intervalMs;
    this.maxMs = maxMs;
  }

  async poll(
    correlationId: string,
    pollingUrl?: string,
    onStatus?: (decision: PADecision) => void,
  ): Promise<PADecision> {
    const deadline = Date.now() + this.maxMs;

    while (Date.now() < deadline) {
      const decision = await this.checkStatus(correlationId, pollingUrl);
      if (decision !== 'pending') {
        onStatus?.(decision);
        return decision;
      }
      onStatus?.('pending');
      await new Promise((r) => setTimeout(r, this.intervalMs));
    }

    onStatus?.('error');
    return 'error';
  }

  private async checkStatus(correlationId: string, pollingUrl?: string): Promise<PADecision> {
    // Sandbox mode
    if (process.env['PAS_SANDBOX_MODE'] === 'true' || !process.env['PAS_LIVE_MODE']) {
      return Math.random() < 0.6 ? 'approved' : 'denied';
    }

    try {
      const payer = getPayerEndpoint(this.payerId);
      const url = pollingUrl ?? `${payer.pasUrl}/ClaimResponse?request=${correlationId}`;
      const response = await axios.get<FhirResource>(url, {
        headers: { Accept: 'application/fhir+json' },
        timeout: 10_000,
      });

      const outcome = (response.data as unknown as Record<string, unknown>)['outcome'] as string | undefined;
      if (outcome === 'complete') return 'approved';
      if (outcome === 'error') return 'denied';
      return 'pending';
    } catch {
      return 'pending';
    }
  }
}

// ── AppealBuilder ─────────────────────────────────────────────────────────────

export class AppealBuilder {
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async build(
    originalBundle: PASBundle,
    denialResponse: FhirResource,
    clinicalNotes: string[] = [],
  ): Promise<AppealBundle> {
    const denialReason = await this.summarizeDenial(denialResponse);
    const appealArgument = await this.buildAppealArgument(denialReason, clinicalNotes);

    const appealId = uuidv4();
    const originalClaim = originalBundle.entry.find((e) => e.resource.resourceType === 'Claim');

    const appealClaim: Record<string, unknown> = {
      ...(originalClaim?.resource as unknown as Record<string, unknown> ?? {}),
      id: appealId,
      meta: {
        profile: ['http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claim'],
      },
      extension: [
        ...((originalClaim?.resource as unknown as Record<string, unknown>)?.['extension'] as unknown[] ?? []),
        { url: 'pe:appeal', valueBoolean: true },
        { url: 'pe:denial-reason', valueString: denialReason },
        { url: 'pe:appeal-argument', valueString: appealArgument },
      ],
    };

    return {
      resourceType: 'Bundle',
      type: 'collection',
      id: `appeal-${appealId}`,
      entry: [
        { fullUrl: `urn:uuid:${appealId}`, resource: appealClaim as unknown as FhirResource },
        ...originalBundle.entry.filter((e) => e.resource.resourceType !== 'Claim'),
      ],
    };
  }

  private async summarizeDenial(response: FhirResource): Promise<string> {
    try {
      const res = response as unknown as Record<string, unknown>;
      const outcome = res['outcome'] as string | undefined;
      const error = res['error'] as Array<{ text?: string; coding?: Array<{ display?: string }> }> | undefined;

      const rawText = error?.[0]?.text ?? error?.[0]?.coding?.[0]?.display ?? outcome ?? JSON.stringify(response).slice(0, 500);

      const message = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: `Summarize this prior authorization denial reason in 1-2 sentences: ${rawText}`,
          },
        ],
      });

      const content = message.content[0];
      return content.type === 'text' ? content.text : rawText;
    } catch {
      return 'Prior authorization denied by payer.';
    }
  }

  private async buildAppealArgument(denialReason: string, clinicalNotes: string[]): Promise<string> {
    try {
      const context = clinicalNotes.slice(0, 3).join('\n---\n') || 'No clinical notes provided.';

      const message = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `You are a clinical appeals specialist. The payer denied the prior authorization with this reason: "${denialReason}".

Based on these clinical notes:
${context}

Write the strongest 2-3 sentence appeal argument citing clinical necessity and evidence.`,
          },
        ],
      });

      const content = message.content[0];
      return content.type === 'text' ? content.text : 'Appeal based on medical necessity.';
    } catch {
      return 'Appeal based on documented medical necessity and clinical guidelines.';
    }
  }
}
