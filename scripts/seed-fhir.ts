/**
 * scripts/seed-fhir.ts
 *
 * Seeds the 10 deterministic sandbox patients into HAPI FHIR and records
 * each in the SandboxPatient table so the dashboard can reference them.
 *
 * Usage:
 *   pnpm sandbox:reset [--url <hapiUrl>]
 *
 * Default HAPI URL: http://localhost:8080
 *
 * Idempotent: clears the SandboxPatient table first, then re-uploads.
 */

import ora from 'ora';
import { getSandboxBundles } from '@pe/fhir-pipeline';
import { uploadBundle } from '@pe/fhir-pipeline';
import { prisma } from '@pe/db';

// ── Config ─────────────────────────────────────────────────────────────────────

const DEFAULT_HAPI_URL = 'http://localhost:8080';

function getHapiUrl(): string {
  const idx = process.argv.indexOf('--url');
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1]! : DEFAULT_HAPI_URL;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const hapiUrl = getHapiUrl();

  console.log('=== Pe Sandbox Reset ===\n');
  console.log(`HAPI FHIR: ${hapiUrl}\n`);

  // 1. Generate 10 fresh bundles (new UUIDs each run)
  const sandboxBundles = getSandboxBundles();
  console.log(`Generated ${sandboxBundles.length} sandbox bundles.\n`);

  // 2. Clear existing SandboxPatient rows
  const deleted = await prisma.sandboxPatient.deleteMany();
  if (deleted.count > 0) {
    console.log(`Cleared ${deleted.count} existing sandbox patient(s).\n`);
  }

  // 3. Upload each bundle to HAPI and persist metadata
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  const spinner = ora({ text: 'Seeding sandbox patients…', spinner: 'dots' }).start();

  for (const sb of sandboxBundles) {
    spinner.text = `Uploading ${sb.meta.name}…`;

    const result = await uploadBundle(hapiUrl, sb.bundle);

    if (!result.success) {
      failed++;
      errors.push(`${sb.meta.name}: ${result.error ?? 'unknown error'}`);
      continue;
    }

    // The HAPI-assigned Patient ID comes from the response location header.
    // If HAPI didn't return one, fall back to our local UUID.
    const hapiPatientId = result.patientId ?? sb.meta.patientId;

    await prisma.sandboxPatient.create({
      data: {
        patientId: hapiPatientId,
        name: sb.meta.name,
        gender: sb.meta.gender,
        birthDate: sb.meta.birthDate,
        payerId: sb.meta.payerId,
        icd10: sb.meta.icd10,
      },
    });

    succeeded++;
  }

  if (failed === 0) {
    spinner.succeed(`Seeded ${succeeded} sandbox patients`);
  } else {
    spinner.warn(`Seeded ${succeeded}/${sandboxBundles.length} (${failed} failed)`);
  }

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach((e) => console.log(`  ✗ ${e}`));
  }

  // 4. Print final list
  if (succeeded > 0) {
    console.log('\nSandbox patients:');
    const rows = await prisma.sandboxPatient.findMany({ orderBy: { createdAt: 'asc' } });
    for (const row of rows) {
      console.log(`  ${row.name.padEnd(25)} ${row.icd10.padEnd(8)} ${row.payerId}`);
    }
  }

  console.log('');
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  await prisma.$disconnect();
  process.exit(1);
});
