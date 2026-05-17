# Frontend cleanup — 2026-05-17

Cleanup / documentation polish / tests rationalization pass on
`/opt/projects/4Reels-Frontend`. No feature behavior changed; no new
dependencies; no TS / blocked frameworks; no service restarts; no
commits.

## 1. Deletions

### 1.1 Orphan source files

Grepped each candidate against `src/` + `tests/` with
`grep -rn "from '.*/<stem>['"]` — zero importers in every case.

- `src/features/defaults/IntroOutroCard.jsx` — superseded by
  `UploadVideoCard.jsx` + `IntroCard.jsx` + `OutroCard.jsx` (feature 34).
  Reviewer 34 had flagged it. Evidence:
  `grep -rn "IntroOutroCard" src/ tests/ DOCS.md ARCHITECTURE.md` returned
  only the file's own export line.
- `src/shared/EmptyBox.jsx` — `<EmptyBox>` component had zero importers.
  The `.empty` *class* is still used as a plain `<div className="empty">`
  in `AdminView`, `AgencyConfigDrawer`, `DefaultDescriptionsPanel`,
  `MusicLibrary`, `MusicRules`, so `.empty` in `src/styles/surfaces.css`
  stays. The `.empty-icon` / `.empty-title` / `.empty-sub` rules (only
  consumed by `EmptyBox`) were removed too — see §1.3.
- `src/features/defaults/formatter.js` — `formatPriceSample` and
  `formatDateSample` had zero importers (likely leftover from a deleted
  preview card in a previous sprint).
- `src/features/music/Waveform.jsx` — zero importers; the
  `.waveform` / `.waveform-bar` CSS block in `music.css` was also
  removed (no other consumer).

### 1.2 Unused barrel re-exports

These named exports in feature `index.js` files had no consumer outside
the feature folder. The internal consumers always imported from the
concrete module path, so the barrel entries were dead.

- `src/features/social/index.js` —
  removed `SocialPreviewCard`,
  `ALLOWED_SOCIAL_TEMPLATE_VARIABLES`,
  `SOCIAL_TEMPLATE_VARIABLE_PATTERN`.
  (`SocialConfig` is still exported and used by `app/Shell.jsx`.)
  Tests `tests/support/mock-backend.js` already imports the constants
  from `../../src/features/social/constants.js` directly.
- `src/features/reels/index.js` — removed `ReelEditor` re-export.
  `ReelEditor` is consumed only by `ReelEditorRoute.jsx`, which imports
  the concrete `./editor/ReelEditor.jsx` path.

### 1.3 Unused CSS rules

Spot-checked the CSS classes that were only consumed by the deleted
components:

- `src/features/defaults/defaults.css` — removed `.io-brand-card`,
  `.io-brand-logo`, `.io-brand-logo img`, `.io-brand-title`,
  `.io-brand-sub`, `.io-brand-hint` (the "Brand card" preview branch of
  the old `IntroOutroCard`). Verified no JSX uses them:
  `grep -rn "io-brand-card\|io-brand-logo\|io-brand-title\|io-brand-sub\|io-brand-hint" src/ --include="*.jsx"` → 0 matches.
- `src/features/music/music.css` — removed `.waveform`, `.waveform-bar`
  (only `Waveform.jsx` referenced them).
- `src/shared/shared.css` — removed `.empty-icon`, `.empty-title`,
  `.empty-sub` (only `EmptyBox.jsx` referenced them).

### 1.4 Duplicate unit test

- `tests/unit/mapPublishStatus.unit.js` — strict subset of
  `tests/unit/publishStatus.unit.js`. The latter covers every case in
  the former plus `pending_review`, `pending_publish`, `skipped` and
  feature-14 docstring context. Deleted the duplicate.

### 1.5 No-op TODO / FIXME

`grep -rn "TODO\|FIXME\|XXX\|HACK" src/ tests/ --include="*.js" --include="*.jsx"`
returned **0 hits**. Nothing to flag.

### 1.6 Commented-out code blocks

Heuristic grep
(`^\s*//.*function\|//.*const \|//.*import \|//.*return `) returned 0
hits. Nothing to remove.

## 2. Spanish → English translations

Scope: JSDoc, code comments, UI strings, CSS comments (NOT
`progress/*.md`, NOT `AGENTS.md`/`CLAUDE.md`, NOT `feature_list.json`,
NOT identifiers).

Intentional Spanish kept (contract): the post-approve banner copy
`"Publicará el dd/mm/yyyy a las HH:MM."` — pinned by DOCS.md,
`tests/automation_scheduling.spec.js`,
`tests/reel_approve_schedule.spec.js`,
`tests/unit/formatScheduledAt.unit.js` and
`src/shared/formatScheduledAt.js`. Spanish (`es-ES`) locale option in
`src/features/defaults/tabs/FormatTab.jsx` (`Español`) and the
`{ id: 'sofia-es', name: 'Sofía', accent: 'Spanish (ES)' ... }` AI voice
entry also stayed — they're localized labels, not free-form Spanish.

Files touched (10):

| File | Kind |
|---|---|
| `src/features/brand/BrandConfig.jsx` | JSDoc comment |
| `src/features/music/MusicConfig.jsx` | JSDoc + UI error strings |
| `src/features/music/MusicLibrary.jsx` | UI error strings + form label |
| `src/features/reels/editor/MusicOverridePanel.jsx` | UI tooltip + readonly hint |
| `src/features/reels/editor/ReelEditor.jsx` | inline comment |
| `src/features/reels/publishStatus.js` | JSDoc block |
| `src/features/session/SessionProvider.jsx` | 4 inline comment blocks |
| `src/shared/formatScheduledAt.js` | JSDoc subhead |
| `tests/reel_approve_schedule.spec.js` | header comment |
| `tests/social_templates.spec.js` | test fixture string (`'Tu título'` → `'Your title'`) |
| `tests/support/mock-backend.js` | inline comment |
| `tests/unit/publishStatus.unit.js` | JSDoc block |

Sample diffs:

```jsx
// MusicOverridePanel.jsx — UI string
- 'La pista no se puede cambiar tras aprobar/publicar.'
+ "The track can't be changed after approve/publish."
```

```js
// MusicConfig.jsx — humanizeMusicError
- if (status === 413) return 'Archivo demasiado grande (máx 20MB).';
+ if (status === 413) return 'File too large (max 20MB).';
```

```js
// SessionProvider.jsx — comment
- // Adjuntar el bearer ANTES de pasar a 'ready' para evitar la race
- // con el primer GET /v1/admin/agencies/{id} disparado por
- // ActiveAgencyProvider en el mismo render.
+ // Attach the bearer BEFORE switching to 'ready' to avoid the race
+ // with the first GET /v1/admin/agencies/{id} fired by
+ // ActiveAgencyProvider in the same render.
```

```js
// publishStatus.js — JSDoc block (full Spanish → English block, ~30 lines)
```

Final sweep confirms no high-density Spanish remains in
`src/` + `tests/` (`grep -rnE "\b(que|con|para|sin|tras|según|también|aunque|cuando|porque|donde|añadir|añadido|nuevo|nueva|último|última|primer|primera|cabecera|fallo|necesario|migración|reusa|elegir|recordar)\b"` → 0 hits) and no accents
outside the contract Spanish string.

## 3. DOCS.md / ARCHITECTURE.md polish

- `DOCS.md` — features 33 (outro upload) and 34 (intro upload) were
  already documented with the full backend contract in English; no
  changes needed.
- `DOCS.md` — **added** a new "Manual reel re-render (feature 40)"
  entry under Backend contract, immediately before the Rendering
  bullet. Covers the POST `/regenerate` endpoint shape, the 409
  `REGENERATE_PUBLISHED_FORBIDDEN` and 409
  `REGENERATE_ALREADY_IN_FLIGHT` error codes (with the toast copy
  the front surfaces), 404 `ADMIN_REEL_NOT_FOUND`, and the
  client-side gating on `publish_status === 'published'`.
- `ARCHITECTURE.md` — already English; no Spanish residue. No
  changes needed.

## 4. Tests audit

### 4.1 Deleted

- `tests/unit/mapPublishStatus.unit.js` — strict subset of
  `tests/unit/publishStatus.unit.js`. Rationale in §1.4.

### 4.2 Skipped (env-gated)

- `tests/audit_editor_live.spec.js` — added `test.skip(!process.env.RUN_LIVE_AUDIT, ...)` at the
  `test.describe` level. The spec is documented at the top of the file
  as "One-off functional audit spec, NOT part of the regular smoke
  suite", points at `http://127.0.0.1` with a hardcoded bundle hash
  (`/assets/index-C0tFPACT.js`), and was failing in **every** baseline
  run on every viewport because:
    1. The hardcoded bundle hash drifts as soon as anything in `src/`
       changes (any new build produces a fresh hash).
    2. `https://4reelsback-test.4property.com` is not always
       reachable in the sandbox.
  Now skipped by default; run with `RUN_LIVE_AUDIT=1 npm run test:e2e
  tests/audit_editor_live.spec.js` from the production nginx host when
  needed.

### 4.3 Flake investigation + fixes

Baseline (before any change) reported 3 failing-spec patterns:

1. **`tests/audit_editor_live.spec.js`** (×3 viewports) — addressed in
   §4.2.
2. **`tests/brand_dynamic_fonts.spec.js:73`** (`select Manrope -> Save
   -> PUT carries font_family: "Manrope"`) — flaked on different
   viewports across runs (tablet in baseline, mobile in mid-run).
3. **`tests/social_templates.spec.js:233`** (`edit title + add 3
   hashtags + save → PUT body carries the 3 fields`) — flaked on
   desktop in baseline.

Root cause for both 2 and 3 (same fingerprint): the test installs a
`page.on('request', …)` AND a `page.on('response', …)` listener to
capture the PUT body and the PUT status into two separate arrays
(`putBodies` / `putStatuses`). After the click that triggers the PUT,
the test polls `putBodies.length` for completion, then immediately
asserts on `putStatuses`. The response listener fires *strictly after*
the request listener, and the polling only waits on the bodies array,
so on a slow CI box the status array can still be empty when the
assertion runs. Confirmed by re-running each test in isolation
(`npx playwright test ... --project tablet|desktop`) — both passed
trivially without parallel load.

Both flakes show **`Expected value: 200, Received array: []`** —
which is the body-poll-resolved-before-response-listener-fires
signature. The Page Snapshot in the error context shows the page
already in the post-PUT state ("Brand saved." banner visible), which
confirms the PUT did succeed; only the test's listener was racing.

**Fix:** poll the status array too before the hard `toContain(200)`
assertion. Applied to every spec where the same pattern appears:

```js
- await expect.poll(() => putBodies.length).toBe(1);
- expect(putStatuses).toContain(200);
+ await expect.poll(() => putBodies.length).toBe(1);
+ await expect.poll(() => putStatuses.length).toBeGreaterThan(0);
+ expect(putStatuses).toContain(200);
```

Files touched:

- `tests/brand_dynamic_fonts.spec.js:73` — flake fix.
- `tests/social_templates.spec.js:233` and `:78` — flake fix (same
  pattern on the descriptions sub-tab save).
- `tests/social_publish_toggles.spec.js:81` — preemptive: same race
  pattern appeared as a flake in a mid-run too.
- `tests/templates.spec.js:81` — preemptive: same race pattern.

After the fix, two full e2e passes both finished green
(`343 passed / 0 failed / 5 skipped` — see §6/§7).

### 4.4 Skipped tests inventory

`grep -rn "test\.skip\|test\.fixme\|describe\.skip\|describe\.fixme"
tests/` → **2 hits, both legitimate**:

- `tests/flows.spec.js:154` — `test.skip(viewport.width <= 900, 'theme
  toggle lives inside the mobile drawer')`. Standard viewport gating,
  not a leftover.
- `tests/audit_editor_live.spec.js` — env-gated per §4.2.

`grep -rn "test\.only\|describe\.only" tests/` → **0 hits**.

`grep -rn "expect(true)\.toBe(true)\|expect(true).toBeTruthy()\|expect(1).toBe(1)" tests/`
→ **0 hits**.

### 4.5 Flagged but kept

None. The cross-feature duplicates (e.g. `agency_intro_upload.spec.js`
vs `agency_outro_upload.spec.js`) are intentionally symmetric — they
cover sibling backend endpoints (intro vs outro) that may diverge.

## 5. Baseline diff

| Metric | Before | After |
|---|---|---|
| `./init.sh` (lint + build) | green | green |
| `npm run test:smoke` | 46 passed / 2 skipped | 46 passed / 2 skipped |
| `npm run test:e2e` passed | 341 | **343** |
| `npm run test:e2e` failed | 5 (audit ×3 + brand_dynamic_fonts ×1 + social_templates ×1) | **0** |
| `npm run test:e2e` skipped | 2 | 5 (the 2 documented + 3 audit_editor_live env-gated) |

Net: +2 passed (formerly flaky now stable), -5 failed, +3 skipped
(audit deliberately skipped under env gate).

## 6. Bundle size delta

Before this pass (from the briefing):

```
dist/assets/index-*.css   132.31 kB │ gzip:  31.53 kB
dist/assets/index-*.js    433.05 kB │ gzip: 124.37 kB
```

After this pass:

```
dist/assets/index-*.css   131.15 kB │ gzip:  31.36 kB    (-1.16 kB / -0.17 kB gz)
dist/assets/index-*.js    433.02 kB │ gzip: 124.33 kB    (-0.03 kB / -0.04 kB gz)
```

CSS delta accounts for the `.io-brand-*`, `.waveform*`, and `.empty-*`
blocks. The JS delta is tiny because tree-shaking already dropped the
orphan `IntroOutroCard`, `EmptyBox`, `formatter`, `Waveform` files from
the production bundle (nothing imported them).

## 7. Verification output (tails)

### `./init.sh`

```
── 5. Lint ─────────────────────────────────────────────
[OK]    lint verde

── 6. Build ────────────────────────────────────────────
[OK]    build verde

── 7. Resumen ──────────────────────────────────────────
[OK]    Entorno listo. Puedes empezar a trabajar.
```

### `npm run test:smoke`

```
  2 skipped
  46 passed (37.2s)
```

### `npm run test:e2e`

```
  5 skipped
  343 passed (2.4m)
```

(Skipped breakdown: 2 viewport-gated theme tests
[`flows.spec.js:153`] + 3 audit_editor_live across desktop/tablet/mobile
under env gate.)
