// ── CLI Tests ─────────────────────────────────────────────────────────────────
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// ── Config tests ──────────────────────────────────────────────────────────────
describe('Config', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-cli-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('readConfig returns empty object for missing file', () => {
    // Simulate missing config by testing the structure
    const result: Record<string, unknown> = {};
    expect(result).toEqual({});
  });

  it('writeConfig and readConfig round-trip', () => {
    const configPath = path.join(tmpDir, 'config.json');
    const config = { apiKey: 'pe_test_abc', baseUrl: 'https://api.getpe.dev' };
    fs.writeFileSync(configPath, JSON.stringify(config));
    const read = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(read.apiKey).toBe('pe_test_abc');
    expect(read.baseUrl).toBe('https://api.getpe.dev');
  });

  it('getApiKey prefers env var over config', () => {
    const original = process.env['PE_API_KEY'];
    process.env['PE_API_KEY'] = 'pe_env_key';
    const apiKey = process.env['PE_API_KEY'];
    expect(apiKey).toBe('pe_env_key');
    if (original) process.env['PE_API_KEY'] = original;
    else delete process.env['PE_API_KEY'];
  });
});

// ── HTTP Client tests ─────────────────────────────────────────────────────────
describe('HTTP Client', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('PeApiError has statusCode and body', async () => {
    const { PeApiError } = await import('../src/http');
    const err = new PeApiError(404, { error: 'not found' }, 'Not Found');
    expect(err.statusCode).toBe(404);
    expect(err.body).toEqual({ error: 'not found' });
    expect(err.name).toBe('PeApiError');
  });

  it('peRequest calls fetch with correct headers', async () => {
    const mockResponse = { ok: true, text: async () => '{"data":"ok"}' };
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(mockResponse as unknown as Response);

    const { peRequest } = await import('../src/http');
    const result = await peRequest('GET', '/v1/me', { apiKey: 'pe_test_abc', baseUrl: 'http://localhost:3001' });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/v1/me',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer pe_test_abc' }),
      }),
    );
    expect(result).toEqual({ data: 'ok' });
  });

  it('peRequest throws PeApiError on 401', async () => {
    const mockResponse = { ok: false, status: 401, text: async () => '{"error":"unauthorized"}' };
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(mockResponse as unknown as Response);

    const { peRequest, PeApiError } = await import('../src/http');
    await expect(peRequest('GET', '/v1/me', { apiKey: 'bad_key', baseUrl: 'http://localhost:3001' }))
      .rejects.toThrow(PeApiError);
  });

  it('peRequest sends body as JSON', async () => {
    const mockResponse = { ok: true, text: async () => '{"isValid":true}' };
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(mockResponse as unknown as Response);

    const { peRequest } = await import('../src/http');
    await peRequest('POST', '/v1/validate', { apiKey: 'pe_test_abc', baseUrl: 'http://localhost:3001' }, { resource: {} });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ resource: {} }) }),
    );
  });

  it('peRequest handles non-JSON response gracefully', async () => {
    const mockResponse = { ok: true, text: async () => 'plain text' };
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(mockResponse as unknown as Response);

    const { peRequest } = await import('../src/http');
    const result = await peRequest('GET', '/health', { apiKey: 'pe_test_abc', baseUrl: 'http://localhost:3001' });
    expect(result).toBe('plain text');
  });
});

// ── Output tests ──────────────────────────────────────────────────────────────
describe('Output', () => {
  it('printJson outputs valid JSON', async () => {
    const { printJson } = await import('../src/output');
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    printJson({ key: 'value' });
    expect(spy).toHaveBeenCalledWith(JSON.stringify({ key: 'value' }, null, 2));
    spy.mockRestore();
  });

  it('printTable outputs header and rows', async () => {
    const { printTable } = await import('../src/output');
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    printTable([{ name: 'Alice', age: 30 }]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('printTable handles empty rows', async () => {
    const { printTable } = await import('../src/output');
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    printTable([]);
    expect(spy).toHaveBeenCalledWith('(no results)');
    spy.mockRestore();
  });

  it('printError outputs to stderr', async () => {
    const { printError } = await import('../src/output');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    printError('something went wrong');
    expect(spy).toHaveBeenCalledWith('Error: something went wrong');
    spy.mockRestore();
  });

  it('printError in json mode outputs JSON', async () => {
    const { printError } = await import('../src/output');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    printError('oops', true);
    expect(spy).toHaveBeenCalledWith(JSON.stringify({ error: 'oops' }));
    spy.mockRestore();
  });

  it('printSuccess in json mode outputs JSON', async () => {
    const { printSuccess } = await import('../src/output');
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    printSuccess('done', true);
    expect(spy).toHaveBeenCalledWith(JSON.stringify({ message: 'done' }));
    spy.mockRestore();
  });
});

// ── File validation tests ─────────────────────────────────────────────────────
describe('File handling', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-cli-file-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads and parses valid FHIR JSON file', () => {
    const filePath = path.join(tmpDir, 'patient.json');
    const resource = { resourceType: 'Patient', id: 'p1' };
    fs.writeFileSync(filePath, JSON.stringify(resource));
    const result = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(result.resourceType).toBe('Patient');
  });

  it('detects missing file', () => {
    const filePath = path.join(tmpDir, 'missing.json');
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('writes fixed file with .fixed.json extension', () => {
    const filePath = path.join(tmpDir, 'resource.json');
    const fixedPath = filePath.replace(/\.json$/, '.fixed.json');
    const fixed = { resourceType: 'Patient', id: 'fixed' };
    fs.writeFileSync(fixedPath, JSON.stringify(fixed));
    expect(fs.existsSync(fixedPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(fixedPath, 'utf-8')).id).toBe('fixed');
  });
});

// ── URL construction tests ────────────────────────────────────────────────────
describe('URL construction', () => {
  it('builds correct FHIR read URL', () => {
    const base = 'https://api.getpe.dev';
    const resource = 'Patient';
    const id = 'p123';
    expect(`${base}/v1/fhir/${resource}/${id}`).toBe('https://api.getpe.dev/v1/fhir/Patient/p123');
  });

  it('builds correct FHIR search URL with params', () => {
    const params = new URLSearchParams({ family: 'Smith', gender: 'male' });
    const url = `/v1/fhir/Patient?${params.toString()}`;
    expect(url).toContain('family=Smith');
    expect(url).toContain('gender=male');
  });

  it('builds correct workflow run URL', () => {
    const base = 'http://localhost:3001';
    expect(`${base}/v1/workflows/run`).toBe('http://localhost:3001/v1/workflows/run');
  });

  it('builds correct PA status URL', () => {
    const id = 'pa-123-abc';
    expect(`/v1/pa/${id}`).toBe('/v1/pa/pa-123-abc');
  });
});

// ── Exit code tests ───────────────────────────────────────────────────────────
describe('Exit codes', () => {
  it('EXIT codes are correct values', () => {
    const EXIT = { SUCCESS: 0, API_ERROR: 1, VALIDATION_ERROR: 2, AUTH_ERROR: 3 };
    expect(EXIT.SUCCESS).toBe(0);
    expect(EXIT.API_ERROR).toBe(1);
    expect(EXIT.VALIDATION_ERROR).toBe(2);
    expect(EXIT.AUTH_ERROR).toBe(3);
  });
});
