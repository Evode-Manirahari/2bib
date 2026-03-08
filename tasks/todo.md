# API Key Signup Flow

## API Gateway
- [ ] Create apps/api/src/routes/register.ts
- [ ] Mount /v1/register in apps/api/src/app.ts (public, before auth)
- [ ] Fix apps/api/src/routes/me.ts — return full key data from DB

## Dashboard
- [ ] Create apps/dashboard/src/app/api/register/route.ts
- [ ] Create apps/dashboard/src/app/get-started/page.tsx
- [ ] Update Nav.tsx — Get API Key → /get-started
- [ ] Update Hero.tsx — Get API Key → /get-started
- [ ] Update Pricing.tsx — all CTAs → /get-started

## Verification
- [ ] pnpm --filter @pe/api exec tsc --noEmit → 0 errors
- [ ] pnpm --filter @pe/dashboard exec tsc --noEmit → 0 errors
