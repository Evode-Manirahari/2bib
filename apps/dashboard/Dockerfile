FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Install all dependencies ───────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY packages/types/package.json    ./packages/types/
COPY apps/dashboard/package.json    ./apps/dashboard/
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY packages/types/    ./packages/types/
COPY apps/dashboard/    ./apps/dashboard/
RUN pnpm --filter @pe/types build \
 && pnpm --filter @pe/dashboard build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN addgroup -g 1001 -S nodejs \
 && adduser -S nodejs -u 1001 \
 && apk add --no-cache wget
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js standalone output bundles everything needed (node_modules + server.js)
COPY --from=builder --chown=nodejs:nodejs /app/apps/dashboard/.next/standalone .
# Static assets must be copied separately (not included in standalone)
COPY --from=builder --chown=nodejs:nodejs /app/apps/dashboard/.next/static ./apps/dashboard/.next/static

USER nodejs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=15s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000 || exit 1
WORKDIR /app/apps/dashboard
CMD ["node", "server.js"]
