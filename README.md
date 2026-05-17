# 4Reels — Frontend

Multi-tenant React + Vite SPA that drives the 4Reels admin/operator experience: agency onboarding, reel review, brand and music management, social-publishing controls, and the GoHighLevel-embedded customer view.

Talks to the backend at `/opt/projects/4Reels-Backend` through `src/lib/api/client.js`. Playwright drives every flow against a stubbed backend (`tests/support/mock-backend.js`) so no live server is required for CI.

## Stack

- **Vite 5** (React plugin, ES modules, no legacy bundle)
- **React 18** with `jsx-runtime` (no explicit React import)
- **ESLint 9** flat config (no TypeScript by policy, no Tailwind, no React Query, no MSW, no `styled-components`/`@emotion`)
- **Playwright** for E2E across `desktop` / `tablet` / `mobile` Chromium viewports
- No state libraries beyond React's own (per `AGENTS.md`)

## Quick start

```bash
npm install
npm run dev               # http://localhost:5173 (auto-opens browser)
```

For an offline-ish demo without hitting the test backend, edit `.env.local` and let Playwright's mock layer take over. See `docs/DEPLOYMENT.md` for environment variables.

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
| `npm run predeploy` | Lint + build + full E2E. Run this manually before deploying — the CI workflow currently does **not**. |

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

## Environment

`.env.example` is the source of truth. Copy to `.env.local` for development and to whatever your deployment pipeline uses for production. **All `VITE_*` values are inlined into the JS bundle at build time — never put secrets here.** Bearers and tokens come from the backend at runtime (`/v1/sessions/gohighlevel/session`) or from a super-admin paste behind `VITE_MVP_ADMIN_ENABLED`.

Key variable: `VITE_MVP_API_URL` — the canonical backend base URL. If unset the app has no API to talk to.

Full inventory and deployment recipe in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Deploy

CI (`.github/workflows/deploy.yml`) SSHes to the Rocky Linux server on every push to `main`, does `git reset --hard origin/main && npm ci && npm run build`. There is **no** lint/test gate in CI today and **no** automatic `.env` injection — see `docs/DEPLOYMENT.md` for the gaps and how the team currently works around them.

## Backend pairing

- Repo: [`/opt/projects/4Reels-Backend`](../4Reels-Backend) (sister checkout on this dev box).
- Test/staging API: `:8001` on the same host (systemd `reels-test.service`).
- Production API: separate host, `:8000` behind nginx (systemd `reels.service` / `cpihed.service`).
- Backend's webhook ingestion model and the multi-WordPress feature (#38) are documented in `4Reels-Backend/docs/DEPLOYMENT.md`.

## Further reading

- `DOCS.md` — product overview (pages, end-to-end flow, tenant model).
- `ARCHITECTURE.md` — high-level architecture decisions.
- `AGENTS.md`, `CLAUDE.md` — how Claude / Codex agents are expected to operate inside this repo.
- `CHECKPOINTS.md` — milestone log.
