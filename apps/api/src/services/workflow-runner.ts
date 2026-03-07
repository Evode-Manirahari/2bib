import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import axios from 'axios';
import type { StepResult, RunStatus } from '@pe/types';

// ── Service URLs ──────────────────────────────────────────────────────────────

const VALIDATOR_URL = process.env['VALIDATOR_URL'] ?? 'http://localhost:3010';
const PA_URL = process.env['PA_SIMULATOR_URL'] ?? 'http://localhost:3003';

// ── Template types ────────────────────────────────────────────────────────────

export interface WorkflowStep {
  name: string;
  action: 'validate' | 'pa-submit' | 'pa-status' | 'pa-appeal' | 'pa-info' | 'fhir-read' | 'fhir-search' | 'assert';
  input?: Record<string, unknown>;
  assert?: Record<string, unknown>;
}

export interface WorkflowTemplate {
  name: string;
  description?: string;
  vars?: Record<string, unknown>;
  steps: WorkflowStep[];
}

export interface WorkflowRunResult {
  workflowName: string;
  status: RunStatus;
  steps: StepResult[];
  durationMs: number;
}

// ── Template discovery ────────────────────────────────────────────────────────

const WORKFLOWS_DIR = path.join(process.cwd(), 'data', 'workflows');

export function listTemplates(): Array<{ name: string; description: string; file: string }> {
  try {
    if (!fs.existsSync(WORKFLOWS_DIR)) return [];
    return fs
      .readdirSync(WORKFLOWS_DIR)
      .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map((file) => {
        try {
          const raw = fs.readFileSync(path.join(WORKFLOWS_DIR, file), 'utf8');
          const tpl = yaml.load(raw) as WorkflowTemplate;
          return { name: tpl.name ?? file.replace(/\.ya?ml$/, ''), description: tpl.description?.trim() ?? '', file };
        } catch {
          return { name: file.replace(/\.ya?ml$/, ''), description: '', file };
        }
      });
  } catch {
    return [];
  }
}

export function loadTemplate(nameOrFile: string): WorkflowTemplate {
  // Try exact file name first, then name match
  const candidates = [
    path.join(WORKFLOWS_DIR, nameOrFile),
    path.join(WORKFLOWS_DIR, `${nameOrFile}.yaml`),
    path.join(WORKFLOWS_DIR, `${nameOrFile}.yml`),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const raw = fs.readFileSync(candidate, 'utf8');
      return yaml.load(raw) as WorkflowTemplate;
    }
  }

  // Search by template name field
  const templates = listTemplates();
  const match = templates.find((t) => t.name === nameOrFile);
  if (match) {
    const raw = fs.readFileSync(path.join(WORKFLOWS_DIR, match.file), 'utf8');
    return yaml.load(raw) as WorkflowTemplate;
  }

  throw new Error(`Workflow template not found: ${nameOrFile}`);
}

// ── Variable interpolation ────────────────────────────────────────────────────

/**
 * Resolve {{ vars.x }} and {{ steps.name.output.field }} references.
 */
export function interpolate(
  value: unknown,
  vars: Record<string, unknown>,
  stepOutputs: Record<string, unknown>,
): unknown {
  if (typeof value === 'string') {
    // Replace all {{ expr }} tokens
    const result = value.replace(/\{\{\s*([\w.\-]+)\s*\}\}/g, (_match, expr: string) => {
      const parts = expr.split('.');
      let cur: unknown = parts[0] === 'vars' ? vars : parts[0] === 'steps' ? stepOutputs : undefined;
      for (let i = 1; i < parts.length; i++) {
        if (cur == null || typeof cur !== 'object') return '';
        cur = (cur as Record<string, unknown>)[parts[i]!];
      }
      return cur == null ? '' : String(cur);
    });
    return result;
  }

  if (Array.isArray(value)) {
    return value.map((item) => interpolate(item, vars, stepOutputs));
  }

  if (value !== null && typeof value === 'object') {
    const resolved: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      resolved[k] = interpolate(v, vars, stepOutputs);
    }
    return resolved;
  }

  return value;
}

// ── Assertion checker ─────────────────────────────────────────────────────────

function checkAssertions(
  asserts: Record<string, unknown>,
  output: Record<string, unknown>,
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  for (const [key, expected] of Object.entries(asserts)) {
    const actual = output[key];
    const exp = String(expected);
    const act = String(actual);
    if (act !== exp) {
      failures.push(`assert.${key}: expected "${exp}", got "${act}"`);
    }
  }

  return { passed: failures.length === 0, failures };
}

// ── Step executors ────────────────────────────────────────────────────────────

async function executeValidate(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await axios.post<Record<string, unknown>>(
    `${VALIDATOR_URL}/validate`,
    input,
    { timeout: 30_000, validateStatus: () => true },
  );
  return response.data;
}

async function executePaSubmit(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await axios.post<Record<string, unknown>>(
    `${PA_URL}/pa/submit`,
    input,
    { timeout: 30_000, validateStatus: () => true },
  );
  return response.data;
}

async function executePaStatus(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { id, ...rest } = input;
  if (!id) throw new Error('pa-status requires input.id');
  const response = await axios.get<Record<string, unknown>>(
    `${PA_URL}/pa/${String(id)}`,
    { params: rest, timeout: 30_000, validateStatus: () => true },
  );
  return response.data;
}

async function executePaAppeal(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { id, ...body } = input;
  if (!id) throw new Error('pa-appeal requires input.id');
  const response = await axios.post<Record<string, unknown>>(
    `${PA_URL}/pa/${String(id)}/appeal`,
    body,
    { timeout: 30_000, validateStatus: () => true },
  );
  return response.data;
}

async function executePaInfo(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { id, ...body } = input;
  if (!id) throw new Error('pa-info requires input.id');
  const response = await axios.post<Record<string, unknown>>(
    `${PA_URL}/pa/${String(id)}/info`,
    body,
    { timeout: 30_000, validateStatus: () => true },
  );
  return response.data;
}

// ── Main runner ───────────────────────────────────────────────────────────────

export async function runWorkflow(
  template: WorkflowTemplate,
  overrideVars: Record<string, unknown> = {},
): Promise<WorkflowRunResult> {
  const vars = { ...(template.vars ?? {}), ...overrideVars };
  const stepOutputs: Record<string, unknown> = {};
  const results: StepResult[] = [];
  const startAll = Date.now();
  let workflowFailed = false;

  for (const step of template.steps) {
    const stepStart = Date.now();
    let output: Record<string, unknown> = {};
    let stepStatus: StepResult['status'] = 'pass';
    let errorMsg: string | undefined;

    if (workflowFailed) {
      results.push({ name: step.name, action: step.action, status: 'skip', durationMs: 0 });
      continue;
    }

    try {
      // Resolve input variables
      const resolvedInput = (
        step.input ? interpolate(step.input, vars, stepOutputs) : {}
      ) as Record<string, unknown>;

      // Dispatch action
      switch (step.action) {
        case 'validate':
          output = await executeValidate(resolvedInput);
          break;
        case 'pa-submit':
          output = await executePaSubmit(resolvedInput);
          break;
        case 'pa-status':
          output = await executePaStatus(resolvedInput);
          break;
        case 'pa-appeal':
          output = await executePaAppeal(resolvedInput);
          break;
        case 'pa-info':
          output = await executePaInfo(resolvedInput);
          break;
        case 'assert':
          // Pure assertion step — output IS the input for assert checking
          output = resolvedInput;
          break;
        default:
          throw new Error(`Unknown action: ${String(step.action)}`);
      }

      // Run assertions
      if (step.assert) {
        const resolvedAssert = interpolate(step.assert, vars, stepOutputs) as Record<string, unknown>;
        const { passed, failures } = checkAssertions(resolvedAssert, output);
        if (!passed) {
          stepStatus = 'fail';
          errorMsg = failures.join('; ');
          workflowFailed = true;
        }
      }

      // Store output for subsequent steps to reference
      stepOutputs[step.name] = { output };
    } catch (err) {
      stepStatus = 'error';
      errorMsg = (err as Error).message;
      workflowFailed = true;
    }

    results.push({
      name: step.name,
      action: step.action,
      status: stepStatus,
      durationMs: Date.now() - stepStart,
      output: stepStatus === 'pass' ? output : undefined,
      error: errorMsg,
    });
  }

  const allPassed = results.every((r) => r.status === 'pass' || r.status === 'skip');
  const anyError = results.some((r) => r.status === 'error');

  let status: RunStatus;
  if (allPassed) {
    status = 'PASSED';
  } else if (anyError) {
    status = 'ERROR';
  } else {
    status = 'FAILED';
  }

  return {
    workflowName: template.name,
    status,
    steps: results,
    durationMs: Date.now() - startAll,
  };
}
