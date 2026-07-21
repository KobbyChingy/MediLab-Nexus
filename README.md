# MediLab Nexus

MediLab Nexus is a web-based Medical Laboratory and Imaging Information System for diagnostic centers running laboratory and sonography workflows through a connected API, with outbound integration dispatch for notifications and external systems.

## Architecture

- `apps/api`: Fastify API for patients, orders, imaging, reporting, billing, inventory, QC, and integration dispatch metadata.
- `apps/web`: React + Vite operations console for secure browser-based access.
- `packages/shared`: shared types, validation schemas, seeded catalog, and dashboard contracts.
- `packages/db`: Prisma schema and seed script for local SQLite development and hosted PostgreSQL deployment.

## Connected deployment model

- Browser clients talk directly to the MediLab Nexus API over HTTP.
- Local SQLite remains available for fast workstation development.
- A hosted PostgreSQL deployment path is included for shared multi-user environments.
- Outbound `SyncEvent` records act as an integration dispatch journal for external systems and retryable delivery.
- Patient Trace Codes remain initials plus a sequence, with facility-bound sequence management.

## Core workflows included

- Patient registration with auto-generated Patient Trace Code.
- Test and imaging catalog with pricing and turnaround targets.
- Order entry for lab and ultrasound studies.
- Sample tracking and imaging appointment creation.
- Report authoring and approval metadata.
- Printable HTML report layouts and generated PDF artifacts for web-based release.
- Billing objects, payment capture, inventory monitoring, QC events, and dashboard summaries.
- Westgard-rule QC evaluation and Levey-Jennings trending.
- Instrument and ultrasound maintenance scheduling.
- Role-aware admin overview, user administration, audit trail, notification queueing, integration dispatch controls, and encrypted backup snapshots.

## Run locally

```bash
npm install
copy .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

If the local development schema changes in a way that requires rebuilding the SQLite file, use:

```bash
npm run db:reset
```

On Windows, the Prisma commands now run through a retrying wrapper that handles the common `query_engine-windows.dll.node` and `query-engine-windows.exe` rename locks more gracefully. If it still fails after retries, stop any running API, worker, or editor tasks holding Prisma and rerun the command.

The API runs on `http://localhost:4000` and the web client on `http://localhost:5173`.

The web app reads `VITE_API_BASE`, and local Vite proxying reads `VITE_DEV_API_PROXY_TARGET`.

## Standalone desktop app

MediLab Nexus includes a Windows desktop shell that can run in two modes:

- Hosted client mode: the installed app opens the central hosted MediLab Nexus deployment so every workstation sees the same live data and web updates immediately.
- Local runtime mode: if no hosted URL is configured, the installer falls back to the bundled API, worker, and web UI for standalone local operation.

Build the desktop runtime and installer with:

```bash
npm run desktop:build
npm run desktop:dist
```

The installer is generated at `dist-desktop/MediLab Nexus Setup 0.1.0.exe`.

Desktop runtime notes:

- To package the installer against a hosted deployment, set `hostedUrl` in `apps/desktop/desktop.config.json` before running `npm run desktop:dist`, or set `MEDILAB_DESKTOP_HOSTED_URL` when launching the desktop app.
- In hosted client mode, the installed app loads the configured hosted URL directly and does not start the bundled local API, worker, or SQLite runtime.
- In local runtime mode, the installed app serves the bundled web client from the local API on a loopback port.
- SQLite data, generated PDFs, and encrypted backups are written under the signed-in user's application data directory only when running in local runtime mode.
- On first launch in local runtime mode the desktop app runs `prisma db push` against its local SQLite file before opening the window.
- The unpacked desktop build is also available at `dist-desktop/win-unpacked/`.

## Deploy online

For a shared web deployment, start from `.env.production.example` and point `DATABASE_URL` at a managed PostgreSQL instance.

```bash
copy .env.production.example .env
npm run db:generate:hosted
npm run db:push:hosted
npm run build
```

Recommended production settings:

- `DATABASE_URL`: managed PostgreSQL connection string.
- `VITE_API_BASE`: browser-facing API path, typically `/api` when the web app and API share one origin through a reverse proxy.
- `MEDILAB_INTEGRATION_ENDPOINT`: outbound integration receiver for HL7 or external workflow dispatch.
- `MEDILAB_NOTIFICATION_WEBHOOK_URL`: notification gateway endpoint.
- `MEDILAB_ALLOWED_ORIGINS`: comma-separated browser origins allowed to call the API.
- `MEDILAB_TRUST_PROXY`: set to `true` when the API runs behind a reverse proxy or load balancer.
- `MEDILAB_SESSION_COOKIE_NAME`: cookie name used for browser session transport.
- `MEDILAB_SESSION_COOKIE_DOMAIN`: optional cookie domain for shared subdomain deployments.
- `MEDILAB_SESSION_COOKIE_SECURE`: set to `true` behind HTTPS.
- `MEDILAB_SESSION_COOKIE_SAMESITE`: cookie same-site mode, typically `Lax`.
- `MEDILAB_DISPATCH_WORKER_ENABLED`: enables the background dispatch loop for the current process.
- `MEDILAB_DISPATCH_INTERVAL_MS`: background integration worker interval in milliseconds.
- `MEDILAB_DISPATCH_BATCH_SIZE`: maximum number of outbound records processed per worker cycle.
- `MEDILAB_ENCRYPTION_KEY`: strong secret for backup and protected operations.

## Operational modules

- Quality control: daily QC capture, Westgard rule detection, Levey-Jennings visualization, and traceable QC review state.
- Inventory and reagents: stock movement recording, expiry watchlist, low-stock alerts, and reorder suggestions.
- Billing and finance: invoice generation from orders plus capture of cash, MTN mobile money, Vodafone cash, card, and NHIS payments.
- Notifications: queued SMS, email, and WhatsApp updates dispatched through configured gateways.
- Security and compliance: PIN-backed login sessions, role-aware API actions, full audit logs, encrypted backup files, and operational alignment with Ghana Data Protection Act and ISO 15189-oriented workflows.
- Credential administration: user creation, PIN rotation, failed-login tracking, temporary lockout, account activation control, and lock reset actions.
- Maintenance and integrations: analyzer and ultrasound calibration scheduling, with hooks for HL7, ASTM, DICOM, PACS, EHR, and accounting integrations.
- Printable diagnostics: report preview endpoints and PDF generation for browser printing, file sharing, and result handoff.

## Authentication

The web console signs in against application users stored in the database and issues session tokens for RBAC-controlled access.

For browser deployments, the API sets an HTTP-only session cookie and expects browser requests to use that cookie-backed session.

Seeded demo credentials for first-run development:

- `admin` / `2468`
- `qa.officer` / `1357`
- `finance.desk` / `2244`
- `frontdesk` / `1122`
- `sono.tech` / `7788`

These should be rotated before real deployment.

## Integration dispatch configuration

The integration dispatch runner can be triggered from the admin console.

- Without extra configuration it runs in standalone mode and preserves outbound records in `SyncEvent` for later delivery.
- Set `MEDILAB_INTEGRATION_ENDPOINT` to enable outbound event dispatch.
- Set `MEDILAB_NOTIFICATION_WEBHOOK_URL` to enable queued notification delivery.
- `MEDILAB_SYNC_REMOTE_URL` is still accepted as a legacy alias for existing environments.
- If those endpoints are not configured, the runner records attempts and retains outbound events for later retry.

## Deployment notes

- Local development defaults to SQLite through `packages/db/prisma/schema.prisma`.
- Hosted deployments should generate Prisma Client with `packages/db/prisma/schema.postgres.prisma` before build or release.
- Schema maintenance rule: when workflow fields change, update both `packages/db/prisma/schema.prisma` and `packages/db/prisma/schema.postgres.prisma` unless the change is intentionally environment-specific.
- `npm run db:generate` and `npm run db:push` target the local SQLite schema.
- `npm run db:generate:hosted` and `npm run db:push:hosted` target the hosted PostgreSQL schema.
- Keep the API behind HTTPS and expose it to browsers through the same public origin as the web app when possible.
- In production, configure `MEDILAB_ALLOWED_ORIGINS` explicitly; if it is left empty the API refuses browser cross-origin requests.
- Use `/health` for liveness checks and `/ready` for database-backed readiness checks.
- PM2 and the root `start:prod` script now run both the API server and the integration worker.
- Example deployment assets are available in `deploy/nginx.example.conf` and `deploy/ecosystem.config.cjs`.
- `deploy/start-production.ps1` and `deploy/start-production.sh` can prepare the hosted schema, build the workspace, and start the API plus worker either directly or through PM2.
- Local development now starts the API worker alongside the API and web client so queued integrations can be exercised while building features.

## Docker deployment

For a containerized hosted stack, use the included Compose example. It starts PostgreSQL, builds the API against the hosted Prisma schema, runs a dedicated background integration worker, and serves the web app behind nginx with `/api` proxied to the API container.

Start from `.env.docker.example` if you want a dedicated container-oriented env file for local hosted testing.

```bash
docker compose up --build
```

The Docker workflow listens on `http://localhost:8080`, keeps browser auth same-origin so the session cookie works without custom browser headers, exposes `/health` plus `/ready` through the web gateway, and processes outbound integration work in the separate `worker` service.

For non-Docker rollout, you can also run:

```bash
npm run prepare:prod
npm run start:prod
```

Or use the deploy scripts:

```powershell
./deploy/start-production.ps1
./deploy/start-production.ps1 -UsePm2
```

## Free public demo

For a zero-cost public test deployment, the simplest path is:

- Neon Free for PostgreSQL, because the Free plan is permanent and scales to zero.
- Render Free Web Service for the app, with the API serving the built web UI from the same origin.

This repo now includes a root `render.yaml` for that setup.

Why this path:

- One public URL keeps cookie-backed login simple.
- No separate static host or reverse proxy is required.
- The background integration worker can stay off for a public demo.

### What to expect on free hosting

- Render free web services can sleep when idle, so the first request after inactivity may be slow.
- Demo PDF files, backups, and other filesystem artifacts live on ephemeral service storage and can be cleared on redeploy or restart.
- This is appropriate for product testing, not for live clinical use.

### Deploy on Render with Neon

1. Create a free Neon project and copy its direct PostgreSQL connection string.
2. Push this repository to GitHub.
3. In Render, create a new Blueprint from the repo so it picks up `render.yaml`.
4. When prompted for `DATABASE_URL`, paste the Neon connection string.
5. Let Render complete the first deploy. The pre-deploy command will push the hosted schema and run the seed script.
6. Open the generated `onrender.com` URL and sign in with the demo users.

Use the direct Neon connection string for Prisma migrations and schema push. For this stack, do not start with a pooled connection string.

### Demo environment values already covered by `render.yaml`

- `VITE_API_BASE=/api`
- `MEDILAB_WEB_DIST=apps/web/dist`
- `MEDILAB_TRUST_PROXY=true`
- `MEDILAB_SESSION_COOKIE_SECURE=true`
- `MEDILAB_SESSION_COOKIE_SAMESITE=Lax`
- `MEDILAB_DISPATCH_WORKER_ENABLED=false`

### Optional alternative

If you only need a short-lived throwaway demo, Render also advertises a free Postgres option. Based on its pricing page, that database tier has a 30-day limit, so Neon Free is the safer default for ongoing external testing.
