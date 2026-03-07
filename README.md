# Pe — The Developer Infrastructure Layer for Healthcare APIs

**Stripe meets Postman — for FHIR APIs**

Pe is a managed API platform that abstracts away the complexity of FHIR integration. One API key, unified auth, normalized responses, a prior auth simulator, and an AI layer that speaks FHIR.

---

## Quick start

```bash
# 1. Clone & install
git clone https://github.com/evode/pe && cd pe
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Start infrastructure + all services
docker compose up

# Services:
#   Dashboard  → http://localhost:3000
#   API        → http://localhost:3001
#   Proxy      → http://localhost:3002
#   PA Sim     → http://localhost:3003
#   Validator  → http://localhost:3010
#   HAPI FHIR  → http://localhost:8080
#   PostgreSQL → localhost:5432
#   Redis      → localhost:6379
```

## Local development (without Docker for apps)

```bash
# Start infrastructure only
docker compose up postgres redis hapi -d

# Install deps & generate Prisma client
pnpm install
pnpm db:generate

# Run migrations
pnpm db:migrate

# Start all apps in parallel (Turborepo)
pnpm dev
```

## Monorepo structure

```
pe/
├── apps/
│   ├── api/             # API Gateway — auth, rate-limit, routing, metering
│   ├── proxy/           # FHIR Proxy — payer registry, token cache, normalization
│   ├── validator/       # Validation Service — HL7 Validator wrapper + AI enricher
│   ├── pa-simulator/    # PA Simulator — state machine + payer profiles
│   └── dashboard/       # Next.js 14 Developer Dashboard
├── packages/
│   ├── db/              # Prisma schema + PrismaClient singleton
│   ├── types/           # Shared TypeScript types
│   ├── fhir-utils/      # FHIR normalization helpers
│   └── payer-profiles/  # Payer behavior profile configs
├── data/
│   ├── synthea/         # Pre-generated synthetic patient FHIR bundles
│   └── workflows/       # Pre-built PA workflow YAML templates
├── infra/
│   ├── docker/          # Production Dockerfiles
│   ├── k8s/             # Kubernetes manifests
│   └── terraform/       # AWS infra
├── scripts/             # Data generation & seeding scripts
├── docker-compose.yml
├── turbo.json
└── package.json
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all services (Turborepo parallel) |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | Lint all workspaces |
| `pnpm typecheck` | TypeScript check all workspaces |
| `pnpm test` | Run all tests |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run DB migrations |
| `pnpm db:seed` | Seed database with test data |

## Tech stack

| Layer | Technology |
|---|---|
| API Gateway | Express + TypeScript |
| Auth (dashboard) | Clerk |
| Database | PostgreSQL + Prisma |
| Cache / Rate Limit | Redis (Upstash) |
| FHIR Server | HAPI FHIR R4 (Docker) |
| FHIR Validator | HL7 Validator CLI (Java) |
| AI Layer | Claude API (claude-sonnet-4-5) |
| Frontend | Next.js 14 App Router |
| UI Components | shadcn/ui + Tailwind CSS |
| Monorepo | Turborepo + pnpm |
| Billing | Stripe Metered Subscriptions |

## API endpoints

All endpoints require `Authorization: Bearer <api_key>` except `/health`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/v1/me` | API key info |
| GET | `/v1/fhir/:resourceType` | Search FHIR resources |
| GET | `/v1/fhir/:resourceType/:id` | Read FHIR resource |
| POST | `/v1/validate` | Validate FHIR resource |
| POST | `/v1/validate/fix` | AI auto-fix |
| POST | `/v1/query` | Natural language → FHIR |
| POST | `/v1/pa/submit` | Submit PA to simulator |
| GET | `/v1/pa/:id` | PA status + timeline |
| POST | `/v1/workflows/run` | Execute workflow |

## Build phases

| Phase | Weeks | Deliverable |
|---|---|---|
| 1 | 1–3 | Core: FHIR Sandbox, Validator, Synthetic Data |
| 2 | 4–6 | PA Simulator + Workflow Test Runner |
| 3 | 7–8 | Full Developer Dashboard |
| 4 | 9–10 | CLI, TypeScript SDK, Python SDK |
| 5 | 11–12 | Production Deploy + Billing + First 10 Users |

---

**Pe** — Build healthcare apps without the FHIR headache.
