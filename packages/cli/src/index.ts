#!/usr/bin/env node
// ── Pe CLI ────────────────────────────────────────────────────────────────────

import { Command } from 'commander';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import ora from 'ora';
import { readConfig, writeConfig, getApiKey, getBaseUrl } from './config';
import { peRequest, PeApiError } from './http';
import { printJson, printTable, printError, printSuccess } from './output';

const program = new Command();

program
  .name('pe')
  .description('Pe — AI for FHIR APIs')
  .version('0.1.0')
  .option('--api-key <key>', 'API key (overrides config/env)')
  .option('--base-url <url>', 'API base URL')
  .option('--json', 'Output machine-readable JSON');

// ── Exit codes ────────────────────────────────────────────────────────────────
const EXIT = { SUCCESS: 0, API_ERROR: 1, VALIDATION_ERROR: 2, AUTH_ERROR: 3 } as const;

function resolveOpts(cmd: Command): { apiKey: string; baseUrl: string; json: boolean } {
  const opts = program.opts<{ apiKey?: string; baseUrl?: string; json?: boolean }>();
  const apiKey = getApiKey(opts.apiKey);
  const baseUrl = getBaseUrl(opts.baseUrl);
  const json = opts.json ?? false;

  if (!apiKey) {
    printError('No API key found. Run `pe auth login` or set PE_API_KEY.', json);
    process.exit(EXIT.AUTH_ERROR);
  }

  return { apiKey, baseUrl, json };
}

// ── pe auth ───────────────────────────────────────────────────────────────────

const auth = program.command('auth').description('Authentication commands');

auth
  .command('login')
  .description('Authenticate with Pe (stores API key in ~/.pe/config.json)')
  .action(async () => {
    console.log('Pe Authentication');
    console.log('─────────────────');
    console.log('Get your API key at https://getpe.dev/dashboard\n');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const apiKey = await new Promise<string>((resolve) => {
      rl.question('Paste your API key: ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });

    if (!apiKey.startsWith('pe_')) {
      printError('Invalid API key format. Keys start with pe_test_ or pe_live_');
      process.exit(EXIT.AUTH_ERROR);
    }

    const baseUrl = getBaseUrl();
    try {
      const me = await peRequest<{ email?: string; plan?: string }>('GET', '/v1/me', { apiKey, baseUrl });
      writeConfig({ apiKey, baseUrl, email: me.email, plan: me.plan });
      console.log(`\nLogged in as ${me.email ?? 'unknown'} (${me.plan ?? 'FREE'} plan)`);
      process.exit(EXIT.SUCCESS);
    } catch (err) {
      if (err instanceof PeApiError && err.statusCode === 401) {
        printError('Invalid API key');
        process.exit(EXIT.AUTH_ERROR);
      }
      // Save anyway for offline use
      writeConfig({ apiKey, baseUrl });
      console.log('API key saved (could not verify — check your connection)');
      process.exit(EXIT.SUCCESS);
    }
  });

auth
  .command('whoami')
  .description('Show current user and plan')
  .action(async () => {
    const { apiKey, baseUrl, json } = resolveOpts(program);
    try {
      const me = await peRequest<{ email?: string; plan?: string; project?: unknown }>('GET', '/v1/me', { apiKey, baseUrl });
      if (json) {
        printJson(me);
      } else {
        console.log(`Email : ${me.email ?? 'unknown'}`);
        console.log(`Plan  : ${me.plan ?? 'FREE'}`);
      }
    } catch (err) {
      printError((err as Error).message, json);
      process.exit(err instanceof PeApiError && err.statusCode === 401 ? EXIT.AUTH_ERROR : EXIT.API_ERROR);
    }
  });

// ── pe fhir ───────────────────────────────────────────────────────────────────

const fhir = program.command('fhir').description('FHIR resource operations');

fhir
  .command('read <resource> <id>')
  .description('Read a FHIR resource by type and ID')
  .action(async (resource: string, id: string) => {
    const { apiKey, baseUrl, json } = resolveOpts(program);
    try {
      const result = await peRequest<unknown>('GET', `/v1/fhir/${resource}/${id}`, { apiKey, baseUrl });
      printJson(result);
    } catch (err) {
      printError((err as Error).message, json);
      process.exit(EXIT.API_ERROR);
    }
  });

fhir
  .command('search <resource>')
  .description('Search FHIR resources')
  .option('--param <params...>', 'Query params as key=value')
  .action(async (resource: string, opts: { param?: string[] }) => {
    const { apiKey, baseUrl, json } = resolveOpts(program);
    const params = new URLSearchParams();
    for (const p of opts.param ?? []) {
      const [k, v] = p.split('=');
      if (k && v) params.set(k, v);
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    try {
      const result = await peRequest<unknown>('GET', `/v1/fhir/${resource}${qs}`, { apiKey, baseUrl });
      printJson(result);
    } catch (err) {
      printError((err as Error).message, json);
      process.exit(EXIT.API_ERROR);
    }
  });

// ── pe validate ───────────────────────────────────────────────────────────────

const validate = program.command('validate').description('FHIR validation');

validate
  .argument('<file>', 'Path to FHIR JSON file')
  .option('--enrich', 'AI-enrich validation errors')
  .description('Validate a FHIR JSON file')
  .action(async (file: string, opts: { enrich?: boolean }) => {
    const { apiKey, baseUrl, json } = resolveOpts(program);
    const filePath = path.resolve(file);

    if (!fs.existsSync(filePath)) {
      printError(`File not found: ${filePath}`, json);
      process.exit(EXIT.VALIDATION_ERROR);
    }

    let resource: unknown;
    try {
      resource = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      printError('Invalid JSON file', json);
      process.exit(EXIT.VALIDATION_ERROR);
    }

    const spinner = json ? null : ora('Validating...').start();
    try {
      const result = await peRequest<{
        isValid: boolean;
        errorCount: number;
        warningCount: number;
        errors: Array<{ severity: string; path: string; message: string; suggestion?: string }>;
      }>('POST', '/v1/validate', { apiKey, baseUrl }, { resource, enrich: opts.enrich });

      spinner?.stop();

      if (json) {
        printJson(result);
      } else {
        console.log(`\n${result.isValid ? '✓ Valid' : '✗ Invalid'} — ${result.errorCount} errors, ${result.warningCount} warnings\n`);
        for (const err of result.errors) {
          const icon = err.severity === 'error' || err.severity === 'fatal' ? '✗' : '⚠';
          console.log(`  ${icon} [${err.path}] ${err.message}`);
          if (err.suggestion) console.log(`    → ${err.suggestion}`);
        }
      }

      process.exit(result.isValid ? EXIT.SUCCESS : EXIT.VALIDATION_ERROR);
    } catch (err) {
      spinner?.fail();
      printError((err as Error).message, json);
      process.exit(EXIT.API_ERROR);
    }
  });

validate
  .command('fix <file>')
  .description('AI auto-fix a FHIR JSON file, writes <file>.fixed.json')
  .action(async (file: string) => {
    const { apiKey, baseUrl, json } = resolveOpts(program);
    const filePath = path.resolve(file);

    if (!fs.existsSync(filePath)) {
      printError(`File not found: ${filePath}`, json);
      process.exit(EXIT.VALIDATION_ERROR);
    }

    let resource: unknown;
    try {
      resource = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      printError('Invalid JSON file', json);
      process.exit(EXIT.VALIDATION_ERROR);
    }

    const spinner = json ? null : ora('AI fixing...').start();
    try {
      const result = await peRequest<{
        correctedResource: unknown;
        changesApplied: string[];
        explanation: string;
      }>('POST', '/v1/validate/fix', { apiKey, baseUrl }, { resource });

      spinner?.stop();

      const outPath = filePath.replace(/\.json$/, '.fixed.json');
      fs.writeFileSync(outPath, JSON.stringify(result.correctedResource, null, 2));

      if (json) {
        printJson(result);
      } else {
        console.log(`\n✓ Fixed file written to ${outPath}`);
        console.log(`\nChanges applied:`);
        for (const change of result.changesApplied) {
          console.log(`  • ${change}`);
        }
      }
    } catch (err) {
      spinner?.fail();
      printError((err as Error).message, json);
      process.exit(EXIT.API_ERROR);
    }
  });

// ── pe pa ─────────────────────────────────────────────────────────────────────

const pa = program.command('pa').description('Prior authorization operations');

pa
  .command('run')
  .description('Run the PA Orchestrator Agent (interactive)')
  .option('--patient <id>', 'Patient ID')
  .option('--procedure <code>', 'Procedure/CPT code')
  .option('--payer <id>', 'Payer ID')
  .action(async (opts: { patient?: string; procedure?: string; payer?: string }) => {
    const { apiKey, baseUrl, json } = resolveOpts(program);

    // Collect missing inputs interactively
    let patientId = opts.patient;
    let procedureCode = opts.procedure;
    let payerId = opts.payer;

    if (!json && (!patientId || !procedureCode || !payerId)) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ask = (q: string) => new Promise<string>((r) => rl.question(q, r));

      if (!patientId) patientId = await ask('Patient ID: ');
      if (!procedureCode) procedureCode = await ask('Procedure code (CPT): ');
      if (!payerId) {
        console.log('\nAvailable payers: uhc-commercial, aetna-commercial, cigna-commercial, anthem-bcbs, medicare-advantage-humana');
        payerId = await ask('Payer ID: ');
      }
      rl.close();
    }

    if (!patientId || !procedureCode || !payerId) {
      printError('patient, procedure, and payer are required', json);
      process.exit(EXIT.VALIDATION_ERROR);
    }

    const spinner = json ? null : ora('Running PA Orchestrator...').start();

    const steps: string[] = [];

    const stepLabels: Record<string, string> = {
      'coverage-fetch': '1. Coverage Fetch',
      'crd-check': '2. CRD Check (Da Vinci)',
      'dtr-collection': '3. DTR Collection',
      'pas-submission': '4. PAS Submission',
      'decision-polling': '5. Decision Polling',
      'appeal': '6. Appeal',
    };

    try {
      const payload = {
        patient: {
          resourceType: 'Patient',
          id: patientId,
          name: [{ family: 'Patient', given: [patientId] }],
        },
        procedure: {
          resourceType: 'ServiceRequest',
          id: `sr-${Date.now()}`,
          code: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: procedureCode }] },
          authoredOn: new Date().toISOString().split('T')[0],
        },
        payerId,
      };

      const result = await peRequest<{
        correlationId: string;
        decision: string;
        durationMs: number;
        steps: Array<{ step: string; status: string; durationMs?: number; error?: string }>;
        confidenceScore?: number;
      }>('POST', '/v1/pa/run', { apiKey, baseUrl }, payload);

      spinner?.stop();

      if (json) {
        printJson(result);
      } else {
        console.log('\n── PA Run Complete ──────────────────────────────────\n');
        console.log(`  Correlation ID  : ${result.correlationId}`);
        console.log(`  Decision        : ${result.decision.toUpperCase()}`);
        console.log(`  Duration        : ${result.durationMs}ms`);
        if (result.confidenceScore !== undefined) {
          console.log(`  DTR Confidence  : ${Math.round(result.confidenceScore * 100)}%`);
        }
        console.log('\n  Steps:');
        for (const step of result.steps) {
          const label = stepLabels[step.step] ?? step.step;
          const icon = step.status === 'done' ? '✓' : step.status === 'skipped' ? '–' : '✗';
          const dur = step.durationMs != null ? ` (${step.durationMs}ms)` : '';
          console.log(`    ${icon} ${label}${dur}`);
          if (step.error) console.log(`      Error: ${step.error}`);
        }
        console.log();
        steps.push(...result.steps.map((s) => s.step));
      }
    } catch (err) {
      spinner?.fail();
      printError((err as Error).message, json);
      process.exit(EXIT.API_ERROR);
    }
  });

pa
  .command('status <id>')
  .description('Get PA status by correlation ID')
  .action(async (id: string) => {
    const { apiKey, baseUrl, json } = resolveOpts(program);
    const spinner = json ? null : ora('Fetching PA status...').start();
    try {
      const result = await peRequest<{ status?: string; id?: string; [key: string]: unknown }>(
        'GET',
        `/v1/pa/${id}`,
        { apiKey, baseUrl },
      );
      spinner?.stop();
      if (json) {
        printJson(result);
      } else {
        console.log(`\nPA ID : ${result.id ?? id}`);
        console.log(`Status: ${result.status ?? 'unknown'}`);
        printJson(result);
      }
    } catch (err) {
      spinner?.fail();
      printError((err as Error).message, json);
      process.exit(EXIT.API_ERROR);
    }
  });

// ── pe workflow ───────────────────────────────────────────────────────────────

const workflow = program.command('workflow').description('Workflow operations');

workflow
  .command('run <template>')
  .description('Run a workflow template')
  .action(async (template: string) => {
    const { apiKey, baseUrl, json } = resolveOpts(program);
    const spinner = json ? null : ora(`Running workflow: ${template}...`).start();
    try {
      const result = await peRequest<{
        status: string;
        workflowName: string;
        steps: Array<{ name: string; status: string; durationMs?: number; error?: string }>;
        durationMs?: number;
      }>('POST', '/v1/workflows/run', { apiKey, baseUrl }, { template });

      spinner?.stop();

      if (json) {
        printJson(result);
      } else {
        const icon = result.status === 'PASSED' ? '✓' : '✗';
        console.log(`\n${icon} Workflow: ${result.workflowName} — ${result.status}`);
        if (result.durationMs) console.log(`  Duration: ${result.durationMs}ms\n`);
        for (const step of result.steps ?? []) {
          const s = step.status === 'pass' ? '✓' : step.status === 'skip' ? '–' : '✗';
          const dur = step.durationMs != null ? ` (${step.durationMs}ms)` : '';
          console.log(`  ${s} ${step.name}${dur}`);
          if (step.error) console.log(`    ${step.error}`);
        }
        console.log();
      }

      process.exit(result.status === 'PASSED' ? EXIT.SUCCESS : EXIT.API_ERROR);
    } catch (err) {
      spinner?.fail();
      printError((err as Error).message, json);
      process.exit(EXIT.API_ERROR);
    }
  });

program.parse(process.argv);
