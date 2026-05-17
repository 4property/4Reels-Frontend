# Implementer — Feature 25 (per_reel_music_override, frontend)

Fecha: 2026-05-14
Agente: implementer (front, repo `/opt/projects/4Reels-Frontend`).
Estado: entregado, pendiente de reviewer. **No marcado `done`**.

## Decisión UX: editor inline, no card

El selector se monta como un panel inline dentro del `ReelEditor`, entre el
banner de `statusMessage` y el `editor-body` (preview + tabs). Razones:

- **Paridad con feature 21 (Descriptions)**: el override de descripciones
  vive en una pestaña del editor; manteniendo el control de música también
  dentro del editor evitamos ensuciar la card del grid con un dropdown que
  el usuario no espera ver ahí.
- **Visibilidad sin extra click**: ponerlo en el `editor-body` como una
  pestaña dedicada lo escondería detrás de una tab. Como solo es un
  `<select>` de una línea, vive arriba de todo el cuerpo y siempre se ve,
  independientemente de la tab activa (Photos, Subtitles, Descriptions…).
- **Layer rules**: el panel solo consume `useReel` (ya inyectado en
  `ReelEditorInner`) + `useTracks` + el nuevo `useReelMusicOverride`. No
  toca rutas, no abre nuevas pantallas.

La card del grid (`ReelCard.jsx`) **no se ha tocado**: añadir una vista
compacta read-only de "música actual" duplicaba estado (el track override
ya se ve al abrir el editor) sin aportar acción posible — la card no es
editable. Si en el futuro se quiere mostrar un chip "Override: <track>"
en la card, se puede colgar de `reel.music` que ya está en `useReels`
adaptado.

## Cambios

### `src/features/reels/api.js`

Añadido verbo `patchReelMusic(agencyId, siteId, sourcePropertyId, musicId)`:

```
PATCH /v1/admin/agencies/{a}/reels/{s}/{p}/music
Body:  { music_id: <string> | null }
```

`musicId === '' | null | undefined` se normaliza a `null` antes de salir
para evitar mandar `{music_id: undefined}` (que se omitiría tras
`JSON.stringify` y rompería `extra='forbid'`).

### `src/features/reels/hooks.js`

1. **Eliminado** el campo muerto `music: ''` que devolvía
   `adaptReelSummary` (línea ~142). Confirmado con `grep -rn "music: ''"
   src tests` → 0 hits. Tampoco había consumidores (`grep "reel.music"
   src` → 0 hits).
2. **Surface en `useReel`**:
   - `musicId`: extraído de `raw.music_track_id` (string o `null`). Es
     el override actual; `null` significa "agency default pool".
   - `music`: si el back denormaliza `{music_id, display_name}` en la
     respuesta, lo expone con esa misma forma. Si no, `null`.
3. **Nuevo hook** `useReelMusicOverride()` con el mismo patrón que
   `useReelDescriptionsOverride`: caller pasa
   `{agencyId, siteId, sourcePropertyId, musicId}`; `musicId == null`
   borra el override.

### `src/features/reels/editor/MusicOverridePanel.jsx` (nuevo)

Componente del editor. Hidrata desde `reel.musicId`, dispara el PATCH
en `onChange`, sincroniza el dropdown con la respuesta del back tras el
refetch.

Estados visibles:

- `disabled` + tooltip "La pista no se puede cambiar tras aprobar/publicar."
  cuando `!EDITABLE_PUBLISH_STATUSES.has(rawPublishStatus)`.
- Spinner inline "Loading tracks…" mientras `useTracks` carga; "Saving…"
  durante el PATCH.
- Feedback exitoso: "Re-rendering with new track…" (track seleccionada)
  o "Override cleared. Re-rendering with the agency default pool…" (null).
- Errores: 409 `REEL_NOT_EDITABLE`, 404 `ADMIN_REEL_NOT_FOUND`, 404
  `ADMIN_MUSIC_TRACK_NOT_FOUND` con copy específico; cualquier otro
  cae al `err.body.error || err.message`.
- Si el PATCH falla, el `<select>` se revierte al valor previo así no
  damos sensación de éxito.

### `src/features/reels/editor/ReelEditor.jsx`

Import del nuevo panel + render entre el banner de status y `editor-body`:

```
<MusicOverridePanel reel={reel} agencyId={agencyId} refetchReel={refetch} />
```

`refetch` re-tira el GET del reel para que la próxima vez que el usuario
toque el dropdown el baseline esté sincronizado con el back.

### `src/features/reels/editor/editor.css`

Bloque nuevo `── Feature 25: per-reel music-track override ──` con:
`.music-override-panel`, `.music-override-row`, `.music-override-label`,
`.music-override-control`, `.music-override-select`,
`.music-override-status`, `.music-override-readonly`,
`.music-override-feedback{,-success,-danger}`. Hereda variables CSS del
tema existente (`--surface`, `--border`, `--success`, `--danger`,
`--space-*`, `--fs-*`). No tailwind, no CSS-in-JS.

## Cómo se denormaliza la track en la respuesta del reel

El back de feature 25 expone (según la spec en el plan + el contrato
documentado):

- `music_track_id`: el override actual (string o `null`).
- `music`: objeto denormalizado con al menos `{music_id, display_name}`
  cuando el override apunta a una pista existente. Si no hay override,
  el back puede devolver `music: null` (la pool aún no está fijada).

El hook `useReel` consume ambos. Si el back no devolviera `music`, el
panel sigue funcionando: el `<select>` muestra `display_name` desde la
lista de `useTracks(agencyId)` porque las options se construyen
desde ahí, no desde `reel.music`. `reel.music` está ahí para futuras
vistas (ej. mostrar la pista en la card sin volver a llamar a `/music`).

## Shape del PATCH y del mock

**Request:**
```
PATCH /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/music
Authorization: Bearer <admin-token>
Content-Type: application/json

{ "music_id": "mock-music-alpha" }   // o null
```

**Response 200 (happy):**
```
{ "status": "saved", "reel_id": "<string>", "music_id": "<id|null>" }
```

**Response 409 (REEL_NOT_EDITABLE):**
```
{ "error": "REEL_NOT_EDITABLE", "message": "Music track cannot be changed once the reel is approved or published." }
```

**Response 404 (ADMIN_MUSIC_TRACK_NOT_FOUND):**
```
{ "error": "ADMIN_MUSIC_TRACK_NOT_FOUND", "message": "Music track is not available for this agency." }
```

**Response 404 (ADMIN_REEL_NOT_FOUND):**
```
{ "error": "ADMIN_REEL_NOT_FOUND", "message": "No reel matches that tuple" }
```

**Response 422 (extra='forbid'):**
Pydantic-style `{detail: [{loc, msg, type}]}`.

### Mock (`tests/support/mock-backend.js`)

- Nuevo handler `PATCH /reels/{s}/{p}/music` con el árbol completo de
  errores (409 / 404 reel / 404 track / 422 extra) + persistencia en
  el `reelsByAgency` map para que el siguiente GET refleje el override.
- GET del reel ahora surfacea `music_track_id` y `music` (con default
  `null/null` si el seed no los traía, así no rompe los tests
  preexistentes).
- `isKnownAdminStub` actualizado con `/music$`.

## Tests añadidos

`tests/reel_music_override.spec.js` (3 escenarios, 3 viewports →
9 ejecuciones):

1. **editable reel + 2 tracks**: dropdown lista
   `["Agency default pool", "Alpha Theme", "Beta Vibes"]`, seleccionar
   "Alpha" dispara PATCH con `{music_id: "mock-music-alpha"}`, response
   200 con `{status:'saved', reel_id, music_id}`, feedback
   "Re-rendering with new track…" visible, select queda en alpha tras
   refetch.
2. **clearing override**: reel seeded con `music_track_id: 'mock-music-beta'`
   → dropdown empieza en Beta, seleccionar la opción vacía dispara
   PATCH `{music_id: null}`, feedback contiene "agency default pool",
   select vuelve a `""` tras refetch.
3. **approved reel**: `publish_status: 'published'` → dropdown
   `disabled`, banner `[data-testid="music-override-readonly"]` visible.

## Verificación

```
cd /opt/projects/4Reels-Frontend
./init.sh                                # verde (env)
npm run lint                             # verde
npm run build                            # verde (123.52 kB css, 396.26 kB js)
npm run test:smoke                       # 46 passed / 2 skipped (theme legacy)
npx playwright test tests/reel_music_override.spec.js
                                         # 9 passed (3 escenarios × 3 viewports)
grep -rn "music: ''" src tests           # 0 hits
```

Todo en verde. No marco `done` — eso es decisión del leader tras el
review.

## Archivos tocados

- `src/features/reels/api.js`
- `src/features/reels/hooks.js`
- `src/features/reels/editor/ReelEditor.jsx`
- `src/features/reels/editor/MusicOverridePanel.jsx` (nuevo)
- `src/features/reels/editor/editor.css`
- `tests/support/mock-backend.js`
- `tests/reel_music_override.spec.js` (nuevo)
- `progress/current.md` (Bitacora feature 25 front)
