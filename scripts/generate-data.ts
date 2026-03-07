/**
 * scripts/generate-data.ts
 *
 * Downloads the Synthea JAR (if not cached) and generates synthetic FHIR R4
 * patient bundles for three modules: oncology, cardiology, and general.
 *
 * Usage:
 *   pnpm data:generate [--patients <n>]   (default: 50 per module)
 *
 * Output: data/synthea/output/<module>/*.json
 */

import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';

// ── Config ─────────────────────────────────────────────────────────────────────

const SYNTHEA_VERSION = '3.3.0';
const SYNTHEA_JAR_URL = `https://github.com/synthetichealth/synthea/releases/download/v${SYNTHEA_VERSION}/synthea-with-dependencies.jar`;

const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'data', 'synthea', 'cache');
const OUTPUT_BASE = path.join(ROOT, 'data', 'synthea', 'output');
const JAR_PATH = path.join(CACHE_DIR, `synthea-${SYNTHEA_VERSION}.jar`);

const MODULES = [
  { name: 'oncology', module: 'cancer/lung_cancer' },
  { name: 'cardiology', module: 'heart/coronary_heart_disease' },
  { name: 'general', module: '' },
] as const;

const DEFAULT_PATIENTS = 50;

// ── Helpers ────────────────────────────────────────────────────────────────────

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          file.close();
          downloadFile(res.headers.location!, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      })
      .on('error', (err) => {
        fs.unlink(dest, () => undefined);
        reject(err);
      });
  });
}

function ensureJar(): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (fs.existsSync(JAR_PATH)) {
    console.log(`✓ Synthea JAR cached at ${JAR_PATH}`);
    return;
  }
  console.log(`Downloading Synthea v${SYNTHEA_VERSION}…`);
  // Use synchronous approach via curl for simplicity
  const result = spawnSync('curl', ['-fsSL', '-o', JAR_PATH, SYNTHEA_JAR_URL], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`Failed to download Synthea JAR from ${SYNTHEA_JAR_URL}`);
  }
  console.log('✓ Synthea JAR downloaded');
}

function checkJava(): void {
  try {
    execSync('java -version', { stdio: 'ignore' });
  } catch {
    throw new Error('Java is required to run Synthea. Install JDK 11+ and try again.');
  }
}

function parsePatientCount(): number {
  const idx = process.argv.indexOf('--patients');
  if (idx !== -1 && process.argv[idx + 1]) {
    const n = parseInt(process.argv[idx + 1]!, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return DEFAULT_PATIENTS;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== Pe Synthetic Data Generator ===\n');

  checkJava();
  ensureJar();

  const patientCount = parsePatientCount();
  console.log(`\nGenerating ${patientCount} patients per module…\n`);

  let totalFiles = 0;

  for (const { name, module } of MODULES) {
    const outputDir = path.join(OUTPUT_BASE, name);
    fs.mkdirSync(outputDir, { recursive: true });

    console.log(`▶ Module: ${name}${module ? ` (${module})` : ' (default)'}`);

    const args = [
      '-jar', JAR_PATH,
      '-p', String(patientCount),
      '--exporter.fhir.export', 'true',
      '--exporter.hospital.fhir.export', 'false',
      '--exporter.practitioner.fhir.export', 'false',
      '--exporter.baseDirectory', outputDir,
      '--generate.only_dead_patients', 'false',
      ...(module ? ['-m', module] : []),
      'Massachusetts',
    ];

    const result = spawnSync('java', args, { stdio: 'inherit', cwd: ROOT });

    if (result.status !== 0) {
      console.error(`  ✗ Failed to generate ${name} patients`);
      process.exit(1);
    }

    // Count generated FHIR bundle files
    const fhirDir = path.join(outputDir, 'fhir');
    const generated = fs.existsSync(fhirDir)
      ? fs.readdirSync(fhirDir).filter((f) => f.endsWith('.json')).length
      : 0;
    totalFiles += generated;
    console.log(`  ✓ ${generated} FHIR bundles → ${fhirDir}\n`);
  }

  console.log(`\n✅ Done — ${totalFiles} total bundles in ${OUTPUT_BASE}`);
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
