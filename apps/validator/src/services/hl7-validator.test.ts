import * as childProcess from 'child_process';
import { validateWithHl7, isJavaAvailable, resetJavaAvailableCache } from './hl7-validator';

// ── Mock child_process and fs ─────────────────────────────────────────────────

jest.mock('child_process', () => ({
  spawnSync: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  createWriteStream: jest.fn(),
}));

import * as fs from 'fs';

const mockedSpawnSync = jest.mocked(childProcess.spawnSync);
const mockedFs = fs as jest.Mocked<typeof fs>;

// ── Test data ─────────────────────────────────────────────────────────────────

const validPatient = {
  resourceType: 'Patient',
  id: 'p1',
  name: [{ family: 'Smith', given: ['John'] }],
  gender: 'male',
};

const validOutcome = JSON.stringify({
  resourceType: 'OperationOutcome',
  issue: [{ severity: 'information', code: 'informational', diagnostics: 'All OK' }],
});

const errorOutcome = JSON.stringify({
  resourceType: 'OperationOutcome',
  issue: [
    { severity: 'error', code: 'required', diagnostics: 'Patient.name: minimum required = 1', expression: ['Patient.name'] },
    { severity: 'warning', code: 'code-invalid', diagnostics: 'Unknown gender code "xyz"', expression: ['Patient.gender'] },
  ],
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockSpawnOk() {
  mockedSpawnSync.mockReturnValueOnce({
    status: 0, stdout: Buffer.from(''), stderr: Buffer.from(''),
    pid: 1, output: [], signal: null, error: undefined,
  } as unknown as ReturnType<typeof childProcess.spawnSync>);
}

function mockSpawnFail() {
  mockedSpawnSync.mockReturnValueOnce({
    status: 1, stdout: Buffer.from(''), stderr: Buffer.from(''),
    pid: 1, output: [], signal: null, error: new Error('java not found'),
  } as unknown as ReturnType<typeof childProcess.spawnSync>);
}

function setupDefaultMocks(outcomeContent = validOutcome) {
  mockedFs.existsSync.mockReturnValue(true);
  mockedFs.mkdirSync.mockReturnValue(undefined as unknown as string);
  mockedFs.writeFileSync.mockReturnValue(undefined);
  mockedFs.readFileSync.mockReturnValue(outcomeContent as unknown as ReturnType<typeof fs.readFileSync>);
  mockedFs.unlinkSync.mockReturnValue(undefined);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  resetJavaAvailableCache();
  setupDefaultMocks();
});

describe('isJavaAvailable()', () => {
  it('returns true when java process exits 0', () => {
    mockSpawnOk();
    expect(isJavaAvailable()).toBe(true);
  });

  it('returns false when java process fails', () => {
    mockSpawnFail();
    expect(isJavaAvailable()).toBe(false);
  });

  it('caches the result on subsequent calls', () => {
    mockSpawnOk();
    isJavaAvailable(); // first call
    isJavaAvailable(); // second call — should use cache
    expect(mockedSpawnSync).toHaveBeenCalledTimes(1);
  });
});

describe('validateWithHl7()', () => {
  it('falls back to structural when Java unavailable', async () => {
    mockSpawnFail();
    const result = await validateWithHl7(validPatient);
    expect(result.engine).toBe('structural');
  });

  it('uses hl7 engine when Java available and JAR exists', async () => {
    mockSpawnOk(); // java -version
    mockSpawnOk(); // java -jar

    const result = await validateWithHl7(validPatient);
    expect(result.engine).toBe('hl7');
    expect(result.isValid).toBe(true);
  });

  it('parses error OperationOutcome correctly', async () => {
    mockSpawnOk();
    mockSpawnOk();
    setupDefaultMocks(errorOutcome);

    const result = await validateWithHl7(validPatient);
    expect(result.engine).toBe('hl7');
    expect(result.isValid).toBe(false);
    expect(result.errorCount).toBe(1);
    expect(result.warningCount).toBe(1);
    expect(result.errors[0]!.path).toBe('Patient.name');
  });

  it('falls back to structural when validator throws during spawn', async () => {
    mockSpawnOk(); // java -version
    mockedSpawnSync.mockImplementationOnce(() => { throw new Error('spawn error'); });

    const result = await validateWithHl7(validPatient);
    expect(result.engine).toBe('structural');
  });

  it('falls back to structural when output file is missing', async () => {
    mockSpawnOk();
    mockSpawnOk();
    // Output file doesn't exist after validation
    mockedFs.existsSync
      .mockReturnValueOnce(true)  // JAR exists
      .mockReturnValueOnce(false); // output file missing

    const result = await validateWithHl7(validPatient);
    expect(result.engine).toBe('structural');
  });

  it('includes profile in result when provided', async () => {
    mockSpawnOk();
    mockSpawnOk();

    const profile = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient';
    const result = await validateWithHl7(validPatient, profile);
    expect(result.profile).toBe(profile);
  });

  it('returns a complete ValidationResult shape', async () => {
    mockSpawnOk();
    mockSpawnOk();

    const result = await validateWithHl7(validPatient);
    expect(result).toHaveProperty('isValid');
    expect(result).toHaveProperty('errorCount');
    expect(result).toHaveProperty('warningCount');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('durationMs');
    expect(result).toHaveProperty('engine');
  });
});
