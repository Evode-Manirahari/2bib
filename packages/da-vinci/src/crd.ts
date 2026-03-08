// ── Da Vinci CRD Client ────────────────────────────────────────────────────────
// CDS Hooks 2.0 — Coverage Requirements Discovery

import axios, { type AxiosInstance } from 'axios';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getPayerEndpoint, type HookType } from './payer-registry';
import type { FhirResource, FhirCoding } from '@pe/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CrdContext {
  patientId: string;
  encounterId?: string;
  draftOrders?: FhirResource[];
}

export interface CdsHookRequest {
  hookInstance: string;
  hook: HookType;
  context: CrdContext;
  prefetch?: Record<string, FhirResource>;
}

export interface CdsCard {
  summary: string;
  indicator: 'info' | 'warning' | 'critical';
  detail?: string;
  source: { label: string; url?: string };
  suggestions?: Array<{
    label: string;
    actions?: Array<{ type: string; description: string }>;
  }>;
  extension?: Record<string, unknown>;
}

export interface CdsHookResponse {
  cards: CdsCard[];
}

export interface CrdResult {
  paRequired: boolean;
  documentationNeeded: string[];
  alternatives: FhirCoding[];
  rawCards: CdsCard[];
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

// ── CdsHooksClient ─────────────────────────────────────────────────────────────

export class CdsHooksClient {
  private readonly payerId: string;
  private readonly http: AxiosInstance;
  private tokenCache: TokenCache | null = null;
  private readonly maxRetries = 3;

  constructor(payerId: string) {
    this.payerId = payerId;
    this.http = axios.create({ timeout: 10_000 });
  }

  // ── SMART Backend Services auth ────────────────────────────────────────────

  private buildJwtAssertion(tokenUrl: string, clientId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: clientId,
      sub: clientId,
      aud: tokenUrl,
      jti: uuidv4(),
      iat: now,
      exp: now + 300,
    };
    // In a real system you'd use an RSA private key. For sandbox we use HS256 with a shared secret.
    const secret = process.env['SMART_JWT_SECRET'] ?? 'pe-sandbox-secret';
    return jwt.sign(payload, secret, { algorithm: 'HS256' });
  }

  async getAccessToken(): Promise<string> {
    const payer = getPayerEndpoint(this.payerId);
    const now = Date.now();

    if (this.tokenCache && this.tokenCache.expiresAt > now + 30_000) {
      return this.tokenCache.accessToken;
    }

    const assertion = this.buildJwtAssertion(payer.tokenUrl, payer.clientId);

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: assertion,
      scope: 'system/*.read',
    });

    // For sandbox mode (no real payer endpoint), return a mock token
    if (process.env['CRD_SANDBOX_MODE'] === 'true' || !process.env['CRD_LIVE_MODE']) {
      const mockToken = `sandbox-token-${this.payerId}-${now}`;
      this.tokenCache = { accessToken: mockToken, expiresAt: now + 3_600_000 };
      return mockToken;
    }

    const response = await this.http.post<{ access_token: string; expires_in: number }>(
      payer.tokenUrl,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    this.tokenCache = {
      accessToken: response.data.access_token,
      expiresAt: now + response.data.expires_in * 1000,
    };
    return this.tokenCache.accessToken;
  }

  // ── Prefetch bundle builder ────────────────────────────────────────────────

  buildPrefetch(resources: {
    patient?: FhirResource;
    coverage?: FhirResource;
    encounter?: FhirResource;
    serviceRequest?: FhirResource;
  }): Record<string, FhirResource> {
    const prefetch: Record<string, FhirResource> = {};
    if (resources.patient) prefetch['patient'] = resources.patient;
    if (resources.coverage) prefetch['coverage'] = resources.coverage;
    if (resources.encounter) prefetch['encounter'] = resources.encounter;
    if (resources.serviceRequest) prefetch['serviceRequest'] = resources.serviceRequest;
    return prefetch;
  }

  // ── Hook request builder ───────────────────────────────────────────────────

  buildHookRequest(
    hook: HookType,
    context: CrdContext,
    prefetch?: Record<string, FhirResource>,
  ): CdsHookRequest {
    return {
      hookInstance: uuidv4(),
      hook,
      context,
      prefetch,
    };
  }

  // ── Response parser ────────────────────────────────────────────────────────

  parseResponse(response: CdsHookResponse): CrdResult {
    const paRequired = response.cards.some(
      (c) =>
        c.extension?.['pa-required'] === true ||
        (c.indicator === 'critical' && c.summary.toLowerCase().includes('prior authorization required')),
    );

    const documentationNeeded: string[] = [];
    const alternatives: FhirCoding[] = [];

    for (const card of response.cards) {
      // Extract documentation requirements
      const docNeeded = card.extension?.['documentation-needed'];
      if (Array.isArray(docNeeded)) {
        documentationNeeded.push(...(docNeeded as string[]));
      } else if (typeof docNeeded === 'string') {
        documentationNeeded.push(docNeeded);
      }

      // Extract alternative codings
      const alts = card.extension?.['alternatives'];
      if (Array.isArray(alts)) {
        alternatives.push(...(alts as FhirCoding[]));
      }

      // Parse from suggestions
      if (card.suggestions) {
        for (const suggestion of card.suggestions) {
          if (suggestion.label.toLowerCase().includes('alternative')) {
            alternatives.push({ display: suggestion.label });
          }
        }
      }
    }

    return { paRequired, documentationNeeded, alternatives, rawCards: response.cards };
  }

  // ── Main hook execution with retry ────────────────────────────────────────

  async callHook(
    hook: HookType,
    context: CrdContext,
    resources: {
      patient?: FhirResource;
      coverage?: FhirResource;
      encounter?: FhirResource;
      serviceRequest?: FhirResource;
    } = {},
  ): Promise<CrdResult> {
    const payer = getPayerEndpoint(this.payerId);
    const prefetch = this.buildPrefetch(resources);
    const hookRequest = this.buildHookRequest(hook, context, prefetch);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Sandbox mode: return deterministic response without hitting real endpoint
        if (process.env['CRD_SANDBOX_MODE'] === 'true' || !process.env['CRD_LIVE_MODE']) {
          return this.sandboxResponse(hookRequest);
        }

        const token = await this.getAccessToken();
        const resp = await this.http.post<CdsHookResponse>(
          payer.crdUrl,
          hookRequest,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        );
        return this.parseResponse(resp.data);
      } catch (err) {
        lastError = err as Error;
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
        }
      }
    }

    throw new Error(`CRD request failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  // ── Sandbox deterministic response ────────────────────────────────────────

  private sandboxResponse(request: CdsHookRequest): CrdResult {
    // Determine PA required based on hook type
    const paRequired = request.hook === 'order-sign' || request.hook === 'order-dispatch';

    const cards: CdsCard[] = paRequired
      ? [
          {
            summary: 'Prior Authorization Required',
            indicator: 'critical',
            detail: 'This procedure requires prior authorization from the payer.',
            source: { label: this.payerId },
            extension: {
              'pa-required': true,
              'documentation-needed': [
                'Clinical notes from last 6 months',
                'Diagnosis supporting documentation',
                'Previous treatment history',
              ],
            },
          },
        ]
      : [
          {
            summary: 'No Prior Authorization Required',
            indicator: 'info',
            detail: 'This procedure does not require prior authorization.',
            source: { label: this.payerId },
            extension: { 'pa-required': false },
          },
        ];

    return this.parseResponse({ cards });
  }
}
