FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Install all dependencies ───────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY packages/types/package.json      ./packages/types/
COPY packages/fhir-utils/package.json ./packages/fhir-utils/
COPY apps/validator/package.json      ./apps/validator/
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY packages/types/      ./packages/types/
COPY packages/fhir-utils/ ./packages/fhir-utils/
COPY apps/validator/      ./apps/validator/
RUN pnpm --filter @pe/types build \
 && pnpm --filter @pe/fhir-utils build \
 && pnpm --filter @pe/validator build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN addgroup -g 1001 -S nodejs \
 && adduser -S nodejs -u 1001 \
 && apk add --no-cache wget
WORKDIR /app

COPY --from=builder --chown=nodejs:nodejs /app/node_modules        ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json        ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

COPY --from=builder --chown=nodejs:nodejs /app/packages/types/package.json      ./packages/types/
COPY --from=builder --chown=nodejs:nodejs /app/packages/types/dist              ./packages/types/dist/
COPY --from=builder --chown=nodejs:nodejs /app/packages/fhir-utils/package.json ./packages/fhir-utils/
COPY --from=builder --chown=nodejs:nodejs /app/packages/fhir-utils/dist         ./packages/fhir-utils/dist/

COPY --from=builder --chown=nodejs:nodejs /app/apps/validator/package.json ./apps/validator/
COPY --from=builder --chown=nodejs:nodejs /app/apps/validator/dist         ./apps/validator/dist/

# HL7 validator cache directory
RUN mkdir -p /app/apps/validator/cache && chown nodejs:nodejs /app/apps/validator/cache

USER nodejs
EXPOSE 3010
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3010/health || exit 1
WORKDIR /app/apps/validator
CMD ["node", "dist/index.js"]
