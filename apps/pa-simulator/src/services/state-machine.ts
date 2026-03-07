import type { PAStatus, PATimelineEvent } from '@pe/types';
import type { PayerProfile } from '@pe/payer-profiles';

// ── Constants ─────────────────────────────────────────────────────────────────

export const BASE_DELAY_MS = parseInt(process.env['PA_SIMULATION_DELAY_MS'] ?? '5000', 10);
// Placeholder delay for "waiting for user action" (1 year)
const ACTION_WAIT_MS = 365 * 24 * 60 * 60 * 1000;

// ── PAOutcome ─────────────────────────────────────────────────────────────────

export interface PAOutcome {
  finalStatus: 'APPROVED' | 'DENIED';
  pendForInfo: boolean;
  requiresPeerToPeer: boolean;
  denialCode?: string;
  denialDescription?: string;
}

// ── computeOutcome ────────────────────────────────────────────────────────────

export function computeOutcome(profile: PayerProfile, scenario?: string): PAOutcome {
  switch (scenario) {
    case 'auto-approve':
      return {
        finalStatus: 'APPROVED',
        pendForInfo: false,
        requiresPeerToPeer: false,
      };

    case 'auto-deny': {
      const denialReason = profile.denialReasons[0];
      return {
        finalStatus: 'DENIED',
        pendForInfo: false,
        requiresPeerToPeer: false,
        denialCode: denialReason?.code ?? 'NOT_MEDICALLY_NECESSARY',
        denialDescription: denialReason?.description ?? 'Not medically necessary',
      };
    }

    case 'pended':
      return {
        finalStatus: 'APPROVED',
        pendForInfo: true,
        requiresPeerToPeer: false,
      };

    case 'appeal-approve': {
      const denialReason = profile.denialReasons[0];
      return {
        finalStatus: 'DENIED',
        pendForInfo: false,
        requiresPeerToPeer: false,
        denialCode: denialReason?.code ?? 'NOT_MEDICALLY_NECESSARY',
        denialDescription: denialReason?.description ?? 'Not medically necessary',
      };
    }

    case 'peer-to-peer': {
      const denialReason = profile.denialReasons[0];
      return {
        finalStatus: 'DENIED',
        pendForInfo: false,
        requiresPeerToPeer: true,
        denialCode: denialReason?.code ?? 'NOT_MEDICALLY_NECESSARY',
        denialDescription: denialReason?.description ?? 'Not medically necessary',
      };
    }

    default: {
      // Random based on profile autoApproveRate
      const approved = Math.random() < profile.autoApproveRate;
      if (approved) {
        return {
          finalStatus: 'APPROVED',
          pendForInfo: false,
          requiresPeerToPeer: false,
        };
      }
      // Denied — pick a denial reason by weighted probability
      const denialReason = pickDenialReason(profile);
      return {
        finalStatus: 'DENIED',
        pendForInfo: false,
        requiresPeerToPeer: profile.requiresPeerToPeer,
        denialCode: denialReason?.code ?? 'NOT_MEDICALLY_NECESSARY',
        denialDescription: denialReason?.description ?? 'Not medically necessary',
      };
    }
  }
}

function pickDenialReason(
  profile: PayerProfile,
): { code: string; description: string } | undefined {
  const reasons = profile.denialReasons;
  if (!reasons || reasons.length === 0) return undefined;
  const rand = Math.random();
  let cumulative = 0;
  for (const reason of reasons) {
    cumulative += reason.probability;
    if (rand < cumulative) return reason;
  }
  return reasons[reasons.length - 1];
}

// ── buildInitialTimeline ──────────────────────────────────────────────────────

export function buildInitialTimeline(
  outcome: PAOutcome,
  startTime: Date,
  delayMs: number = BASE_DELAY_MS,
): PATimelineEvent[] {
  const t = startTime.getTime();
  const timeline: PATimelineEvent[] = [];

  // SUBMITTED immediately
  timeline.push({
    status: 'SUBMITTED',
    timestamp: new Date(t).toISOString(),
    note: 'Prior authorization request submitted',
    actor: 'provider',
  });

  // PENDING_REVIEW 50ms later
  timeline.push({
    status: 'PENDING_REVIEW',
    timestamp: new Date(t + 50).toISOString(),
    note: 'Request received and under review',
    actor: 'payer',
  });

  if (outcome.pendForInfo) {
    // PENDED_FOR_INFO after delay
    timeline.push({
      status: 'PENDED_FOR_INFO',
      timestamp: new Date(t + delayMs).toISOString(),
      note: 'Additional clinical documentation required',
      actor: 'payer',
    });

    // RE_REVIEW placeholder: ACTION_WAIT_MS after start (far future, provider must supply docs)
    timeline.push({
      status: 'RE_REVIEW',
      timestamp: new Date(t + ACTION_WAIT_MS).toISOString(),
      note: 'Waiting for provider to submit additional information',
      actor: 'payer',
    });

    // Final status placeholder: ACTION_WAIT_MS + delay
    const finalStatus: PAStatus = outcome.finalStatus;
    timeline.push({
      status: finalStatus,
      timestamp: new Date(t + ACTION_WAIT_MS + delayMs).toISOString(),
      note:
        finalStatus === 'APPROVED'
          ? 'Prior authorization approved after review of additional information'
          : 'Prior authorization denied after review of additional information',
      actor: 'payer',
    });
  } else if (outcome.requiresPeerToPeer) {
    // PEER_TO_PEER_REQUESTED after delay
    timeline.push({
      status: 'PEER_TO_PEER_REQUESTED',
      timestamp: new Date(t + delayMs).toISOString(),
      note: 'Peer-to-peer review requested by payer',
      actor: 'payer',
    });

    // DENIED after ACTION_WAIT_MS (waiting for provider to schedule P2P)
    timeline.push({
      status: 'DENIED',
      timestamp: new Date(t + ACTION_WAIT_MS).toISOString(),
      note:
        outcome.denialDescription ??
        'Prior authorization denied — peer-to-peer review not completed',
      actor: 'payer',
    });
  } else {
    // Direct path: APPROVED or DENIED after delay
    const finalStatus: PAStatus = outcome.finalStatus;
    timeline.push({
      status: finalStatus,
      timestamp: new Date(t + delayMs).toISOString(),
      note:
        finalStatus === 'APPROVED'
          ? 'Prior authorization approved'
          : outcome.denialDescription ?? 'Prior authorization denied',
      actor: 'payer',
    });
  }

  return timeline;
}

// ── computeCurrentStatus ──────────────────────────────────────────────────────

export function computeCurrentStatus(storedTimeline: PATimelineEvent[]): {
  currentStatus: PAStatus;
  visibleTimeline: PATimelineEvent[];
} {
  const now = Date.now();
  const visibleTimeline = storedTimeline.filter(
    (event) => new Date(event.timestamp).getTime() <= now,
  );

  if (visibleTimeline.length === 0) {
    return {
      currentStatus: 'SUBMITTED',
      visibleTimeline: [],
    };
  }

  const lastEvent = visibleTimeline[visibleTimeline.length - 1]!;
  return {
    currentStatus: lastEvent.status,
    visibleTimeline,
  };
}

// ── updateTimelineForInfo ─────────────────────────────────────────────────────

export function updateTimelineForInfo(
  storedTimeline: PATimelineEvent[],
  delayMs: number = BASE_DELAY_MS,
): PATimelineEvent[] {
  const updated = [...storedTimeline];
  const now = Date.now();

  // Find the RE_REVIEW event index
  const reReviewIdx = updated.findIndex((e) => e.status === 'RE_REVIEW');
  if (reReviewIdx === -1) return updated;

  // RE_REVIEW happens soon
  const reReviewTime = now + 50;
  updated[reReviewIdx] = {
    ...updated[reReviewIdx]!,
    timestamp: new Date(reReviewTime).toISOString(),
    note: 'Re-reviewing with submitted additional information',
  };

  // Update subsequent events (final status)
  for (let i = reReviewIdx + 1; i < updated.length; i++) {
    updated[i] = {
      ...updated[i]!,
      timestamp: new Date(reReviewTime + delayMs * (i - reReviewIdx)).toISOString(),
    };
  }

  return updated;
}

// ── appendAppealToTimeline ────────────────────────────────────────────────────

export function appendAppealToTimeline(
  storedTimeline: PATimelineEvent[],
  appealSuccessRate: number,
  scenario?: string,
  delayMs: number = BASE_DELAY_MS,
): PATimelineEvent[] {
  const updated = [...storedTimeline];
  const now = Date.now();

  // Determine appeal outcome
  let appealApproved: boolean;
  if (scenario === 'appeal-approve') {
    appealApproved = true;
  } else {
    appealApproved = Math.random() < appealSuccessRate;
  }

  const appealSubmittedTime = now;
  const appealReviewTime = now + 50;
  const appealFinalTime = now + 50 + delayMs;

  updated.push({
    status: 'APPEAL_SUBMITTED',
    timestamp: new Date(appealSubmittedTime).toISOString(),
    note: 'Appeal submitted for denied prior authorization',
    actor: 'provider',
  });

  updated.push({
    status: 'APPEAL_REVIEW',
    timestamp: new Date(appealReviewTime).toISOString(),
    note: 'Appeal under review by payer',
    actor: 'payer',
  });

  updated.push({
    status: appealApproved ? 'APPEAL_APPROVED' : 'APPEAL_DENIED',
    timestamp: new Date(appealFinalTime).toISOString(),
    note: appealApproved
      ? 'Appeal approved — prior authorization granted'
      : 'Appeal denied — prior authorization upheld',
    actor: 'payer',
  });

  return updated;
}
