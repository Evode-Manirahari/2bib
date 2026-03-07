import { generatePatientBundle, type PatientBundleConfig } from './generators';

/** 10 deterministic sandbox patient configs for instant seeding. */
const SANDBOX_CONFIGS: PatientBundleConfig[] = [
  { firstName: 'Margaret', lastName: 'Wilson',   gender: 'female', icd10: 'C50.9',  payerId: 'aetna-commercial',          birthDate: '1962-03-14' },
  { firstName: 'James',    lastName: 'Rodriguez', gender: 'male',   icd10: 'C34.90', payerId: 'uhc-commercial',             birthDate: '1958-07-22' },
  { firstName: 'Sarah',    lastName: 'Chen',      gender: 'female', icd10: 'C18.9',  payerId: 'cigna-commercial',           birthDate: '1971-11-05' },
  { firstName: 'Robert',   lastName: 'Johnson',   gender: 'male',   icd10: 'C85.90', payerId: 'anthem-bcbs',                birthDate: '1955-09-30' },
  { firstName: 'Jennifer', lastName: 'Taylor',    gender: 'female', icd10: 'C50.9',  payerId: 'medicare-advantage-humana',  birthDate: '1949-04-18' },
  { firstName: 'Michael',  lastName: 'Brown',     gender: 'male',   icd10: 'C61',    payerId: 'uhc-commercial',             birthDate: '1953-01-25' },
  { firstName: 'Emily',    lastName: 'Davis',     gender: 'female', icd10: 'C91.10', payerId: 'aetna-commercial',           birthDate: '1984-06-12' },
  { firstName: 'David',    lastName: 'Martinez',  gender: 'male',   icd10: 'C64.9',  payerId: 'cigna-commercial',           birthDate: '1967-08-09' },
  { firstName: 'Ashley',   lastName: 'Thompson',  gender: 'female', icd10: 'C53.9',  payerId: 'anthem-bcbs',                birthDate: '1978-02-27' },
  { firstName: 'Christopher', lastName: 'Anderson', gender: 'male', icd10: 'C18.9', payerId: 'medicare-advantage-humana',  birthDate: '1945-12-03' },
];

export interface SandboxBundle {
  bundle: Record<string, unknown>;
  meta: {
    patientId: string;
    name: string;
    gender: string;
    birthDate: string;
    icd10: string;
    payerId: string;
    conditionDisplay: string;
  };
}

export function getSandboxBundles(): SandboxBundle[] {
  return SANDBOX_CONFIGS.map((config) => generatePatientBundle(config));
}
