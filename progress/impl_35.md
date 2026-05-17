# Feature 35 — `per_reel_photos_override_ui` (implementer report)

- **Feature en curso:** 35 — `per_reel_photos_override_ui`
- **Estado en `feature_list.json`:** `in_progress` (no marcado `done` por
  contrato del implementer — espera al reviewer).
- **Agente:** Claude (rol implementer)
- **Inicio:** 2026-05-15 ~19:59

## 1. Archivos tocados

| Tipo | Path | Resumen |
|------|------|---------|
| api | `src/features/reels/api.js` | Nuevo `reelsApi.patchReelPhotos(agencyId, siteId, sourcePropertyId, photos)` → PATCH `/v1/admin/agencies/{a}/reels/{s}/{p}/photos` con body `{photos}`. Acepta `null`/`[]` para limpiar; el caller decide entre `null`, `[]` o array. |
| hook | `src/features/reels/hooks.js` | `useReelPhotosOverride()` mutación equivalente a `useReelMusicOverride`. `useReel` adapter expone `photosOverride` y `rawWorkflowState`. `useReelImages` ahora memoiza el array `images` para evitar el reset del state `photos` en re-renders (raíz del bug que descubrí, ver §5). |
| componente | `src/features/reels/editor/PhotosPanel.jsx` | Reescrito: añade debounce 500 ms, optimistic UI con rollback al snapshot pre-flush, badge `Re-rendering…` mientras `renderStatus === 'pending'`, banner persistente 409 (`PHOTOS_OVERRIDE_LOCKED`) tanto client-gated (`workflow_state ∈ {approved, published}`) como server-gated. Polling cada 1.5 s del reel mientras el badge esté on (cleanup al desmontar). Reordenado y toggle funcional setters (`setPhotos(prev => ...)`) — los closures por-render no eran seguros contra clicks rápidos. |
| wiring | `src/features/reels/editor/ReelEditor.jsx` | `LivePhotosPanel` recibe `agencyId`, `reel`, `refetchReel` y los pasa a `PhotosPanel`. `livePhotos` hidrata `selected` desde `reel.photosOverride` (Map por position) con fallback a la heurística legacy `index < 8`. |
| css | `src/features/reels/editor/editor.css` | Nuevos estilos: `.photos-tab`, `.photos-locked-banner`, `.photos-rerender-badge`, `.photos-feedback`/`-success`/`-danger`, `.photo-tile-locked`. Reutilizan los tokens existentes (`var(--danger)`, `var(--info)`, `var(--success)`). |
| mock | `tests/support/mock-backend.js` | Handler PATCH `/photos`. Pydantic-style `extra='forbid'` sobre el wrapper. Validación per-item `{position:int, selected:bool}` (422 si rompe). Persiste `photos_override` en el reel in-memory, marca `render_status: 'pending'` y dispara `setTimeout(200ms)` que lo flipa a `'done'` para que el badge aparezca brevemente en E2E. 409 `PHOTOS_OVERRIDE_LOCKED` cuando `workflow_state ∈ {approved, published}` o `publish_status === 'published'`. El GET reel surfacea `photos_override` (default `null`). El GET `/images` ahora lee de `reel.images` (default `[]`) para que los tests puedan seedearlas. Path nuevo registrado en `isKnownAdminStub`. |
| docs | `DOCS.md` | Nueva sección `Per-reel photos override (feature 35)` en § Backend contract: contrato del endpoint, errores, comportamiento del badge. |
| tests | `tests/per_reel_photos_override.spec.js` | 6 escenarios × 3 viewports = 18 specs. Cubre toggle, reorder, debounce-collapse, 409 client-side (banner + sin PATCH), rollback 500, y server-side 409. |

## 2. Cambios en el mock-handler

Endpoint nuevo:

```
PATCH /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/photos
Body:    { photos: [{ position:int, selected:bool }, ...] | null }   (extra='forbid')
200 →    { photos_override, render_status: 'pending' }
409 →    PHOTOS_OVERRIDE_LOCKED  (workflow_state ∈ {approved, published}
                                  o publish_status === 'published')
404 →    ADMIN_REEL_NOT_FOUND
422 →    body shape inválido (extra='forbid' / item type)
```

- Persiste `photos_override` en `reel`. Devuelve `render_status: 'pending'`
  y a los ~200 ms un `setTimeout` lo flipa a `'done'`, simulando al worker.
- El GET reel surfacea `photos_override` para que el editor seedee
  `selected` per-tile desde el override (con fallback a la heurística
  legacy `index < 8`).
- El GET `/images` ahora soporta seedear vía `reel.images` (array
  `{position, image_url, has_local_file?}` per-reel). Default sigue siendo
  `[]` para no romper specs previos.

## 3. Tests añadidos

`tests/per_reel_photos_override.spec.js`:

1. **toggle selected → ONE debounced PATCH** con el body
   `{photos:[{position:0,selected:false},{...,true},{...,true}]}` y el
   badge `Re-rendering…` que aparece y luego se oculta tras el refetch.
2. **DnD reorder → ONE PATCH** con la lista en el orden nuevo (positions
   `[0,1,2]` reasignadas por index, `selected` preservado).
3. **Multiples cambios <500ms colapsan en 1 PATCH** — tres clicks
   consecutivos producen exactamente un PATCH cuyo body refleja el estado
   final (todas las posiciones `selected:false`).
4. **Reel approved → locked banner + sin PATCH** — el banner cliente-gated
   aparece al abrir el editor y los clicks no disparan PATCH.
5. **PATCH 500 → rollback + toast** — el state local se optimistic-flipa,
   tras el fail vuelve al snapshot pre-flush y el feedback muestra el
   mensaje del back.
6. **Server-side 409 PHOTOS_OVERRIDE_LOCKED** — el cliente NO bloqueaba
   inicialmente (workflow_state stale), pero el back devuelve 409 y el
   panel surfacea el banner persistente con la copy exacta.

## 4. Verificación

- `./init.sh` → **exit 0** (node v24.14.1, lint verde, build verde).
- `npm run test:smoke` → **46 passed / 2 skipped** (los 2 skipped son los
  `theme` preexistentes).
- `npx playwright test tests/per_reel_photos_override.spec.js` →
  **18 passed** (6 specs × 3 viewports).
- `npm run test:e2e` (full) → **276 passed / 2 skipped / 1 flake**
  (`tests/payload_contract.spec.js:20 › Brand save sends only the
  canonical Pydantic body` en `tablet`). Re-run aislado de
  `payload_contract.spec.js` → **6/6 passed**. Es el mismo flake
  preexistente que reportaron `review_33.md` / `review_34.md`.

### Diff con el baseline (feature 34 cierre): 257 passed → 276 passed
= +18 nuevos specs míos + 1 flake que ya estaba.

## 5. Decisiones no obvias

1. **Bug raíz descubierto en `useReelImages`**: el hook devolvía
   `images = items.map(...)` sin memoizar. Cada render del editor creaba
   un array nuevo → `livePhotos` (useMemo con dep `[images, ...]`)
   recomputaba → `useEffect([livePhotos])` reseteaba el state `photos`.
   En la práctica el toggle/reorder se perdía en cuanto React re-rendereaba.
   Esto era latente desde antes (PhotosPanel pre-feature-35 sólo modificaba
   state local y nunca tuvo un test que detectara el reset). Fix:
   `useMemo` el adapter con dep `[data, agencyId, siteId, sourcePropertyId]`.
   Como cleanup, ahora la ref de `images` sólo cambia cuando el `data`
   subyacente cambia.

2. **Funcional setters en `toggle`/`move`**: `setPhotos(prev => ...)`
   en lugar de `setPhotos(photos.map(...))`. Necesario para que clicks
   rápidos consecutivos (caso del test "multiples cambios <500ms") no se
   re-baseen sobre el `photos` capturado en la closure del render anterior.

3. **Polling vs refetch-on-focus para el badge**: usé `setInterval` de
   1.5 s mientras `renderStatus === 'pending'`. Más simple que conectar
   un `visibilitychange` listener. El cleanup del `useEffect` lo apaga.
   El mock flipa a 'done' en 200 ms, así que en E2E el badge es
   transitorio. Contra :8001 real, el render puede tardar varios
   segundos y el polling 1.5 s da buen UX.

4. **`workflow_state` raw en el adapter**: `useReel` ya tenía
   `rawPublishStatus` para feature 21/25; añadí `rawWorkflowState` por
   simetría. El back feature 35 decide el 409 por `workflow_state`
   (no por `publish_status`), así que el cliente debe gatear por la
   misma señal para no enviar PATCHes que sabemos que van a 409.

5. **No factoricé un componente `PhotoTile` separado.** Lo consideré
   pero el JSX de cada tile es lo suficientemente corto y todos los
   handlers comparten estado local (`dragIdx`). Una factorización ahora
   sólo añadiría props-drilling sin reuso real. Si features 36/37
   piden tiles equivalentes para subtítulos/slides probablemente
   factoricen una primitiva genérica entonces.

## 6. Open items para el reviewer

- Si el reviewer prefiere que `useReelImages` también se renombre
  (porque ahora es un cambio cross-feature de comportamiento, no sólo
  cosmetic), abrir el debate. Mi tesis: el cambio es defensivo y
  estabiliza el contrato `images` para todos los consumidores del hook.
- El badge `Re-rendering…` es texto en inglés, igual que el resto del
  panel; no internacionalicé. Si el repo tiene un i18n catalog que me
  perdí, marcarlo como follow-up.
- El polling es `setInterval` simple. Si en producción la red puede
  tener problemas (timeouts), podríamos cambiar a un `useApi`
  re-key. Para el alcance de feature 35 lo dejé.

## 7. Manual QA contra :8001 (back feature 35 desplegada)

1. Abrir `/reels` con el agency_token de una agency con reels
   `needs_approval`.
2. Click en una card → editor abre. Tab "Photos" debería listar las
   imágenes ingresadas.
3. Drag-to-reorder de la primera foto al final → tras ~500 ms una
   request `PATCH .../photos` con `{photos:[...]}` con el nuevo orden.
   Status 200; el badge `Re-rendering…` aparece arriba del grid.
4. Recargar el editor: la galería conserva el nuevo orden (hidratado
   desde `photos_override`).
5. Esperar a que el worker termine (Render: `done`) → badge desaparece.
6. Click en una foto seleccionada → la deselecciona; otra PATCH; badge
   reaparece.
7. Aprobar el reel (botón "Approve & Publish"). Volver al editor →
   tab Photos: el banner rojo `Cannot edit a reel that has already been
   approved` aparece arriba y los tiles ya no son draggable / clickable.
8. Edge: intentar dos cambios en rápida sucesión (<500 ms) — sólo se
   debería ver UNA request `PATCH .../photos` en DevTools/Network.
