# Review — Defaults · Intro & outro: eliminar restricciones cliente (2026-05-20)

**Veredicto:** APPROVED

> Ad-hoc, no es feature nueva en `feature_list.json` (toca features 33+34, ambas
> `done`). Reporte del implementer:
> `progress/impl_unrestricted_intro_outro.md`.

## Verificaciones

- [x] `UploadVideoCard.jsx`: `MAX_BYTES`, `MAX_DURATION_S`, `MIN_DURATION_S`
      borradas (líneas 15-16 antiguas ya no existen). `handleFile` solo conserva
      el filtro MIME (line 125) y la rama `!Number.isFinite(durationS)` →
      `'Could not read video metadata'` (lines 134-138). El `try/catch` del
      probe también devuelve ese mismo mensaje.
- [x] Validación MIME sigue viva: `ACCEPTED_MIME` (line 14) + check en
      `handleFile`.
- [x] Manejo de fallo de probe sigue vivo (catch + branch NaN, ambas
      escupen `'Could not read video metadata'`).
- [x] Copy del dropzone actualizado a `"MP4 or MOV"` (UploadVideoCard.jsx:280);
      no menciona "10s" ni "50 MB".
- [x] `humaniseUploadError` solo mapea `INVALID_MIME`; ramas
      `FILE_TOO_LARGE` y `INVALID_DURATION` borradas.
- [x] Docstring del componente (líneas 41-50) reescrito para reflejar la
      ausencia de caps; explica que el probe sigue ahí solo como hint para
      el chip y que la única rama superviviente es el fallo de probe.
- [x] Slider eliminado: el bloque `<div className="field">` con el `<input
      type="range">` ya no existe en el JSX. Props `duration` /
      `setDuration` desaparecen de la firma de `UploadVideoCard`.
- [x] `IntroCard.jsx` / `OutroCard.jsx`: `durationLabel` y `durationHint`
      borrados de `*_COPY`.
- [x] `IntroOutroTab.jsx`: la desestructuración no extrae
      `introDuration`/`outroDuration` y ya no pasa `duration` /
      `setDuration` a las cards.
- [x] `initialState.js`: `introDuration: 2.5` y `outroDuration: 3`
      eliminados; comentario añadido explicando que `{kind}_duration_seconds`
      (ffprobe) es la fuente real.
- [x] Grep en `src/`: ningún componente referencia
      `introDuration`/`outroDuration`/`setIntroDuration`/`setOutroDuration`
      tras los cambios. Las únicas apariciones de `MAX_BYTES` en `src/` son
      en componentes ajenos (`LogoUploader.jsx`, `MusicLibrary.jsx`) con sus
      propios caps — fuera del alcance.
- [x] Rehidratación segura: `ReelDefaultsConfig.jsx:33-48` hace
      `{...INITIAL_DEFAULTS, ...persisted}`; si una agencia antigua tiene un
      blob `settings` con `introDuration`/`outroDuration`, esas keys
      sobreviven como propiedades extras del state sin romper nada, porque
      ningún consumidor las lee. El PUT (`buildDefaultsBody`,
      `hooks.js:96-110`) hace `settings: state` enterito, así que los keys
      huérfanos solo viajan de ida y vuelta sin efecto colateral.
- [x] Backend (`/opt/projects/4Reels-Backend/modules/configuration/`): solo
      escribe/lee `intro_duration_seconds` / `outro_duration_seconds`
      derivados de ffprobe (`defaults_router.py`, `intro_router.py`,
      `outro_router.py`). Nunca lee un `introDuration`/`outroDuration` del
      front. La justificación del implementer para eliminar el slider es
      correcta — era UI muerta.
- [x] Specs E2E rebrandeadas: nombres actuales reflejan la semántica
      positiva:
      - `oversized files pass client-side (no MAX_BYTES cap)` (intro+outro).
      - `long clips (>10s) pass client-side validation` (intro+outro).
      - `duration probe failure blocks submit` (intro+outro) — ahora
        inyecta `Promise.reject` y verifica `/metadata/i` en el error.
- [x] `npm run lint` → verde.
- [x] `npm run build` → verde (`✓ built in 2.56s`).
- [x] `npx playwright test agency_intro_upload agency_outro_upload
      --project=desktop` → **17 passed (11.4s)**.
- [x] `npm run test:smoke -- --project=desktop` → **16 passed, 5 skipped**
      (los 5 son `integration_smoke_e2e`, gated por
      `RUN_INTEGRATION_SMOKE=1`, comportamiento esperado).

## Por qué eliminar el slider es la decisión correcta

`state.introDuration` / `state.outroDuration` eran UI muerta: se serializaban
en el blob `defaults.settings` vía `buildDefaultsBody`, pero ningún otro
componente del front los lee, y el backend (`modules/configuration/`) solo
considera `{intro,outro}_duration_seconds` poblado por ffprobe en el upload.
Mantener un slider con `max=10` contradice el pedido del usuario; ampliarlo a
un valor arbitrario produciría una palanca sin efecto observable. La duración
real del clip ya se muestra en el chip del archivo cuando hay subida.

## Notas sobre el árbol de trabajo

`git status` muestra cambios ajenos a esta tarea en `DOCS.md`,
`SubtitlesTab.jsx`, `Dashboard.jsx`, `hooks.js`,
`reels_list_pagination.spec.js`, `brand_dynamic_fonts.spec.js`,
`subtitles_autocaptions.spec.js` y `mock-backend.js`, que corresponden a
otras tareas en curso del sprint (features 41 / pagesize / dynamic font
catalog — cada una con su propio `impl_*.md` no aún reviewado). Esta review
se limitó al diff de la tarea actual: `UploadVideoCard.jsx`, `IntroCard.jsx`,
`OutroCard.jsx`, `tabs/IntroOutroTab.jsx`, `initialState.js`,
`agency_intro_upload.spec.js`, `agency_outro_upload.spec.js`. Esos otros
diffs no rompen lint, build ni el smoke suite ejecutado, y no se solapan con
el código tocado por esta tarea.
