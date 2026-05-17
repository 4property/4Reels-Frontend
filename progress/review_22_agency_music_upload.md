# Review — feature 22 (agency_music_upload, frontend)

**Veredicto:** `APPROVED (code-complete, awaiting back deploy)`

> Importante: NO se marca la feature como `done` en `feature_list.json`.
> La feature declara `depends_on: 4Reels-Backend feature 22 desplegada en
> :8001` y la feature 22 del back está hoy `pending`. La calidad del
> código y el scope se aprueban; el cierre cross-repo queda pendiente
> del despliegue del back. Estado correcto: seguir en `in_progress`
> con la nota "code-complete, awaiting back deploy" (la decisión sobre
> `tests/music.spec.js` queda como follow-up — ver §"Decisión sobre
> tests/music.spec.js").

## Tabla de acceptance criteria

| # | Criterio | Estado | Nota |
|---|---|---|---|
| 1 | `MusicLibrary.jsx`: `<input type="file" accept="audio/mpeg,audio/mp4,audio/wav,audio/x-wav">` obligatorio + label `Audio file (mp3/m4a/wav, máx 20MB)` + `display_name` obligatorio + checkbox `is_default`. Eliminados `object_key` y `duration_seconds` del form. | ✅ | `MusicLibrary.jsx:175-198` cumple literal: `accept={ACCEPT_ATTR}` (= `audio/mpeg,audio/mp4,audio/wav,audio/x-wav`), label exacta `Audio file (mp3/m4a/wav, máx 20MB)`, `required`, `display_name` con `required`, `is_default` checkbox. El form de create ya no contiene `object_key` ni `duration_seconds`. |
| 2 | `api.js`: nuevo `uploadTrack(agencyId, formData)` → `apiRequest('/v1/admin/agencies/{id}/music/upload', {method:'POST', body: FormData})`. `listTracks`, `inspectTrack`, `reconfigureTrack`, `decommissionTrack` intactos. `registerTrack` retirado. | ✅ | `api.js:34-49` expone `uploadTrack`; el resto sigue. `grep -rn "registerTrack" src` = 0 hits. |
| 3 | `hooks.js`: `useUploadTrack` reemplaza `useRegisterTrack`; otros hooks intactos. | ✅ | `hooks.js:29-35`. `grep -rn "useRegisterTrack" src` = 0 hits. |
| 4 | Feedback de progreso (submit deshabilitado + "Uploading…"). | ✅ | `MusicLibrary.jsx:134-135,242-258` (submitDisabled + Spinner + "Uploading…"). El campo file y display_name también quedan `disabled={disabled || uploading}` para evitar dobles envíos. |
| 5 | Manejo de errores: 400 MIME → "Formato no soportado. Use mp3, m4a o wav."; 413 → "Archivo demasiado grande (máx 20MB)"; 400 MUSIC_TRACK_AUDIO_INVALID → "No se pudo procesar el audio (¿archivo corrupto?)"; otros 4xx → mensaje del backend. | ⚠️ | `MusicConfig.jsx:111-126` cubre 413, 400+MUSIC_TRACK_AUDIO_INVALID (con fallback a `body.hint`), 422 y el caso genérico (usa `body.message || body.error || err.message`). El criterio pedía el copy "Formato no soportado..." para el caso de **MIME inválido del backend**; el código devuelve ese copy en validación cliente (`MusicLibrary.jsx:74`) pero en el handler 400 server-side el mensaje cae bajo el `MUSIC_TRACK_AUDIO_INVALID` branch con copy ligeramente diferente ("No se pudo procesar el audio (¿archivo corrupto o formato no soportado?)."). Es coherente y accionable, no es bloqueante — los dos caminos cubren los dos casos reales. Lo dejo como nit (ver issue #N1). |
| 6 | Tras upload exitoso el listado muestra la nueva pista con `duration_seconds` derivado y `object_key` como identificador opaco no editable. | ✅ | `MusicLibrary.jsx:286-340`: la tabla mantiene columnas `Object key` y `Duration` en read-only; `td className="mono music-row-objectkey"` aplica `font-family: monospace` + truncado (`music.css:49-54`). |
| 7 | El editor (modo edit) solo permite cambiar `display_name` e `is_default`. `object_key`/`duration_seconds` aparecen como read-only. | ✅ | `MusicLibrary.jsx:140-172` (rama `isEdit`): el form sólo muestra display_name + is_default; `object_key` y `duration_seconds` siguen visibles en la tabla en read-only, no en el form. Cumple la intención del criterio. |
| 8 | Test Playwright `tests/playwright/music_upload.spec.js`: subir un .mp3, verificar que aparece con `duration_seconds > 0`. | ✅ | Test verde en los 3 viewports (desktop + tablet + mobile, ver §"Resultado de comandos"). Asserta `0:30` literal (mock pin) — `duration_seconds = 30 > 0`. También valida el header `multipart/form-data; boundary=` y que el body multipart viaja. |
| 9 | `grep -rn 'object_key' src/features/music` solo hits de lectura, no de escritura. | ✅ | 7 hits: 4 en comentarios JSDoc, 2 en lectura para search/tabla, 0 en escritura desde el form. |
| 10 | `grep -rn 'fetch(' src/features/music` devuelve 0 hits. | ✅ | 0 hits efectivos (único match es `refetch();` de `useApi`, no `fetch()` del browser). |
| 11 | `npm run lint` verde. | ✅ | `init.sh` paso 5 OK. |
| 12 | `npm run build` verde. | ✅ | `init.sh` paso 6 OK. |
| 13 | `npm run test:smoke` verde. | ✅ | 46 passed / 2 skipped (los 2 skips son `theme` en tablet/mobile, pre-existentes). |

## Scope check (archivos tocados vs scope declarado)

Scope declarado por el usuario al implementer:

- `src/features/music/`
- `tests/support/mock-backend.js`
- `tests/playwright/music_upload.spec.js`
- `tests/playwright/fixtures/sample-music.mp3`
- `src/features/music/music.css`

Archivos modificados / creados por el implementer (vs `HEAD`, excluyendo archivos
ya modificados por otros agentes/sesiones antes de feature 22):

| Archivo | Tipo | Dentro de scope |
|---|---|---|
| `src/features/music/api.js` | modificado | ✅ |
| `src/features/music/hooks.js` | modificado | ✅ |
| `src/features/music/MusicLibrary.jsx` | modificado | ✅ |
| `src/features/music/MusicConfig.jsx` | modificado | ✅ |
| `src/features/music/music.css` | modificado | ✅ |
| `tests/support/mock-backend.js` | modificado | ✅ |
| `tests/playwright/music_upload.spec.js` | creado | ✅ |
| `tests/playwright/fixtures/sample-music.mp3` | creado | ✅ |

Veredicto de scope: **limpio**. El implementer no tocó nada fuera de la
lista. Los otros archivos que `git status` muestra como modificados son
artefactos de sesiones anteriores (admin, automation, brand, reels,
session, social, etc.) y NO forman parte de esta feature.

## Reglas de arquitectura

| Regla | Resultado |
|---|---|
| Sin `fetch()` directo en componentes | ✅ — todo pasa por `musicApi.*` → `apiRequest`. |
| Sin TypeScript, React Query, MSW, styled-components, Tailwind, CSS-in-JS | ✅ — `init.sh` paso 4 verde; `package.json` solo añade `"license"` (cambio externo, no del implementer). |
| `apiRequest` soporta `FormData` sin `Content-Type` manual | ✅ — `client.js:56-70` detecta `body instanceof FormData` (`isMultipart`) y **omite** explícitamente la cabecera `Content-Type` para que el browser inyecte `multipart/form-data; boundary=...` con el boundary correcto. El test `music_upload.spec.js:62` asserta literal `^multipart\/form-data; boundary=`. |
| Layer rules respetadas (`features/music/` no importa de otros features) | ✅ — `MusicConfig.jsx:1-11` importa solo `react`, `shared/`, sus propios módulos y `session` (provider permitido como app concern). |
| Vanilla CSS en `music.css`, no en componentes | ✅ — único `style={{ overflow: 'hidden' }}` en el `<div className="card">` raíz (no es lógica de feature, es contención del card; lo dejo como nit ínfimo en issue #N2). |

## Calidad del código

- **Validación cliente sensata**: ✅ `MusicLibrary.jsx:67-87` valida MIME
  contra el whitelist y tamaño ≤ 20MB **antes** de hablar al back; si
  falla, limpia el input y muestra `music-file-error` con copy en español.
- **Mensajes de error legibles**: ⚠️ Ver issue #N1.
- **Sin `console.log` / `console.error` de debug**: ✅ — 0 hits en
  `src/features/music`.
- **Sin código muerto, sin TODOs sueltos**: ✅ — 0 hits TODO/FIXME/XXX
  en `src/features/music`. El JSDoc menciona "TODO mock-only" sólo en
  conventions, no en código real.
- **Form en modo "edit"**: ✅ — sólo `display_name` + `is_default`; el
  resto sigue en la tabla read-only.
- **Listado mantiene columnas `object_key` y `duration_seconds`**: ✅
  — `MusicLibrary.jsx:289-306`.

## Mock-backend

- **Handler `POST /music/upload`**: parsea multipart con un mini parser
  (`parseMultipartUpload`, `mock-backend.js:889-930`) **sin librerías
  nuevas** (split por boundary + regex sobre las headers del part).
  Funciona en latin-1 (Playwright decode), suficiente para extraer
  `display_name`, `is_default` y los metadatos del file. Confirmado:
  `git diff HEAD -- package.json` sólo añade `"license"` (cambio
  externo); ninguna dep nueva en deps/devDeps por el implementer.
- **`POST /music` sin `/upload` → 405**: ✅ con body
  `{error:'METHOD_NOT_ALLOWED', message:'Direct metadata POST retired.
  Use POST /v1/admin/agencies/{id}/music/upload.'}`. Decisión razonable
  y bien documentada (el back probablemente devolverá 405 por
  FastAPI). El scope permitía 405 o 404; 405 es el correcto cuando el
  recurso existe (GET activo) y solo el verbo cambia.
- **Shape de la 201 response**: ⚠️ El mock devuelve
  `{ status: 'created', agency_id, music_track: { music_id,
  **agency_id**, display_name, object_key, duration_seconds,
  is_default, created_at } }`. El acceptance del back declara
  `music_track: { music_id, display_name, object_key,
  duration_seconds, is_default, created_at }` — **sin `agency_id`
  dentro de `music_track`**. El front lo ignora (sólo consume
  `display_name`, `object_key`, `duration_seconds`, `is_default`,
  `created_at`, `music_id`), pero la divergencia con el back spec
  es un riesgo cross-repo si el back hace `extra='forbid'` también
  en respuestas (no es el patrón habitual de FastAPI; suele forbidear
  inputs, no outputs). Lo dejo como **risk cross-repo / nit follow-up**
  (issue #S1).

## Test Playwright `music_upload.spec.js`

- **Ejecuta verde en los 3 viewports**: ✅ 3 passed (desktop + tablet +
  mobile) en 7.0s.
- **Cubre el flujo real**: ✅ select file → display_name → submit →
  fila nueva con `0:30`. También valida que la request multipart
  realmente sale con `Content-Type: multipart/form-data; boundary=` y
  body no vacío.
- **No depende de :8001**: ✅ todo el routing va vía
  `installMockBackend(page, …)`; no hay llamadas reales al back.
- **Selectores robustos**: ✅ usa `getByRole('heading')`,
  `getByLabel('Display name')`, `getByRole('button', { name:
  /Upload track/ })`, `getByRole('row', { name: /Midnight Keys/ })`
  y `data-testid="music-upload-input"` para el file input (única vía
  con `setInputFiles`). Cumple `docs/conventions.md` § Tests
  Playwright.

## Fixture `sample-music.mp3`

- 10240 bytes con sync header MPEG (`FF FB 90 64`). Confirmado con
  `xxd tests/playwright/fixtures/sample-music.mp3 | head -1`.
- **Veredicto**: razonable. El mock no decodifica el audio (no corre
  ffprobe), valida sólo MIME por header del part; el back real ya
  validará seriamente con ffprobe cuando se despliegue. Generar un
  .mp3 real con ffmpeg/lame para el front es over-engineering — el
  back tendrá sus propios fixtures en `tests/integration/configuration/
  _fixtures/`. Confirmo la decisión del implementer.

## Decisión sobre `tests/music.spec.js`

`tests/music.spec.js` (de la feature 2) ejercita el form viejo
(`Object key`, `Duration`, `Register track`). Con feature 22 ese form
ya no existe y el spec **falla en los 3 viewports** (timeout en
`getByLabel('Object key')`). Confirmado: `npx playwright test
tests/music.spec.js` → 3 failed.

`npm run test:smoke` NO lo ejecuta (el filtro `playwright test smoke
flows` sólo corre `smoke.spec.js` y `flows.spec.js`), pero `npm run
test:e2e` **sí lo ejecuta y rompe** (4 failed: 3 son
`tests/music.spec.js`, 1 es `tests/templates.spec.js` mobile que es
flaky preexistente — re-run pasa en 649ms).

**Recomendación (follow-up, no bloqueante para esta feature):**
**actualizar** `tests/music.spec.js` para cubrir edit + delete contra
el nuevo flujo (el `create` ya queda cubierto por
`tests/playwright/music_upload.spec.js`; el viejo spec podría
reducirse a una variante CRUD: seed un track via mock, edit
display_name + is_default, delete). Está fuera del scope estricto que
recibió el implementer, así que **no le pido re-roll** — lo dejo como
nota de follow-up explícita en `progress/current.md` y en este review.

Alternativa más conservadora: **borrar** `tests/music.spec.js` (su
flujo de create lo cubre `music_upload.spec.js`; edit/delete son
triviales contra el mock y se pueden mover al spec nuevo o a un nuevo
`tests/music_crud.spec.js`). Mi preferencia es **actualizar**, pero
acepto cualquier camino — lo importante es que `npm run test:e2e`
quede verde antes de cerrar la feature como `done`.

## Resultado de los 5 comandos de verificación

| # | Comando | Resultado |
|---|---|---|
| 1 | `bash ./init.sh` | ✅ verde end-to-end (lint + build + checks de entorno). |
| 2 | `npm run test:smoke` | ✅ 46 passed / 2 skipped (skips de theme tablet/mobile, pre-existentes). |
| 3 | `npm run test:e2e` | ⚠️ 108 passed / 4 failed / 2 skipped. Las 4 fallidas son: 3× `tests/music.spec.js` (esperado — spec obsoleto, ver §"Decisión sobre `tests/music.spec.js`") y 1× `tests/templates.spec.js` mobile (flaky preexistente, pasa solo al re-correr). |
| 4 | `grep -rn "fetch(" src/features/music` | ✅ 0 hits efectivos (único match: `refetch();` del hook `useApi` en `MusicConfig.jsx:25`). |
| 5 | `grep -rn "registerTrack\|useRegisterTrack" src` | ✅ 0 hits. |

Comando extra solicitado (sólo el spec nuevo en los 3 viewports):

- `npx playwright test tests/playwright/music_upload.spec.js` → ✅ 3
  passed (desktop + tablet + mobile) en 7.0s.

## Issues

### Must-fix antes de merge

(ninguno)

### Should-fix follow-up

- **#F1 — `tests/music.spec.js` rompe `npm run test:e2e`.** Ver §"Decisión
  sobre `tests/music.spec.js`". Decisión recomendada: **actualizar** el
  spec al nuevo flujo (seed + edit + delete) en una tarea de follow-up
  (estimación: 15-20 min). Hasta entonces, `npm run test:e2e` no es
  verde end-to-end, lo cual bloquea el cierre como `done` aunque
  el back ya estuviera desplegado.
- **#F2 — Flakiness en `tests/templates.spec.js` mobile.** No es scope
  de esta feature, pero conviene anotarlo en `progress/current.md`
  como follow-up independiente para que un agente de mantenimiento
  lo investigue (probable race entre la mutation y la refetch del
  badge).

### Nits

- **#N1 — Copy "Formato no soportado" del backend (criterio 5).** El
  criterio pedía el copy literal "Formato no soportado. Use mp3, m4a
  o wav." para el caso 400 MIME inválido del **backend**. El
  implementer aplica ese copy en la validación cliente
  (`MusicLibrary.jsx:74`) y para el código `MUSIC_TRACK_AUDIO_INVALID`
  del back usa "No se pudo procesar el audio (¿archivo corrupto o
  formato no soportado?)." (`MusicConfig.jsx:120`). Ambos textos son
  coherentes y accionables — la mayoría de los rechazos por MIME
  llegarán a la validación cliente antes de tocar el back. Si se
  quiere paridad estricta con el criterio, cambiar
  `MusicConfig.jsx:120` a "Formato no soportado. Use mp3, m4a o wav."
  cuando `body.hint` esté ausente. Decisión: dejarlo como nit (no
  re-roll); el implementer puede arreglarlo en el follow-up #F1
  cuando re-tocque el área.
- **#N2 — `style={{ overflow: 'hidden' }}` inline en `MusicLibrary.jsx:138`.**
  Vanilla CSS recomienda moverlo a `music.css` (p. ej.
  `.music-card { overflow: hidden; }`). Es un nit ínfimo — el patrón
  ya existe en otras features del repo y `docs/conventions.md` lo
  permite "salvo cuando un valor es genuinamente dinámico". Aquí no
  es dinámico pero tampoco contamina nada. Lo dejo como nit
  opcional.

### Risks cross-repo

- **#S1 — `agency_id` dentro de `music_track` (mock vs back spec).**
  El mock fabrica `music_track.agency_id` pero el acceptance del back
  feature 22 no lo declara dentro del subobjeto. El front lo ignora,
  así que no rompe la UI; pero si el back hace una assertion estricta
  de output schema, el contrato divergirá. Acción sugerida: cuando
  el back implementer recoja su feature 22, confirmar el shape final
  y, si difiere del mock, ajustar el mock en una micro-tarea (es un
  cambio trivial, 1 línea: quitar el `agency_id` del literal en
  `mock-backend.js:272-286`).

## Nota técnica para futuras features de upload

`apiRequest` (`src/lib/api/client.js:56-70`) maneja `FormData`
correctamente: detecta `body instanceof FormData` y **omite**
explícitamente la cabecera `Content-Type` para dejar que el browser
inyecte `multipart/form-data; boundary=...`. La función `redact()`
trata `FormData` como `[formdata]` en los traces para no fugar binarios.
**Patrón canónico** para uploads desde el front:

1. Construir `FormData` en el componente (
   `formData.append('file', file, file.name)` + campos de texto).
2. Pasar el `FormData` como `body` al hook → api → `apiRequest`.
3. **No** setear `Content-Type` a mano en `headers` — rompería el
   boundary que el browser genera.

Documentado tanto en el cliente (`client.js:32-41`) como en este
review para que el próximo upload (audio waveform, video preview,
…) lo reutilice tal cual.

## Review del delta — segunda pasada `tests/music.spec.js`

**Veredicto del delta:** `APPROVED`

> Cierra el should-fix `#F1` del review original. La feature 22 sigue
> en `in_progress` (NO se marca `done` aquí) porque el cierre cross-repo
> sigue esperando el deploy de la feature 22 del backend en :8001 y la
> verificación manual contra :8001 (acceptance criteria del back).
> `#F2` (flake mobile de `tests/templates.spec.js`) **no se reprodujo**
> en esta corrida — pasó verde a la primera en los 3 viewports; queda
> como nota independiente de mantenimiento, no como bloqueante.
> `#S1` (`agency_id` dentro de `music_track` en el mock) **sigue
> vigente**: se ajustará cuando el back implementer toque su feature 22
> y confirme el shape final de la 201.

### Checks del delta

- ✅ **Scope estricto**: `git diff --stat HEAD -- tests/music.spec.js`
  → único archivo del delta, `52 lines changed (+37 / -15)`. Verificado
  contra `git status --short`: ningún otro archivo de feature 22
  (mock-backend.js, music.css, MusicLibrary.jsx, api.js, hooks.js,
  MusicConfig.jsx, music_upload.spec.js, fixtures/sample-music.mp3)
  ni de progress aparece movido en este delta respecto al estado
  post-primera-pasada. El implementer respetó "sólo `tests/music.spec.js`".
- ✅ **Imports reusan helpers existentes**:
  `agencyConnectedSession`, `installMockBackend`, `SAMPLE_AGENCY`,
  `SAMPLE_AGENCY_ID`, `seedAgencyLocalStorage` — todos importados
  desde `./support/mock-backend.js` (`tests/music.spec.js:1-8`).
  Cero imports nuevos del lado de fixtures.
- ✅ **`PRELOADED_TRACK` shape coherente con el mock**:
  `tests/music.spec.js:21-29` declara los 7 campos exactos que el mock
  setea en `defaultMusicTracks()` (`mock-backend.js:849-860`) —
  `music_id`, `agency_id`, `display_name`, `object_key`,
  `duration_seconds`, `is_default`, `created_at`. `installMockBackend`
  acepta `musicTracks: [...]` y reescribe `agency_id` al agency
  activo (`mock-backend.js:105-113`), lo cual es exactamente el patrón
  que ya usaban otros specs.
- ✅ **Cubre edit + delete, no create**: el `describe` se llama
  `'music library'` y el test `'edits and deletes a preloaded track'`.
  No hay paso de upload ni multipart en este spec — el create vive en
  `tests/playwright/music_upload.spec.js`. Sin duplicación de
  cobertura.
- ✅ **Selectores estables**: `getByRole('heading', { name: /Music/ })`,
  `getByRole('row', { name: /Midnight Keys/ })`,
  `getByLabel('Edit Midnight Keys')` / `getByLabel('Delete Midnight Keys
  Edit')` (matchean el `aria-label` literal de
  `MusicLibrary.jsx:320,329`), `getByLabel('Display name')` y
  `getByLabel('Default track')` (matchean `<label>` con
  `<span className="label">` en `MusicLibrary.jsx:142-170`),
  `getByRole('button', { name: /Save track/ })`
  (`MusicLibrary.jsx:254-255`). Cero CSS profundo / XPath. Cumple
  `docs/conventions.md § Tests Playwright`.
- ✅ **Empieza sin empty state, termina con empty state**:
  `expect(page.getByText('No music tracks yet.')).toHaveCount(0)` al
  arrancar y `expect(page.getByText('No music tracks yet.')).toBeVisible()`
  tras el delete (`tests/music.spec.js:44, 62`). El `toHaveCount(0)`
  final sobre la fila `getByRole('row', { name: /Midnight Keys/ })`
  (línea 63) es robusto frente a desmontaje del DOM — decisión
  correcta del implementer.
- ✅ **`is_default: false` → flip a `true` coherente con la UI**:
  `MusicLibrary.jsx:308-311` renderiza
  `<span className="badge accent">default</span>` cuando
  `is_default === true` y `<span className="badge">library</span>`
  en caso contrario. El spec asserta `library` antes del edit
  (línea 48) y `default` después (línea 58). El handler PUT del mock
  (`mock-backend.js:320-339`) mergea `{display_name, is_default}` del
  body. Flujo completo verificado.

### Resultado de los 4 comandos de verificación

| # | Comando | Resultado |
|---|---|---|
| 1 | `bash ./init.sh` | ✅ verde end-to-end (lint + build + checks de entorno). |
| 2 | `npx playwright test tests/music.spec.js` | ✅ 3 passed (desktop + tablet + mobile) en 7.4s. |
| 3 | `npx playwright test tests/playwright/music_upload.spec.js` | ✅ 3 passed en 7.1s — sin regresión del create flow. |
| 4 | `npm run test:e2e` (suite completa) | ✅ **127 passed / 2 skipped / 0 failed** en 1.6m. Coincide exacto con lo que reportó el implementer. Los 2 skips son los `theme` tablet/mobile preexistentes. |

### Issues nuevos del delta

(ninguno). El delta es quirúrgico, no introduce regresiones ni nuevos
nits sobre lo que ya quedó documentado en el review original.

### Estado final consolidado de la feature 22

- **Frontend code-complete**: ✅ — primer review APPROVED, delta APPROVED.
- **`#F1` (`tests/music.spec.js` rompe `test:e2e`)**: ✅ **cerrado** por
  este delta. Suite completa verde.
- **`#F2` (flake mobile `templates.spec.js`)**: ⚠️ no se reprodujo en
  esta corrida — queda como nota independiente de mantenimiento, no
  bloquea la feature 22.
- **`#S1` (`agency_id` dentro de `music_track` en el mock)**: ⚠️
  pendiente del deploy back para alinear el shape de la 201. Cambio
  trivial cuando se confirme el contrato real.
- **`#N1` y `#N2`** (copy ES "Formato no soportado" y `style={{ overflow }}`
  inline): nits opcionales del review original, sin movimiento.
- **`feature_list.json` status**: sigue `in_progress`. **NO** se marca
  `done` en este review — espera al back deploy en :8001 y a la
  verificación manual.
