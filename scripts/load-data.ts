/**
 * scripts/load-data.ts
 *
 * Reads FHIR Bundle JSON files from data/synthea/output/ and POSTs each to
 * HAPI FHIR, showing a live progress bar via ora.
 *
 * Usage:
 *   pnpm data:load [--url <hapiUrl>] [--dir <outputDir>]
 *
 * Defaults:
 *   --url  http://localhost:8080
 *   --dir  data/synthea/output
 */

import * as fs from 'fs';
import * as path from 'path';
import ora from 'ora';
import { uploadBundle } from '@pe/fhir-pipeline';

// ── Config ─────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_HAPI_URL = 'http://localhost:8080';
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'data', 'synthea', 'output');

// ── Helpers ────────────────────────────────────────────────────────────────────

function getArg(flag: string, defaultValue: string): string {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1]! : defaultValue;
}

function collectJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsonFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(full);
    }
  }
  return files;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const hapiUrl = getArg('--url', DEFAULT_HAPI_URL);
  const outputDir = getArg('--dir', DEFAULT_OUTPUT_DIR);

  console.log('=== Pe FHIR Data Loader ===\n');
  console.log(`HAPI FHIR: ${hapiUrl}`);
  console.log(`Source:    ${outputDir}\n`);

  const files = collectJsonFiles(outputDir);

  if (files.length === 0) {
    console.log('No JSON files found. Run `pnpm data:generate` first.');
    process.exit(0);
  }

  console.log(`Found ${files.length} bundle files to upload.\n`);

  let uploaded = 0;
  let failed = 0;
  let totalResources = 0;
  const errors: string[] = [];
  const start = Date.now();

  const spinner = ora({ text: `Uploading 1/${files.length}…`, spinner: 'dots' }).start();

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i]!;
    const label = path.relative(outputDir, filePath);
    spinner.text = `Uploading ${i + 1}/${files.length}: ${label}`;

    let bundle: Record<string, unknown>;
    try {
      bundle = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
    } catch {
      failed++;
      errors.push(`${label}: invalid JSON`);
      continue;
    }

    const result = await uploadBundle(hapiUrl, bundle);

    if (result.success) {
      uploaded++;
      totalResources += result.resourceCount;
    } else {
      failed++;
      errors.push(`${label}: ${result.error ?? 'unknown error'}`);
    }
  }

  const durationMs = Date.now() - start;

  if (failed === 0) {
    spinner.succeed(`Uploaded ${uploaded}/${files.length} bundles`);
  } else {
    spinner.warn(`Uploaded ${uploaded}/${files.length} bundles (${failed} failed)`);
  }

  console.log('\n── Summary ──────────────────────────────');
  console.log(`  Total files:      ${files.length}`);
  console.log(`  Uploaded:         ${uploaded}`);
  console.log(`  Failed:           ${failed}`);
  console.log(`  Resources created:${totalResources}`);
  console.log(`  Duration:         ${(durationMs / 1000).toFixed(1)}s`);

  if (errors.length > 0) {
    console.log('\n── Errors ───────────────────────────────');
    errors.slice(0, 10).forEach((e) => console.log(`  ✗ ${e}`));
    if (errors.length > 10) console.log(`  … and ${errors.length - 10} more`);
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
