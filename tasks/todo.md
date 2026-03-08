# Backend Services + Navigation Wiring

## Backend fixes
- [x] Fix @pe/pa-simulator src/app.ts:9 — Express type annotation → tsc OK
- [x] Verified @pe/cli (package name: pe-cli) → tsc OK

## Frontend navigation
- [x] Nav: Get API Key → /dashboard, Docs → /docs
- [x] Hero: Get API Key → /dashboard
- [x] Pricing: all 4 CTAs → /dashboard
- [x] Footer: Docs → /docs, GitHub → github.com/Evode-Manirahari/2bib, Status → /status, Privacy → /privacy
- [x] PAAgent: "Try it →" button → /dashboard/pa

## New pages
- [x] /status — all systems operational page
- [x] /privacy — privacy policy page

## Verification
- [x] pa-simulator tsc --noEmit → 0 errors
- [x] dashboard tsc --noEmit → 0 errors
- [x] cli tsc --noEmit → 0 errors
- [x] dashboard already running on :3000
