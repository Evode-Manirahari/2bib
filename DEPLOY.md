# Deploying Pe on Railway

## Overview

Pe deploys as 6 Railway services:
- **Postgres** — managed plugin
- **Redis** — managed plugin
- **API** — Express gateway (port 3001)
- **PA Simulator** — Express service (port 3003)
- **Validator** — Express service (port 3010)
- **Dashboard** — Next.js frontend (port 3000)

All Docker builds use the **monorepo root** as build context.

---

## Step 1 — Create Railway project

1. Go to [railway.app](https://railway.app) → New Project
2. Choose **Empty Project**
3. Name it `pe`

---

## Step 2 — Add managed plugins

In your Railway project, click **+ New** → **Database**:

1. Add **PostgreSQL** → Railway injects `DATABASE_URL` automatically
2. Add **Redis** → Railway injects `REDIS_URL` automatically

---

## Step 3 — Deploy the API service

1. Click **+ New** → **GitHub Repo** → select `Evode-Manirahari/2bib`
2. Service name: `api`
3. In service settings:
   - **Root Directory**: `/` (leave empty — repo root)
   - **Config File Path**: `railway.api.toml`
4. Add environment variables (Variables tab):
   ```
   NODE_ENV=production
   ANTHROPIC_API_KEY=sk-ant-YOUR_KEY
   VALIDATOR_SERVICE_URL=http://validator.railway.internal:3010
   PA_SIMULATOR_SERVICE_URL=http://pa-simulator.railway.internal:3003
   CORS_ORIGINS=https://YOUR_DASHBOARD_URL.up.railway.app
   ```
   > DATABASE_URL and REDIS_URL are auto-injected from plugins — no need to add them manually if the services are in the same Railway project.
5. Click **Deploy**

Once deployed, copy the public API URL (e.g., `https://api-abc123.up.railway.app`).

---

## Step 4 — Deploy the PA Simulator

1. Click **+ New** → **GitHub Repo** → same repo
2. Service name: `pa-simulator`
3. Settings:
   - **Root Directory**: `/`
   - **Config File Path**: `railway.pa-simulator.toml`
4. Variables:
   ```
   NODE_ENV=production
   ```
   > DATABASE_URL and REDIS_URL auto-injected.
5. Deploy

---

## Step 5 — Deploy the Validator

1. Click **+ New** → **GitHub Repo** → same repo
2. Service name: `validator`
3. Settings:
   - **Root Directory**: `/`
   - **Config File Path**: `railway.validator.toml`
4. Variables:
   ```
   NODE_ENV=production
   ANTHROPIC_API_KEY=sk-ant-YOUR_KEY
   ```
5. Deploy

---

## Step 6 — Deploy the Dashboard

1. Click **+ New** → **GitHub Repo** → same repo
2. Service name: `dashboard`
3. Settings:
   - **Root Directory**: `/`
   - **Config File Path**: `railway.dashboard.toml`
4. Variables:
   ```
   NODE_ENV=production
   NEXT_PUBLIC_API_URL=https://YOUR_API_URL.up.railway.app
   ```
   > Replace with the actual API URL from Step 3.
5. Deploy

---

## Step 7 — Update CORS on the API

After the dashboard deploys and you have its URL, go back to the **api** service Variables and update:
```
CORS_ORIGINS=https://YOUR_DASHBOARD_URL.up.railway.app
```

---

## Step 8 — Verify

```bash
# API health
curl https://YOUR_API_URL.up.railway.app/health

# Register a test API key
curl -X POST https://YOUR_API_URL.up.railway.app/v1/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'
```

Visit `https://YOUR_DASHBOARD_URL.up.railway.app` → you should see the landing page.
Visit `/get-started` → enter your email → get a live API key.

---

## Environment variables reference

See `.env.railway` at repo root for a full template.

---

## Deployment order

```
Postgres + Redis → API (runs prisma db push on release) → PA Simulator → Validator → Dashboard
```

The API's `releaseCommand` in `railway.api.toml` runs `prisma db push` automatically before the server starts — no manual migration step needed.

---

## Custom domain (optional)

In Railway, go to each service → Settings → Domains → Add custom domain.
Recommended:
- `api.pe.dev` → API service
- `app.pe.dev` → Dashboard service
