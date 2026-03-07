import { v4 as uuidv4 } from 'uuid';

// ── buildFhirClaim ────────────────────────────────────────────────────────────

export interface BuildFhirClaimOpts {
  id?: string;
  patientRef: string;
  providerRef?: string;
  payerName: string;
  icd10?: string;
  cptCode?: string;
  serviceDate?: string;
}

export function buildFhirClaim(opts: BuildFhirClaimOpts): Record<string, unknown> {
  const {
    id = uuidv4(),
    patientRef,
    providerRef = 'Practitioner/unknown',
    payerName,
    icd10,
    cptCode,
    serviceDate = new Date().toISOString().split('T')[0],
  } = opts;

  const claim: Record<string, unknown> = {
    resourceType: 'Claim',
    id,
    status: 'active',
    use: 'preauthorization',
    type: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/claim-type',
          code: 'professional',
          display: 'Professional',
        },
      ],
    },
    patient: {
      reference: patientRef,
    },
    created: new Date().toISOString(),
    provider: {
      reference: providerRef,
    },
    priority: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/processpriority',
          code: 'normal',
        },
      ],
    },
    insurer: {
      display: payerName,
    },
  };

  // Add diagnosis if icd10 provided
  if (icd10) {
    claim['diagnosis'] = [
      {
        sequence: 1,
        diagnosisCodeableConcept: {
          coding: [
            {
              system: 'http://hl7.org/fhir/sid/icd-10-cm',
              code: icd10,
            },
          ],
        },
      },
    ];
  }

  // Add item if cptCode provided
  if (cptCode) {
    claim['item'] = [
      {
        sequence: 1,
        productOrService: {
          coding: [
            {
              system: 'http://www.ama-assn.org/go/cpt',
              code: cptCode,
            },
          ],
        },
        servicedDate: serviceDate,
        ...(icd10 ? { diagnosisSequence: [1] } : {}),
      },
    ];
  }

  return claim;
}

// ── buildFhirClaimResponse ────────────────────────────────────────────────────

export interface BuildFhirClaimResponseOpts {
  id?: string;
  claimId: string;
  payerName: string;
  outcome: 'complete' | 'error' | 'partial';
  disposition: string;
  denialCode?: string;
  denialDescription?: string;
}

export function buildFhirClaimResponse(
  opts: BuildFhirClaimResponseOpts,
): Record<string, unknown> {
  const {
    id = uuidv4(),
    claimId,
    payerName,
    outcome,
    disposition,
    denialCode,
    denialDescription,
  } = opts;

  const claimResponse: Record<string, unknown> = {
    resourceType: 'ClaimResponse',
    id,
    status: 'active',
    type: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/claim-type',
          code: 'professional',
          display: 'Professional',
        },
      ],
    },
    use: 'preauthorization',
    created: new Date().toISOString(),
    insurer: {
      display: payerName,
    },
    request: {
      reference: `Claim/${claimId}`,
    },
    outcome,
    disposition,
  };

  // Add adjudication with denial code if provided
  if (denialCode) {
    claimResponse['error'] = [
      {
        code: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/adjudication-error',
              code: denialCode,
              display: denialDescription ?? denialCode,
            },
          ],
          text: denialDescription ?? denialCode,
        },
      },
    ];
  }

  return claimResponse;
}
