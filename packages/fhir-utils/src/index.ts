import type {
  FhirResource,
  FhirReference,
  FhirBundle,
  FhirOperationOutcome,
  FhirMeta,
  FhirCoding,
  FhirCodeableConcept,
} from '@pe/types';

// ── Reference Builders ───────────────────────────────────────────────────────

export function buildReference(resourceType: string, id: string, display?: string): FhirReference {
  return {
    reference: `${resourceType}/${id}`,
    ...(display && { display }),
  };
}

export function parseReference(reference: string): { resourceType: string; id: string } | null {
  const parts = reference.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { resourceType: parts[0], id: parts[1] };
}

// ── Meta Builders ────────────────────────────────────────────────────────────

export function buildMeta(profile: string | string[]): FhirMeta {
  return {
    profile: Array.isArray(profile) ? profile : [profile],
  };
}

// ── Coding & CodeableConcept Builders ────────────────────────────────────────

export function buildCoding(system: string, code: string, display?: string): FhirCoding {
  return { system, code, ...(display && { display }) };
}

export function buildCodeableConcept(
  system: string,
  code: string,
  display?: string,
): FhirCodeableConcept {
  return {
    coding: [buildCoding(system, code, display)],
    ...(display && { text: display }),
  };
}

// ── Resource Helpers ─────────────────────────────────────────────────────────

export function extractResourceType(resource: unknown): string | undefined {
  if (typeof resource === 'object' && resource !== null && 'resourceType' in resource) {
    const rt = (resource as Record<string, unknown>).resourceType;
    return typeof rt === 'string' ? rt : undefined;
  }
  return undefined;
}

export function isBundle(resource: unknown): resource is FhirBundle {
  return extractResourceType(resource) === 'Bundle';
}

export function isOperationOutcome(resource: unknown): resource is FhirOperationOutcome {
  return extractResourceType(resource) === 'OperationOutcome';
}

export function extractBundleEntries<T extends FhirResource = FhirResource>(
  bundle: FhirBundle,
  resourceType?: string,
): T[] {
  if (!bundle.entry) return [];
  return bundle.entry
    .map((e) => e.resource)
    .filter((r): r is T => {
      if (!r) return false;
      if (resourceType) return r.resourceType === resourceType;
      return true;
    });
}

// ── OperationOutcome Builder ─────────────────────────────────────────────────

export function buildOperationOutcome(
  severity: 'fatal' | 'error' | 'warning' | 'information',
  code: string,
  diagnostics: string,
): FhirOperationOutcome {
  return {
    resourceType: 'OperationOutcome',
    issue: [{ severity, code, diagnostics }],
  };
}

export function hasErrors(outcome: FhirOperationOutcome): boolean {
  return outcome.issue.some((i) => i.severity === 'fatal' || i.severity === 'error');
}

// ── FHIR URL Builder ─────────────────────────────────────────────────────────

export function buildFhirSearchUrl(
  baseUrl: string,
  resourceType: string,
  params: Record<string, string | string[]>,
): string {
  const url = new URL(`${baseUrl}/${resourceType}`);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((v) => url.searchParams.append(key, v));
    } else {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

// ── ICD / CPT Code Systems ───────────────────────────────────────────────────

export const FHIR_SYSTEMS = {
  ICD10: 'http://hl7.org/fhir/sid/icd-10-cm',
  SNOMED: 'http://snomed.info/sct',
  CPT: 'http://www.ama-assn.org/go/cpt',
  LOINC: 'http://loinc.org',
  RxNorm: 'http://www.nlm.nih.gov/research/umls/rxnorm',
  NPI: 'http://hl7.org/fhir/sid/us-npi',
  US_CORE_RACE: 'urn:oid:2.16.840.1.113883.6.238',
} as const;

export const IG_PROFILES = {
  US_CORE_PATIENT: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient',
  PAS_CLAIM: 'http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claim',
  PAS_CLAIM_RESPONSE:
    'http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claimresponse',
  CRD_COVERAGE: 'http://hl7.org/fhir/us/davinci-crd/StructureDefinition/profile-coverage',
} as const;
