# 4Reels Frontend — v1.0.0

Multi-tenant React + Vite SPA that drives the 4Reels admin/operator experience: agency onboarding, reel review, brand and music management, social-publishing controls, and the GoHighLevel-embedded customer view.

Talks to the backend at [`/opt/projects/4Reels-Backend`](../4Reels-Backend) through `src/lib/api/client.js`. Playwright drives every flow against a stubbed backend (`tests/support/mock-backend.js`) so no live server is required for CI.

> **Version 1.0.0** — first stable release. Version of record lives in [`package.json`](package.json). Bump it together with a `git tag vX.Y.Z` on every release.

## Stack

- **Vite 5** (React plugin, ES modules, no legacy bundle).
- **React 18** with `jsx-runtime` (no explicit React import).
- **ESLint 9** flat config. By policy: **no TypeScript, no Tailwind, no React Query, no MSW, no `styled-components`/`@emotion`** (see [`docs/architecture.md`](docs/architecture.md)).
- **Playwright** for E2E across `desktop` / `tablet` / `mobile` Chromium viewports.
- No state libraries beyond React's own (per [`AGENTS.md`](AGENTS.md)).

## Quick start

```bash
npm install
npm run dev               # http://localhost:5173 (auto-opens browser)
```

`vite.config.js` does **not** configure a backend proxy: requests go straight to `VITE_MVP_API_URL`. Point that env at the test backend (`https://4reelsback-test.4property.com`) or a local API server. Vite inlines env values at startup — restart `npm run dev` after editing `.env.local`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server on `:5173` with HMR. |
| `npm run build` | Production build into `dist/`. |
| `npm run preview` | Serve the built `dist/` on `:4173`. Used by Playwright by default. |
| `npm run lint` | ESLint over the repo. |
| `npm run test:e2e` | Full Playwright suite (builds + previews if `dist/` is stale). |
| `npm run test:smoke` | Subset covering critical flows. |
| `npm run test:visual` | Visual regression with committed snapshots. |
| `npm run test:visual:update` | Re-baseline visual snapshots. |
| `npm run test:report` | Open the last Playwright HTML report. |
| `npm run predeploy` | Lint + build + full E2E. Run manually before deploying — CI does **not** run this today. |

Set `PW_DEV=1` to point Playwright at `vite dev` instead of the preview build.

## Layout

```
src/
  app/             Top-level shell, routes, providers
  features/        One folder per product area (reels, brand, music, admin, session, templates, …)
  shared/          Re-usable UI primitives (Avatar, Button, etc.)
  lib/             api client, errors, utilities not tied to a feature
docs/
  architecture.md  How features/, shared/, lib/ are allowed to import each other
  conventions.md   Style and patterns
  verification.md  How to convince yourself a feature is done
  DEPLOYMENT.md    Build + ship workflow
tests/
  *.spec.js        Playwright specs grouped by feature
  support/         mock-backend, route catalog, fixtures
```

`src/lib/api/client.js` is the single I/O boundary to the backend — every page goes through it.

## Deploy

Three environments, all served by some form of Vite. **Full step-by-step in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).**

| Environment | Served by | Trigger | Backend it talks to |
|---|---|---|---|
| **Local dev** | `npm run dev` (Vite dev server on `:5173`) | Developer command | Whatever `VITE_MVP_API_URL` points at in `.env.local`. |
| **Local preview** | `npm run preview` (serves `dist/` on `:4173`) | Playwright `webServer` or manual | Same env baked into the build. |
| **Production** | nginx serving `dist/` from `/opt/4reels-frontend` (or similar) on the Rocky Linux host | `.github/workflows/deploy.yml` on push to `main` | Production backend host (e.g. `https://4reelsback.4property.com`). |

There is no Docker image for the frontend and no CDN in the loop — production `dist/` is built on the server.

### Production deploy in one shot

`.github/workflows/deploy.yml` SSHes to the host on every push to `main`:

```bash
cd $DEPLOY_PATH && git fetch --all && git reset --hard origin/main && npm ci && npm run build
```

Required GitHub secrets: `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER`, `SSH_PORT` (optional), `DEPLOY_PATH`.

What the workflow does **not** do (caveats to keep in mind):

- No lint/test gate — a compiling build that fails tests still ships.
- No `.env` injection — the host's existing `.env` is reused. Update it manually before bumping `VITE_*` defaults.
- No rollback — to revert, force-push the previous commit to `main` or rebuild a prior SHA on the host.

### Manual deploy from the host

```bash
ssh you@deploy-host
cd /opt/4reels-frontend
git fetch && git reset --hard origin/main
npm ci
npm run build
# nginx serves dist/ as the document root — no service restart needed
sudo systemctl reload nginx   # only if you changed the nginx config itself
```

## Environment

`.env.example` is the source of truth. Copy to `.env.local` for development and to whatever your deployment pipeline uses for production. **All `VITE_*` values are inlined into the JS bundle at build time — never put secrets here.** Bearer tokens come from the backend at runtime (`/v1/sessions/gohighlevel/session`) or from a super-admin paste behind `VITE_MVP_ADMIN_ENABLED`.

Required for any non-dev build:

| Variable | Purpose |
|---|---|
| `VITE_MVP_API_URL` | Canonical backend base URL. Every API call goes through this. |
| `VITE_GHL_MVP_ENABLED` | `true` to enable the GoHighLevel Marketplace iframe context resolution. |
| `VITE_MVP_ADMIN_ENABLED` | `false` in production (must be `true` only for the local super-admin path). |

Full per-environment matrix in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Backend pairing

- Repo: [`/opt/projects/4Reels-Backend`](../4Reels-Backend) (sister checkout on this dev box).
- Test/staging API: `:8001` on the same host (systemd `reels-test.service`).
- Production API: separate host, `:8000` behind nginx (systemd `reels.service` / `cpihed.service`).
- Backend's webhook ingestion model and the multi-WordPress feature (#38) are documented in [`../4Reels-Backend/docs/DEPLOYMENT.md`](../4Reels-Backend/docs/DEPLOYMENT.md).

## Further reading

- [`DOCS.md`](DOCS.md) — product overview (pages, end-to-end flow, tenant model).
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — high-level architecture decisions.
- [`AGENTS.md`](AGENTS.md), [`CLAUDE.md`](CLAUDE.md) — how Claude / Codex agents are expected to operate inside this repo.
- [`CHECKPOINTS.md`](CHECKPOINTS.md) — milestone log.

## License

Copyright (C) 2026 Roberto Gaviño Hurtado.

This project is licensed under the GNU General Public License, version 2 only
(GPL-2.0-only). See [`LICENSE`](LICENSE) for details.
