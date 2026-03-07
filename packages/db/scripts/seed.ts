import { PrismaClient, Tier } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateRawKey(prefix: string): string {
  const random = crypto.randomBytes(20).toString('hex');
  return `${prefix}${random}`;
}

async function main() {
  console.log('🌱 Seeding database...');

  // Clean up existing seed data
  await prisma.apiKey.deleteMany({ where: { user: { email: 'test@pe.dev' } } });
  await prisma.project.deleteMany({ where: { user: { email: 'test@pe.dev' } } });
  await prisma.user.deleteMany({ where: { email: 'test@pe.dev' } });

  // Create test user
  const user = await prisma.user.create({
    data: {
      email: 'test@pe.dev',
      name: 'Test User',
      plan: 'FREE',
    },
  });
  console.log(`✅ Created user: ${user.email} (${user.id})`);

  // Create project
  const project = await prisma.project.create({
    data: {
      name: 'My First Project',
      userId: user.id,
      fhirVersion: 'R4',
    },
  });
  console.log(`✅ Created project: ${project.name} (${project.id})`);

  // Helper to create an API key
  async function createApiKey(tier: Tier, prefix: string, rateLimit: number) {
    const rawKey = generateRawKey(prefix);
    const displayPrefix = rawKey.slice(0, prefix.length + 6); // e.g. "pe_test_abc123"
    const hashed = await bcrypt.hash(rawKey, 10);

    const apiKey = await prisma.apiKey.create({
      data: {
        key: hashed,
        prefix: displayPrefix,
        tier,
        rateLimit,
        userId: user.id,
        projectId: project.id,
      },
    });
    return { apiKey, rawKey };
  }

  // FREE key
  const { apiKey: freeKey, rawKey: freeRaw } = await createApiKey(Tier.FREE, 'pe_test_', 1000);
  console.log(`✅ Created FREE API key:     ${freeRaw}`);
  console.log(`   Prefix: ${freeKey.prefix} | Rate limit: ${freeKey.rateLimit} req/day`);

  // STARTER key
  const { apiKey: starterKey, rawKey: starterRaw } = await createApiKey(Tier.STARTER, 'pe_live_', 10000);
  console.log(`✅ Created STARTER API key:  ${starterRaw}`);
  console.log(`   Prefix: ${starterKey.prefix} | Rate limit: ${starterKey.rateLimit} req/day`);

  console.log('\n🎉 Seed complete!');
  console.log('\n📋 Summary:');
  console.log(`   User:    test@pe.dev`);
  console.log(`   Project: My First Project`);
  console.log(`   FREE key (save this — not stored in plaintext):`);
  console.log(`     ${freeRaw}`);
  console.log(`   STARTER key (save this — not stored in plaintext):`);
  console.log(`     ${starterRaw}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
