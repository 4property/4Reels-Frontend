# Review — feature 33 (agency_outro_upload_ui)

**Verdict:** APPROVED

## 1. Per-decision audit table

| Decision (leader / implementer) | Status | Verified at |
|---|---|---|
| `defaultsApi.outroUpload(agencyId, file)` — POST multipart `file`; no manual `Content-Type` (browser sets the boundary) | OK | `src/features/defaults/api.js:45-52` — builds `FormData`, appends single `file` part, `apiRequest(..., { method: 'POST', body: form })` (no header override). The smoke `agency_outro_upload.spec.js:60-69` asserts the outgoing `content-type` matches `multipart/form-data; boundary=`. |
| `defaultsApi.outroDelete(agencyId)` — DELETE | OK | `src/features/defaults/api.js:53-56`. |
| `defaultsApi.outroFileUrl(agencyId)` — URL string only, NO request | OK | `src/features/defaults/api.js:57-60` — just concatenates `MVP_API_URL`/`BASE_URL` + path; no `fetch`. `trimSlashes` is local at `:68-70`. Test verifies `<video src>` is the resulting URL (`agency_outro_upload.spec.js:86-89`). The extra `outroDownload` helper at `:61-65` is a non-breaking add (auth-aware blob fetch, documented for production); the contract surface stays the requested 3 entries. |
| `useOutroUpload`, `useOutroDelete` hooks in `hooks.js`; `buildDefaultsBody` includes `outro_enabled` | OK | `src/features/defaults/hooks.js:10-20` (`useOutroUpload`), `:26-33` (`useOutroDelete`), `:66-80` (`buildDefaultsBody` now sets `outro_enabled: Boolean(state.outroEnabled)` at top-level alongside `intro_enabled`). |
| `OutroCard` — Segmented Source: Uploaded video enabled / Brand card DISABLED + tooltip "Coming soon" / None enabled (calls DELETE) | OK | `src/features/defaults/OutroCard.jsx:186-199` (Segmented options with `brand-card` carrying `disabled: true, title: 'Coming soon'`). `handleSource` at `:82-94` short-circuits on `brand-card` (no-op), calls picker for `uploaded`, calls `runDelete()` for `none`. Test `agency_outro_upload.spec.js:173-180` asserts the brand-card button has `disabled=""` + `title="Coming soon"`. |
| Client-side validation: size ≤50MB, mime mp4/quicktime, duration 1–10s via `<video>` probe (injectable for tests) | OK | `src/features/defaults/OutroCard.jsx:9-13` (constants), `:107-114` (mime + size gates), `:115-130` (duration probe + 1–10s gate). The probe is injectable both via `probeDurationSeconds` prop (`:53`) AND via `window.__4reelsProbeOutroDuration` (used by `defaultDurationProbe` at `:407-413`). Errors set local `error` state (`:108,:112,:120,:128`); they render inline at `:271-279` and never crash. |
| Server errors (422/413) surfaced inline | OK | `src/features/defaults/OutroCard.jsx:144-147` catches upload failure and calls `humaniseUploadError` (`:384-397`) which maps `INVALID_MIME` / `FILE_TOO_LARGE` / `413` / `INVALID_DURATION` from `err.body.code` or HTTP status, then sets `error` state which renders inline at `:271-279`. |
| Mock backend: 3 new routes (POST/GET/DELETE) under `defaultsByAgency`; `surfaceDefaultsForGet` extended with `outro_object_key`, `outro_duration_seconds`, `outro_source`; `isKnownAdminStub` knows the 3 new paths | OK | `tests/support/mock-backend.js:914-948` (POST `/outro/upload` — persists into `defaultsByAgency`, returns `{outro_object_key, outro_duration_seconds, outro_source: "uploaded"}`), `:951-964` (GET `/outro/file` returns 12-byte placeholder `video/mp4`), `:966-986` (DELETE `/outro` resets the same map entry), `:1455-1466` (`surfaceDefaultsForGet` exposes `outro_enabled`, `outro_source`, `outro_object_key`, `outro_duration_seconds` at top-level), `:1296-1298` (`isKnownAdminStub` registers `/outro$`, `/outro/upload$`, `/outro/file$`). |
| No `brand_card` action: click is a no-op (disabled) | OK | `Segmented.jsx:9-13` returns early when `o.disabled`. `OutroCard.handleSource:84` also short-circuits on `next === 'brand-card'`. Combined: `<button disabled>` + JS no-op even if disabled were bypassed. |
| No new npm dependencies | OK | `git diff package.json package-lock.json` only adds `"license": "GPL-2.0-only"` line to `package.json` (12 diff lines total, no `dependencies` change). No `package-lock.json` movement. Confirmed by `init.sh` block 4 (`package.json sin libs prohibidas`). |
| `Segmented` primitive extended with `disabled+title` per option, retrocompat | OK | `src/shared/Segmented.jsx:1-22`. Both keys are optional and default to `undefined`/`false`. 16 call sites across the codebase (grepped: TweaksPanel, FormatTab×5, SubtitlesTab×3, IntroOutroCard, MusicLibrary, VideoTab×2, OutroCard, Dashboard, CaptionsTab) — only OutroCard passes `disabled`/`title`; all others render unchanged (`title || undefined` and `Boolean(o.disabled)` both fall through gracefully). Smoke green on all surfaces using Segmented. |
| `ReelDefaultsConfig` hydrates `outroEnabled` | OK | `src/features/defaults/ReelDefaultsConfig.jsx:42-44` (when `settings` is present) and `:53` (settings-less fallback) read `defaults?.outro_enabled` with a fallback to legacy `persisted.outroEnabled` / `current.outroEnabled`, matching exactly the `intro_enabled` pattern above. `defaults`, `agencyId` and `refetch` are threaded into `IntroOutroTab` at `:134-141`. |
| `IntroOutroTab` swap: Outro card uses the new `OutroCard` | OK | `src/features/defaults/tabs/IntroOutroTab.jsx:3` imports `OutroCard`, `:25-33` mounts it with `enabled/setEnabled/duration/setDuration/defaults/agencyId/refetchDefaults` props. Intro side (line 14) still uses the legacy `IntroOutroCard kind="Intro"` — explicitly out of scope for this feature (feature 34). |
| `forms.css` adds dim + not-allowed style | OK | `src/styles/forms.css:136-140` — `.seg button.is-disabled, .seg button[disabled] { opacity: 0.45; cursor: not-allowed; }`. Does not touch `.active` or the rest of the file. |
| No TypeScript anywhere | OK | `init.sh` block 4 (`Sin TypeScript en src/`). |
| No React Query / MSW / styled-components / Tailwind / CSS-in-JS | OK | `init.sh` block 4 + git-diff inspection of `package.json`. |
| Components don't `fetch` directly | OK | `grep "fetch\|XMLHttpRequest" src/features/defaults/OutroCard.jsx src/features/defaults/hooks.js src/features/defaults/api.js` → empty. Path is `OutroCard` → `useOutroUpload`/`useOutroDelete` → `defaultsApi.outroUpload`/`outroDelete` → `apiRequest` in `lib/api/client.js`. |
| Layer rules respected | OK | `OutroCard.jsx:1-7` imports only from `react`, `shared/`, and same-feature siblings (`./api.js`, `./hooks.js`). `Segmented.jsx` has no data-layer imports. `mock-backend.js` is a Playwright support file, not under `src/`. |
| No `VITE_ADMIN_API_TOKEN` / `VITE_*` secret | OK | `grep -r "VITE_ADMIN_API_TOKEN" src/` → empty. `outroFileUrl` only reads `VITE_MVP_API_URL` / `VITE_API_URL` (public URL bases, both already documented in `.env.example`). |
| `DOCS.md` § Backend contract has the new outro section, matching the contract | OK | `DOCS.md:191-222` — block "Agency outro upload (feature 33)" documents the 3 endpoints with request/response shapes, the 3 documented errors (`INVALID_MIME` 422, `FILE_TOO_LARGE` 413, `INVALID_DURATION` 422), the `GET /defaults` extension (`outro_enabled`, `outro_source`, `outro_object_key`, `outro_duration_seconds`), the `outro_enabled` persistence in `PUT /defaults`, and the Source selector behaviour. Also flags that `<video src>` only works against the mock (production needs `defaultsApi.outroDownload`). |
| No `console.log` / `debugger` residual | OK | `grep "console\.\(log\|error\|warn\|debug\)\|debugger" src/features/defaults/OutroCard.jsx src/features/defaults/api.js src/features/defaults/hooks.js src/features/defaults/tabs/IntroOutroTab.jsx src/features/defaults/ReelDefaultsConfig.jsx src/shared/Segmented.jsx` → empty. |

## 2. Acceptance checklist (feature_list.json id=33)

- [x] **`src/features/defaults/api.js`: `outroUpload`, `outroDelete`, `outroFileUrl` aligned with feature 9 / 22; no `VITE_ADMIN_API_TOKEN`** — `src/features/defaults/api.js:45-66`. Pattern is identical to `brandApi.uploadLogo` (FormData multipart, no JSON header). `outroFileUrl` is a pure URL builder. The added `outroDownload` is extra (production helper) and uses `apiFetchBlob` already in `lib/api/client.js`.
- [x] **Outro card uses real multipart upload; chip reflects size + duration; replace + trash work** — `OutroCard.jsx:215-244` (chip with replace+trash icons), `:101-148` (upload flow), `:150-163` (delete flow). E2E `agency_outro_upload.spec.js:55-94` (happy path + chip + preview) + `:182-208` (trash → DELETE). Note: as flagged by the implementer in §6.4 of `impl_33.md`, size only shows post-upload (until the back returns `size_bytes` from GET `/defaults`); duration shows after reload too. Non-blocking — documented in DOCS.md.
- [x] **Toggle Enabled persists `outro_enabled` in defaults** — `OutroCard.jsx:177` (Toggle), `ReelDefaultsConfig.jsx:42-44` (hydration), `hooks.js:66-80` (`buildDefaultsBody` includes `outro_enabled`). No PUT fires from the card itself; saving happens through the existing "Save defaults" button at `ReelDefaultsConfig.jsx:96-103`.
- [x] **Source segmented: Uploaded video enabled / Brand card disabled + tooltip / None enabled and calls DELETE** — `OutroCard.jsx:186-199` + `:82-94`. Test `agency_outro_upload.spec.js:173-180`.
- [x] **Client-side validation blocks >50MB / non-video / >10s (now: also <1s) with inline error, no crash, no submit** — `OutroCard.jsx:107-130`. Tests `agency_outro_upload.spec.js:96-127` (oversized → no POST), `:129-149` (mime → no POST), `:151-171` (duration 12s → no POST).
- [x] **Playwright: upload MP4 → chip, toggle off/on preserves file, trash dispatches DELETE** — `tests/agency_outro_upload.spec.js` 7 specs × 3 viewports = 21 tests, all green (see §3).
- [x] **`npm run lint`, `npm run build`, `npm run test:smoke` green** — see §3.

## 3. Verification re-run (this review)

### `./init.sh`
```
── 4. TypeScript filtrado ───────────────  OK (sin .ts/.tsx en src/, sin libs prohibidas en package.json)
── 5. Lint ──────────────────────────────  OK
── 6. Build ─────────────────────────────  OK
── 7. Resumen ──────────────────────────  Entorno listo.
```
Exit 0.

### `npm run test:smoke`
```
2 skipped
46 passed (36.8s)
```
The 2 skipped are the pre-existing `theme` specs on tablet/mobile viewports — not introduced by this feature.

### `npm run test:e2e tests/agency_outro_upload.spec.js`
```
21 passed (15.0s)
```
All 7 specs × 3 viewports green. Coverage matches the contract:
- `upload happy path → chip appears with duration + size` (POST multipart fires, chip + preview `<video src>` point at the file endpoint).
- `client-side validation blocks oversized files without firing a request` (51 MB → inline error, 0 POSTs).
- `rejects non-mp4/mov files client-side` (`.txt` → inline error, 0 POSTs).
- `duration probe failure blocks submit` (12 s probe → inline error, 0 POSTs).
- `Brand card option is disabled with "Coming soon" tooltip` (`disabled=""` + `title="Coming soon"`).
- `trash dispatches DELETE and clears the chip`.
- `toggling Enabled off and on preserves the persisted chip`.

### `npm run test:e2e` (full)
First run: 1 flake (desktop `tests/social_templates.spec.js:233 — edit title + add 3 hashtags + save → PUT body carries the 3 fields`). Re-run of only `tests/social_templates.spec.js`: **30 passed**. Cause is unrelated to feature 33 (no defaults/outro code on that path) and the same spec passes on tablet + mobile within the same first run. Treated as a known-flaky test in the social_templates suite, not a regression. The full suite is 234 passed / 2 skipped on the first run + the recovered green on re-run.

## 4. Checkpoints (CHECKPOINTS.md)

- C1 — Arnés completo. `./init.sh` exit 0. **[x]**
- C2 — Estado coherente. Feature 33 sigue `in_progress` (pendiente del cierre por leader tras esta aprobación). No hay otras `in_progress`. **[x]**
- C3 — Código respeta arquitectura. No TS, no React Query/MSW, vanilla CSS, ningún `fetch` directo, layer rules cumplidas. **[x]**
- C4 — Verificación real. Lint, build, smoke, full e2e (con la nota de flake en §3). **[x]**
- C5 — Contrato mock-backend vivo. 3 handlers añadidos, registrados en `isKnownAdminStub`, shape mirror del backend descrito en `DOCS.md`. **[x]**
- C6 — Sesión limpia. Sin `console.log` ni `debugger`. Sin archivos basura. Sin libs nuevas. **[x]**

## 5. Issues found

### Blocking
*None.*

### Non-blocking
1. **`size_bytes` no se hidrata tras reload** (`OutroCard.jsx:356-365` + back GET payload). El chip muestra duración + size sólo justo tras un upload (porque el `File` local tiene `.size`); tras refrescar la página, el chip muestra sólo duración porque `GET /defaults` no devuelve `size_bytes`. El implementer lo flagged en `impl_33.md` §6.4. Recomendación para feature 34 o un follow-up: pedir al back que añada `outro_size_bytes` al payload GET.
2. **`outroFileUrl` no lleva bearer** (`OutroCard.jsx:165` + `api.js:57-60`). Funciona contra el mock; contra `:8001` el `<video src>` fallará si el back exige `Authorization`. El implementer ya añadió `outroDownload` (blob + objectURL) y lo documentó en `DOCS.md:202-207`. La QA manual contra :8001 confirmará si hay que pivotar el preview a blob. Documentado en `impl_33.md` §6.2.
3. **Duración 0 < d < 1s no se considera "duración válida"** — el contrato del back acepta 1–10s; la UI lo refleja correctamente. El test `duration probe failure blocks submit` usa 12s; no hay test específico para 0.5s. La rama se cubre por el mismo `if (!Number.isFinite(...) || > 10 || < 1)`. No es bug, sólo cobertura no-explícita.

### Nit
1. **`OutroCard.jsx:80`** — la línea `const source = hasFile ? 'uploaded' : view.source === 'uploaded' ? 'uploaded' : 'none';` define un local que nunca se lee (el render usa `hasFile ? 'uploaded' : 'none'` directamente en `:182` y `:197`). Es muerto pero inocuo; el lint pasa porque la variable `source` se usa formalmente vía el handler `handleSource(next)` que compara `next === source` (`:83`). Funciona porque `hasFile` y `view.source === 'uploaded'` son equivalentes cuando `objectKey` existe, pero la línea puede simplificarse a `const source = hasFile ? 'uploaded' : 'none';`. No-blocker.
2. **`OutroCard.jsx:30-35`** — el docstring dice `"uploaded" or "none"` para `outro_source`, mientras que el back y el mock también devuelven el alias `null → "none"`. El código maneja ambos (default a `'none'` en `:64`); el docstring podría mencionarlo.

## 6. Open items

### Manual QA contra :8001 (cuando back feature 33 deploye)
Heredados del checklist del implementer en `impl_33.md` §7:
- Abrir `/defaults` → tab "Intro & outro" → ver Outro card y Toggle Enabled persistido.
- Source segmented: 3 botones, Brand card con cursor not-allowed + tooltip "Coming soon".
- Subir MP4 5s ≤50MB → POST multipart, chip con duración + size, preview ok.
- Subir MOV ≤50MB → mismo flujo.
- Subir PNG → error `Only MP4 or MOV`, ningún POST.
- Subir MP4 60MB → error `File must be ≤50MB`, ningún POST.
- Subir MP4 12s → error `Duration must be 1–10s`, ningún POST.
- Recargar página → chip se hidrata con duración del back; size desaparece (open item §5.1 arriba).
- Verificar que `<video src>` del preview obtiene los bytes contra :8001. Si el back exige `Authorization` y el preview queda en blanco, pivotear a `defaultsApi.outroDownload` con `URL.createObjectURL` (la pieza ya está en `api.js:61-65`).
- Click Trash → DELETE → chip desaparece, dropzone vuelve.
- Toggle OFF + Save → PUT `outro_enabled:false`. Toggle ON + Save → PUT `outro_enabled:true`.
- Ingerir property con `outro_enabled:true` + outro persistido → reel renderizado termina con el clip de outro.

### Para feature 34 (intro upload)
- La estructura está lista para factorizar `OutroCard.jsx` → `UploadVideoCard.jsx` con prop `kind` (Intro|Outro), parametrizando endpoint paths, copy del header, `outro_*` ↔ `intro_*`. Idiomáticamente:
  - El probe inyectable (`window.__4reelsProbeOutroDuration`) se debe renombrar o duplicar a `__4reelsProbeIntroDuration` para que las dos cards convivan en la misma tab sin interferencia.
  - `IntroOutroTab.jsx:14-24` sigue montando el legacy mockeado `IntroOutroCard kind="Intro"` — feature 34 lo reemplaza por `<IntroCard>` o `<UploadVideoCard kind="Intro">`.
  - Los gates de validación pueden vivir en `src/features/defaults/uploadValidation.js` para no duplicarse entre Intro y Outro.
  - El `Segmented` ya está preparado (`disabled` + `title`) — feature 34 puede reutilizar la extensión sin tocar el primitive.

### Backend follow-up
- Solicitar al back que añada `outro_size_bytes` (y `intro_size_bytes` cuando feature 34 aterrice) al payload GET `/defaults`, para que el chip muestre size también tras reload.
