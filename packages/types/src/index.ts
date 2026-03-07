// ── FHIR Core Types ─────────────────────────────────────────────────────────

export type FhirResourceType =
  | 'Patient'
  | 'Practitioner'
  | 'Coverage'
  | 'Claim'
  | 'ClaimResponse'
  | 'Condition'
  | 'Procedure'
  | 'MedicationRequest'
  | 'ServiceRequest'
  | 'DocumentReference'
  | 'Bundle'
  | 'OperationOutcome';

export interface FhirMeta {
  profile?: string[];
  lastUpdated?: string;
  versionId?: string;
  source?: string;
}

export interface FhirReference {
  reference: string;
  display?: string;
}

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: FhirMeta;
}

export interface FhirBundle extends FhirResource {
  resourceType: 'Bundle';
  type: 'searchset' | 'transaction' | 'batch' | 'collection' | 'document' | 'history';
  total?: number;
  entry?: Array<{
    fullUrl?: string;
    resource?: FhirResource;
    request?: { method: string; url: string };
    response?: { status: string };
  }>;
}

export interface FhirOperationOutcome extends FhirResource {
  resourceType: 'OperationOutcome';
  issue: Array<{
    severity: 'fatal' | 'error' | 'warning' | 'information';
    code: string;
    diagnostics?: string;
    expression?: string[];
    details?: FhirCodeableConcept;
  }>;
}

// ── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  code?: string;
  requestId?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ── Auth / API Key Types ─────────────────────────────────────────────────────

export type ApiKeyTier = 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE';
export type UserPlan = 'FREE' | 'PRO' | 'ENTERPRISE';

export interface ApiKeyInfo {
  id: string;
  prefix: string;
  tier: ApiKeyTier;
  callCount: number;
  rateLimit: number;
  createdAt: string;
  lastUsedAt?: string;
  projectId: string;
}

// ── Health Check ─────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  timestamp: string;
  version?: string;
  uptime?: number;
}

// ── Validation Types ─────────────────────────────────────────────────────────

export type ErrorCategory =
  | 'MISSING_REQUIRED'
  | 'INVALID_VALUE'
  | 'WRONG_TYPE'
  | 'PROFILE_MISMATCH'
  | 'REFERENCE_ERROR'
  | 'TERMINOLOGY_ERROR';

export interface EnrichedError {
  severity: 'fatal' | 'error' | 'warning' | 'information';
  category: ErrorCategory;
  path: string;
  message: string;
  suggestion?: string;
  igLink?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  errors: EnrichedError[];
  profile?: string;
  durationMs: number;
}

export interface FixResult {
  explanation: string;
  correctedResource: FhirResource;
  changesApplied: string[];
}

// ── PA Simulation Types ──────────────────────────────────────────────────────

export type PAStatus =
  | 'SUBMITTED'
  | 'PENDING_REVIEW'
  | 'PENDED_FOR_INFO'
  | 'RE_REVIEW'
  | 'APPROVED'
  | 'DENIED'
  | 'APPEAL_SUBMITTED'
  | 'APPEAL_REVIEW'
  | 'APPEAL_APPROVED'
  | 'APPEAL_DENIED'
  | 'PEER_TO_PEER_REQUESTED';

export interface PATimelineEvent {
  status: PAStatus;
  timestamp: string;
  note?: string;
  actor?: string;
}

export interface PASimulation {
  id: string;
  projectId: string;
  payerProfile: string;
  scenario?: string;
  status: PAStatus;
  claim: FhirResource;
  response?: FhirResource;
  timeline: PATimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

// ── Workflow Types ───────────────────────────────────────────────────────────

export type RunStatus = 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR';

export interface StepResult {
  name: string;
  action: string;
  status: 'pass' | 'fail' | 'skip' | 'error';
  durationMs: number;
  output?: unknown;
  error?: string;
}

export interface WorkflowRun {
  id: string;
  projectId: string;
  workflowName: string;
  status: RunStatus;
  steps: StepResult[];
  durationMs?: number;
  createdAt: string;
}

// ── Request Log ──────────────────────────────────────────────────────────────

export interface RequestLog {
  id: string;
  projectId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  payerTarget?: string;
  resourceType?: string;
  error?: string;
  createdAt: string;
}
