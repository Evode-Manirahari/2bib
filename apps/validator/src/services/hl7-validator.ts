/**
 * HL7 FHIR Validator CLI wrapper.
 *
 * Downloads and caches the official HL7 FHIR Validator JAR, then invokes it
 * via `java -jar` for deep conformance checking.
 *
 * Falls back to structural validation if Java is unavailable or the JAR
 * fails to download.
 */

import { spawnSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import type { EnrichedError, ErrorCategory, ValidationResult } from '@pe/types';
import { validateStructural } from './structural';

// ── Config ────────────────────────────────────────────────────────────────────

const JAR_URL =
  'https://github.com/hapifhir/org.hl7.fhir.core/releases/latest/download/validator_cli.jar';
const JAR_CACHE_DIR = path.join(os.homedir(), '.pe', 'validator-cache');
const JAR_PATH = path.join(JAR_CACHE_DIR, 'validator_cli.jar');
const FHIR_VERSION = '4.0.1';

// ── Java check ────────────────────────────────────────────────────────────────

let _javaAvailable: boolean | null = null;

export function isJavaAvailable(): boolean {
  if (_javaAvailable !== null) return _javaAvailable;
  try {
    const result = spawnSync('java', ['-version'], { stdio: 'pipe', timeout: 5000 });
    _javaAvailable = result.status === 0;
  } catch {
    _javaAvailable = false;
  }
  return _javaAvailable;
}

// exposed for tests
export function resetJavaAvailableCache(): void {
  _javaAvailable = null;
}

// ── JAR download ──────────────────────────────────────────────────────────────

function downloadJar(): Promise<void> {
  fs.mkdirSync(JAR_CACHE_DIR, { recursive: true });
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(JAR_PATH);
    const get = (url: string) =>
      https
        .get(url, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            file.close();
            get(res.headers.location!);
            return;
          }
          if (res.statusCode !== 200) {
            file.close();
            reject(new Error(`HTTP ${res.statusCode} downloading validator JAR`));
            return;
          }
          res.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        })
        .on('error', (e) => { fs.unlink(JAR_PATH, () => undefined); reject(e); });
    get(JAR_URL);
  });
}

export async function ensureJar(): Promise<boolean> {
  if (fs.existsSync(JAR_PATH)) return true;
  try {
    await downloadJar();
    return true;
  } catch (err) {
    console.warn('[validator] Could not download HL7 Validator JAR:', (err as Error).message);
    return false;
  }
}

// ── Parse OperationOutcome ────────────────────────────────────────────────────

function mapSeverity(s: string): EnrichedError['severity'] {
  if (s === 'fatal') return 'fatal';
  if (s === 'error') return 'error';
  if (s === 'warning') return 'warning';
  return 'information';
}

function inferCategory(diagnostics: string): ErrorCategory {
  const d = diagnostics.toLowerCase();
  if (d.includes('unknown') || d.includes('not found') || d.includes('no match')) return 'TERMINOLOGY_ERROR';
  if (d.includes('required') || d.includes('minimum')) return 'MISSING_REQUIRED';
  if (d.includes('type') || d.includes('expected')) return 'WRONG_TYPE';
  if (d.includes('profile') || d.includes('conformance') || d.includes('constraint')) return 'PROFILE_MISMATCH';
  if (d.includes('reference') || d.includes('resolve')) return 'REFERENCE_ERROR';
  return 'INVALID_VALUE';
}

function parseOperationOutcome(json: string, durationMs: number, profile?: string): ValidationResult {
  let outcome: { issue?: Array<{ severity?: string; code?: string; diagnostics?: string; expression?: string[] }> };
  try {
    outcome = JSON.parse(json) as typeof outcome;
  } catch {
    return {
      isValid: false,
      errorCount: 1,
      warningCount: 0,
      errors: [{ severity: 'error', category: 'INVALID_VALUE', path: '$', message: 'Validator returned unparseable output.' }],
      profile,
      durationMs,
    };
  }

  const issues = (outcome.issue ?? []).map((i): EnrichedError => ({
    severity: mapSeverity(i.severity ?? 'error'),
    category: inferCategory(i.diagnostics ?? ''),
    path: i.expression?.[0] ?? '$',
    message: i.diagnostics ?? 'Validation issue',
  }));

  const errorCount = issues.filter((i) => i.severity === 'error' || i.severity === 'fatal').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  return {
    isValid: errorCount === 0,
    errorCount,
    warningCount,
    errors: issues,
    profile,
    durationMs,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function validateWithHl7(
  resource: unknown,
  profile?: string,
): Promise<ValidationResult & { engine: 'hl7' | 'structural' }> {
  if (!isJavaAvailable()) {
    console.info('[validator] Java not available — using structural validation');
    return { ...validateStructural(resource, profile), engine: 'structural' };
  }

  const jarReady = await ensureJar();
  if (!jarReady) {
    console.info('[validator] JAR unavailable — using structural validation');
    return { ...validateStructural(resource, profile), engine: 'structural' };
  }

  // Write resource to temp file
  const tmpId = crypto.randomUUID();
  const inputFile = path.join(os.tmpdir(), `pe-validate-in-${tmpId}.json`);
  const outputFile = path.join(os.tmpdir(), `pe-validate-out-${tmpId}.json`);

  try {
    fs.writeFileSync(inputFile, JSON.stringify(resource), 'utf8');

    const start = Date.now();
    const args = [
      '-jar', JAR_PATH,
      inputFile,
      '-version', FHIR_VERSION,
      '-output', outputFile,
      '-output-style', 'json',
      '-no-extensible-binding-warnings',
      ...(profile ? ['-profile', profile] : []),
    ];

    const result = spawnSync('java', args, {
      timeout: 60_000,
      stdio: 'pipe',
    });

    const durationMs = Date.now() - start;

    if (result.error || result.status === null) {
      throw new Error(result.error?.message ?? 'java process failed');
    }

    // Read output file
    if (!fs.existsSync(outputFile)) {
      throw new Error('Validator did not produce output file');
    }

    const output = fs.readFileSync(outputFile, 'utf8');
    return { ...parseOperationOutcome(output, durationMs, profile), engine: 'hl7' };
  } catch (err) {
    console.warn('[validator] HL7 validation failed, falling back:', (err as Error).message);
    return { ...validateStructural(resource, profile), engine: 'structural' };
  } finally {
    try { fs.unlinkSync(inputFile); } catch { /* ignore */ }
    try { fs.unlinkSync(outputFile); } catch { /* ignore */ }
  }
}
