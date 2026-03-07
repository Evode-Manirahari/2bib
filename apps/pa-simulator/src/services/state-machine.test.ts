import type { PayerProfile } from '@pe/payer-profiles';
import {
  computeOutcome,
  buildInitialTimeline,
  computeCurrentStatus,
  updateTimelineForInfo,
  appendAppealToTimeline,
} from './state-machine';

// ── Test profile helpers ──────────────────────────────────────────────────────

const makeProfile = (overrides: Partial<PayerProfile> = {}): PayerProfile => ({
  id: 'test-payer',
  name: 'Test Payer',
  baseUrl: 'https://test.example.com/fhir/R4',
  authType: 'none',
  autoApproveRate: 0.7,
  averageResponseTime: '2d',
  requiredDocumentation: {},
  denialReasons: [
    { code: 'MISSING_DOCS', description: 'Missing documentation', probability: 0.5 },
    { code: 'NOT_MEDICALLY_NECESSARY', description: 'Not medically necessary', probability: 0.5 },
  ],
  appealSuccessRate: 0.5,
  requiresPeerToPeer: false,
  ...overrides,
});

// ── computeOutcome tests ──────────────────────────────────────────────────────

describe('computeOutcome', () => {
  const profile = makeProfile();

  it('auto-approve scenario returns APPROVED with no pend or p2p', () => {
    const outcome = computeOutcome(profile, 'auto-approve');
    expect(outcome.finalStatus).toBe('APPROVED');
    expect(outcome.pendForInfo).toBe(false);
    expect(outcome.requiresPeerToPeer).toBe(false);
  });

  it('auto-deny scenario returns DENIED with denialCode', () => {
    const outcome = computeOutcome(profile, 'auto-deny');
    expect(outcome.finalStatus).toBe('DENIED');
    expect(outcome.denialCode).toBeDefined();
    expect(typeof outcome.denialCode).toBe('string');
  });

  it('pended scenario returns APPROVED with pendForInfo=true', () => {
    const outcome = computeOutcome(profile, 'pended');
    expect(outcome.finalStatus).toBe('APPROVED');
    expect(outcome.pendForInfo).toBe(true);
  });

  it('peer-to-peer scenario returns DENIED with requiresPeerToPeer=true', () => {
    const outcome = computeOutcome(profile, 'peer-to-peer');
    expect(outcome.finalStatus).toBe('DENIED');
    expect(outcome.requiresPeerToPeer).toBe(true);
  });

  it('appeal-approve scenario returns DENIED (initial state before appeal)', () => {
    const outcome = computeOutcome(profile, 'appeal-approve');
    expect(outcome.finalStatus).toBe('DENIED');
  });

  it('random with autoApproveRate=1.0 always returns APPROVED', () => {
    const alwaysApproveProfile = makeProfile({ autoApproveRate: 1.0 });
    for (let i = 0; i < 20; i++) {
      const outcome = computeOutcome(alwaysApproveProfile, undefined);
      expect(outcome.finalStatus).toBe('APPROVED');
    }
  });

  it('random with autoApproveRate=0.0 always returns DENIED', () => {
    const alwaysDenyProfile = makeProfile({ autoApproveRate: 0.0 });
    for (let i = 0; i < 20; i++) {
      const outcome = computeOutcome(alwaysDenyProfile, undefined);
      expect(outcome.finalStatus).toBe('DENIED');
    }
  });
});

// ── buildInitialTimeline tests ────────────────────────────────────────────────

describe('buildInitialTimeline', () => {
  const profile = makeProfile();
  const startTime = new Date();

  it('auto-approve timeline contains SUBMITTED, PENDING_REVIEW, APPROVED', () => {
    const outcome = computeOutcome(profile, 'auto-approve');
    const timeline = buildInitialTimeline(outcome, startTime, 100);
    const statuses = timeline.map((e) => e.status);
    expect(statuses).toContain('SUBMITTED');
    expect(statuses).toContain('PENDING_REVIEW');
    expect(statuses).toContain('APPROVED');
    expect(statuses).not.toContain('DENIED');
  });

  it('APPROVED event is in the future when delayMs > 0', () => {
    const outcome = computeOutcome(profile, 'auto-approve');
    const timeline = buildInitialTimeline(outcome, startTime, 5000);
    const approvedEvent = timeline.find((e) => e.status === 'APPROVED');
    expect(approvedEvent).toBeDefined();
    expect(new Date(approvedEvent!.timestamp).getTime()).toBeGreaterThan(Date.now());
  });

  it('auto-deny timeline contains DENIED', () => {
    const outcome = computeOutcome(profile, 'auto-deny');
    const timeline = buildInitialTimeline(outcome, startTime, 100);
    const statuses = timeline.map((e) => e.status);
    expect(statuses).toContain('DENIED');
    expect(statuses).not.toContain('APPROVED');
  });

  it('pended timeline contains PENDED_FOR_INFO, RE_REVIEW, and final status', () => {
    const outcome = computeOutcome(profile, 'pended');
    const timeline = buildInitialTimeline(outcome, startTime, 100);
    const statuses = timeline.map((e) => e.status);
    expect(statuses).toContain('PENDED_FOR_INFO');
    expect(statuses).toContain('RE_REVIEW');
    // Final status should be APPROVED (pended scenario resolves to approved)
    expect(statuses).toContain('APPROVED');
  });

  it('peer-to-peer timeline contains PEER_TO_PEER_REQUESTED', () => {
    const outcome = computeOutcome(profile, 'peer-to-peer');
    const timeline = buildInitialTimeline(outcome, startTime, 100);
    const statuses = timeline.map((e) => e.status);
    expect(statuses).toContain('PEER_TO_PEER_REQUESTED');
  });

  it('timeline events are in chronological order', () => {
    const outcome = computeOutcome(profile, 'auto-approve');
    const timeline = buildInitialTimeline(outcome, startTime, 1000);
    for (let i = 1; i < timeline.length; i++) {
      const prev = new Date(timeline[i - 1]!.timestamp).getTime();
      const curr = new Date(timeline[i]!.timestamp).getTime();
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });
});

// ── computeCurrentStatus tests ────────────────────────────────────────────────

describe('computeCurrentStatus', () => {
  it('with all past timestamps returns the last status', () => {
    const now = Date.now();
    const timeline = [
      { status: 'SUBMITTED' as const, timestamp: new Date(now - 3000).toISOString() },
      { status: 'PENDING_REVIEW' as const, timestamp: new Date(now - 2000).toISOString() },
      { status: 'APPROVED' as const, timestamp: new Date(now - 1000).toISOString() },
    ];
    const { currentStatus, visibleTimeline } = computeCurrentStatus(timeline);
    expect(currentStatus).toBe('APPROVED');
    expect(visibleTimeline).toHaveLength(3);
  });

  it('with future events after PENDING_REVIEW returns PENDING_REVIEW', () => {
    const now = Date.now();
    const timeline = [
      { status: 'SUBMITTED' as const, timestamp: new Date(now - 3000).toISOString() },
      { status: 'PENDING_REVIEW' as const, timestamp: new Date(now - 2000).toISOString() },
      { status: 'APPROVED' as const, timestamp: new Date(now + 5000).toISOString() },
    ];
    const { currentStatus, visibleTimeline } = computeCurrentStatus(timeline);
    expect(currentStatus).toBe('PENDING_REVIEW');
    expect(visibleTimeline).toHaveLength(2);
  });

  it('with empty timeline returns SUBMITTED with empty visible timeline', () => {
    const { currentStatus, visibleTimeline } = computeCurrentStatus([]);
    expect(currentStatus).toBe('SUBMITTED');
    expect(visibleTimeline).toHaveLength(0);
  });
});

// ── updateTimelineForInfo tests ───────────────────────────────────────────────

describe('updateTimelineForInfo', () => {
  it('moves RE_REVIEW to near-future', () => {
    const now = Date.now();
    const ACTION_WAIT_MS = 365 * 24 * 60 * 60 * 1000;
    const timeline = [
      { status: 'SUBMITTED' as const, timestamp: new Date(now - 5000).toISOString() },
      { status: 'PENDING_REVIEW' as const, timestamp: new Date(now - 4000).toISOString() },
      { status: 'PENDED_FOR_INFO' as const, timestamp: new Date(now - 1000).toISOString() },
      {
        status: 'RE_REVIEW' as const,
        timestamp: new Date(now + ACTION_WAIT_MS).toISOString(),
      },
      {
        status: 'APPROVED' as const,
        timestamp: new Date(now + ACTION_WAIT_MS + 5000).toISOString(),
      },
    ];

    const updated = updateTimelineForInfo(timeline, 100);
    const reReviewEvent = updated.find((e) => e.status === 'RE_REVIEW');
    expect(reReviewEvent).toBeDefined();
    // RE_REVIEW should now be in the near future (within 1 second of now)
    const reReviewTime = new Date(reReviewEvent!.timestamp).getTime();
    expect(reReviewTime).toBeGreaterThan(now - 100);
    expect(reReviewTime).toBeLessThan(now + 5000);
  });
});

// ── appendAppealToTimeline tests ──────────────────────────────────────────────

describe('appendAppealToTimeline', () => {
  it('appeal-approve scenario appends APPEAL_APPROVED', () => {
    const now = Date.now();
    const timeline = [
      { status: 'SUBMITTED' as const, timestamp: new Date(now - 5000).toISOString() },
      { status: 'PENDING_REVIEW' as const, timestamp: new Date(now - 4000).toISOString() },
      { status: 'DENIED' as const, timestamp: new Date(now - 1000).toISOString() },
    ];

    const updated = appendAppealToTimeline(timeline, 0.5, 'appeal-approve', 100);
    const statuses = updated.map((e) => e.status);
    expect(statuses).toContain('APPEAL_SUBMITTED');
    expect(statuses).toContain('APPEAL_REVIEW');
    expect(statuses).toContain('APPEAL_APPROVED');
    expect(statuses).not.toContain('APPEAL_DENIED');
  });

  it('preserves original timeline events before appending appeal events', () => {
    const now = Date.now();
    const timeline = [
      { status: 'SUBMITTED' as const, timestamp: new Date(now - 5000).toISOString() },
      { status: 'DENIED' as const, timestamp: new Date(now - 1000).toISOString() },
    ];

    const updated = appendAppealToTimeline(timeline, 1.0, undefined, 100);
    expect(updated[0]!.status).toBe('SUBMITTED');
    expect(updated[1]!.status).toBe('DENIED');
    expect(updated.length).toBeGreaterThan(2);
  });
});
