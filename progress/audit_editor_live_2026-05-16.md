# Audit — deployed editor (features 35 + 36)

**Verdict: WORKING.** The deployed bundle at `http://127.0.0.1/` renders
both the PhotosPanel (feature 35) and the SubtitlesPanel (feature 36)
against the live backend without errors. The most likely reason the user
"doesn't see" the new tabs is browser cache — `index.html` references a
fresh JS hash (`index-C0tFPACT.js`) that was deployed at 19:09 today, and
a hard refresh / cache bust will surface the new editor.

Date: 2026-05-16
Auditor: Claude (general-purpose subagent)
Audit spec: `tests/audit_editor_live.spec.js`
Backend under test: `https://4reelsback-test.4property.com` → :8001

## 1. Reachability

- `curl -s http://127.0.0.1/` returns 200 with:
  - `<script type="module" crossorigin src="/assets/index-C0tFPACT.js">`
  - `<link rel="stylesheet" crossorigin href="/assets/index-BYA_arSx.css">`
- The deployed bundle inlines `https://4reelsback-test.4property.com` as
  the `VITE_MVP_API_URL`, matching `/opt/projects/4Reels-Frontend/.env.local`.
- Bundle contains the new feature strings (`patchReelPhotos`,
  `patchReelSubtitles`, `photos_override`, `subtitles_override`,
  `Re-rendering`), confirmed via `grep` on `dist/assets/index-C0tFPACT.js`.

## 2. Bearer injection

No bearer needed for the audit. The deployed bundle has
`VITE_MVP_ADMIN_ENABLED=true` but the audit takes the regular GHL MVP
path: `page.addInitScript()` seeds `localStorage['4reels.ghlMvpContext']`
with a real `location_id` (`v8H1XNB3YCQmVHRhqDoM`, bound to the Test
agency `f86148f7-7862-455a-8161-337b62cb1134`) before any script runs.
`SessionProvider` then POSTs `/v1/sessions/gohighlevel/session`, gets a
real `agency_token` from the backend, calls `setAuthToken(...)`, and
flips to `status='ready'` — no super-admin bearer required.

Backend `ADMIN_API_DISABLE_AUTH_FOR_TESTING=true` means the bearer
wouldn't even be enforced on :8001, but the audit doesn't rely on that.

## 3. Editor render

- Direct navigation to `/reels/dev76.designbricks.ie/677148` opens the
  editor overlay (`.editor-overlay` visible within the 20 s budget).
- Target reel: `Test` agency, `dev76.designbricks.ie / 677148`
  (`34 Westlawn, Cork`), `workflow_state=awaiting_review`,
  `publish_status=pending_review`, `render_status=completed`. Editable
  state, not locked, 13 ingested photos.
- Console errors observed during the full editor session: **none**.
- The dashboard renders underneath (8/13 photos count chip visible in
  the Photos tab header — same value the dashboard would show).

## 4. PhotosPanel (feature 35)

- `[data-testid="photos-tab"]` mounts.
- `[data-testid="photos-grid"]` renders.
- Live tiles hydrate: `photo-tile-0` ... `photo-tile-N` populate from
  the real `/images` endpoint (13 entries).
- The first tile carries `draggable="true"`, confirming the DnD
  scaffolding from feature 35 is wired (PhotosPanel.jsx:152 sets
  `draggable={!clientLocked}`).
- "Property photos" header with the reorder hint is visible.
- The "Re-rendering…" badge primitive (`photos-rerender-badge`) is
  imported from `lockedReelHelpers.jsx` — the audit does not trigger a
  render, but the import is present in the bundle and the spec for it
  is preserved.
- `[data-testid="photos-locked-banner"]` count is 0 (correct — the
  reel is in `awaiting_review`).

Screenshot: `test-results/audit-editor-live-photos.png` shows the cover
on the left, the 13-tile grid on the right, each tile labelled with its
slot number, the first 8 tiles marked as selected.

## 5. SubtitlesPanel (feature 36)

- `[data-testid="subtitles-tab"]` mounts.
- `[data-testid="subtitles-add"]` ("+ Add line") button visible.
- 8 cue rows render (`subtitle-row-0` ... `subtitle-row-7`). The reel
  has `subtitles_override = null` and no `publishSubtitlesSnapshot`, so
  `hydrateSubtitles()` in `ReelEditor.jsx:611` falls back to
  `CRANFORD_SUBTITLES` — visible in the screenshot as the
  `"Welcome to Cranford Court"` placeholder text.
- Every row has the trio of inputs the feature ships:
  `subtitle-in-{i}`, `subtitle-out-{i}`, `subtitle-text-{i}`, plus the
  per-row `subtitle-delete-{i}`.
- Header hint "Auto-saves 1 s after the last edit" is visible.
- `[data-testid="subtitles-locked-banner"]` count is 0.

Screenshot: `test-results/audit-editor-live-subtitles.png` shows the
panel head, the +Add line / Regenerate buttons, and 8 fully-rendered
cue rows.

## 6. LockedReelBanner gating

The reel chosen (`awaiting_review`) is NOT in
`LOCKED_WORKFLOW_STATES = {'approved', 'published'}`, so neither
banner appears. The condition gate is correctly bypassed.

A separate quick check on the database (via the admin reels endpoint)
shows that the Test agency has reels in `published` state too
(174131 belongs to ckp); opening one of those would flip
`clientLocked=true` and surface the banner — outside this audit's
scope but the wiring is in place.

## 7. Screenshots

- `test-results/audit-editor-live-photos.png` — Photos tab with 13
  tiles + property cover.
- `test-results/audit-editor-live-subtitles.png` — Subtitles tab with
  8 cue rows + in/out/text inputs + Add line button.

## 8. Read-only safety net

The audit installs a `page.route()` handler that allows only `GET` and
`POST` (the latter is needed for the GHL session exchange). Any `PATCH`,
`PUT`, or `DELETE` reaching `https://4reelsback-test.4property.com/**`
is aborted with `blockedbyclient` before it hits the backend. During the
run no aborts occurred — the panels render without auto-PATCHing
because the audit never mutates a tile or a cue.

## 9. How to reproduce

```bash
# Required because playwright.config.js webServer points at :4173.
# The audit doesn't need it (baseURL is overridden in the spec) but
# Playwright still probes the URL on startup. A no-op `vite preview`
# satisfies the check; nothing in /dist is regenerated.
nohup npx vite preview --port 4173 --host 127.0.0.1 \
  >/tmp/vite-preview.log 2>&1 &
sleep 3
npx playwright test tests/audit_editor_live.spec.js \
  --reporter=list --project=desktop
# 1 passed (~3s).
```

## 10. Verdict and next steps for the user

**WORKING.** The new editor panels are correctly bundled and render
against the live :8001 backend. The most plausible explanation for the
user's report:

- **Browser cache** — the prior bundle hash differs from the deployed
  `index-C0tFPACT.js`. A hard refresh (`Ctrl-Shift-R`) or DevTools →
  Disable cache should surface the new editor.
- **Looking at the wrong reel** — features 35/36 only become useful on
  reels that are NOT in `approved`/`published`. For example, opening
  the `ckp` reel 174131 (already `published`) would correctly show the
  locked banner and disable the panels — which is the intended UX.

No frontend defect found in features 35 or 36 as deployed.
