# Impl — Defaults · Intro & outro: eliminar restricciones cliente (2026-05-20)

> Tarea ad-hoc (no es una entrada nueva en `feature_list.json`; toca el código
> de las features 33 + 34, ambas `done`). Pedido del usuario: levantar TODOS
> los topes cliente (size ≤ 50 MB, duración ∈ [1, 10] s) y la copy/UI asociada,
> manteniendo MIME y el probe local como hint para el chip.

## Resumen ejecutivo

- Eliminadas las constantes `MAX_BYTES`, `MAX_DURATION_S`, `MIN_DURATION_S` y
  sus checks en `handleFile`. Solo queda el filtro MIME y una rama "Could not
  read video metadata" que dispara cuando el probe rechaza o devuelve NaN.
- Eliminado el slider `Intro/Outro duration` (1–10 s, step 0.5) del card y la
  pareja `introDuration`/`outroDuration` de `INITIAL_DEFAULTS`. Justificación
  en §"Decisión sobre el slider" más abajo.
- Copy del dropzone: `"Max 10s · MP4 or MOV · 50 MB"` → `"MP4 or MOV"`.
- `humaniseUploadError` ya no traduce `FILE_TOO_LARGE` ni `INVALID_DURATION`
  (el back no los devuelve más); se mantiene la rama `INVALID_MIME`.
- Specs E2E adaptadas: las pruebas de rechazo por tamaño y por duración se
  reescribieron como pruebas de "pasa el upload aunque sea grande/largo" (la
  semántica positiva del cambio). El test "duration probe failure blocks
  submit" pasa a inyectar un probe que `Promise.reject`ea para cubrir la
  única rama de validación de duración que sobrevive.
- Lint + build + 17/17 specs de intro/outro + smoke (16 passed, 5 skipped por
  `integration_smoke_e2e` que requiere `RUN_INTEGRATION_SMOKE=1`) + payload
  contract (2/2) verdes.

## Archivos tocados

| Archivo | Tipo | Cambios |
|---|---|---|
| `src/features/defaults/UploadVideoCard.jsx` | componente | borradas constantes de tamaño/duración, borrados los dos checks numéricos en `handleFile`, borrado el bloque del slider del JSX, simplificado `humaniseUploadError`, copy del dropzone actualizado, docstring del componente reescrito |
| `src/features/defaults/IntroCard.jsx` | componente | borradas `durationLabel` y `durationHint` de `INTRO_COPY` (ya no las consume nadie) |
| `src/features/defaults/OutroCard.jsx` | componente | borradas `durationLabel` y `durationHint` de `OUTRO_COPY` |
| `src/features/defaults/tabs/IntroOutroTab.jsx` | composición | desestructuración ya no extrae `introDuration`/`outroDuration`; cards ya no reciben `duration`/`setDuration` |
| `src/features/defaults/initialState.js` | estado | borradas `introDuration: 2.5` y `outroDuration: 3` del seed; añadido comentario que explica que la duración real vive en `{kind}_duration_seconds` (ffprobe) |
| `tests/agency_intro_upload.spec.js` | E2E | reemplazado test de "blocks oversized" por test de "oversized files pass" (POST se dispara con file.size=100 MB patched); añadido test "long clips (>10s) pass" con probeSeconds=30 + `introDurationOverride: 30`; test "duration probe failure" reescrito para inyectar un probe que rechaza; docstring del archivo actualizado |
| `tests/agency_outro_upload.spec.js` | E2E | mismas tres adaptaciones espejo para outro |
| `progress/impl_unrestricted_intro_outro.md` | reporte | este archivo |

## Decisión sobre el slider

**Acción tomada:** eliminado completo. No queda label ni control alguno de
"Intro/Outro duration" en el card.

**Razonamiento:**

1. El slider escribía a `state.introDuration` / `state.outroDuration`. El
   parent (`ReelDefaultsConfig`) hace `buildDefaultsBody(state)` y pasa
   `settings: state` enterito al PUT /defaults. Es decir, el valor SÍ se
   serializaba, pero como blob namespaced bajo `defaults.settings`.
2. Grep exhaustivo (`grep -rn "introDuration\|outroDuration\|intro_duration\|
   outro_duration" src/ tests/`) confirma que **nadie lee** ese
   `state.introDuration` / `state.outroDuration` de vuelta:
   - El render del clip en backend usa `{intro,outro}_duration_seconds`,
     poblado por ffprobe.
   - El propio frontend, al rehidratarse desde GET /defaults, sobreescribe el
     slider con el último valor del blob `settings`, pero ningún otro
     componente lo consulta (ni el editor de reels, ni la API del back, ni
     ningún hook).
3. Mantener el slider con `max=10` contradice directamente la pedida del
   usuario; subirlo a un número arbitrario (60 s) sería UI muerta — el
   operador no tiene forma de saber a qué afecta porque no afecta a nada.
4. El campo `{kind}_duration_seconds` (la duración real probed/ffprobe) ya
   se muestra dentro del chip del archivo cuando hay clip subido —
   conserva la información útil al usuario.

Los keys `introDuration`/`outroDuration` viejos en blobs persistidos siguen
deserializando sin error (el spread `{...INITIAL_DEFAULTS, ...persisted}` los
deja entrar como propiedades extra del state aunque ya no haya UI que los
escriba). No se rompe compat con agencias antiguas.

## Cambios en validación cliente

| Antes | Después |
|---|---|
| MIME ∈ {video/mp4, video/quicktime} | igual (sin cambio) |
| `size > 50MB` → "File must be ≤50MB" | sin tope |
| `probe()` rechaza → "Could not read video metadata" | igual |
| `!isFinite(d) \|\| d > 10 \|\| d < 1` → "Duration must be 1–10s" | solo `!isFinite(d)` → "Could not read video metadata" |
| `humaniseUploadError` trata FILE_TOO_LARGE / INVALID_DURATION | solo INVALID_MIME |

## Verificación

```
$ ./init.sh
…
[OK]    lint verde
[OK]    build verde
[OK]    Entorno listo.

$ npx playwright test agency_intro_upload agency_outro_upload --project=desktop
17 passed (11.6s)

$ npm run test:smoke -- --project=desktop
5 skipped (integration_smoke_e2e — gated por RUN_INTEGRATION_SMOKE)
16 passed (26.6s)

$ npx playwright test payload_contract --project=desktop
2 passed (7.8s)
```

## Cosas que NO se han tocado (alcance honesto)

- `tests/support/mock-backend.js` sigue exponiendo `introDurationOverride` /
  `outroDurationOverride` (era utilidad de test ya existente, sigue siendo
  útil y los specs nuevos lo usan).
- El backend NO se ha tocado (este repo es solo frontend). Las pruebas
  asumen que el server real también ha levantado las restricciones
  (`FILE_TOO_LARGE` / `INVALID_DURATION`); si no, el back devolverá un 4xx
  con `code` que `humaniseUploadError` propaga como `msg || 'Failed to
  upload.'` — el usuario verá el detalle textual del back.
- `feature_list.json` no se ha modificado: las features 33/34 siguen
  `done`. Esta es una modificación post-feature de su comportamiento, no
  una feature nueva.

## Reviewer

Pendiente. Mi recomendación al `reviewer`: focalizar en (a) que ningún
import o componente externo siga esperando los props `duration` /
`setDuration` en `UploadVideoCard` (grep ya hecho — limpio), (b) que la
rehidratación de `settings` con blobs viejos no rompe (los keys huérfanos
en `state` no se usan en ningún sitio post-cambio), (c) que el copy nuevo
del dropzone es lo bastante informativo.
