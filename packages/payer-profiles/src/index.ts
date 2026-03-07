// ── Payer Profile Types ──────────────────────────────────────────────────────

export type AuthType = 'smart' | 'client_creds' | 'none';

export interface DenialReason {
  code: string;
  description: string;
  probability: number; // 0–1
}

export interface RequiredDocumentation {
  [serviceCategory: string]: string[];
}

export interface PayerProfile {
  id: string;
  name: string;
  baseUrl: string;
  authType: AuthType;
  autoApproveRate: number; // 0–1
  averageResponseTime: string; // e.g. '2h', '3d', '7d'
  requiredDocumentation: RequiredDocumentation;
  denialReasons: DenialReason[];
  appealSuccessRate: number; // 0–1
  requiresPeerToPeer: boolean;
}

// ── 5 Payer Profiles ─────────────────────────────────────────────────────────

export const PAYER_PROFILES: Record<string, PayerProfile> = {
  'uhc-commercial': {
    id: 'uhc-commercial',
    name: 'UnitedHealthcare Commercial',
    baseUrl: 'https://sandbox.uhc.com/fhir/R4',
    authType: 'smart',
    autoApproveRate: 0.65,
    averageResponseTime: '2d',
    requiredDocumentation: {
      oncology: ['clinical-notes', 'pathology-report', 'treatment-plan', 'NCCN-guideline-ref'],
      imaging: ['clinical-notes', 'prior-imaging-results', 'ordering-rationale'],
      radiation: ['clinical-notes', 'simulation-plan', 'dosimetry-plan', 'treatment-fields'],
      medication: ['prescription', 'diagnosis-code', 'prior-therapy-history'],
    },
    denialReasons: [
      {
        code: 'MISSING_DOCS',
        description: 'Missing required clinical documentation',
        probability: 0.3,
      },
      {
        code: 'NOT_MEDICALLY_NECESSARY',
        description: 'Service not medically necessary per UHC guidelines',
        probability: 0.2,
      },
      {
        code: 'STEP_THERAPY',
        description: 'Step therapy requirements not met',
        probability: 0.15,
      },
    ],
    appealSuccessRate: 0.45,
    requiresPeerToPeer: false,
  },

  'aetna-commercial': {
    id: 'aetna-commercial',
    name: 'Aetna Commercial',
    baseUrl: 'https://sandbox.aetna.com/fhir/R4',
    authType: 'smart',
    autoApproveRate: 0.7,
    averageResponseTime: '2d',
    requiredDocumentation: {
      oncology: ['clinical-notes', 'pathology-report', 'staging-info', 'treatment-plan'],
      imaging: ['clinical-notes', 'ordering-physician-notes', 'clinical-indication'],
      radiation: ['clinical-notes', 'IMRT-treatment-plan', 'physician-attestation'],
      medication: ['prescription', 'formulary-exception-request', 'diagnosis-codes'],
    },
    denialReasons: [
      {
        code: 'MISSING_DOCS',
        description: 'Incomplete clinical documentation',
        probability: 0.25,
      },
      {
        code: 'OUT_OF_NETWORK',
        description: 'Provider not in Aetna network',
        probability: 0.1,
      },
      {
        code: 'NOT_MEDICALLY_NECESSARY',
        description: 'Not medically necessary per Aetna clinical policy',
        probability: 0.2,
      },
    ],
    appealSuccessRate: 0.5,
    requiresPeerToPeer: false,
  },

  'cigna-commercial': {
    id: 'cigna-commercial',
    name: 'Cigna Commercial',
    baseUrl: 'https://sandbox.cigna.com/fhir/R4',
    authType: 'client_creds',
    autoApproveRate: 0.6,
    averageResponseTime: '3d',
    requiredDocumentation: {
      oncology: [
        'clinical-notes',
        'pathology-report',
        'treatment-plan',
        'NCCN-guidelines',
        'staging',
      ],
      imaging: ['clinical-notes', 'prior-test-results', 'clinical-indication'],
      radiation: ['simulation-CT', 'DVH-data', 'treatment-plan', 'physician-attestation'],
      medication: ['prescription', 'diagnosis-codes', 'prior-auth-form', 'step-therapy-docs'],
    },
    denialReasons: [
      {
        code: 'MISSING_DOCS',
        description: 'Required documentation missing',
        probability: 0.35,
      },
      {
        code: 'EXPERIMENTAL',
        description: 'Service considered experimental or investigational by Cigna',
        probability: 0.1,
      },
      {
        code: 'NOT_MEDICALLY_NECESSARY',
        description: 'Medical necessity not established per Cigna criteria',
        probability: 0.25,
      },
    ],
    appealSuccessRate: 0.4,
    requiresPeerToPeer: true,
  },

  'anthem-bcbs': {
    id: 'anthem-bcbs',
    name: 'Anthem Blue Cross Blue Shield',
    baseUrl: 'https://sandbox.anthem.com/fhir/R4',
    authType: 'smart',
    autoApproveRate: 0.68,
    averageResponseTime: '2d',
    requiredDocumentation: {
      oncology: [
        'clinical-notes',
        'pathology-report',
        'treatment-plan',
        'physician-statement',
        'NCCN-ref',
      ],
      imaging: ['clinical-notes', 'ordering-rationale', 'clinical-indication'],
      radiation: ['simulation-plan', 'clinical-notes', 'dosimetry', 'physician-statement'],
      medication: ['prescription', 'prior-therapy-failure', 'formulary-step-docs'],
    },
    denialReasons: [
      {
        code: 'MISSING_DOCS',
        description: 'Incomplete documentation submitted',
        probability: 0.28,
      },
      {
        code: 'NOT_MEDICALLY_NECESSARY',
        description: 'Does not meet Anthem medical necessity criteria',
        probability: 0.22,
      },
      {
        code: 'DUPLICATE_REQUEST',
        description: 'Duplicate prior authorization request detected',
        probability: 0.05,
      },
    ],
    appealSuccessRate: 0.48,
    requiresPeerToPeer: false,
  },

  'medicare-advantage-humana': {
    id: 'medicare-advantage-humana',
    name: 'Medicare Advantage (Humana)',
    baseUrl: 'https://sandbox.humana.com/fhir/R4',
    authType: 'smart',
    autoApproveRate: 0.55,
    averageResponseTime: '7d',
    requiredDocumentation: {
      oncology: [
        'clinical-notes',
        'pathology-report',
        'Medicare-LCD-criteria',
        'treatment-plan',
        'NCCN-ref',
      ],
      imaging: [
        'clinical-notes',
        'LCD-criteria',
        'ordering-physician-attestation',
        'prior-imaging',
      ],
      radiation: [
        'simulation-CT',
        'treatment-plan',
        'clinical-notes',
        'Medicare-LCD',
        'DVH-data',
      ],
      medication: [
        'prescription',
        'Medicare-formulary-form',
        'step-therapy-docs',
        'diagnosis-codes',
      ],
    },
    denialReasons: [
      {
        code: 'NOT_COVERED',
        description: 'Service not covered under Medicare benefit',
        probability: 0.2,
      },
      {
        code: 'MISSING_DOCS',
        description: 'Missing required Medicare documentation',
        probability: 0.3,
      },
      {
        code: 'NOT_MEDICALLY_NECESSARY',
        description: 'Does not meet Medicare medical necessity criteria',
        probability: 0.25,
      },
      {
        code: 'LCD_CRITERIA_NOT_MET',
        description: 'Local Coverage Determination criteria not met',
        probability: 0.15,
      },
    ],
    appealSuccessRate: 0.35,
    requiresPeerToPeer: true,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getPayerProfile(id: string): PayerProfile | undefined {
  return PAYER_PROFILES[id];
}

export function listPayerProfiles(): PayerProfile[] {
  return Object.values(PAYER_PROFILES);
}

export function listPayerIds(): string[] {
  return Object.keys(PAYER_PROFILES);
}
