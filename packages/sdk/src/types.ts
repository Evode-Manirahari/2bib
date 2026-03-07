export interface PeClientOptions {
  apiKey: string;
  baseUrl?: string; // default 'http://localhost:3001'
  timeout?: number; // ms, default 30000
}

export interface ApiKeyInfo {
  id: string; prefix: string; tier: string;
  callCount: number; rateLimit: number; projectId: string;
  createdAt: string; lastUsedAt?: string;
}

export interface RequestLog {
  id: string; method: string; path: string;
  statusCode: number; durationMs: number;
  payerTarget?: string; resourceType?: string;
  error?: string; createdAt: string;
}

export interface LogsResponse {
  data: RequestLog[]; total: number; page: number; pageSize: number; hasMore: boolean;
}

export interface EnrichedError {
  severity: 'fatal'|'error'|'warning'|'information';
  category: string; path: string; message: string;
  suggestion?: string; igLink?: string;
}

export interface ValidationResult {
  isValid: boolean; errorCount: number; warningCount: number;
  errors: EnrichedError[]; profile?: string; engine?: string;
  durationMs: number; cached?: boolean;
}

export interface FixResult {
  explanation: string; correctedResource: Record<string, unknown>; changesApplied: string[];
}

export interface ValidateProfile {
  id: string; name: string; description: string; requiresJava: boolean; url?: string;
}

export interface PATimelineEvent {
  status: string; timestamp: string; note?: string; actor?: string;
}

export interface PASimulation {
  id: string; projectId: string; payerProfile: string; scenario?: string;
  currentStatus: string; claim?: Record<string, unknown>; response?: Record<string, unknown>;
  timeline: PATimelineEvent[]; createdAt: string; updatedAt: string;
}

export interface PayerProfile {
  id: string; name: string; autoApproveRate: number;
  appealSuccessRate: number; requiresPeerToPeer: boolean;
  denialReasons: Array<{ code: string; description: string; probability: number }>;
}

export interface StepResult {
  name: string; action: string; status: 'pass'|'fail'|'skip'|'error';
  durationMs: number; output?: unknown; error?: string;
}

export interface WorkflowRun {
  id: string; projectId: string; workflowName: string; status: string;
  steps: StepResult[]; durationMs?: number; createdAt: string;
}

export interface WorkflowTemplate {
  name: string; description?: string;
  vars?: Record<string, unknown>;
  steps: Array<{ name: string; action: string; input?: Record<string, unknown>; assert?: Record<string, unknown> }>;
}

export interface WorkflowTemplateInfo {
  name: string; description: string; file: string;
}

export interface WorkflowRunsResponse {
  data: WorkflowRun[]; total: number; page: number; pageSize: number; hasMore: boolean;
}

export interface FhirSearchResponse {
  resourceType: 'Bundle'; type: string; total?: number;
  entry?: Array<{ resource?: Record<string, unknown>; fullUrl?: string }>;
}
