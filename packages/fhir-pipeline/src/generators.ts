import { v4 as uuidv4 } from 'uuid';

// ── Seed data ─────────────────────────────────────────────────────────────────

const FIRST_NAMES_M = ['James', 'Robert', 'John', 'Michael', 'David', 'William', 'Richard', 'Thomas', 'Christopher', 'Daniel'];
const FIRST_NAMES_F = ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Taylor', 'Martinez', 'Anderson', 'Thomas', 'Jackson', 'White'];
const CITIES = [
  { city: 'Boston', state: 'MA', zip: '02101' },
  { city: 'Chicago', state: 'IL', zip: '60601' },
  { city: 'Houston', state: 'TX', zip: '77001' },
  { city: 'Phoenix', state: 'AZ', zip: '85001' },
  { city: 'Philadelphia', state: 'PA', zip: '19101' },
  { city: 'San Antonio', state: 'TX', zip: '78201' },
  { city: 'San Diego', state: 'CA', zip: '92101' },
  { city: 'Dallas', state: 'TX', zip: '75201' },
];
const ONCOLOGIST_NAMES = ['Dr. Sarah Chen', 'Dr. Michael Torres', 'Dr. Emily Watson', 'Dr. James Park', 'Dr. Rachel Kim'];
const PAYER_NAMES: Record<string, string> = {
  'uhc-commercial': 'UnitedHealthcare Commercial',
  'aetna-commercial': 'Aetna Commercial',
  'cigna-commercial': 'Cigna Commercial',
  'anthem-bcbs': 'Anthem Blue Cross Blue Shield',
  'medicare-advantage-humana': 'Humana Medicare Advantage',
};

export const CONDITIONS: Record<string, { snomed: string; display: string; category: string }> = {
  'C50.9': { snomed: '363346000', display: 'Malignant neoplasm of breast', category: 'encounter-diagnosis' },
  'C34.90': { snomed: '363358000', display: 'Malignant neoplasm of lung', category: 'encounter-diagnosis' },
  'C18.9': { snomed: '363406005', display: 'Malignant neoplasm of colon', category: 'encounter-diagnosis' },
  'C85.90': { snomed: '413448000', display: 'Non-Hodgkin lymphoma', category: 'encounter-diagnosis' },
  'C61': { snomed: '399068003', display: 'Malignant neoplasm of prostate', category: 'encounter-diagnosis' },
  'C91.10': { snomed: '91861009', display: 'Acute lymphoblastic leukemia', category: 'encounter-diagnosis' },
  'C64.9': { snomed: '188132003', display: 'Malignant neoplasm of kidney', category: 'encounter-diagnosis' },
  'C53.9': { snomed: '363354003', display: 'Malignant neoplasm of cervix uteri', category: 'encounter-diagnosis' },
};

export const MEDICATIONS: Record<string, { rxnorm: string; display: string; route: string }> = {
  'C50.9': { rxnorm: '1876356', display: 'pembrolizumab 25 MG/ML Injectable Solution [Keytruda]', route: 'IV' },
  'C34.90': { rxnorm: '1876356', display: 'pembrolizumab 25 MG/ML Injectable Solution [Keytruda]', route: 'IV' },
  'C18.9': { rxnorm: '1860479', display: 'oxaliplatin 5 MG/ML Injectable Solution [Eloxatin]', route: 'IV' },
  'C85.90': { rxnorm: '1864400', display: 'rituximab 10 MG/ML Injectable Solution [Rituxan]', route: 'IV' },
  'C61': { rxnorm: '799345', display: 'abiraterone 250 MG Oral Tablet [Zytiga]', route: 'oral' },
  'C91.10': { rxnorm: '1860497', display: 'venetoclax 100 MG Oral Tablet [Venclexta]', route: 'oral' },
  'C64.9': { rxnorm: '1379701', display: 'sunitinib 50 MG Oral Capsule [Sutent]', route: 'oral' },
  'C53.9': { rxnorm: '583214', display: 'cisplatin 1 MG/ML Injectable Solution', route: 'IV' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function randomDate(minAge: number, maxAge: number): string {
  const now = new Date();
  const year = now.getFullYear() - minAge - Math.floor(Math.random() * (maxAge - minAge));
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ── Config ────────────────────────────────────────────────────────────────────

export interface PatientBundleConfig {
  firstName?: string;
  lastName?: string;
  gender?: 'male' | 'female';
  icd10?: string;
  payerId?: string;
  birthDate?: string;
}

// ── FHIR R4 resource builders ─────────────────────────────────────────────────

export function buildPatient(opts: {
  id: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  birthDate: string;
  mrn: string;
  city: string;
  state: string;
  zip: string;
}) {
  return {
    resourceType: 'Patient',
    id: opts.id,
    identifier: [
      { system: 'urn:pe:sandbox:mrn', value: opts.mrn },
    ],
    name: [{ use: 'official', family: opts.lastName, given: [opts.firstName] }],
    gender: opts.gender,
    birthDate: opts.birthDate,
    address: [
      {
        use: 'home',
        line: [`${100 + Math.floor(Math.random() * 900)} Main St`],
        city: opts.city,
        state: opts.state,
        postalCode: opts.zip,
        country: 'US',
      },
    ],
    communication: [{ language: { coding: [{ system: 'urn:ietf:bcp:47', code: 'en-US' }] }, preferred: true }],
  };
}

export function buildPractitioner(opts: { id: string; name: string }) {
  const [title, ...rest] = opts.name.split(' ');
  const parts = rest.join(' ').split(' ');
  const family = parts[parts.length - 1] ?? 'Unknown';
  const given = parts.slice(0, -1);
  return {
    resourceType: 'Practitioner',
    id: opts.id,
    identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: `NPI${Math.floor(1000000000 + Math.random() * 9000000000)}` }],
    name: [{ use: 'official', prefix: [title ?? 'Dr.'], family, given }],
    qualification: [
      {
        code: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0360', code: 'MD', display: 'Doctor of Medicine' }],
        },
      },
    ],
  };
}

export function buildCondition(opts: {
  id: string;
  patientRef: string;
  practitionerRef: string;
  icd10: string;
  onsetDate: string;
}) {
  const condition = CONDITIONS[opts.icd10] ?? {
    snomed: '64572001',
    display: 'Disease (disorder)',
    category: 'encounter-diagnosis',
  };
  return {
    resourceType: 'Condition',
    id: opts.id,
    clinicalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }],
    },
    verificationStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }],
    },
    category: [
      {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: condition.category }],
      },
    ],
    code: {
      coding: [
        { system: 'http://snomed.info/sct', code: condition.snomed, display: condition.display },
        { system: 'http://hl7.org/fhir/sid/icd-10-cm', code: opts.icd10, display: condition.display },
      ],
      text: condition.display,
    },
    subject: { reference: opts.patientRef },
    asserter: { reference: opts.practitionerRef },
    onsetDateTime: opts.onsetDate,
  };
}

export function buildCoverage(opts: {
  id: string;
  patientRef: string;
  payerId: string;
  memberId: string;
}) {
  const payerName = PAYER_NAMES[opts.payerId] ?? opts.payerId;
  return {
    resourceType: 'Coverage',
    id: opts.id,
    status: 'active',
    beneficiary: { reference: opts.patientRef },
    subscriber: { reference: opts.patientRef },
    subscriberId: opts.memberId,
    payor: [{ display: payerName }],
    class: [
      { type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/coverage-class', code: 'plan' }] }, value: 'COMM-001', name: payerName },
    ],
  };
}

export function buildMedicationRequest(opts: {
  id: string;
  patientRef: string;
  practitionerRef: string;
  icd10: string;
}) {
  const med = MEDICATIONS[opts.icd10] ?? {
    rxnorm: '1049502',
    display: 'acetaminophen 325 MG Oral Tablet',
    route: 'oral',
  };
  const routeCode = med.route === 'IV' ? '47625008' : '26643006';
  const routeDisplay = med.route === 'IV' ? 'Intravenous route' : 'Oral route';
  return {
    resourceType: 'MedicationRequest',
    id: opts.id,
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: {
      coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: med.rxnorm, display: med.display }],
      text: med.display,
    },
    subject: { reference: opts.patientRef },
    requester: { reference: opts.practitionerRef },
    reasonReference: [],
    dosageInstruction: [
      {
        route: {
          coding: [{ system: 'http://snomed.info/sct', code: routeCode, display: routeDisplay }],
        },
        timing: { repeat: { frequency: 1, period: 3, periodUnit: 'wk' } },
      },
    ],
  };
}

export function buildTransactionBundle(entries: Array<{ resource: Record<string, unknown>; method: string; url: string }>) {
  return {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: entries.map(({ resource, method, url }) => ({
      fullUrl: `urn:uuid:${resource['id'] as string}`,
      resource,
      request: { method, url },
    })),
  };
}

// ── Full patient bundle generator ─────────────────────────────────────────────

export function generatePatientBundle(config: PatientBundleConfig = {}) {
  const gender = config.gender ?? (Math.random() > 0.5 ? 'male' : 'female');
  const firstName = config.firstName ?? pick(gender === 'male' ? FIRST_NAMES_M : FIRST_NAMES_F);
  const lastName = config.lastName ?? pick(LAST_NAMES);
  const icd10 = config.icd10 ?? pick(Object.keys(CONDITIONS));
  const payerId = config.payerId ?? pick(Object.keys(PAYER_NAMES));
  const location = pick(CITIES);
  const birthDate = config.birthDate ?? randomDate(30, 80);

  const patientId = uuidv4();
  const practitionerId = uuidv4();
  const conditionId = uuidv4();
  const coverageId = uuidv4();
  const medReqId = uuidv4();

  const patientRef = `urn:uuid:${patientId}`;
  const practitionerRef = `urn:uuid:${practitionerId}`;

  const patient = buildPatient({
    id: patientId,
    firstName,
    lastName,
    gender,
    birthDate,
    mrn: `MRN${Math.floor(100000 + Math.random() * 900000)}`,
    ...location,
  });

  const practitioner = buildPractitioner({
    id: practitionerId,
    name: pick(ONCOLOGIST_NAMES),
  });

  const condition = buildCondition({
    id: conditionId,
    patientRef,
    practitionerRef,
    icd10,
    onsetDate: randomDate(0, 3),
  });

  const coverage = buildCoverage({
    id: coverageId,
    patientRef,
    payerId,
    memberId: `MEM${Math.floor(1000000 + Math.random() * 9000000)}`,
  });

  const medReq = buildMedicationRequest({
    id: medReqId,
    patientRef,
    practitionerRef,
    icd10,
  });

  const bundle = buildTransactionBundle([
    { resource: patient as Record<string, unknown>, method: 'POST', url: 'Patient' },
    { resource: practitioner as Record<string, unknown>, method: 'POST', url: 'Practitioner' },
    { resource: condition as Record<string, unknown>, method: 'POST', url: 'Condition' },
    { resource: coverage as Record<string, unknown>, method: 'POST', url: 'Coverage' },
    { resource: medReq as Record<string, unknown>, method: 'POST', url: 'MedicationRequest' },
  ]);

  return {
    bundle,
    meta: {
      patientId,
      name: `${firstName} ${lastName}`,
      gender,
      birthDate,
      icd10,
      payerId,
      conditionDisplay: CONDITIONS[icd10]?.display ?? icd10,
    },
  };
}
