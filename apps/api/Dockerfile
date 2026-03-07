FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Install all dependencies ───────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY packages/types/package.json         ./packages/types/
COPY packages/db/package.json            ./packages/db/
COPY apps/api/package.json               ./apps/api/
RUN pnpm install --frozen-lockfile --ignore-scripts
# Generate Prisma client after install
RUN pnpm --filter @pe/db db:generate

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY packages/types/    ./packages/types/
COPY packages/db/       ./packages/db/
COPY apps/api/          ./apps/api/
COPY data/              ./data/
RUN pnpm --filter @pe/types build \
 && pnpm --filter @pe/db build \
 && pnpm --filter @pe/api build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN addgroup -g 1001 -S nodejs \
 && adduser -S nodejs -u 1001 \
 && apk add --no-cache wget
WORKDIR /app

# Monorepo root
COPY --from=builder --chown=nodejs:nodejs /app/node_modules        ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json        ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Workspace packages (node_modules symlinks point into these dirs)
COPY --from=builder --chown=nodejs:nodejs /app/packages/types/package.json ./packages/types/
COPY --from=builder --chown=nodejs:nodejs /app/packages/types/dist         ./packages/types/dist/
COPY --from=builder --chown=nodejs:nodejs /app/packages/db/package.json    ./packages/db/
COPY --from=builder --chown=nodejs:nodejs /app/packages/db/dist            ./packages/db/dist/
COPY --from=builder --chown=nodejs:nodejs /app/packages/db/prisma          ./packages/db/prisma/

# App
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/dist         ./apps/api/dist/

# Workflow templates
COPY --from=builder --chown=nodejs:nodejs /app/data ./data/

USER nodejs
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1
WORKDIR /app/apps/api
CMD ["node", "dist/index.js"]
