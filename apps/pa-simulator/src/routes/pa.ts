import { Router, type IRouter, type Request, type Response } from 'express';
import { prisma } from '@pe/db';
import { getPayerProfile, listPayerProfiles } from '@pe/payer-profiles';
import type { PATimelineEvent } from '@pe/types';
import {
  computeOutcome,
  buildInitialTimeline,
  computeCurrentStatus,
  updateTimelineForInfo,
  appendAppealToTimeline,
  BASE_DELAY_MS,
} from '../services/state-machine';
import { buildFhirClaim, buildFhirClaimResponse } from '../services/claim-fhir';

export const paRouter: IRouter = Router();

// ── Terminal status set ───────────────────────────────────────────────────────

const TERMINAL_STATUSES = new Set([
  'APPROVED',
  'DENIED',
  'APPEAL_APPROVED',
  'APPEAL_DENIED',
]);

// ── Format simulation for response ───────────────────────────────────────────

function formatSimulation(sim: {
  id: string;
  projectId: string;
  payerProfile: string;
  scenario: string | null;
  claim: unknown;
  response: unknown;
  timeline: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  const storedTimeline = sim.timeline as unknown as PATimelineEvent[];
  const { currentStatus, visibleTimeline } = computeCurrentStatus(storedTimeline);
  const isTerminal = TERMINAL_STATUSES.has(currentStatus);

  return {
    id: sim.id,
    projectId: sim.projectId,
    payerProfile: sim.payerProfile,
    scenario: sim.scenario ?? undefined,
    status: currentStatus,
    claim: sim.claim,
    ...(isTerminal ? { response: sim.response } : {}),
    timeline: visibleTimeline,
    createdAt: sim.createdAt.toISOString(),
    updatedAt: sim.updatedAt.toISOString(),
  };
}

// ── GET /payers ───────────────────────────────────────────────────────────────

paRouter.get('/payers', (_req: Request, res: Response) => {
  const payers = listPayerProfiles();
  res.json({ payers });
});

// ── POST /submit ──────────────────────────────────────────────────────────────

paRouter.post('/submit', async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  // Validate required field
  if (!body['payerProfile'] || typeof body['payerProfile'] !== 'string') {
    res.status(400).json({
      error: 'payerProfile is required',
      code: 'BAD_REQUEST',
    });
    return;
  }

  const payerProfileId = body['payerProfile'] as string;
  const profile = getPayerProfile(payerProfileId);

  if (!profile) {
    res.status(400).json({
      error: `Unknown payer profile: ${payerProfileId}`,
      code: 'UNKNOWN_PAYER',
    });
    return;
  }

  const scenario = body['scenario'] as string | undefined;
  const patientRef = (body['patientRef'] as string | undefined) ?? 'Patient/unknown';
  const icd10 = body['icd10'] as string | undefined;
  const cptCode = body['cptCode'] as string | undefined;
  const projectId =
    (req.headers['x-pe-project-id'] as string | undefined) ??
    (body['projectId'] as string | undefined) ??
    'sandbox';

  // Compute outcome
  const outcome = computeOutcome(profile, scenario);

  // Build timeline (all future events pre-computed)
  const delayMs = parseInt(process.env['PA_SIMULATION_DELAY_MS'] ?? String(BASE_DELAY_MS), 10);
  const timeline = buildInitialTimeline(outcome, new Date(), delayMs);

  // Build FHIR Claim
  const fhirClaim = buildFhirClaim({
    patientRef,
    payerName: profile.name,
    icd10,
    cptCode,
  });

  // Build FHIR ClaimResponse
  const fhirClaimResponse = buildFhirClaimResponse({
    claimId: fhirClaim['id'] as string,
    payerName: profile.name,
    outcome: outcome.finalStatus === 'APPROVED' ? 'complete' : 'error',
    disposition:
      outcome.finalStatus === 'APPROVED'
        ? 'Prior authorization approved'
        : outcome.denialDescription ?? 'Prior authorization denied',
    denialCode: outcome.denialCode,
    denialDescription: outcome.denialDescription,
  });

  const claimToStore = body['claim'] ?? fhirClaim;

  const simulation = await prisma.pASimulation.create({
    data: {
      projectId,
      payerProfile: payerProfileId,
      scenario: scenario ?? null,
      status: 'SUBMITTED',
      claim: claimToStore as object,
      response: fhirClaimResponse as object,
      timeline: timeline as unknown as object,
    },
  });

  res.status(201).json(formatSimulation(simulation));
});

// ── GET /:id ──────────────────────────────────────────────────────────────────

paRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };

  const simulation = await prisma.pASimulation.findUnique({ where: { id } });
  if (!simulation) {
    res.status(404).json({ error: 'Simulation not found', code: 'NOT_FOUND' });
    return;
  }

  res.json(formatSimulation(simulation));
});

// ── POST /:id/info ────────────────────────────────────────────────────────────

paRouter.post('/:id/info', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const body = req.body as Record<string, unknown>;

  // Validate documents
  if (!Array.isArray(body['documents'])) {
    res.status(400).json({
      error: 'documents array is required',
      code: 'BAD_REQUEST',
    });
    return;
  }

  const simulation = await prisma.pASimulation.findUnique({ where: { id } });
  if (!simulation) {
    res.status(404).json({ error: 'Simulation not found', code: 'NOT_FOUND' });
    return;
  }

  const storedTimeline = simulation.timeline as unknown as PATimelineEvent[];
  const { currentStatus } = computeCurrentStatus(storedTimeline);

  if (currentStatus !== 'PENDED_FOR_INFO') {
    res.status(409).json({
      error: `Cannot submit info: current status is ${currentStatus}, expected PENDED_FOR_INFO`,
      code: 'INVALID_STATE',
    });
    return;
  }

  const delayMs = parseInt(process.env['PA_SIMULATION_DELAY_MS'] ?? String(BASE_DELAY_MS), 10);
  const newTimeline = updateTimelineForInfo(storedTimeline, delayMs);

  const updated = await prisma.pASimulation.update({
    where: { id },
    data: {
      timeline: newTimeline as unknown as object,
      status: 'RE_REVIEW',
    },
  });

  res.json(formatSimulation(updated));
});

// ── POST /:id/appeal ──────────────────────────────────────────────────────────

paRouter.post('/:id/appeal', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const body = req.body as Record<string, unknown>;

  const simulation = await prisma.pASimulation.findUnique({ where: { id } });
  if (!simulation) {
    res.status(404).json({ error: 'Simulation not found', code: 'NOT_FOUND' });
    return;
  }

  const storedTimeline = simulation.timeline as unknown as PATimelineEvent[];
  const { currentStatus } = computeCurrentStatus(storedTimeline);

  const appealableStatuses = ['DENIED', 'PEER_TO_PEER_REQUESTED'];
  if (!appealableStatuses.includes(currentStatus)) {
    res.status(409).json({
      error: `Cannot appeal: current status is ${currentStatus}, expected DENIED or PEER_TO_PEER_REQUESTED`,
      code: 'INVALID_STATE',
    });
    return;
  }

  const profile = getPayerProfile(simulation.payerProfile);
  const appealSuccessRate = profile?.appealSuccessRate ?? 0.5;
  const scenario = simulation.scenario ?? undefined;
  const delayMs = parseInt(process.env['PA_SIMULATION_DELAY_MS'] ?? String(BASE_DELAY_MS), 10);

  const newTimeline = appendAppealToTimeline(
    storedTimeline,
    appealSuccessRate,
    scenario,
    delayMs,
  );

  const updated = await prisma.pASimulation.update({
    where: { id },
    data: {
      timeline: newTimeline as unknown as object,
      status: 'APPEAL_SUBMITTED',
    },
  });

  res.json(formatSimulation(updated));
});

// ── GET /:id/timeline ─────────────────────────────────────────────────────────

paRouter.get('/:id/timeline', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };

  const simulation = await prisma.pASimulation.findUnique({ where: { id } });
  if (!simulation) {
    res.status(404).json({ error: 'Simulation not found', code: 'NOT_FOUND' });
    return;
  }

  const storedTimeline = simulation.timeline as unknown as PATimelineEvent[];
  const { currentStatus, visibleTimeline } = computeCurrentStatus(storedTimeline);

  res.json({
    id: simulation.id,
    currentStatus,
    timeline: visibleTimeline,
    total: visibleTimeline.length,
  });
});
