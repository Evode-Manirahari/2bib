// ── Da Vinci Payer Registry ────────────────────────────────────────────────────

export type HookType = 'order-sign' | 'order-dispatch' | 'encounter-start';

export interface PayerEndpoint {
  payerId: string;
  name: string;
  crdUrl: string;
  dtrUrl: string;
  pasUrl: string;
  tokenUrl: string;
  clientId: string;
  supportedHooks: HookType[];
}

export const PAYER_REGISTRY: Record<string, PayerEndpoint> = {
  'uhc-commercial': {
    payerId: 'uhc-commercial',
    name: 'UnitedHealthcare Commercial',
    crdUrl: 'https://sandbox.uhc.com/crd/cds-hooks',
    dtrUrl: 'https://sandbox.uhc.com/dtr/questionnaire',
    pasUrl: 'https://sandbox.uhc.com/pas/fhir',
    tokenUrl: 'https://sandbox.uhc.com/oauth2/token',
    clientId: 'pe-sandbox-uhc',
    supportedHooks: ['order-sign', 'order-dispatch', 'encounter-start'],
  },
  'aetna-commercial': {
    payerId: 'aetna-commercial',
    name: 'Aetna Commercial',
    crdUrl: 'https://sandbox.aetna.com/crd/cds-hooks',
    dtrUrl: 'https://sandbox.aetna.com/dtr/questionnaire',
    pasUrl: 'https://sandbox.aetna.com/pas/fhir',
    tokenUrl: 'https://sandbox.aetna.com/oauth2/token',
    clientId: 'pe-sandbox-aetna',
    supportedHooks: ['order-sign', 'order-dispatch'],
  },
  'cigna-commercial': {
    payerId: 'cigna-commercial',
    name: 'Cigna Commercial',
    crdUrl: 'https://sandbox.cigna.com/crd/cds-hooks',
    dtrUrl: 'https://sandbox.cigna.com/dtr/questionnaire',
    pasUrl: 'https://sandbox.cigna.com/pas/fhir',
    tokenUrl: 'https://sandbox.cigna.com/oauth2/token',
    clientId: 'pe-sandbox-cigna',
    supportedHooks: ['order-sign', 'order-dispatch', 'encounter-start'],
  },
  'anthem-bcbs': {
    payerId: 'anthem-bcbs',
    name: 'Anthem BCBS',
    crdUrl: 'https://sandbox.anthem.com/crd/cds-hooks',
    dtrUrl: 'https://sandbox.anthem.com/dtr/questionnaire',
    pasUrl: 'https://sandbox.anthem.com/pas/fhir',
    tokenUrl: 'https://sandbox.anthem.com/oauth2/token',
    clientId: 'pe-sandbox-anthem',
    supportedHooks: ['order-sign', 'encounter-start'],
  },
  'medicare-advantage-humana': {
    payerId: 'medicare-advantage-humana',
    name: 'Humana Medicare Advantage',
    crdUrl: 'https://sandbox.humana.com/crd/cds-hooks',
    dtrUrl: 'https://sandbox.humana.com/dtr/questionnaire',
    pasUrl: 'https://sandbox.humana.com/pas/fhir',
    tokenUrl: 'https://sandbox.humana.com/oauth2/token',
    clientId: 'pe-sandbox-humana',
    supportedHooks: ['order-sign', 'order-dispatch'],
  },
};

export function getPayerEndpoint(payerId: string): PayerEndpoint {
  const payer = PAYER_REGISTRY[payerId];
  if (!payer) {
    throw new Error(`Unknown payer: ${payerId}. Available: ${Object.keys(PAYER_REGISTRY).join(', ')}`);
  }
  return payer;
}

export function listPayers(): PayerEndpoint[] {
  return Object.values(PAYER_REGISTRY);
}
