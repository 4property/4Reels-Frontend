# Impl 22 — agency_music_upload (frontend)

> Feature 22 del frontend, ejecutada como `implementer` invocado por el leader.
> Estado al cerrar la sesión: implementada, **revisión pendiente**.
> Cross-repo: la feature 22 del backend **no está desplegada todavía**
> en :8001; este frontend se valida contra `tests/support/mock-backend.js`.

## Resumen de cambios

| Archivo | Tipo | Resumen |
|---|---|---|
| `src/features/music/api.js` | api | Reemplaza `registerTrack` por `uploadTrack(agencyId, formData)` → POST `/v1/admin/agencies/{id}/music/upload`. `listTracks`, `inspectTrack`, `reconfigureTrack`, `decommissionTrack` intactos. |
| `src/features/music/hooks.js` | hook | `useRegisterTrack` → `useUploadTrack({ agencyId, formData })`. Resto de hooks (tracks, reconfigure, decommission, inspect) sin cambios. |
| `src/features/music/MusicLibrary.jsx` | component | Form de alta reescrito: `<input type="file" accept="audio/mpeg,audio/mp4,audio/wav,audio/x-wav">` obligatorio, `display_name` obligatorio, checkbox `is_default`. Eliminados los campos `object_key` y `duration_seconds` del form. El form en modo edit muestra sólo `display_name` + `is_default` (no se puede tocar `object_key`/`duration_seconds`). La tabla del listado mantiene las dos columnas (`Object key` y `Duration`) leyendo del back en read-only. Validación cliente: MIME contra el whitelist + tamaño ≤ 20MB. Spinner + "Uploading…" mientras el upload está en curso; submit deshabilitado. |
| `src/features/music/MusicConfig.jsx` | component | Sustituidas las referencias a `useRegisterTrack` por `useUploadTrack`. El handler `onCreate` ahora recibe `FormData` (no JSON). Helper nuevo `humanizeMusicError` que mapea 413, 400 `MUSIC_TRACK_AUDIO_INVALID` y 422 a copy en español tal como pide el scope. |
| `src/features/music/music.css` | css | Grid del form actualizado para 4 columnas (file / name / default / actions). Estilos nuevos: `.music-form-file`, `.music-form-name`, `.music-file-name` (nombre del archivo seleccionado), `.music-file-error` (validación cliente), `.music-row-objectkey` (truncado en la celda de la tabla). Media query 560 simplificada (sin `.music-form-duration`). |
| `tests/support/mock-backend.js` | mock | Handler de `/music` ampliado para gestionar `POST /music/upload` (multipart): parsea el body con un mini parser (sin libs nuevas), valida MIME contra el mismo set que el front, devuelve 201 con el shape del back (`{status:'created', agency_id, music_track:{music_id, agency_id, display_name, object_key, duration_seconds:30, is_default, created_at}}`). El POST a `/music` sin `/upload` ahora devuelve **405 METHOD_NOT_ALLOWED** con mensaje apuntando al endpoint de upload (decisión documentada abajo). |
| `tests/playwright/music_upload.spec.js` | test (nuevo) | Cargar `/music`, hacer `setInputFiles` con la fixture .mp3, rellenar display name, submit, verificar que (a) el POST multipart sale con `Content-Type: multipart/form-data; boundary=...`, (b) la nueva fila aparece en la lista con `0:30` (duración pinned del mock). |
| `tests/playwright/fixtures/sample-music.mp3` | fixture (nuevo) | Archivo de 10240 bytes con sync header MPEG (`0xFF 0xFB 0x90 0x64`) seguido de relleno. No se valida la integridad del audio en el mock — el back real lo validará en su feature 22. |

## Decisiones tomadas

1. **Mock retire del POST metadata-only**: devuelve `405 METHOD_NOT_ALLOWED` con un mensaje que apunta al endpoint `/music/upload`. El scope permitía 405 o 404; elegí 405 porque (a) la ruta existe (GET sigue activo para list), sólo el verbo POST cambia, y (b) el body de error con `{error:'METHOD_NOT_ALLOWED', message:'Direct metadata POST retired. Use POST .../music/upload.'}` deja una pista accionable si un cliente futuro intenta caller el endpoint antiguo. El back real probablemente devolverá lo mismo (FastAPI 405 nativo).
2. **Fixture .mp3 como placeholder, no como audio real**: el archivo de 10KB tiene sync header MPEG pero no audio decodificable. Es suficiente porque el mock-backend valida sólo MIME (vía la cabecera `Content-Type` del part) y no corre ffprobe. El back real ya hará la validación seria en su feature 22 cuando se despliegue. Se descartó añadir un mp3 codificado real (no quiero ramas en el repo con assets binarios decodificables sin necesidad). El nombre del archivo `sample-music.mp3` + Playwright `setInputFiles(path)` provoca que el browser sniffee el MIME como `audio/mpeg`, que pasa el filtro.
3. **`duration_seconds` pinned a 30 en el mock**: el back real lo deriva con ffprobe, imposible de replicar en Node sin spawnar ffprobe. 30s es un valor representativo y el test asserta `0:30` literal en la tabla.
4. **Mini parser multipart en el mock**: implementado con `string.split(boundary)` en vez de añadir `busboy` u otra lib. El parser sólo extrae `display_name`, `is_default` y los metadatos del `file` (filename + MIME) — no necesita el body binario porque el mock no lo persiste. Esto mantiene `package.json` intacto (sin libs nuevas).
5. **`tests/music.spec.js` queda obsoleto pero NO se toca**: ese spec (de la feature 2) ejercita el form viejo (`Object key`, `Duration`, botón `Register track`). Con esta feature el form ya no existe, así que el spec falla. **No lo he tocado** porque el scope del usuario es estricto: sólo los archivos enumerados. El reviewer/leader debería decidir si retirar `tests/music.spec.js` (su flujo de create queda cubierto por `music_upload.spec.js`; los flujos de edit/delete podrían moverse al spec nuevo o quedarse en uno separado dedicado a CRUD). El comando `test:smoke` NO ejecuta `tests/music.spec.js` (el filtro es "smoke flows"), así que la sesión cierra con los 5 checks de verificación verdes; pero `npm run test:e2e` rompería hasta resolverlo.

## Resultado de los 5 checks de verificación

| # | Check | Resultado |
|---|---|---|
| 1 | `bash ./init.sh` (lint + build + smoke setup) | **OK** — entorno listo, lint verde, build verde. |
| 2 | `npm run test:smoke` | **OK** — 46 passed / 2 skipped (los 2 `theme` preexistentes que llevan tiempo skipeados). |
| 3 | `npx playwright test tests/playwright/music_upload.spec.js` | **OK** — 3 passed (desktop + tablet + mobile). |
| 4 | `grep -rn "fetch(" src/features/music` | **OK (0 hits efectivos)** — único match es `refetch();` en `MusicConfig.jsx:25`, que es el hook local `useApi.refetch`, no la API `fetch()` del browser. |
| 5 | `grep -rn "registerTrack" src/features/music` | **OK** — 0 hits. También `useRegisterTrack` retirado de todo el src/. |

## Bloqueos encontrados

Ninguno crítico. Único punto a decidir: ver decisión 5 arriba sobre
`tests/music.spec.js`. La feature queda funcional contra el mock y lista
para verificación manual contra :8001 una vez se despliegue la feature 22
del back.

## Segunda pasada — `tests/music.spec.js`

> Ejecutada por el implementer (segunda invocación) el 2026-05-14 como
> follow-up should-fix #F1 del review. Scope estrictamente limitado a
> `tests/music.spec.js`. NO se tocaron ni `tests/support/mock-backend.js`
> (su contrato `musicTracks` precargados quedó cerrado en la primera
> pasada), ni la feature `src/features/music/*`, ni `music_upload.spec.js`,
> ni `feature_list.json`.

### Resumen del cambio

`tests/music.spec.js` se reorientó al flujo nuevo. El escenario
unificado de la feature 2 ("lists, creates, edits and deletes tracks")
quedó descompuesto entre dos specs:

| Spec | Cubre |
|---|---|
| `tests/playwright/music_upload.spec.js` | create (file input + multipart upload). |
| `tests/music.spec.js` (este delta) | edit + delete sobre un track precargado vía `installMockBackend({ musicTracks: [...] })`. |

Contenido del nuevo `music.spec.js`:

1. `seedAgencyLocalStorage` + `installMockBackend(page, { agencies:
   [SAMPLE_AGENCY], ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
   musicTracks: [PRELOADED_TRACK] })` con un track precargado
   `Midnight Keys` (`is_default: false`, `duration_seconds: 42`, …).
2. Carga `/music`, verifica heading `Music`, ausencia del empty state
   y presencia de la fila con `0:42` + badge `library`.
3. Edit: `getByLabel('Edit Midnight Keys').click()` →
   `getByLabel('Display name').fill('Midnight Keys Edit')` →
   `getByLabel('Default track').check()` →
   `getByRole('button', { name: /Save track/ }).click()`. Verifica
   que la fila renombrada es visible y muestra el badge `default`.
4. Delete: `getByLabel('Delete Midnight Keys Edit').click()` →
   verifica `No music tracks yet.` y `count(0)` de cualquier fila
   `Midnight Keys`.

### Decisiones (segunda pasada)

1. **`is_default: false` en el track precargado**: lo dejé en `false`
   adrede para que el edit pueda flipearlo a `true` y validar la
   transición `library` → `default` en el badge. Si lo precargara como
   `true`, el edit no podría asertar cambio observable más allá del
   rename.
2. **`PRELOADED_TRACK` como constante a nivel de módulo**: la primera
   pasada del implementer usaba el track inline; lo extraje a constante
   con el shape completo documentado, así el "qué precargamos" queda
   visible de un vistazo. Mantiene `music_id`, `agency_id`,
   `display_name`, `object_key`, `duration_seconds`, `is_default`,
   `created_at` — exactamente los 7 campos que el mock setea por
   defecto (`defaultMusicTracks()` en `mock-backend.js:849-860`) y que
   el front consume (`MusicLibrary.jsx:299-340`).
3. **Sin tocar el shape del mock**: comprobado en
   `mock-backend.js:105-113` que `installMockBackend({ musicTracks:
   [...] })` ya inyecta cada track tal cual con `agency_id`
   reescrito a la agencia activa. El handler PUT mergea el body
   incoming (`mock-backend.js:320-339`) — esto soporta sin cambios el
   PUT del front con `{display_name, is_default}` que emite
   `MusicLibrary.jsx:92-97`. El handler DELETE elimina por
   `music_id` (`mock-backend.js:341-350`). Cero modificaciones al
   mock necesarias.
4. **`toHaveCount(0)` en vez de `not.toBeVisible()`** para el empty
   state final + la ausencia de filas: más estable para selectores
   genéricos como `getByRole('row', { name: /Midnight Keys/ })`
   porque la fila se desmonta enteramente, no se oculta.

### Resultado de los checks de verificación

| # | Comando | Resultado |
|---|---|---|
| 1 | `bash ./init.sh` | ✅ verde (lint + build + checks de entorno OK). |
| 2 | `npx playwright test tests/music.spec.js` | ✅ 3 passed (desktop + tablet + mobile) en 7.4s. |
| 3 | `npx playwright test tests/playwright/music_upload.spec.js` | ✅ 3 passed (desktop + tablet + mobile) en 7.1s — sin regresión. |
| 4 | `npm run test:smoke` | ✅ 46 passed / 2 skipped (los 2 skips son `theme` tablet/mobile, pre-existentes). |
| 5 | `npm run test:e2e` (suite completa) | ✅ **127 passed / 2 skipped / 0 failed** en 1.6m. Cierra el should-fix #F1 del review original: ya no quedan los 3 fallos de `tests/music.spec.js` ni el flake mobile de `tests/templates.spec.js` (no se reprodujo esta vez). |

### Bloqueos

Ninguno. El shape `musicTracks` precargado del mock era suficiente
tal cual, no hizo falta tocarlo. Quedan pendientes los items que ya
estaban en el review original y son cross-repo:

- Follow-up #F2 del review (flake mobile de `tests/templates.spec.js`)
  — no se reprodujo en esta corrida de `npm run test:e2e`; sigue
  como nota independiente.
- Risk cross-repo #S1 (`agency_id` dentro de `music_track` en el mock)
  — sigue válido, no se toca el mock en esta pasada.
- Cierre de la feature como `done`: sigue pendiente del despliegue
  de la feature 22 del back en :8001 y la verificación manual.
