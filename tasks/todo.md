# Pe — Task Board

## DONE
- [x] Railway deployment config (railway.*.toml)
- [x] Dashboard standalone Next.js build
- [x] Real API key signup flow (POST /v1/register)
- [x] Redesign landing page (IBM Plex Mono, cyan design system)
- [x] Docs page (full interactive API reference)
- [x] Status page (real health checks)
- [x] Billing dashboard UI
- [x] API key management + rotate endpoint
- [x] Settings page
- [x] 404 + error boundary
- [x] Welcome email (Resend)
- [x] PostHog analytics wired
- [x] Key recovery flow (POST /v1/register/reset)
- [x] Copy-as-cURL in request logs

---

## TODO — Pre-Public-Launch

### P1 — IP rate limit on /v1/register
- **What:** Add `express-rate-limit` to `POST /v1/register` and `POST /v1/register/reset`
- **Why:** Single IP can create unlimited free API keys. Spam/abuse vector before posting in developer communities.
- **How:** `apps/api/src/app.ts` — add rate limiter middleware scoped to `/v1/register` only. Max 5 requests per IP per hour.
- **File:** `apps/api/src/app.ts`, install `express-rate-limit`
- **Effort:** S

---

## TODO — When Docs Outgrow TSX (20+ endpoints)

### P3 — Migrate docs to MDX
- **What:** Replace `apps/dashboard/src/app/docs/page.tsx` hardcoded content with Next.js MDX files
- **Why:** 300+ lines of hardcoded TSX becomes painful when updating code examples or adding new endpoints
- **How:** Next.js native MDX support. One file per section under `apps/dashboard/src/content/docs/`
- **Effort:** M
- **Trigger:** When endpoint count exceeds 20 or code examples need versioning

---

## TODO — When User Count Reaches 3+

### P2 — Discord community
- **What:** Create Pe Discord server. Invite first beta users to `#beta-feedback` private channel.
- **Why:** Creates a high-bandwidth feedback loop. Developers find bugs faster in chat than email.
- **How:** Create server → add invite link to `/get-started` success screen + welcome email
- **Effort:** S
- **Trigger:** 3rd user signs up

---

## DEPLOY CHECKLIST (run before going live)

- [ ] Set `RESEND_API_KEY` in Railway API service env vars
- [ ] Set `NEXT_PUBLIC_POSTHOG_KEY` in Railway dashboard env vars
- [ ] Set `STRIPE_PRICE_ID_STARTER` and `STRIPE_PRICE_ID_GROWTH` in Railway API env vars (or soft-disable billing for now)
- [ ] Run seed script: `DATABASE_URL=... HAPI_FHIR_URL=... npx tsx scripts/seed-fhir.ts`
- [ ] Smoke test: `curl https://YOUR_API_URL/health`
- [ ] Smoke test: `POST /v1/register` with your email
- [ ] Smoke test: `GET /v1/fhir/Patient?family=Wilson` → should return data
- [ ] Smoke test: welcome email lands in inbox
