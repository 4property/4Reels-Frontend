# Review — feature 34 (agency_intro_upload_ui)

**Verdict:** APPROVED

## 1. Per-decision audit table

| Decision (leader / implementer) | Status | Verified at |
|---|---|---|
| Shared component `UploadVideoCard.jsx` parameterized by `kind: 'intro' \| 'outro'` + `copy` | OK | `src/features/defaults/UploadVideoCard.jsx:54-65` — single `kind` prop guards at `:66-68`; `kindFields(kind)` at `:371-377` maps to `{intro,outro}_{source,object_key,duration_seconds}`; `kindTestIds(kind)` at `:379-394` derives all data-testids from `kind`. Validation, probe, segmented, preview, dropzone, chip all live in this one file. |
| `OutroCard.jsx` is a thin (~10 lines) wrapper | OK | `src/features/defaults/OutroCard.jsx:1-25` — 25 lines total including copy constant; the JSX function body is 3 lines (`<UploadVideoCard kind="outro" copy={OUTRO_COPY} {...props} />`). No duplicated logic. |
| `IntroCard.jsx` mirrors as thin wrapper | OK | `src/features/defaults/IntroCard.jsx:1-23` — 23 lines, identical structure to `OutroCard.jsx`. Only differences are the `INTRO_COPY` table and `kind="intro"`. |
| Validation / probe lives ONCE in `UploadVideoCard` | OK | Constants `ACCEPTED_MIME`, `MAX_BYTES`, `MAX_DURATION_S`, `MIN_DURATION_S` at `UploadVideoCard.jsx:14-18`; mime+size gates at `:126-133`; duration probe + 1–10s gate at `:135-149`. `humaniseUploadError` at `:437-450` for server 422/413. No duplication in `IntroCard.jsx` / `OutroCard.jsx`. |
| `OutroCard` wrapper preserves exact previous behavior (no regression) | OK | 21/21 outro tests pass post-refactor (`agency_outro_upload.spec.js`). All previous data-testids (`outro-card`, `outro-input`, `outro-trash`, `outro-file-chip`, `outro-replace`, `outro-error`, `outro-preview-video`, `outro-uploading`, `outro-dropzone`, `outro-preview-duration`, `outro-file-name`, `outro-file-meta`) are still emitted via `kindTestIds('outro')`. |
| Probe still injectable for tests | OK | Two injection paths preserved: explicit `probeDurationSeconds` prop (`UploadVideoCard.jsx:64,78`) and window hook `window.__4reelsProbeOutroDuration` / `__4reelsProbeIntroDuration` (`defaultDurationProbe(kind)` at `:463-498`). Intro spec uses the intro-suffixed hook (`agency_intro_upload.spec.js:46-48`), outro spec uses the outro one. Decoupled — no collision when both cards are on the same tab. |
| Segmented `disabled` handling for Brand card still works | OK | `UploadVideoCard.jsx:216-229` declares `{value: 'brand-card', disabled: true, title: 'Coming soon'}`. `handleSource:103` short-circuits on `'brand-card'`. Verified by intro test `agency_intro_upload.spec.js:174-181` and outro test `agency_outro_upload.spec.js:173-180` (both assert `disabled=""` + `title="Coming soon"`). |
| `defaultsApi.introUpload(agencyId, file)` — POST multipart, no manual Content-Type | OK | `src/features/defaults/api.js:55,61-68` — `uploadVideo(agencyId, 'intro', file)` builds `FormData`, appends `file`, calls `apiRequest(...)` with `method: 'POST', body: form` and **no** content-type header (browser sets boundary). Intro test `agency_intro_upload.spec.js:78-80` asserts `content-type` matches `multipart/form-data; boundary=`. |
| `defaultsApi.introDelete(agencyId)` — DELETE | OK | `src/features/defaults/api.js:56,70-74` — `deleteVideo(agencyId, 'intro')` calls `apiRequest(..., { method: 'DELETE' })`. |
| `defaultsApi.introFileUrl(agencyId)` — URL string only, NO request | OK | `src/features/defaults/api.js:57,76-79` — string-only concat of `MVP_API_URL`/`BASE_URL` and path. No `fetch`. Test verifies `<video src>` carries that URL (`agency_intro_upload.spec.js:86-90`). |
| `defaultsApi.introDownload(agencyId, options)` — non-breaking auth-aware blob helper | OK | `src/features/defaults/api.js:58,81-86` — uses `apiFetchBlob` from `lib/api/client.js`. Production callers can use this to bypass the `<video src>` auth gap. |
| Whole api surface symmetric to outro | OK | All four entries (`introUpload`, `introDelete`, `introFileUrl`, `introDownload`) share helpers (`uploadVideo`, `deleteVideo`, `fileUrl`, `downloadVideo`) with their outro twins. `api.js:43-59` makes the symmetry visually obvious. |
| `useIntroUpload`, `useIntroDelete` hooks | OK | `src/features/defaults/hooks.js:40-50` (`useIntroUpload`), `:56-63` (`useIntroDelete`). Mirror outro pattern at `:10-33`; same agencyId/file guards. |
| `buildDefaultsBody` ships `intro_enabled` | OK | `src/features/defaults/hooks.js:96-110` — `intro_enabled: Boolean(state.introEnabled)` at `:98` (alongside `outro_enabled` at `:99`). Both surface top-level in PUT body. Already validated by the existing /defaults save flow (smoke + e2e green). |
| `IntroOutroTab.jsx` mounts both `IntroCard` + `OutroCard`, server-cabled | OK | `src/features/defaults/tabs/IntroOutroTab.jsx:14-22` (`IntroCard` with `enabled/setEnabled/duration/setDuration/defaults/agencyId/refetchDefaults`), `:23-31` (`OutroCard`, same prop shape). Legacy mocked `IntroOutroCard kind="Intro"` removed from this file. |
| `ReelDefaultsConfig.jsx` hydrates `introEnabled` from `defaults.intro_enabled` | OK | `src/features/defaults/ReelDefaultsConfig.jsx:40` (when `settings` present) and `:52` (settings-less fallback) read `defaults?.intro_enabled` with a fallback to `persisted.introEnabled` / `current.introEnabled`. Symmetric to `outro_enabled` at `:44,:53`. `defaults`, `agencyId`, `refetch` threaded into `IntroOutroTab` at `:134-141`. |
| Copy distinct per kind — Intro = "Plays at the start of every reel"; Outro = "Plays at the end of every reel" | OK | `IntroCard.jsx:5` (`subtitle: 'Plays at the start of every reel.'`); `OutroCard.jsx:5` (`subtitle: 'Plays at the end of every reel. Great for CTAs and contact info.'`). Distinct `previewTag` (`INTRO` vs `OUTRO`), `previewNoneLabel`, `durationLabel`, `removeAria`. |
| Mock backend: 3 new intro routes (POST/GET/DELETE) | OK | `tests/support/mock-backend.js:994-1023` (POST `/intro/upload` — persists into `defaultsByAgency`, returns `{intro_object_key, intro_duration_seconds, intro_source: "uploaded"}`, parses mp4 vs quicktime from raw form-data at `:1001`), `:1025-1038` (GET `/intro/file` returns 12-byte placeholder `video/mp4`), `:1040-1060` (DELETE `/intro` resets the same map entry with `intro_source: 'none'`, `intro_object_key: null`, `intro_duration_seconds: null`). Identical shape to outro at `:920-986`. |
| `surfaceDefaultsForGet` extended with `intro_object_key`, `intro_duration_seconds`, `intro_source` | OK | `tests/support/mock-backend.js:1530-1542` — surfaces `intro_enabled`, `intro_source`, `intro_object_key`, `intro_duration_seconds` at top-level. Outro twin at `:1545-1554`. |
| `isKnownAdminStub` registers the 3 new intro paths | OK | `tests/support/mock-backend.js:1373-1375` — `/intro$`, `/intro/upload$`, `/intro/file$`. Sits next to outro `:1370-1372`. |
| Client-side validation: ≤50MB, mime `video/mp4\|quicktime`, 1–10s; server 422/413 surfaced inline | OK | `UploadVideoCard.jsx:14-18` (constants), `:126-133` (mime + size), `:135-149` (duration). Server-error humaniser at `:437-450` maps `INVALID_MIME`, `FILE_TOO_LARGE` (or HTTP 413), `INVALID_DURATION`. Error state rendered inline at `:301-309`. Tests `agency_intro_upload.spec.js:97-128` (oversized → no POST), `:130-150` (non-mp4/mov → no POST), `:152-172` (duration 12s → no POST). |
| No regression in feature 33 — 21 outro tests still pass | OK | `npm run test:e2e tests/agency_outro_upload.spec.js` → 21 passed (subset of the 45 combined run). |
| No new npm dependencies | OK | `git diff package.json package-lock.json` — only adds `"license": "GPL-2.0-only"` line to `package.json` (no changes to `dependencies` / `devDependencies`); `package-lock.json` unchanged. `init.sh` block 4 confirms (`package.json sin libs prohibidas`). |
| No TypeScript anywhere | OK | `init.sh` block 4 (`Sin TypeScript en src/`). New files all `.jsx` / `.js`. |
| No React Query / MSW / styled-components / Tailwind / CSS-in-JS | OK | `init.sh` block 4 + git-diff inspection of `package.json`. New imports in `UploadVideoCard.jsx` are only `react`, `shared/`, and same-feature siblings. |
| Components don't `fetch` directly | OK | `grep -rn "fetch(" src/features/defaults/` → 1 hit (`ReelDefaultsConfig.jsx:69 await refetch()`, which is the hook's own refetch handler, not `fetch`). Data path is `UploadVideoCard` → `useIntroUpload`/`useIntroDelete` → `defaultsApi.introUpload`/`introDelete` → `apiRequest` in `lib/api/client.js`. Mirror for outro. |
| Layer rules respected | OK | `UploadVideoCard.jsx:1-12` imports `react`, `../../shared/Icon.jsx`, `../../shared/Segmented.jsx`, `../../shared/Spinner.jsx`, `../../shared/Toggle.jsx`, `./api.js`, `./hooks.js`. No imports from `app/`. `shared/` not importing `features/`. `lib/` not importing upward. |
| No `VITE_ADMIN_API_TOKEN` / `VITE_*` secret | OK | `grep -r "VITE_ADMIN_API_TOKEN\|VITE_.*TOKEN\|VITE_.*SECRET" src/` → empty. `introFileUrl` only reads `VITE_MVP_API_URL` / `VITE_API_URL` (public bases). |
| `DOCS.md` § Backend contract: new intro section, symmetric to outro | OK | `DOCS.md:223-252` — block "Agency intro upload (feature 34)" documents the 3 endpoints with request/response shapes, the 3 documented errors (`INVALID_MIME` 422, `FILE_TOO_LARGE` 413, `INVALID_DURATION` 422), the `GET /defaults` extension (`intro_source`, `intro_object_key`, `intro_duration_seconds`; `intro_enabled` already existed), the auth gap for `<video src>` (production needs `introDownload`), the source-selector copy difference (`start` vs `end`), and the explicit note that both cards are thin wrappers of `UploadVideoCard`. |
| No `console.log` / `debugger` residual | OK | `grep -rn "console\.\(log\|error\|warn\|debug\)\|debugger" src/features/defaults/` → empty. |

## 2. Acceptance checklist (feature_list.json id=34)

- [x] **`src/features/defaults/api.js`: `introUpload`, `introDelete`, `introFileUrl` symmetric to feature 33** — `src/features/defaults/api.js:55-58`. Same FormData multipart pattern (no `VITE_ADMIN_API_TOKEN`, no manual Content-Type) as `outroUpload`. `introFileUrl` is a pure URL builder. The extra `introDownload` at `:58` is a non-breaking add (auth-aware blob helper) mirroring `outroDownload`.
- [x] **IntroOutroCard.jsx in 'Intro' mode uses real multipart upload with the same pattern as outro** — Implementer factored the shared `UploadVideoCard.jsx`, then `IntroCard.jsx` (3-line wrapper) is mounted as the intro slot in `IntroOutroTab.jsx:14-22`. The legacy mocked `IntroOutroCard.jsx` is no longer referenced (orphan; see Issues §4). Real multipart upload verified by `agency_intro_upload.spec.js:55-95` (POST → 200, chip with duration 3s, preview `<video>` points at `/intro/file`).
- [x] **Toggle Enabled del card Intro persiste `intro_enabled` en defaults** — `UploadVideoCard.jsx:200` (Toggle wired to `enabled`/`setEnabled` props), `IntroOutroTab.jsx:15-17` (callback writes `state.introEnabled`), `ReelDefaultsConfig.jsx:40,52` (hydration from `defaults.intro_enabled`), `hooks.js:98` (`buildDefaultsBody` ships `intro_enabled`). No PUT fires from the card itself — persistence happens through the existing "Save defaults" button (`ReelDefaultsConfig.jsx:96-103`), confirmed by `agency_intro_upload.spec.js:211-231` (toggle off/on does not dispatch PUT/DELETE; chip survives via `display:none`).
- [x] **Source segmented igual que feature 33 (Uploaded enabled, Brand card disabled, None enabled)** — `UploadVideoCard.jsx:216-229` + `handleSource:100-113`. Test `agency_intro_upload.spec.js:174-181` asserts `disabled=""` + `title="Coming soon"`.
- [x] **Validación cliente igual que feature 33** — single source in `UploadVideoCard.jsx:14-18,126-149`. Tests `agency_intro_upload.spec.js:97-128,130-150,152-172`.
- [x] **Tests Playwright similares a feature 33 pero para intro** — `tests/agency_intro_upload.spec.js` 8 specs × 3 viewports = 24 tests. All pass.
- [x] **`npm run lint`, `npm run build`, `npm run test:smoke` verdes** — see §3.

## 3. Verification re-run (this review)

### `./init.sh`
```
── 4. Verificando que no hay TypeScript filtrado ───
[OK]    Sin TypeScript en src/
[OK]    package.json sin libs prohibidas
── 5. Lint ─────────────────────────────────────────
[OK]    lint verde
── 6. Build ────────────────────────────────────────
[OK]    build verde
── 7. Resumen ──────────────────────────────────────
[OK]    Entorno listo.
```
Exit 0.

### `npm run test:smoke`
```
46 passed (36.3s) — 2 skipped (pre-existing theme specs)
```

### `npm run test:e2e tests/agency_intro_upload.spec.js tests/agency_outro_upload.spec.js`
```
45 passed (20.8s)
  ↳ 24 nuevos en agency_intro_upload (8 specs × 3 viewports)
  ↳ 21 outro intactos (7 specs × 3 viewports)
```

### `npm run test:e2e` (full)
```
259 passed (1.6m) — 2 skipped (pre-existing theme specs)
0 flake — including `tests/social_templates.spec.js:233` which the
implementer flagged as occasionally flaky; passed first-try in this re-run.
```

## 4. Issues found

None blocking. Two minor observations:

1. **Orphan legacy file `src/features/defaults/IntroOutroCard.jsx`** — no longer referenced anywhere (`grep -rn "IntroOutroCard" src/ tests/` → only its own export line). The implementer explicitly left it in §7.6 of `impl_34.md` to keep the diff scoped to feature 34 and let the leader sign off a separate cleanup. Not a blocker for approval; flagged here so the leader can dispatch a one-line cleanup task (delete file, drop the internal `Preview`/`Controls` helpers it carries).
2. **`size_bytes` not yet returned by `GET /defaults`** — heritage of feature 33 (already documented as an open item in `review_33.md` §5.5). Chip shows `duration + size` only post-upload; after reload only duration. Same trade-off applies symmetrically to intro. No new code needed.

## 5. Open items

### Manual QA against :8001 (deferred to user)

Implementer enumerated the manual smoke checklist in `progress/impl_34.md` §8. Reviewer concurs — once backend feature 34 is deployed to `reels-test.service` (:8001), the user should:

- Open `/defaults` → tab "Intro & outro" → expect **two** cards (Intro + Outro) with Toggles persisted.
- Source segmented: Brand card disabled with tooltip in both cards.
- Upload MP4 intro 3s ≤50MB → DevTools shows `POST /v1/admin/agencies/{id}/intro/upload` multipart → 200 → chip + preview.
- Upload MOV intro → same flow. Upload PNG → inline error `Only MP4 or MOV`, zero POSTs.
- Limits: 12s intro → `Duration must be 1–10s`, zero POSTs. 60 MB intro → `File must be ≤50MB`, zero POSTs.
- Reload page → both chips hydrate with duration from backend; size disappears (heritage of feature 33).
- Trash intro → `DELETE /v1/admin/agencies/{id}/intro` → only intro chip clears, outro untouched. And vice-versa.
- Toggle Intro OFF + Save → `PUT /defaults` body with `intro_enabled: false`. ON + Save → `true`.
- Ingest property with `intro_enabled=true` + persisted intro and `outro_enabled=true` + persisted outro → rendered reel: intro → photos → outro.
- If `<video src>` preview is blank (back enforces Bearer on `/intro/file`), pivot to `defaultsApi.introDownload` + `URL.createObjectURL`. The helper is already in `api.js`; the Card consumes the URL-style endpoint by default to keep the mock smoke fast.

### Forward look — features 35-37 UI patterns

Features 35-37 (per-reel intro/outro overrides + per-reel photo PATCH) will need a different but related UX:
- `PATCH /reels/{id}/photos` (and the intro/outro counterparts) share a **"re-rendering" badge + 409 banner** pattern: optimistic UI tied to a `render_status` field, with a server-side 409 if the editor races with an in-flight render job.
- The `UploadVideoCard` from this feature is **not** directly reusable for those flows (different shape: per-reel selection vs. agency default; PATCH vs. POST upload; conflict semantics). However the **validation + probe + Segmented + chip primitives** in this card are clean abstractions worth lifting if features 35-37 add a `ReelVideoOverrideCard`.
- The leader should consider whether `kindFields` / `kindTestIds` should generalize to a wider taxonomy (e.g. `target: 'agency' | 'reel'`) before features 35-37 add a third axis. Not urgent — defer to that feature's implementer.

## 6. Conclusion

All leader decisions verified at the file:line level. Hard rules respected. Verification re-run clean (init.sh + smoke + targeted e2e + full e2e). No flake observed in this run.

**APPROVED.** Feature 34 → `done`.
