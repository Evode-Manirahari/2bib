'use client';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export const API_KEY_STORAGE = 'pe_api_key';

export function getStoredApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(API_KEY_STORAGE) ?? '';
}

export function setStoredApiKey(key: string) {
  localStorage.setItem(API_KEY_STORAGE, key);
}

export function clearStoredApiKey() {
  localStorage.removeItem(API_KEY_STORAGE);
}

// ── Typed API client ──────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  apiKey?: string,
): Promise<T> {
  const key = apiKey ?? getStoredApiKey();
  const res = await fetch(`${API_BASE}/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── /me ───────────────────────────────────────────────────────────────────────

export interface MeResponse {
  id: string;
  prefix: string;
  tier: string;
  callCount: number;
  rateLimit: number;
  projectId: string;
  createdAt: string;
  lastUsedAt?: string;
}

export function fetchMe(apiKey?: string) {
  return apiFetch<MeResponse>('/me', {}, apiKey);
}

// ── /logs ─────────────────────────────────────────────────────────────────────

export interface RequestLog {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  payerTarget?: string;
  resourceType?: string;
  error?: string;
  createdAt: string;
}

export interface LogsResponse {
  data: RequestLog[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export function fetchLogs(params: { page?: number; pageSize?: number; method?: string; minStatus?: number; maxStatus?: number } = {}) {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.pageSize) q.set('pageSize', String(params.pageSize));
  if (params.method) q.set('method', params.method);
  if (params.minStatus) q.set('minStatus', String(params.minStatus));
  if (params.maxStatus) q.set('maxStatus', String(params.maxStatus));
  return apiFetch<LogsResponse>(`/logs?${q}`);
}

// ── /validate ─────────────────────────────────────────────────────────────────

export interface ValidationError {
  severity: string;
  category: string;
  path: string;
  message: string;
  suggestion?: string;
  igLink?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  errors: ValidationError[];
  profile?: string;
  engine?: string;
  durationMs: number;
  cached?: boolean;
}

export interface ValidateProfile {
  id: string;
  name: string;
  description: string;
  requiresJava: boolean;
}

export function fetchProfiles() {
  return apiFetch<{ profiles: ValidateProfile[] }>('/validate/profiles');
}

export function validateResource(resource: unknown, opts: { profile?: string; enrich?: boolean; mode?: string } = {}) {
  return apiFetch<ValidationResult>('/validate', {
    method: 'POST',
    body: JSON.stringify({ resource, ...opts }),
  });
}

// ── /pa ───────────────────────────────────────────────────────────────────────

export interface PayerProfile {
  id: string;
  name: string;
  autoApproveRate: number;
  denialReasons: string[];
}

export interface PASimulation {
  id: string;
  payerProfile: string;
  currentStatus: string;
  timeline: Array<{ status: string; timestamp: string; note?: string }>;
  claim?: unknown;
  response?: unknown;
}

export function fetchPayers() {
  return apiFetch<{ payers: PayerProfile[] }>('/pa/payers');
}

export function submitPA(body: {
  payerId: string;
  patientRef?: string;
  icd10?: string;
  cptCode?: string;
  scenario?: string;
}) {
  return apiFetch<PASimulation>('/pa/submit', { method: 'POST', body: JSON.stringify(body) });
}

export function fetchPA(id: string) {
  return apiFetch<PASimulation>(`/pa/${id}`);
}

// ── /workflows ────────────────────────────────────────────────────────────────

export interface WorkflowTemplate {
  name: string;
  description?: string;
  steps: Array<{ name: string; action: string }>;
}

export interface StepResult {
  name: string;
  action: string;
  status: 'pass' | 'fail' | 'skip' | 'error';
  durationMs: number;
  error?: string;
}

export interface WorkflowRun {
  id: string;
  workflowName: string;
  status: string;
  steps: StepResult[];
  durationMs?: number;
  createdAt: string;
}

export function fetchWorkflowTemplates() {
  return apiFetch<{ templates: Array<{ name: string; description: string; file: string }> }>('/workflows/templates');
}

export function fetchWorkflowTemplate(name: string) {
  return apiFetch<{ template: WorkflowTemplate }>(`/workflows/templates/${name}`);
}

export function runWorkflow(templateName: string, vars?: Record<string, unknown>) {
  return apiFetch<WorkflowRun>('/workflows/run', {
    method: 'POST',
    body: JSON.stringify({ templateName, vars }),
  });
}

export function fetchWorkflowRuns(params: { page?: number; pageSize?: number } = {}) {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.pageSize) q.set('pageSize', String(params.pageSize));
  return apiFetch<{ data: WorkflowRun[]; total: number; page: number; pageSize: number; hasMore: boolean }>(`/workflows?${q}`);
}

// ── /keys ─────────────────────────────────────────────────────────────────────

export interface RotateKeyResponse {
  rawKey: string;
  prefix: string;
  id: string;
  createdAt: string;
}

export function rotateApiKey() {
  return apiFetch<RotateKeyResponse>('/keys/rotate', { method: 'POST' });
}
