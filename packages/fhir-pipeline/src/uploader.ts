import axios from 'axios';

export interface UploadResult {
  success: boolean;
  patientId?: string;
  resourceCount: number;
  error?: string;
}

export interface UploadSummary {
  total: number;
  uploaded: number;
  failed: number;
  resourcesCreated: number;
  errors: string[];
  durationMs: number;
}

/** Upload a single FHIR transaction Bundle to HAPI FHIR. */
export async function uploadBundle(
  hapiUrl: string,
  bundle: Record<string, unknown>,
): Promise<UploadResult> {
  try {
    const response = await axios.post(`${hapiUrl}/fhir`, bundle, {
      headers: {
        'Content-Type': 'application/fhir+json',
        Accept: 'application/fhir+json',
      },
      timeout: 30_000,
    });

    const responseBundle = response.data as {
      entry?: Array<{ response?: { status?: string; location?: string } }>;
      id?: string;
    };

    const entries = responseBundle.entry ?? [];
    const successCount = entries.filter((e) =>
      e.response?.status?.startsWith('2'),
    ).length;

    // Extract FHIR Patient ID from the first entry whose location contains 'Patient'
    const patientEntry = entries.find((e) =>
      e.response?.location?.includes('Patient'),
    );
    const patientId = patientEntry?.response?.location?.split('/')[1];

    return { success: true, patientId, resourceCount: successCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, resourceCount: 0, error: message };
  }
}

/** Upload multiple bundles and accumulate stats. */
export async function uploadBundles(
  hapiUrl: string,
  bundles: Array<{ bundle: Record<string, unknown>; label: string }>,
  onProgress?: (label: string, result: UploadResult) => void,
): Promise<UploadSummary> {
  const start = Date.now();
  let uploaded = 0;
  let failed = 0;
  let resourcesCreated = 0;
  const errors: string[] = [];

  for (const { bundle, label } of bundles) {
    const result = await uploadBundle(hapiUrl, bundle);
    if (result.success) {
      uploaded++;
      resourcesCreated += result.resourceCount;
    } else {
      failed++;
      errors.push(`${label}: ${result.error ?? 'unknown error'}`);
    }
    onProgress?.(label, result);
  }

  return {
    total: bundles.length,
    uploaded,
    failed,
    resourcesCreated,
    errors,
    durationMs: Date.now() - start,
  };
}
