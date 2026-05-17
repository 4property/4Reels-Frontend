# Feature 37 — per_reel_slides_override_ui (implementer report)

- **Feature en curso:** 37 — `per_reel_slides_override_ui`
- **Estado en `feature_list.json`:** `in_progress` (no marcado `done` por
  contrato del implementer — espera al reviewer).
- **Agente:** Claude (rol implementer)
- **Inicio:** 2026-05-15 ~21:55 IST

## 1. Refactor: `useReelDebouncedOverride` (3rd call-site)

**Extraído.** Nuevo hook compartido en
`src/features/reels/editor/useReelDebouncedOverride.js` que encapsula el
loop snapshot+debounce+flush+rollback+poll que `PhotosPanel` (feature 35) y
`SubtitlesPanel` (feature 36) duplicaban. `SlidesPanel` (feature 37) lo
consume desde el día uno.

### Signature

```js
useReelDebouncedOverride({
  reel,
  refetchReel,
  latest,             // editor state (array); tracked en ref para freshness
  debounceMs,         // 500 (photos/slides) | 1000 (subtitles)
  pollMs = 1500,
  patchFn,            // (latest) => Promise<unknown>; el caller construye el body
  rollback,           // (snapshot) => void; típicamente la setState
  validateLatest,     // opcional (latest) => bool; false ⇒ skip PATCH
  lockedErrorCode,    // 'PHOTOS_OVERRIDE_LOCKED' | 'SUBTITLES_OVERRIDE_LOCKED'
                      // | 'SLIDES_OVERRIDE_LOCKED'
  successText,        // feedback success copy
  fallbackErrorText,  // feedback danger fallback copy
})
=> {
  schedule,           // call after every local edit
  flushNow,           // fire immediately (no consumer usa hoy)
  feedback, setFeedback,
  clientLocked, serverLocked, setServerLocked,
  rerendering,        // true mientras renderStatus === 'pending'
}
```

### Consumidores

- **`PhotosPanel.jsx`** — re-wired. Body: `{photos:[{position,selected}]}`.
  `debounceMs: 500`, `lockedErrorCode: 'PHOTOS_OVERRIDE_LOCKED'`,
  `rollback: setPhotos`, success `'Re-rendering with new photo order…'`.
  Sigue exponiendo los mismos testIds (`photos-tab`, `photos-locked-banner`,
  `photos-rerender-badge`, `photos-feedback`, `photo-tile-*`) — los 18 specs
  de feature 35 pasan sin tocar.
- **`SubtitlesPanel.jsx`** — re-wired. Body: `{cues:[{index,text,in_seconds,out_seconds}]}`.
  `debounceMs: 1000`, `lockedErrorCode: 'SUBTITLES_OVERRIDE_LOCKED'`,
  `rollback: setSubtitles`, success `'Re-rendering with new subtitles…'`.
  El `validateCues` strict (in≥0, out>in, no overlap, 1≤len(text)≤200,
  índices monotónicos) sigue per-row dentro del panel y se pasa al hook
  vía `validateLatest` (skip PATCH si hay errores). 27 specs verde
  tras el refactor.
- **`SlidesPanel.jsx`** — nuevo wiring. Body: `{slides:[{slide_id,position,
  duration_seconds,kind, ...kind-specific}]}`. `debounceMs: 500`,
  `lockedErrorCode: 'SLIDES_OVERRIDE_LOCKED'`, `rollback: setSlides`,
  success `'Re-rendering with new slide order…'`.

### Por qué la extracción funciona limpia

- `validateLatest` cubre la asimetría del flujo de subtítulos (PATCH
  gated por validación cliente) sin filtrar al hook detalles de UI.
- El snapshot del rollback se captura en `latestRef.current` al primer
  `schedule()` del ciclo, no en `schedule(snapshot)` — así el caller no
  tiene que recordarlo.
- `lockedErrorCode` es parameter-driven; el hook compara con
  `err.body.error` y `err.body.code` (mismo dúo que usaban ambos paneles
  pre-extracción), y al detectarlo flipa `serverLocked`.

Cero ESLint warnings, cero regresión de los 45 specs combinados de
photos + subtitles tras la migración (`tests/per_reel_photos_override.spec.js`
y `tests/per_reel_subtitles_override.spec.js` pasan tal cual).

## 2. Archivos tocados

| Tipo | Path | Resumen |
|------|------|---------|
| hook | `src/features/reels/editor/useReelDebouncedOverride.js` | Nuevo. Hook compartido optimistic+debounce+rollback+poll. |
| component (refactor) | `src/features/reels/editor/PhotosPanel.jsx` | Re-wire al hook compartido; toda la lógica del debounce sale del panel. ~70 LOC más cortos. |
| component (refactor) | `src/features/reels/editor/SubtitlesPanel.jsx` | Re-wire al hook compartido; `validateCues` se mantiene per-row + se pasa por `validateLatest`. |
| component (rewrite) | `src/features/reels/editor/SlidesPanel.jsx` | Antes era state-local stub; ahora conectado a PATCH. Debounce 500 ms, optimistic + rollback, locked banner, rerender badge, warning amarillo/rojo sobre target_duration, "unknown kind" guard. |
| component | `src/features/reels/editor/SlideRow.jsx` | Acepta `disabled` (deshabilita inputs/toggle/buttons + bloquea drag) y `dataTestid` para los E2E. |
| component | `src/shared/Toggle.jsx` | Acepta `disabled` opcional (se reenvía al `<button>`). |
| wiring | `src/features/reels/editor/ReelEditor.jsx` | Hidrata `slides` desde `reel.manifestOverride` → `DEFAULT_SLIDES`; pasa `agencyId`/`reel`/`refetch`/`targetDurationSeconds` al panel; tab `slides` deja de ser `stub: true` (sin badge `preview`); quita el wrapper `feature-stub`. |
| css | `src/features/reels/editor/editor.css` | Nuevos estilos `.slides-tab`, `.slides-feedback{,-success,-warning,-danger}`, `.slides-row-error`, `.slide-row-locked`. Reusa tokens existentes. |
| api | `src/features/reels/api.js` | Nuevo `reelsApi.patchReelSlides(agencyId, siteId, sourcePropertyId, slides)` → PATCH `/slides`. Body `{slides}`; acepta array, `null`, `[]`. |
| hook | `src/features/reels/hooks.js` | Nuevo `useReelSlidesOverride()`; `useReel` adapter expone `manifestOverride` (array \| null) y `targetDurationSeconds` (number \| null). |
| mock | `tests/support/mock-backend.js` | Handler PATCH `/slides`. `extra='forbid'` wrapper; per-item validation (kind ∈ allowed set; duration_seconds > 0; `text` requires `text` field; `google-review` requires `url` + `status`); ceiling 1.5×target → 422; 409 `SLIDES_OVERRIDE_LOCKED` si workflow_state ∈ {approved, published}; 200 retorna `{manifest_override, render_status:'pending'}` y flipa a `'done'` tras ~200 ms. GET reel surfacea `manifest_override:null` y `target_duration_seconds:30` por default. Path nuevo en `isKnownAdminStub`. |
| tests | `tests/per_reel_slides_override.spec.js` | 6 escenarios × 3 viewports = **18 specs**. |
| docs | `DOCS.md` | Nueva sección "Per-reel slides override (feature 37)" en § Backend contract, simétrica a las de fotos/subtítulos. |

## 3. Mock handler changes

**New route:** `PATCH /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/slides`.

- `extra='forbid'` en el wrapper (solo `slides`).
- Per-item validation discriminated-union-style:
  - `slide_id:str`, `position:int`, `duration_seconds:float`, `kind:str` requeridos.
  - `kind ∈ {intro-video, outro-video, google-review, text, photo}` — desconocido → 422 con `loc:['body','slides',i,'kind']`.
  - `duration_seconds > 0` — si no → 422.
  - `kind == 'text'` ⇒ requiere `text:str`; si no → 422.
  - `kind == 'google-review'` ⇒ requiere `url:str` + `status:str`; si no → 422.
- Ceiling agregado: `sum(duration_seconds) ≤ 1.5 × target_duration_seconds`. Si excede → 422 con `loc:['body','slides']`. `target_duration_seconds` se lee del reel (default 30 s).
- 409 `SLIDES_OVERRIDE_LOCKED` cuando `workflow_state ∈ {approved, published}` o `publish_status === 'published'`.
- 404 `ADMIN_REEL_NOT_FOUND` cuando el tuple no existe.
- Persiste `manifest_override` en el reel in-memory. `setTimeout(200)` flipa `render_status` `pending → done` para que el badge sea transitorio en E2E.
- GET reel inspector ahora surfacea `manifest_override:null` y `target_duration_seconds:30` por default (un test puede seedear ambos).
- `isKnownAdminStub` matchea `…/reels/{site}/{prop}/slides` para que el path "passes through" al handler dedicado en lugar de caer al stub genérico de 200 OK.

## 4. DOCS.md update

Añadido el bloque "Per-reel slides override (feature 37)" tras el bloque de subtítulos (líneas ~320 en DOCS.md). Cubre:

- Endpoint y body shape completos (`{slide_id, position, duration_seconds, kind, ...kind-specific}`).
- Discriminated-union de `kind` con los campos extra requeridos per-kind.
- Ceiling 1.5× target (back hard-cap) y la convención cliente: warning amarillo si excede target, danger si excede 1.5×target, ninguno bloquea.
- Respuesta 200 `{manifest_override, render_status:'pending'}`; reusa el mismo `Re-rendering…` badge primitive que feature 35/36.
- 422 (unknown kind / missing kind-fields / sum > 1.5×target), 404, 409 `SLIDES_OVERRIDE_LOCKED` con la misma copy compartida.
- GET reel inspector surfaces `manifest_override` y `target_duration_seconds`.
- Save mode: 500 ms debounce, sin botón Save.

## 5. Tests añadidos + confirmación regresión photos/subtitles

**Nuevos** `tests/per_reel_slides_override.spec.js` — 6 specs × 3 viewports = **18 specs**:

1. **Drag-to-reorder → ONE PATCH** con los `slide_id`s en el nuevo orden (`position:[0,1,2]` re-asignado por index). El primer row (sl1) acaba en última posición.
2. **Edit duration → ONE PATCH** con el `duration_seconds` actualizado y kind-specific fields preservados (`text: 'New price!'` sigue ahí).
3. **Múltiples edits <500 ms colapsan en 1 PATCH** — tres fills consecutivos reflejan el estado final (no un queue de diffs).
4. **Sum > target → warning amarillo + PATCH still fires** — target=7 s, suma=8.5 s ∈ (7, 10.5) ⇒ banner `slides-duration-warning` con clase `slides-feedback-warning`; un edit posterior sigue disparando PATCH (no se bloquea).
5. **Approved reel: locked banner + sin PATCH** — `slides-locked-banner` con la copy compartida, slider deshabilitado, cero PATCHes tras 900 ms de espera.
6. **PATCH 500 → rollback + feedback** — el slider muestra el valor optimistic mientras el flush vuela; al fallar vuelve al snapshot y el banner `slides-feedback` muestra el mensaje del back.

**Regresión photos/subtitles:** tras el refactor de `useReelDebouncedOverride`, los 45 specs combinados de feature 35 + 36 pasan sin tocar.

| Step | Result |
|---|---|
| `tests/per_reel_slides_override.spec.js` (aislado) | **18 passed** (6 × 3 viewports) |
| `tests/per_reel_photos_override.spec.js` (aislado) | **18 passed** — confirma 0 regresión post-refactor |
| `tests/per_reel_subtitles_override.spec.js` (aislado) | **27 passed** — confirma 0 regresión post-refactor |
| Combinado de los 3 | **63 passed** |

## 6. Verificación

| Step | Result |
|---|---|
| `./init.sh` | exit 0 (lint + build green; 31 features detected; no TypeScript leaks; sin libs blocked) |
| `npm run lint` | green (no warnings) |
| `npm run build` | green — `dist/assets/index-*.css 130.76 kB`, `dist/assets/index-*.js 425.28 kB` |
| `npm run test:smoke` | **46 passed / 2 skipped** (los 2 `theme` skips pre-existentes) |
| `npm run test:e2e tests/per_reel_slides_override.spec.js tests/per_reel_subtitles_override.spec.js tests/per_reel_photos_override.spec.js` | **63 passed** (18 slides + 27 subtitles + 18 photos) |
| `npm run test:e2e` (full suite, 324 specs) | **322 passed / 2 skipped / 0 flake** |

Diff vs baseline (feature 36 cierre: 303 → 322): **+18 nuevos specs de slides + 0 regresión**. Cero flake en esta corrida (el flake intermitente de `social_templates.spec.js` no apareció).

## 7. Open items para el reviewer

- **Slides hidrata desde override only.** El back no surface aún un
  `publish_target_snapshot.slides` equivalente al de subtítulos (no existe
  en el contrato). Cuando `manifestOverride` es null, el panel cae a
  `DEFAULT_SLIDES` (intro+outro shipped) — es el comportamiento que el
  spec impone. Si en el futuro el back añade snapshot, hidratarlo se
  añade en `hydrateSlides()` en una sola línea.
- **`SlidesPanel.buildSlidesBody`** filtra slides con `kind` desconocido
  ANTES de mandar el PATCH (el panel también muestra una inline-row error
  pidiendo al usuario que los elimine). Decisión defensiva: prefiero no
  enviar al back algo que sé que va a 422; el usuario ve el error inline
  y limpia el state. Si el reviewer prefiere "mandalo y deja que el back
  decida" lo cambio a un punto de validateLatest en lugar de un filter.
- **Toggle disabled propagation** — `src/shared/Toggle.jsx` ganó un prop
  `disabled` (default false). Es retro-compatible (todos los call sites
  existentes lo omiten). Si el reviewer prefiere extraer el "disabled
  state" en CSS solo, podría revertirse — pero como el botón nativo es
  un `<button>` el `disabled` HTML attribute es más limpio (también
  bloquea el `onClick` automáticamente).
- **`SlideRow.dataTestid` prop** — el spec necesitaba selectores estables
  per-row (`slide-row-0`, `slide-row-0-duration`, etc.); el SlideRow
  existente no exponía testIds. La extension es no-disruptiva (cuando
  `dataTestid` es `undefined`, el atributo no se emite).
- **Mock-backend ceiling vs panel warning** — el mock hace cumplir
  `sum > 1.5×target ⇒ 422`. El panel muestra warning rojo cuando supera
  ese umbral, pero igualmente envía el PATCH (cliente NO bloquea, mirrors
  la spec). En E2E para forzar el warning sin chocar contra el ceiling
  del mock, el spec `sum > target` usa `target=7 s` con suma 8.5 s
  (>target pero <1.5×target=10.5). Si el reviewer quiere un test extra
  específico del path 422 server-side, se añade fácil con un `page.route`
  override.

## 8. Manual QA checklist para `:8001`

(Back feature 37 debe estar deployada antes — `feature_list.json` id=37 depende de back 37.)

1. Abrir `https://4reelsback-test.4property.com/reels/{site}/{prop}` para un reel en `workflow_state ∈ {pending, awaiting_review}`.
2. Cambiar al tab **Slides**. Las rows hidratan desde `manifest_override` (o el seed `DEFAULT_SLIDES` si no hay override).
3. **Reorder**: drag-to-reorder de la primera row al final → tras ~500 ms una request `PATCH …/slides` con `{slides:[...]}` con `position:[0,1,2]` (slide_id reasignado al final). Status 200, badge `Re-rendering…` aparece.
4. **Edit duration**: mover el slider de una row → tras ~500 ms el PATCH lleva el `duration_seconds` nuevo. Badge re-aparece.
5. **Toggle**: flipar enabled → tras ~500 ms el PATCH lleva `enabled:false`. Badge re-aparece.
6. **Add slide**: click "Add slide" → menú → "Text slide" → row nueva visible y PATCH dispara con la nueva entry.
7. **Add Google review**: click "Add slide" → "Google review" → modal abre. Pegar URL + Save → row toma `status:'generated'` y PATCH lleva el `kind:'google-review'` con `url`, `status`, `rating`, `author`.
8. **Sum > target**: editar durations para que la suma supere `target_duration_seconds` → warning amarillo bajo el badge ("Slides exceed target duration"). El PATCH sigue saliendo.
9. **Sum > 1.5 × target**: subir aún más las durations → warning rojo ("Slides exceed 1.5× target duration"). PATCH sale, back debería responder 422 — el feedback muestra el `detail[0].msg` del back.
10. **Reload editor**: las edits previas persisten porque hidratamos de `manifest_override`.
11. **Esperar a que el worker termine**: `render_status: done` → badge desaparece.
12. **Aprobar el reel** (botón "Approve & Publish"). Volver al editor → tab Slides: banner rojo `Cannot edit a reel that has already been approved` arriba; sliders, toggles y botones deshabilitados; cero PATCHes en DevTools.
13. **Edge — back-end-only 409**: si otro usuario aprueba el reel mientras estás editando, el back devolverá 409 en el siguiente PATCH; el banner debería aparecer inmediatamente sin recargar.
14. **Edge — múltiples edits rápidos**: hacer 3+ cambios en <500 ms — exactamente UNA request `PATCH …/slides` en DevTools/Network con el snapshot final.
