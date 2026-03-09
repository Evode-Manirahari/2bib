FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Install all dependencies ───────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY packages/types/package.json          ./packages/types/
COPY packages/fhir-utils/package.json     ./packages/fhir-utils/
COPY packages/payer-profiles/package.json ./packages/payer-profiles/
COPY packages/db/package.json             ./packages/db/
COPY packages/db/prisma/                  ./packages/db/prisma/
COPY apps/pa-simulator/package.json       ./apps/pa-simulator/
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter @pe/db db:generate

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY packages/types/          ./packages/types/
COPY packages/fhir-utils/     ./packages/fhir-utils/
COPY packages/payer-profiles/ ./packages/payer-profiles/
COPY packages/db/             ./packages/db/
COPY apps/pa-simulator/       ./apps/pa-simulator/
RUN pnpm --filter @pe/types build \
 && pnpm --filter @pe/fhir-utils build \
 && pnpm --filter @pe/payer-profiles build \
 && pnpm --filter @pe/db build \
 && pnpm --filter @pe/pa-simulator build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN addgroup -g 1001 -S nodejs \
 && adduser -S nodejs -u 1001 \
 && apk add --no-cache wget
WORKDIR /app

COPY --from=builder --chown=nodejs:nodejs /app/node_modules        ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json        ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

COPY --from=builder --chown=nodejs:nodejs /app/packages/types/package.json          ./packages/types/
COPY --from=builder --chown=nodejs:nodejs /app/packages/types/dist                  ./packages/types/dist/
COPY --from=builder --chown=nodejs:nodejs /app/packages/fhir-utils/package.json     ./packages/fhir-utils/
COPY --from=builder --chown=nodejs:nodejs /app/packages/fhir-utils/dist             ./packages/fhir-utils/dist/
COPY --from=builder --chown=nodejs:nodejs /app/packages/payer-profiles/package.json ./packages/payer-profiles/
COPY --from=builder --chown=nodejs:nodejs /app/packages/payer-profiles/dist         ./packages/payer-profiles/dist/
COPY --from=builder --chown=nodejs:nodejs /app/packages/db/package.json             ./packages/db/
COPY --from=builder --chown=nodejs:nodejs /app/packages/db/dist                     ./packages/db/dist/
COPY --from=builder --chown=nodejs:nodejs /app/packages/db/prisma                   ./packages/db/prisma/

COPY --from=builder --chown=nodejs:nodejs /app/apps/pa-simulator/package.json ./apps/pa-simulator/
COPY --from=builder --chown=nodejs:nodejs /app/apps/pa-simulator/dist         ./apps/pa-simulator/dist/

USER nodejs
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3003/health || exit 1
WORKDIR /app/apps/pa-simulator
CMD ["node", "dist/index.js"]
