import type { EnrichedError, ErrorCategory, ValidationResult } from '@pe/types';

// ── Required fields per resourceType ─────────────────────────────────────────

const REQUIRED_FIELDS: Record<string, string[]> = {
  Patient: [],
  Practitioner: [],
  Organization: ['name'],
  Condition: ['clinicalStatus', 'code', 'subject'],
  Observation: ['status', 'code'],
  Coverage: ['status', 'beneficiary', 'payor'],
  MedicationRequest: ['status', 'intent', 'subject'],
  Claim: ['status', 'type', 'use', 'patient', 'created', 'insurer', 'provider', 'priority'],
  ClaimResponse: ['status', 'type', 'use', 'patient', 'created', 'insurer', 'request', 'outcome'],
  Bundle: ['type'],
  ServiceRequest: ['status', 'intent', 'code', 'subject'],
  DocumentReference: ['status', 'content'],
  Procedure: ['status', 'code', 'subject'],
  DiagnosticReport: ['status', 'code'],
  Encounter: ['status', 'class'],
};

// Valid values for coded fields
const VALID_GENDERS = ['male', 'female', 'other', 'unknown'];
const VALID_BUNDLE_TYPES = ['document', 'message', 'transaction', 'transaction-response', 'batch', 'batch-response', 'history', 'searchset', 'collection'];
const VALID_REQUEST_STATUSES = ['draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown'];
const VALID_MED_REQUEST_INTENTS = ['proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function err(
  severity: EnrichedError['severity'],
  category: ErrorCategory,
  path: string,
  message: string,
  suggestion?: string,
): EnrichedError {
  return { severity, category, path, message, ...(suggestion ? { suggestion } : {}) };
}

function hasField(obj: Record<string, unknown>, field: string): boolean {
  return field in obj && obj[field] !== null && obj[field] !== undefined;
}

// ── Resource-type–specific validators ────────────────────────────────────────

function validatePatient(resource: Record<string, unknown>): EnrichedError[] {
  const issues: EnrichedError[] = [];

  // Recommend at least name or identifier
  if (!hasField(resource, 'name') && !hasField(resource, 'identifier')) {
    issues.push(
      err('warning', 'MISSING_REQUIRED', 'Patient',
        'Patient should have at least one name or identifier.',
        'Add a name array with a family name, or an identifier with a system and value.'),
    );
  }

  // gender must be a valid code if present
  if (hasField(resource, 'gender')) {
    const g = resource['gender'];
    if (typeof g !== 'string' || !VALID_GENDERS.includes(g)) {
      issues.push(
        err('error', 'INVALID_VALUE', 'Patient.gender',
          `Invalid gender value: "${String(g)}". Must be one of: ${VALID_GENDERS.join(', ')}.`,
          `Set gender to one of: ${VALID_GENDERS.join(', ')}.`),
      );
    }
  }

  // birthDate format
  if (hasField(resource, 'birthDate')) {
    const bd = resource['birthDate'];
    if (typeof bd !== 'string' || !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(bd)) {
      issues.push(
        err('error', 'INVALID_VALUE', 'Patient.birthDate',
          `Invalid birthDate format: "${String(bd)}". Must be YYYY, YYYY-MM, or YYYY-MM-DD.`,
          'Use ISO 8601 date format, e.g. "1990-06-15".'),
      );
    }
  }

  // name entries must have family or text
  if (Array.isArray(resource['name'])) {
    (resource['name'] as unknown[]).forEach((n, i) => {
      if (typeof n === 'object' && n !== null) {
        const name = n as Record<string, unknown>;
        if (!hasField(name, 'family') && !hasField(name, 'text')) {
          issues.push(
            err('warning', 'MISSING_REQUIRED', `Patient.name[${i}]`,
              'Name entry should have at least a family name or text.',
              'Add a "family" property with the surname.'),
          );
        }
      }
    });
  }

  return issues;
}

function validateCondition(resource: Record<string, unknown>): EnrichedError[] {
  const issues: EnrichedError[] = [];

  if (hasField(resource, 'clinicalStatus')) {
    const cs = resource['clinicalStatus'] as Record<string, unknown> | undefined;
    if (!cs || !Array.isArray(cs['coding']) || (cs['coding'] as unknown[]).length === 0) {
      issues.push(
        err('error', 'INVALID_VALUE', 'Condition.clinicalStatus',
          'clinicalStatus must include a coding array with at least one code.',
          'Add coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }]'),
      );
    }
  }

  if (hasField(resource, 'code')) {
    const code = resource['code'] as Record<string, unknown> | undefined;
    if (!code || (!Array.isArray(code['coding']) && !code['text'])) {
      issues.push(
        err('error', 'INVALID_VALUE', 'Condition.code',
          'Condition.code must have coding or text.',
          'Add at least one SNOMED CT or ICD-10 coding entry.'),
      );
    }
  }

  return issues;
}

function validateBundle(resource: Record<string, unknown>): EnrichedError[] {
  const issues: EnrichedError[] = [];

  const type = resource['type'];
  if (typeof type !== 'string' || !VALID_BUNDLE_TYPES.includes(type)) {
    issues.push(
      err('error', 'INVALID_VALUE', 'Bundle.type',
        `Invalid bundle type: "${String(type)}". Must be one of: ${VALID_BUNDLE_TYPES.join(', ')}.`,
        'Set type to "transaction" for POST bundles or "searchset" for search results.'),
    );
  }

  // transaction/batch bundles must have entry
  if ((type === 'transaction' || type === 'batch') && !hasField(resource, 'entry')) {
    issues.push(
      err('warning', 'MISSING_REQUIRED', 'Bundle.entry',
        'Transaction and batch bundles should include an entry array.',
        'Add an "entry" array with resources and request objects.'),
    );
  }

  // Check entry items
  if (Array.isArray(resource['entry'])) {
    (resource['entry'] as unknown[]).forEach((e, i) => {
      if (typeof e === 'object' && e !== null) {
        const entry = e as Record<string, unknown>;
        if ((type === 'transaction' || type === 'batch') && !hasField(entry, 'request')) {
          issues.push(
            err('error', 'MISSING_REQUIRED', `Bundle.entry[${i}].request`,
              `Entry [${i}] in a ${type} bundle must have a request element.`,
              'Add request: { method: "POST", url: "ResourceType" }'),
          );
        }
      }
    });
  }

  return issues;
}

function validateMedicationRequest(resource: Record<string, unknown>): EnrichedError[] {
  const issues: EnrichedError[] = [];

  if (hasField(resource, 'intent')) {
    const intent = resource['intent'];
    if (typeof intent !== 'string' || !VALID_MED_REQUEST_INTENTS.includes(intent)) {
      issues.push(
        err('error', 'INVALID_VALUE', 'MedicationRequest.intent',
          `Invalid intent: "${String(intent)}". Must be one of: ${VALID_MED_REQUEST_INTENTS.join(', ')}.`,
          'Set intent to "order" for prescriptions.'),
      );
    }
  }

  const hasMedConcept = hasField(resource, 'medicationCodeableConcept');
  const hasMedRef = hasField(resource, 'medicationReference');
  if (!hasMedConcept && !hasMedRef) {
    issues.push(
      err('error', 'MISSING_REQUIRED', 'MedicationRequest',
        'MedicationRequest must have either medicationCodeableConcept or medicationReference.',
        'Add medicationCodeableConcept with an RxNorm coding.'),
    );
  }

  return issues;
}

function validateServiceRequest(resource: Record<string, unknown>): EnrichedError[] {
  const issues: EnrichedError[] = [];

  if (hasField(resource, 'status')) {
    const status = resource['status'];
    if (typeof status !== 'string' || !VALID_REQUEST_STATUSES.includes(status)) {
      issues.push(
        err('error', 'INVALID_VALUE', 'ServiceRequest.status',
          `Invalid status: "${String(status)}". Must be one of: ${VALID_REQUEST_STATUSES.join(', ')}.`,
          'Set status to "active" for active orders.'),
      );
    }
  }
  return issues;
}

// ── Top-level required-field checker ─────────────────────────────────────────

function checkRequiredFields(
  resourceType: string,
  resource: Record<string, unknown>,
): EnrichedError[] {
  const required = REQUIRED_FIELDS[resourceType] ?? [];
  return required
    .filter((f) => !hasField(resource, f))
    .map((f) =>
      err('error', 'MISSING_REQUIRED', `${resourceType}.${f}`,
        `Required field "${f}" is missing from ${resourceType}.`,
        `Add the "${f}" field to the ${resourceType} resource.`),
    );
}

// ── Known resourceTypes ───────────────────────────────────────────────────────

const KNOWN_RESOURCE_TYPES = new Set([
  'Patient', 'Practitioner', 'Organization', 'Condition', 'Observation',
  'Coverage', 'MedicationRequest', 'Claim', 'ClaimResponse', 'Bundle',
  'ServiceRequest', 'DocumentReference', 'Procedure', 'DiagnosticReport',
  'Encounter', 'AllergyIntolerance', 'Immunization', 'Location', 'Device',
  'RelatedPerson', 'PractitionerRole', 'HealthcareService', 'Schedule',
  'Slot', 'Appointment', 'CarePlan', 'CareTeam', 'Goal', 'Task',
  'ExplanationOfBenefit', 'OperationOutcome', 'Parameters',
]);

// ── Main ──────────────────────────────────────────────────────────────────────

export function validateStructural(
  resource: unknown,
  profile?: string,
): ValidationResult {
  const start = Date.now();
  const issues: EnrichedError[] = [];

  // Must be a non-null object
  if (typeof resource !== 'object' || resource === null || Array.isArray(resource)) {
    return {
      isValid: false,
      errorCount: 1,
      warningCount: 0,
      errors: [err('fatal', 'WRONG_TYPE', '$', 'Input must be a FHIR resource object (not an array or primitive).')],
      profile,
      durationMs: Date.now() - start,
    };
  }

  const r = resource as Record<string, unknown>;

  // resourceType must be present
  if (!hasField(r, 'resourceType')) {
    return {
      isValid: false,
      errorCount: 1,
      warningCount: 0,
      errors: [err('fatal', 'MISSING_REQUIRED', '$', 'Missing required field "resourceType".', 'Add resourceType: "Patient" (or appropriate FHIR resource type).')],
      profile,
      durationMs: Date.now() - start,
    };
  }

  if (typeof r['resourceType'] !== 'string') {
    return {
      isValid: false,
      errorCount: 1,
      warningCount: 0,
      errors: [err('error', 'WRONG_TYPE', '$.resourceType', '"resourceType" must be a string.', 'Set resourceType to the FHIR resource type name, e.g. "Patient".')],
      profile,
      durationMs: Date.now() - start,
    };
  }

  const resourceType = r['resourceType'] as string;

  // Warn on unknown resourceTypes (not fatal — could be custom)
  if (!KNOWN_RESOURCE_TYPES.has(resourceType)) {
    issues.push(
      err('warning', 'INVALID_VALUE', '$.resourceType',
        `Unknown FHIR R4 resourceType: "${resourceType}".`,
        'Verify the resourceType spelling. See https://hl7.org/fhir/R4/resourcelist.html for the complete list.'),
    );
  }

  // Check required fields
  issues.push(...checkRequiredFields(resourceType, r));

  // Resource-type–specific validation
  switch (resourceType) {
    case 'Patient':
      issues.push(...validatePatient(r));
      break;
    case 'Condition':
      issues.push(...validateCondition(r));
      break;
    case 'Bundle':
      issues.push(...validateBundle(r));
      break;
    case 'MedicationRequest':
      issues.push(...validateMedicationRequest(r));
      break;
    case 'ServiceRequest':
      issues.push(...validateServiceRequest(r));
      break;
  }

  // Profile mismatch hint
  if (profile && (!r['meta'] || !(r['meta'] as Record<string, unknown>)['profile'])) {
    issues.push(
      err('warning', 'PROFILE_MISMATCH', '$.meta.profile',
        `Validation was requested against profile "${profile}" but the resource has no meta.profile declaration.`,
        `Add meta: { profile: ["${profile}"] } to declare conformance.`),
    );
  }

  const errorCount = issues.filter((i) => i.severity === 'error' || i.severity === 'fatal').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  return {
    isValid: errorCount === 0,
    errorCount,
    warningCount,
    errors: issues,
    profile,
    durationMs: Date.now() - start,
  };
}
