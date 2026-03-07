import axios from 'axios';
import { uploadBundle, uploadBundles } from './uploader';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const HAPI_URL = 'http://localhost:8080';
const SAMPLE_BUNDLE: Record<string, unknown> = { resourceType: 'Bundle', type: 'transaction' };

describe('uploadBundle()', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns success with resourceCount and patientId', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        entry: [
          { response: { status: '201 Created', location: 'Patient/abc123/_history/1' } },
          { response: { status: '201 Created', location: 'Condition/xyz/_history/1' } },
          { response: { status: '201 Created', location: 'Coverage/cov1/_history/1' } },
        ],
      },
    });

    const result = await uploadBundle(HAPI_URL, SAMPLE_BUNDLE);
    expect(result.success).toBe(true);
    expect(result.resourceCount).toBe(3);
    // location 'Patient/abc123/_history/1' → split('/')[1] = 'abc123'
    expect(result.patientId).toBe('abc123');
  });

  it('handles response with no entries', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {} });

    const result = await uploadBundle(HAPI_URL, SAMPLE_BUNDLE);
    expect(result.success).toBe(true);
    expect(result.resourceCount).toBe(0);
    expect(result.patientId).toBeUndefined();
  });

  it('returns failure on network error', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await uploadBundle(HAPI_URL, SAMPLE_BUNDLE);
    expect(result.success).toBe(false);
    expect(result.resourceCount).toBe(0);
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('counts only 2xx status entries', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        entry: [
          { response: { status: '201 Created' } },
          { response: { status: '400 Bad Request' } },
          { response: { status: '200 OK' } },
        ],
      },
    });

    const result = await uploadBundle(HAPI_URL, SAMPLE_BUNDLE);
    expect(result.success).toBe(true);
    expect(result.resourceCount).toBe(2);
  });

  it('posts to the correct FHIR endpoint', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { entry: [] } });

    await uploadBundle(HAPI_URL, SAMPLE_BUNDLE);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      `${HAPI_URL}/fhir`,
      SAMPLE_BUNDLE,
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/fhir+json' }),
      }),
    );
  });
});

describe('uploadBundles()', () => {
  afterEach(() => jest.clearAllMocks());

  const bundles = [
    { bundle: SAMPLE_BUNDLE, label: 'Patient A' },
    { bundle: SAMPLE_BUNDLE, label: 'Patient B' },
    { bundle: SAMPLE_BUNDLE, label: 'Patient C' },
  ];

  it('returns correct summary for all successes', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { entry: [{ response: { status: '201 Created' } }, { response: { status: '201 Created' } }] },
    });

    const summary = await uploadBundles(HAPI_URL, bundles);
    expect(summary.total).toBe(3);
    expect(summary.uploaded).toBe(3);
    expect(summary.failed).toBe(0);
    expect(summary.resourcesCreated).toBe(6);
    expect(summary.errors).toHaveLength(0);
    expect(summary.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns correct summary for mixed results', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { entry: [{ response: { status: '201 Created' } }] } })
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ data: { entry: [{ response: { status: '201 Created' } }] } });

    const summary = await uploadBundles(HAPI_URL, bundles);
    expect(summary.uploaded).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.errors[0]).toContain('Patient B');
    expect(summary.errors[0]).toContain('timeout');
  });

  it('calls onProgress for each bundle', async () => {
    mockedAxios.post.mockResolvedValue({ data: { entry: [] } });

    const onProgress = jest.fn();
    await uploadBundles(HAPI_URL, bundles, onProgress);
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenCalledWith('Patient A', expect.objectContaining({ success: true }));
    expect(onProgress).toHaveBeenCalledWith('Patient B', expect.objectContaining({ success: true }));
    expect(onProgress).toHaveBeenCalledWith('Patient C', expect.objectContaining({ success: true }));
  });

  it('handles all failures gracefully', async () => {
    mockedAxios.post.mockRejectedValue(new Error('HAPI down'));

    const summary = await uploadBundles(HAPI_URL, bundles);
    expect(summary.uploaded).toBe(0);
    expect(summary.failed).toBe(3);
    expect(summary.resourcesCreated).toBe(0);
    expect(summary.errors).toHaveLength(3);
  });

  it('handles empty bundles array', async () => {
    const summary = await uploadBundles(HAPI_URL, []);
    expect(summary.total).toBe(0);
    expect(summary.uploaded).toBe(0);
    expect(summary.failed).toBe(0);
    expect(summary.resourcesCreated).toBe(0);
  });
});
