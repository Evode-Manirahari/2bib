import { Router, type Request, type Response, type IRouter } from 'express';
import { z } from 'zod';
import { validateStructural, validateWithHl7, enrichErrors, autoFix } from '../services';

export const validateRouter: IRouter = Router();

// ── Profiles ──────────────────────────────────────────────────────────────────

const SUPPORTED_PROFILES = [
  {
    id: 'structural',
    name: 'FHIR R4 Structural',
    description: 'Built-in FHIR R4 structural validation. No Java required.',
    requiresJava: false,
  },
  {
    id: 'hl7-fhir-r4',
    name: 'HL7 FHIR R4',
    description: 'Full HL7 FHIR R4 conformance via the official HL7 Validator CLI.',
    requiresJava: true,
  },
  {
    id: 'us-core-3.1.1',
    name: 'US Core 3.1.1',
    description: 'US Core Implementation Guide v3.1.1 (requires HL7 Validator).',
    requiresJava: true,
    url: 'http://hl7.org/fhir/us/core/StructureDefinition/',
  },
  {
    id: 'us-core-6.1.0',
    name: 'US Core 6.1.0',
    description: 'US Core Implementation Guide v6.1.0 (requires HL7 Validator).',
    requiresJava: true,
    url: 'http://hl7.org/fhir/us/core/StructureDefinition/',
  },
  {
    id: 'davinci-pas',
    name: 'Da Vinci PAS',
    description: 'Da Vinci Prior Authorization Support IG (requires HL7 Validator).',
    requiresJava: true,
    url: 'http://hl7.org/fhir/us/davinci-pas/StructureDefinition/',
  },
  {
    id: 'davinci-crd',
    name: 'Da Vinci CRD',
    description: 'Da Vinci Coverage Requirements Discovery IG (requires HL7 Validator).',
    requiresJava: true,
    url: 'http://hl7.org/fhir/us/davinci-crd/StructureDefinition/',
  },
];

// ── Zod Schemas ───────────────────────────────────────────────────────────────

const ValidateBodySchema = z.object({
  resource: z.record(z.unknown()),
  profile: z.string().optional(),
  enrich: z.boolean().optional().default(false),
  mode: z.enum(['structural', 'hl7', 'auto']).optional().default('auto'),
});

const FixBodySchema = z.object({
  resource: z.record(z.unknown()),
  errors: z.array(z.object({
    severity: z.enum(['fatal', 'error', 'warning', 'information']),
    category: z.string(),
    path: z.string(),
    message: z.string(),
    suggestion: z.string().optional(),
    igLink: z.string().optional(),
  })).optional(),
});

// ── GET /validate/profiles ────────────────────────────────────────────────────

validateRouter.get('/profiles', (_req: Request, res: Response) => {
  res.json({ profiles: SUPPORTED_PROFILES });
});

// ── POST /validate ─────────────────────────────────────────────────────────────

validateRouter.post('/', async (req: Request, res: Response) => {
  const parse = ValidateBodySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: 'Invalid request body',
      code: 'VALIDATION_ERROR',
      details: parse.error.flatten(),
    });
    return;
  }

  const { resource, profile, enrich, mode } = parse.data;

  try {
    let result: Awaited<ReturnType<typeof validateWithHl7>>;

    if (mode === 'structural') {
      result = { ...validateStructural(resource, profile), engine: 'structural' as const };
    } else if (mode === 'hl7') {
      result = await validateWithHl7(resource, profile);
    } else {
      // auto: use hl7 if possible, fall back to structural
      result = await validateWithHl7(resource, profile);
    }

    let { errors } = result;

    if (enrich && errors.length > 0) {
      errors = await enrichErrors(resource, errors);
    }

    res.json({
      isValid: result.isValid,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      errors,
      profile: result.profile,
      engine: result.engine,
      durationMs: result.durationMs,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Validation failed',
      code: 'INTERNAL_ERROR',
      details: (err as Error).message,
    });
  }
});

// ── POST /validate/fix ────────────────────────────────────────────────────────

validateRouter.post('/fix', async (req: Request, res: Response) => {
  const parse = FixBodySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: 'Invalid request body',
      code: 'VALIDATION_ERROR',
      details: parse.error.flatten(),
    });
    return;
  }

  const { resource, errors: providedErrors } = parse.data;

  try {
    // If no errors provided, validate first to get them
    let errors = providedErrors;
    if (!errors || errors.length === 0) {
      const result = await validateWithHl7(resource);
      errors = result.errors;

      // If already valid, return as-is
      if (result.isValid) {
        res.json({
          explanation: 'Resource is already valid — no changes needed.',
          correctedResource: resource,
          changesApplied: [],
        });
        return;
      }
    }

    const fixResult = await autoFix(resource, errors as import('@pe/types').EnrichedError[]);
    res.json(fixResult);
  } catch (err) {
    res.status(500).json({
      error: 'Auto-fix failed',
      code: 'INTERNAL_ERROR',
      details: (err as Error).message,
    });
  }
});
