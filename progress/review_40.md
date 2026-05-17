# Review — feature 40 (manual_reel_regenerate_button)

**Veredicto:** APPROVED

## 1. Verdict summary

All leader decisions are implemented exactly as specified. The 409 parsing
key, the modal-primitive reuse, the toast primitive reuse and the cleanup of
the polling interval are all verified. No new dependencies introduced
(`git diff package.json` adds only `"license": "GPL-2.0-only"`). Lint, build,
smoke and the four targeted e2e specs are green.

## 2. Per-decision audit

### API — `reelsApi.regenerateReel(agencyId, siteId, sourcePropertyId, reason?)`

- File: `src/features/reels/api.js:197-203`.
- Builds `body = reason === undefined ? {} : { reason }` and POSTs to
  `/v1/admin/agencies/{aid}/reels/{site}/{prop}/regenerate` via
  `apiRequest` → `lib/api/client.js`. No direct `fetch`.
- Matches the leader contract: `{}` when no reason, `{reason}` otherwise.
- Pydantic `extra='forbid'` documented in the JSDoc.

### Hook — `useRegenerateReel({reel, agencyId, refetchReel})`

- File: `src/features/reels/hooks.js:323-376`.
- Returns `{triggerRegenerate, isRegenerating, errorCode, rerendering}`
  exactly as specified.
- `rerendering` derived from `reel.renderStatus === 'pending'`
  (`hooks.js:328`).
- Polls every 1.5 s (`hooks.js:337-340`, `setInterval(..., 1500)`).
- **Cleanup verified:** `useEffect` returns `() => clearInterval(id)`
  (`hooks.js:340`). Also returns `undefined` early when `!rerendering` or
  no `refetchReel`, so no leaked timers when the reel is idle or before
  the hook is wired.
- `triggerRegenerate` is `useCallback` with deps
  `[agencyId, reel.siteId, reel.sourcePropertyId, refetchReel]` — stable
  reference until those change.
- 409 codes captured into `errorCode` state; the hook also re-throws so
  the button can pick the right toast copy (matches the leader spec).

### Component — `<RegenerateReelButton />`

- File: `src/features/reels/editor/RegenerateReelButton.jsx` (NEW, 147 lines).
- Pure feature component, no `fetch`, no React Query, no styled-components,
  vanilla CSS via reused primitives. Layer rules respected (imports from
  `lib/hooks/useToast.js`, `shared/Icon.jsx`, `shared/Spinner.jsx`,
  `../hooks.js`, `./lockedReelHelpers.jsx`).

### Button placement

- Mounted at `src/features/reels/editor/ReelEditor.jsx:428-433`, inside
  `EditorHeader`, on the right side, after `<div className="editor-header-sep" />`
  (`ReelEditor.jsx:427`) and BEFORE the legacy `Regenerate with AI` stub
  (`ReelEditor.jsx:434-441`). Matches the leader spec.
- `EditorHeader` signature extended with `agencyId`, `refetchReel`,
  `onMutate` (`ReelEditor.jsx:397-408`). Mounted with `reel`, `agencyId`,
  `refetchReel`, `onMutate` (`ReelEditor.jsx:280-291`).

### Visibility logic

- File: `src/features/reels/editor/RegenerateReelButton.jsx:34-43`.
- Active when `renderStatus ∈ {completed, done}` (matches the leader spec
  + the implementer's compatibility note for the mock seed which uses `done`).
  When `publish_status === 'published'` AND `renderStatus ∈ {completed, done}`,
  the button still renders (passes the early-return at `line 43`) and the
  `disabled` flag + tooltip kicks in at `line 83-84`.
- **Disabled-with-tooltip when published:** `disabled={isPublished || isRegenerating || rerendering}`
  and `title={isPublished ? PUBLISHED_TOOLTIP : undefined}` — discoverable,
  not hidden, exactly as the leader specified.
- **Null-safe:** `String(reel?.renderStatus || '')` and
  `String(reel?.rawPublishStatus || '')` (lines 34-35). When `reel` is null,
  `renderStatus === ''` and the early-return at line 43 hits → returns null.
  Confirmed by reading: no crash when the editor is loading.
- Extra defensive hide on `renderStatus === 'failed'` (line 38) — not in the
  spec, but the implementer flagged it as out-of-scope UX, and the leader
  spec didn't forbid the early-return. Acceptable.

### Confirm modal

- File: `src/features/reels/editor/RegenerateReelButton.jsx:101-146`.
- **Modal copy** (lines 113-115): `"This will re-render the reel using the
  current photos, subtitles and slides settings. Continue?"` — matches the
  leader-specified text verbatim.
- Buttons: `Cancel` (line 130, `data-testid="regenerate-cancel"`) and
  `Render again` (line 140, `data-testid="regenerate-confirm"`).
- **Reuses modal-* primitives only.** Verified by reading:
  - `modal-backdrop` (line 103), `modal-panel` (line 105), `modal-header`
    (line 110), `modal-title` (line 112), `modal-sub` (line 113),
    `modal-footer` (line 122). All defined in `src/styles/surfaces.css`
    (lines 112-181). Same shape as `src/features/admin/CreateAgencyModal.jsx`
    (lines 41-43).
  - **No new modal component / no new CSS file introduced.** `git status`
    shows only the listed touched files; no new `src/styles/*.css`. The
    inline `RegenerateConfirmModal` is a local helper, not a primitive.
- The inline modal pattern is consistent with `CreateAgencyModal.jsx` and
  `NotificationSettings.jsx` (other modals in the repo).

### Re-rendering feedback

- File: `src/features/reels/editor/RegenerateReelButton.jsx:21,76-78`.
- Imports `RerenderBadge` from `./lockedReelHelpers.jsx` (line 21).
- Renders it next to the button when `rerendering` is true
  (lines 76-78), with `testId="regenerate-rerender-badge"`.
- Matches the leader spec: badge reuse + rendered next to the button.

### 409 handling — codes + toast copy

- File: `src/features/reels/editor/RegenerateReelButton.jsx:57-71`.
- Reads `err?.body?.error || err?.body?.code` (line 59) — handles BOTH
  the leader-stated backend shape (`error` key) AND the older
  `code` shape as a fallback. **Critical:** the leader spec says the back
  uses `error`, the mock uses `error` (verified in `tests/support/mock-backend.js:303,314`),
  so the primary key is correct.
- `REGENERATE_PUBLISHED_FORBIDDEN` → `toast.error('Cannot re-render a published reel')`
  (line 60-62). Matches leader spec verbatim.
- `REGENERATE_ALREADY_IN_FLIGHT` → `toast.error('A render is already in progress for this reel')`
  (line 64-66). Matches leader spec verbatim.
- Generic fallback at line 68-70 (`err?.body?.message || err?.message ||
  'Failed to re-render the reel.'`) — sane.
- **Toast primitive reused:** `toast` from `lib/hooks/useToast.js`
  (`RegenerateReelButton.jsx:17`). Same as the existing override panels
  (`PhotosPanel.jsx`, `SubtitlesPanel.jsx`, `SlidesPanel.jsx`,
  `DescriptionsPanel.jsx`, `MusicOverridePanel.jsx`, `ReelEditor.jsx` —
  all 6 use the same import). No new toast system introduced.

### Mock backend

- File: `tests/support/mock-backend.js:250-347`.
- POST `/regenerate` route registered, `extra='forbid'` on `reason`
  (lines 274-279).
- 200 happy path (lines 326-345): `{render_status: 'pending', job_id, queued_at}`
  + `setTimeout(..., 400)` flips back to `done` (matches the leader's
  "~400ms" note).
- 404 `ADMIN_REEL_NOT_FOUND` (lines 287-296).
- 409 `REGENERATE_PUBLISHED_FORBIDDEN` (lines 299-308).
- 409 `REGENERATE_ALREADY_IN_FLIGHT` (lines 310-319).
- Path registered in `isKnownAdminStub` (line 2080) so the harness
  surfaces a loud failure on regex drift.

## 3. 409 parsing key check

**PASS.** Hook reads `err?.body?.error || err?.body?.code` (hooks.js:361)
and the component reads `err?.body?.error || err?.body?.code` (RegenerateReelButton.jsx:59).
Both prefer `error` (the leader-confirmed backend shape) and gracefully
fall back to `code` if a different code-path delivers an older shape.
Mock backend emits `error` (mock-backend.js:303, 314). Production parity:
the toast will surface the specific copy on a real 409, not the generic
fallback.

## 4. Modal-primitive reuse audit

**PASS.** Inline `RegenerateConfirmModal` in `RegenerateReelButton.jsx`
consumes only the existing `modal-backdrop/panel/header/title/sub/footer`
CSS classes (all defined in `src/styles/surfaces.css`). Same shape as
`src/features/admin/CreateAgencyModal.jsx:41-43`. No new modal component
or CSS rule introduced; `git status` confirms no new `.css` file.

## 5. Acceptance checklist (from `feature_list.json` id=40)

- [x] `reelsApi.regenerateReel(agencyId, siteId, sourcePropertyId, reason?)`
      POST to the feature 40 endpoint (`api.js:197-203`).
- [x] `Render again` button visible in the header when
      `renderStatus ∈ {completed, done}` and `publish_status !== 'published'`
      (active state) — `RegenerateReelButton.jsx:34-43,79-89`.
- [x] Click → confirm modal with the documented copy
      (`RegenerateReelButton.jsx:113-115`).
- [x] On confirm: POST fires (`hooks.js:349-354`), badge `Re-rendering…`
      via shared `<RerenderBadge />` (`RegenerateReelButton.jsx:76-78`),
      poll of `render_status` every 1.5 s with cleanup (`hooks.js:334-341`).
- [x] 409 `REGENERATE_PUBLISHED_FORBIDDEN` → toast `"Cannot re-render a
      published reel"` (`RegenerateReelButton.jsx:60-62`).
- [x] 409 `REGENERATE_ALREADY_IN_FLIGHT` → toast `"A render is already in
      progress for this reel"` (`RegenerateReelButton.jsx:64-66`).
- [x] Button visible but `disabled` with explanatory tooltip when
      `publish_status === 'published'`
      (`RegenerateReelButton.jsx:35,83-84`, `PUBLISHED_TOOLTIP` constant).
- [x] Playwright tests: happy path + 409 published + 409 in-flight + cancel
      modal (`tests/manual_reel_regenerate.spec.js`, 4 specs × 3 viewports
      = 12 passed).
- [x] `npm run lint`, `npm run build`, `npm run test:smoke` green (see §6).

## 6. Verification re-run

- `./init.sh` → exit 0; lint verde, build verde, feature_list.json válido,
  sin TypeScript, sin libs prohibidas, sin VITE_ secretos.
- `npm run test:smoke` → **46 passed / 2 skipped, 37.3s** (the two
  pre-existing `theme` skips, same as prior reviews).
- `npx playwright test tests/manual_reel_regenerate.spec.js
  tests/per_reel_photos_override.spec.js tests/per_reel_subtitles_override.spec.js
  tests/per_reel_slides_override.spec.js` → **75 passed, 53.4s**
  (12 feature-40 specs + 18 photos + 27 subtitles + 18 slides; zero regression
  on features 35-37 post-sprint).

## 7. CHECKPOINTS

- C1 — Harness completo: [x]
- C2 — Estado coherente: [x] (sólo feature 40 en `in_progress` → ahora `done`).
- C3 — Código respeta arquitectura: [x]
  - Sin TypeScript (verificado por `init.sh §4`).
  - Sin React Query / MSW / Tailwind / styled-components / CSS-in-JS
    (verificado por grep + `init.sh §4`).
  - `RegenerateReelButton.jsx` no llama `fetch` directo — usa el hook
    (`useRegenerateReel`) → api (`reelsApi.regenerateReel`) →
    `lib/api/client.js`.
  - `shared/` no importa de `features/` (sin cambios en `shared/`).
  - `lib/` no importa de `features/`/`app/`/`shared/` (sin cambios en `lib/`).
  - `app/` sin lógica de dominio (sin cambios en `app/`).
- C4 — Verificación real: [x] lint + build + smoke + targeted e2e green.
- C5 — Mock = spec: [x] handler nuevo en `tests/support/mock-backend.js`
  con shape exacto + registrado en `isKnownAdminStub`.
- C6 — Sesión limpia: [x] sin `console.*`/`debugger` en el nuevo código;
  sin diff de `package.json` salvo el campo `license` (no es una dependencia).

## 8. Issues found

Ninguno bloqueante.

Nits no-bloqueantes (no requieren cambios):

1. La constante `errorCode` retornada por `useRegenerateReel` no se usa
   hoy en el `<RegenerateReelButton />` (que prefiere el throw + catch).
   El implementer la documenta como hook abierto a futuros consumidores
   (banner persistente, telemetría). No conflicta con la spec.
2. El botón también acepta `renderStatus === 'done'` además de
   `'completed'`. El implementer lo justifica por compatibilidad con la
   data seedeada del mock (que usaba `done` históricamente). Como el back
   feature 40 puede surfacear cualquiera de los dos según el caso real,
   el `COMPLETED_RENDER_STATUSES` Set queda como single chokepoint si el
   back se vuelve estricto.
3. El botón se oculta cuando `renderStatus === 'failed'` (no especificado
   en el spec). Extensión sensata; no rompe la spec ("visible cuando
   completed AND no published") porque sólo añade un caso extra de hide.

## 9. Open items para manual QA en :80

Manual QA contra el deployed instance (cuando el leader rebuilde dist):

1. Conectar agencia GHL con reels en `render_status='completed'` y
   `publish_status ∈ {pending, pending_review, needs-approval, ''}`.
2. Editor → header → confirmar botón `Render again` visible+activo.
3. Click → modal con copia documentada → `Cancel` cierra sin POST.
4. Reabrir → `Render again` → POST a `/regenerate` con body `{}` → 200 →
   badge `<RerenderBadge />` aparece junto al botón → poll 1.5 s al GET
   del reel → badge desaparece cuando back emite `render_status:
   completed`.
5. Segundo POST mientras el primero está pendiente → 409
   `REGENERATE_ALREADY_IN_FLIGHT` → toast con copia documentada.
6. Aprobar+publicar un reel → reabrir editor → botón visible+disabled con
   tooltip `"Re-rendering is disabled for published reels."`.
7. Forzar POST manual contra reel publicado vía DevTools → 409
   `REGENERATE_PUBLISHED_FORBIDDEN` → toast con copia documentada.

Verificar que el back feature 40 está desplegado en :80 antes de
empezar (el path debe responder; un 404 del path indica back no
deployado, no bug del front).

---

**Acción tras APPROVED:** feature 40 → `done` en `feature_list.json`;
línea de cierre añadida a `progress/current.md`.
