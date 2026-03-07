FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Install all dependencies ───────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY packages/types/package.json      ./packages/types/
COPY packages/fhir-utils/package.json ./packages/fhir-utils/
COPY apps/proxy/package.json          ./apps/proxy/
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY packages/types/      ./packages/types/
COPY packages/fhir-utils/ ./packages/fhir-utils/
COPY apps/proxy/          ./apps/proxy/
RUN pnpm --filter @pe/types build \
 && pnpm --filter @pe/fhir-utils build \
 && pnpm --filter @pe/proxy build

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

COPY --from=builder --chown=nodejs:nodejs /app/apps/proxy/package.json ./apps/proxy/
COPY --from=builder --chown=nodejs:nodejs /app/apps/proxy/dist         ./apps/proxy/dist/

USER nodejs
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3002/health || exit 1
WORKDIR /app/apps/proxy
CMD ["node", "dist/index.js"]
