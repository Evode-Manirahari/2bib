import { prisma } from '@pe/db';
import bcrypt from 'bcryptjs';

/** Display prefix length stored in DB: "pe_test_" (8 chars) + 6 hex = 14 */
const PREFIX_LEN = 14;

export type VerifiedApiKey = {
  id: string;
  key: string;
  prefix: string;
  tier: string;
  rateLimit: number;
  callCount: number;
  userId: string;
  projectId: string;
  revokedAt: Date | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    plan: string;
  };
};

export async function lookupAndVerifyKey(rawKey: string): Promise<VerifiedApiKey | null> {
  const prefix = rawKey.slice(0, PREFIX_LEN);

  const candidates = await prisma.apiKey.findMany({
    where: { prefix, revokedAt: null },
    include: {
      user: { select: { id: true, email: true, name: true, plan: true } },
    },
  });

  for (const candidate of candidates) {
    if (await bcrypt.compare(rawKey, candidate.key)) {
      return candidate as VerifiedApiKey;
    }
  }
  return null;
}

export async function incrementCallCount(apiKeyId: string): Promise<void> {
  await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: {
      callCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });
}
