import request from 'supertest';
import type { PATimelineEvent } from '@pe/types';
import app from '../app';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@pe/db', () => ({
  prisma: {
    pASimulation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@pe/payer-profiles', () => {
  const PROFILE = {
    id: 'aetna-commercial',
    name: 'Aetna Commercial',
    baseUrl: 'https://sandbox.aetna.com/fhir/R4',
    authType: 'smart',
    autoApproveRate: 1.0,
    appealSuccessRate: 0.5,
    averageResponseTime: '2d',
    denialReasons: [
      { code: 'MISSING_DOCS', description: 'Missing docs', probability: 0.5 },
    ],
    requiresPeerToPeer: false,
    requiredDocumentation: {},
  };
  return {
    getPayerProfile: jest.fn().mockReturnValue(PROFILE),
    listPayerProfiles: jest.fn().mockReturnValue([PROFILE]),
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

beforeAll(() => {
  process.env['PA_SIMULATION_DELAY_MS'] = '0';
});

afterAll(() => {
  delete process.env['PA_SIMULATION_DELAY_MS'];
});

function makePastTimestamp(offsetMs = 0): string {
  return new Date(Date.now() - 1000 + offsetMs).toISOString();
}

function makeSimulation(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  const defaultTimeline: PATimelineEvent[] = [
    { status: 'SUBMITTED', timestamp: new Date(now - 3000).toISOString(), actor: 'provider' },
    { status: 'PENDING_REVIEW', timestamp: new Date(now - 2000).toISOString(), actor: 'payer' },
    { status: 'APPROVED', timestamp: new Date(now - 1000).toISOString(), actor: 'payer' },
  ];

  return {
    id: 'sim-123',
    projectId: 'sandbox',
    payerProfile: 'aetna-commercial',
    scenario: null,
    status: 'APPROVED',
    claim: { resourceType: 'Claim', id: 'claim-1' },
    response: { resourceType: 'ClaimResponse', id: 'resp-1' },
    timeline: defaultTimeline,
    createdAt: new Date(now - 5000),
    updatedAt: new Date(now - 1000),
    ...overrides,
  };
}

function makePendedSimulation() {
  const now = Date.now();
  const ACTION_WAIT_MS = 365 * 24 * 60 * 60 * 1000;
  const pendedTimeline: PATimelineEvent[] = [
    { status: 'SUBMITTED', timestamp: new Date(now - 5000).toISOString(), actor: 'provider' },
    { status: 'PENDING_REVIEW', timestamp: new Date(now - 4000).toISOString(), actor: 'payer' },
    { status: 'PENDED_FOR_INFO', timestamp: new Date(now - 2000).toISOString(), actor: 'payer' },
    {
      status: 'RE_REVIEW',
      timestamp: new Date(now + ACTION_WAIT_MS).toISOString(),
      actor: 'payer',
    },
    {
      status: 'APPROVED',
      timestamp: new Date(now + ACTION_WAIT_MS + 5000).toISOString(),
      actor: 'payer',
    },
  ];

  return makeSimulation({
    status: 'PENDED_FOR_INFO',
    timeline: pendedTimeline,
  });
}

function makeDeniedSimulation() {
  const now = Date.now();
  const deniedTimeline: PATimelineEvent[] = [
    { status: 'SUBMITTED', timestamp: new Date(now - 5000).toISOString(), actor: 'provider' },
    { status: 'PENDING_REVIEW', timestamp: new Date(now - 4000).toISOString(), actor: 'payer' },
    { status: 'DENIED', timestamp: new Date(now - 1000).toISOString(), actor: 'payer' },
  ];

  return makeSimulation({
    status: 'DENIED',
    timeline: deniedTimeline,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('pa-simulator');
  });
});

describe('GET /pa/payers', () => {
  it('returns 200 with payers array', async () => {
    const res = await request(app).get('/pa/payers');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.payers)).toBe(true);
    expect(res.body.payers.length).toBeGreaterThan(0);
  });
});

describe('POST /pa/submit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 201 with simulation when valid body', async () => {
    const { prisma } = jest.requireMock('@pe/db') as {
      prisma: { pASimulation: { create: jest.Mock } };
    };
    prisma.pASimulation.create.mockResolvedValueOnce(makeSimulation());

    const res = await request(app)
      .post('/pa/submit')
      .send({ payerProfile: 'aetna-commercial' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('sim-123');
    expect(res.body.status).toBeDefined();
  });

  it('returns 400 when payerProfile is missing', async () => {
    const res = await request(app)
      .post('/pa/submit')
      .send({ scenario: 'auto-approve' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  it('returns 400 when payerProfile is unknown', async () => {
    const { getPayerProfile } = jest.requireMock('@pe/payer-profiles') as {
      getPayerProfile: jest.Mock;
    };
    getPayerProfile.mockReturnValueOnce(undefined);

    const res = await request(app)
      .post('/pa/submit')
      .send({ payerProfile: 'unknown-payer' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UNKNOWN_PAYER');
  });
});

describe('GET /pa/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with simulation when found', async () => {
    const { prisma } = jest.requireMock('@pe/db') as {
      prisma: { pASimulation: { findUnique: jest.Mock } };
    };
    prisma.pASimulation.findUnique.mockResolvedValueOnce(makeSimulation());

    const res = await request(app).get('/pa/sim-123');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('sim-123');
    expect(res.body.status).toBeDefined();
    expect(res.body.timeline).toBeDefined();
  });

  it('returns 404 when simulation not found', async () => {
    const { prisma } = jest.requireMock('@pe/db') as {
      prisma: { pASimulation: { findUnique: jest.Mock } };
    };
    prisma.pASimulation.findUnique.mockResolvedValueOnce(null);

    const res = await request(app).get('/pa/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

describe('POST /pa/:id/info', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 when simulation is in PENDED_FOR_INFO state', async () => {
    const { prisma } = jest.requireMock('@pe/db') as {
      prisma: { pASimulation: { findUnique: jest.Mock; update: jest.Mock } };
    };
    const pendedSim = makePendedSimulation();
    prisma.pASimulation.findUnique.mockResolvedValueOnce(pendedSim);
    // After update, return updated sim with RE_REVIEW in near future
    const updatedTimeline = [...(pendedSim.timeline as PATimelineEvent[])];
    const now = Date.now();
    updatedTimeline[3] = { status: 'RE_REVIEW', timestamp: new Date(now + 50).toISOString(), actor: 'payer' };
    updatedTimeline[4] = { status: 'APPROVED', timestamp: new Date(now + 150).toISOString(), actor: 'payer' };
    prisma.pASimulation.update.mockResolvedValueOnce({
      ...pendedSim,
      timeline: updatedTimeline,
      status: 'RE_REVIEW',
    });

    const res = await request(app)
      .post('/pa/sim-123/info')
      .send({ documents: ['doc1.pdf', 'doc2.pdf'] });

    expect(res.status).toBe(200);
  });

  it('returns 409 when simulation is not in PENDED_FOR_INFO state', async () => {
    const { prisma } = jest.requireMock('@pe/db') as {
      prisma: { pASimulation: { findUnique: jest.Mock } };
    };
    // Use a SUBMITTED state simulation
    const now = Date.now();
    const submittedSim = makeSimulation({
      timeline: [
        { status: 'SUBMITTED', timestamp: new Date(now - 1000).toISOString(), actor: 'provider' },
      ],
      status: 'SUBMITTED',
    });
    prisma.pASimulation.findUnique.mockResolvedValueOnce(submittedSim);

    const res = await request(app)
      .post('/pa/sim-123/info')
      .send({ documents: ['doc1.pdf'] });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_STATE');
  });
});

describe('POST /pa/:id/appeal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 when simulation is in DENIED state', async () => {
    const { prisma } = jest.requireMock('@pe/db') as {
      prisma: { pASimulation: { findUnique: jest.Mock; update: jest.Mock } };
    };
    const deniedSim = makeDeniedSimulation();
    prisma.pASimulation.findUnique.mockResolvedValueOnce(deniedSim);

    const now = Date.now();
    const appealTimeline = [
      ...(deniedSim.timeline as PATimelineEvent[]),
      { status: 'APPEAL_SUBMITTED' as const, timestamp: new Date(now).toISOString(), actor: 'provider' },
      { status: 'APPEAL_REVIEW' as const, timestamp: new Date(now + 50).toISOString(), actor: 'payer' },
      { status: 'APPEAL_APPROVED' as const, timestamp: new Date(now + 100).toISOString(), actor: 'payer' },
    ];
    prisma.pASimulation.update.mockResolvedValueOnce({
      ...deniedSim,
      timeline: appealTimeline,
      status: 'APPEAL_SUBMITTED',
    });

    const res = await request(app)
      .post('/pa/sim-123/appeal')
      .send({ reason: 'Patient meets all criteria' });

    expect(res.status).toBe(200);
  });

  it('returns 409 when simulation is not in DENIED or PEER_TO_PEER_REQUESTED state', async () => {
    const { prisma } = jest.requireMock('@pe/db') as {
      prisma: { pASimulation: { findUnique: jest.Mock } };
    };
    const now = Date.now();
    const submittedSim = makeSimulation({
      timeline: [
        { status: 'SUBMITTED', timestamp: new Date(now - 1000).toISOString(), actor: 'provider' },
      ],
      status: 'SUBMITTED',
    });
    prisma.pASimulation.findUnique.mockResolvedValueOnce(submittedSim);

    const res = await request(app)
      .post('/pa/sim-123/appeal')
      .send({ reason: 'Test appeal' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_STATE');
  });
});

describe('GET /pa/:id/timeline', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with timeline data', async () => {
    const { prisma } = jest.requireMock('@pe/db') as {
      prisma: { pASimulation: { findUnique: jest.Mock } };
    };
    prisma.pASimulation.findUnique.mockResolvedValueOnce(makeSimulation());

    const res = await request(app).get('/pa/sim-123/timeline');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('sim-123');
    expect(res.body.currentStatus).toBeDefined();
    expect(Array.isArray(res.body.timeline)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });
});
