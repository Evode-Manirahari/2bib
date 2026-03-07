import { PrismaClient } from '@prisma/client';

// ── PrismaClient singleton ────────────────────────────────────────────────────
// Prevents multiple instances during hot-reload in development.

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [{ level: 'query', emit: 'event' }, 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export default prisma;

// ── Re-export everything from Prisma client ───────────────────────────────────
export { Prisma } from '@prisma/client';

export type {
  User,
  Project,
  ApiKey,
  RequestLog,
  ValidationLog,
  PASimulation,
  WorkflowRun,
  SandboxPatient,
} from '@prisma/client';

export { Plan, Tier, PAStatus, RunStatus } from '@prisma/client';
