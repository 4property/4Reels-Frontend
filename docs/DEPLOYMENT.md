# Deployment

Three concrete environments to keep straight, each backed by a different invocation of Vite.

| Environment | Served by | Trigger | Backend it talks to |
|---|---|---|---|
| **Local dev** | `npm run dev` (Vite dev server) | Developer command | Whatever `VITE_MVP_API_URL` points at in `.env.local` (usually `https://4reelsback-test.4property.com`) |
| **Local preview** | `npm run preview` (serves `dist/`) | Playwright's `webServer` or manual | Same as dev — env values are baked into the build |
| **Production** | nginx serving `dist/` from `/opt/4reels-frontend` (or similar) on the Rocky Linux host | `.github/workflows/deploy.yml` on push to `main` | Production backend host (e.g. `https://4reelsback.4property.com`) |

There is no Docker image for the frontend and no CDN in the loop — the production `dist/` is built on the server.

---

## 1. Local development

```bash
npm install
npm run dev      # Vite on :5173, opens browser automatically
```

`vite.config.js` does **not** configure a backend proxy. Requests go directly to `VITE_MVP_API_URL`, which means the backend must answer with permissive CORS for the dev origin (`http://localhost:5173`). If you need to target a different backend, edit `.env.local` and restart the dev server (Vite inlines env values at startup, not on hot reload).

To run against the live `dist/` instead of HMR:

```bash
npm run build
npm run preview    # :4173
```

---

## 2. Playwright (CI and local)

Playwright drives `dist/` via the preview server by default:

```bash
npm run test:e2e            # full suite, all 3 viewports
npm run test:smoke          # critical flows only
npm run test:visual         # visual regression
npm run test:visual:update  # re-baseline snapshots after intentional UI changes
PW_DEV=1 npm run test:e2e   # point at vite dev (HMR) instead of preview
```

`tests/support/mock-backend.js` intercepts every network call via `page.route()` — Playwright does **not** require a live backend at `:8000`. That's why CI runs the suite without any backend stack.

Outputs:

- `playwright-report/` — HTML report (open with `npm run test:report`).
- `test-results/` — screenshots and traces on failure (per `trace: retain-on-failure`).
- `tests/**/*-snapshots/` — committed visual baselines (gitignore exception in `.gitignore:158`).

The current suite has **3 viewports × ~108 tests** = 321 passing, 1 failing on tablet (`tests/social_templates.spec.js:19`) and 2 skipped — see `progress/audit_frontend_state_2026_05_16.md` for the breakdown. The tablet failure is a timing race in the mock-backend setup, not a regression in app code; the suite is treated as green for deploy purposes.

---

## 3. Production

### Workflow

`.github/workflows/deploy.yml` (push to `main` or manual `workflow_dispatch`):

```yaml
- ssh -i id_ed25519 -p $SSH_PORT $SSH_USER@$SSH_HOST \
    "cd $DEPLOY_PATH && git fetch --all && git reset --hard origin/main && npm ci && npm run build"
```

Required GitHub secrets (set under repo *Settings → Secrets and variables → Actions*):

- `SSH_PRIVATE_KEY` — ed25519 key authorised on the Rocky Linux host.
- `SSH_HOST` — the host's address.
- `SSH_USER` — user that owns the deploy path.
- `SSH_PORT` — optional, defaults to 22.
- `DEPLOY_PATH` — absolute path to the frontend checkout on the host (e.g. `/opt/4reels-frontend`).

What the workflow does **not** do today:

- No lint/test gate. A failing build that compiles will still ship.
- No `.env` injection. The frontend relies on whatever `.env` already lives on the host (or on the values baked into `vite.config.js` defaults).
- No version stamping. `package.json` is pinned at `0.0.0`; the produced `dist/` carries no build ID.
- No rollback. To revert, force-push the previous commit to `main` or pull the previous SHA on the host and re-run `npm ci && npm run build`.

### Recommended hardening (not yet implemented)

1. Add a `lint` + `test:e2e` step in the workflow **before** the SSH deploy. Use `actions/cache@v4` for `node_modules` so it's fast.
2. Drop a per-host `.env` in `$DEPLOY_PATH/.env` (mode 640, owned by the deploy user) and reference its values from GitHub Secrets in the SSH command. Vite reads it automatically.
3. Stamp the build: in CI, `npm version patch --no-git-tag-version` (or write the commit SHA into `src/lib/buildId.js`), expose it via `window.APP_VERSION` so support can identify what's live.
4. Keep the previous `dist/` next to the new one on disk so a rollback is a symlink swap rather than a full rebuild.

### Manual deploy from the host

```bash
ssh you@deploy-host
cd /opt/4reels-frontend
git fetch && git reset --hard origin/main
npm ci
npm run build
# nginx serves /opt/4reels-frontend/dist as the document root — no service restart needed
sudo systemctl reload nginx   # only if you changed the nginx config itself
```

---

## Environment variables

All `VITE_*` values are inlined into the JS bundle at build time. **Anything you put here is public the first time the build is shipped.** Bearer tokens come from runtime endpoints, not from env.

| Variable | Required | Used for |
|---|---|---|
| `VITE_MVP_API_URL` | **yes** | Canonical backend base URL. Every API call goes through this. |
| `VITE_API_URL` | no | Legacy fallback. Safe to omit. |
| `VITE_USE_MOCK` | no | Legacy; ignored at runtime. |
| `VITE_API_TRACE` | no | When `true`, API errors include trace details in the browser console. |
| `VITE_ERROR_ENDPOINT` | no | If set, unhandled errors `POST` to this URL. |
| `VITE_GHL_MVP_ENABLED` | yes for GHL | Enables the GoHighLevel Marketplace iframe context resolution. |
| `VITE_GHL_CONTEXT_TIMEOUT_MS` | no | Default `2500`. How long to wait for the GHL iframe to hand over context. |
| `VITE_GHL_FALLBACK_USER_ID` | no | Used if GHL returns `location_id` but not `user_id`. |
| `VITE_MVP_ADMIN_ENABLED` | yes for local super-admin | Enables `/admin` and `?admin=1` shortcut without an iframe context. |
| `VITE_MVP_ADMIN_USER_ID` / `_NAME` / `_EMAIL` | with admin mode | Identifies the local super-admin session. |
| `VITE_GHL_LOCATION_ID` / `_USER_ID` / `_USER_NAME` / `_USER_EMAIL` | no | Dev-only overrides when you can't run the GHL iframe locally. |

Production should set at minimum: `VITE_MVP_API_URL`, `VITE_GHL_MVP_ENABLED=true`, `VITE_MVP_ADMIN_ENABLED=false`. The full inventory and the per-environment matrix is in `progress/audit_frontend_deployment_2026_05_16.md`.

---

## Backend pairing

The frontend has no opinion about which backend host serves it — only `VITE_MVP_API_URL` matters. In practice:

- **Local dev** typically points at the test API (`:8001` via Cloudflare Tunnel, e.g. `https://4reelsback-test.4property.com`).
- **Production** points at the live API host.

The backend's deployment story is documented in [`/opt/projects/4Reels-Backend/docs/DEPLOYMENT.md`](../../4Reels-Backend/docs/DEPLOYMENT.md). Two facts worth remembering when debugging cross-stack issues:

1. The backend test instance (`reels-test.service`, `:8001`) is restarted manually by the dev. Production (`reels.service` / `cpihed.service`, `:8000`) requires explicit user confirmation before restart per the backend's CLAUDE.md.
2. After backend feature 38 landed, adding a new WordPress source no longer requires a backend restart — the frontend just needs the API to be reachable.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Blank page in production | `VITE_MVP_API_URL` was empty at build time, so every fetch resolves against the wrong origin. Rebuild with a populated `.env`. |
| CORS error in dev | Backend isn't allowing `http://localhost:5173`. Either run dev against the test backend (which is configured for it) or proxy via Vite. |
| Playwright build server takes 2 min before tests start | First-time `npm run build` cost. Subsequent runs reuse `dist/`. Set `reuseExistingServer: !process.env.CI` is already the default. |
| Visual diff failures after a legit UI change | Run `npm run test:visual:update`, eyeball the diffs in the report, commit the updated `*-snapshots/`. |
| Bundle suddenly grows | Inspect `dist/` with `du -sh dist/assets/*`. Most likely a new import pulled in a large dependency; check `package.json` history. |

---

## Reference

- `package.json` (scripts), `vite.config.js`, `playwright.config.js`, `eslint.config.js`, `.gitignore`.
- `init.sh` — pre-session harness used by agents.
- `.github/workflows/deploy.yml` — current deploy workflow.
- `progress/audit_frontend_deployment_2026_05_16.md` — full audit (560 lines).
- Backend deployment counterpart: `/opt/projects/4Reels-Backend/docs/DEPLOYMENT.md`.
