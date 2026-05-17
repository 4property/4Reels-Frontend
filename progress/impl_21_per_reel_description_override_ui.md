# impl 21 — per_reel_description_override_ui (frontend)

- **Fecha:** 2026-05-14
- **Agente:** implementer (frontend), invocado por leader Claude
- **Feature `feature_list.json`:** 21 — sigue `in_progress` (no se marca `done`).
- **Backend de referencia:** review aprobado en
  `/opt/projects/4Reels-Backend/progress/review_21_per_reel_description_override_endpoint.md`.

## Contrato consumido

PATCH `/v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/descriptions`
con `extra='forbid'` sobre `{descriptions_by_platform: {<platform>: <text>}}`.
Replace semantics; `{}` limpia el override (back persiste NULL).

Respuesta happy: `{status:'saved', agency_id, site_id, source_property_id, descriptions_override: {...}}`.

Errores:
- 404 `ADMIN_REEL_NOT_FOUND` cuando la tupla no resuelve un reel.
- 409 `REEL_NOT_EDITABLE` cuando `publish_status` no está en
  `{'', 'pending', 'pending_review', 'needs-approval'}`.
- 422 `PLATFORM_NOT_ENABLED` con `details.platform` cuando una plataforma
  no figura en `agency_reel_defaults.platforms`.
- 422 Pydantic standard si el payload no respeta `extra='forbid'`.

Precedencia: el reel inspeccionado expone tanto `descriptions_override`
(JSONB, puede ser `null`) como `publish_target_snapshot.descriptions_by_platform`.
La UI hidrata cada textarea en ese orden de precedencia, mismo orden que
aplica el worker al re-publicar.

## Cambios por archivo

### `src/features/reels/api.js`
- Añadido verb `patchReelDescriptions(agencyId, siteId, sourcePropertyId, descriptionsByPlatform)`
  que llama al PATCH con `{descriptions_by_platform: <map>}`. Reusa el helper
  `reelPath` existente para mantener un único punto de construcción de la
  tupla URL.

### `src/features/reels/hooks.js`
- `useReel` ahora adapta `raw.descriptions_override`, `raw.publish_target_snapshot`
  y el `raw.publish_status` literal (campos `descriptionsOverride`,
  `publishDescriptionsSnapshot`, `rawPublishStatus` en el objeto adaptado),
  sin tocar el resto del shape consumido por `Dashboard` / `ReelCard` /
  `ReelsTable` (esos siguen leyendo el output de `adaptReelSummary`).
- Añadido hook `useReelDescriptionsOverride()` siguiendo el patrón de
  `useApproveReel` / `useRejectReel` (mutation pasando la tupla + el map de
  descriptions). Se exponen `loading` / `error` / `reset` estándar de
  `useMutation`.

### `src/features/reels/publishStatus.js`
- Exportado `EDITABLE_PUBLISH_STATUSES` (Set con los 4 valores que el back
  acepta) + helper `isPublishStatusEditable(rawPublishStatus)`. La lista
  es coherente con la decisión §5 del review backend: cuatro estados de
  pre-aprobación legítimos, sin contar la traducción "needs-approval" que
  ya hace `mapPublishStatus`.

### `src/features/reels/editor/DescriptionsPanel.jsx` (reescritura)
- Sustituye el panel single-active anterior (tabs + un solo textarea + toggle
  decorativo de "Publish to") por un layout vertical con una sección por
  cada platform de `useSocials()`. Cada sección expone:
  - Label de la red + icono + flag visual `override` cuando ese platform
    tiene un override persistido (`reel.descriptionsOverride[platform]` definido).
  - `<textarea>` editable hidratado con el orden de precedencia
    `override → snapshot → ''`.
  - Contador `<div class="char-count">{n}/{NETWORK_LIMITS[net]}</div>` con
    clase `over` cuando excede.
  - Botón "Save" por red, deshabilitado si el textarea coincide con el
    baseline.
- Botón "Save all" arriba que envía el PATCH con TODAS las plataformas dirty;
  badge con el contador de plataformas dirty pegado al botón.
- Botón "Reset to template" que envía PATCH con `{}` para limpiar el override.
- Banner `desc-readonly-banner` cuando `publish_status` no es editable; en
  ese estado todos los textareas son `readOnly` y los botones Save / Save all
  / Reset quedan deshabilitados.
- Banner de feedback (`desc-feedback`) tras Save con tres tonos:
  - success → "Saved description for {platform}." / "Saved descriptions for all platforms." / "Override cleared. Reel will use the template snapshot.".
  - danger (409 `REEL_NOT_EDITABLE`) → "This reel can no longer be edited.".
  - warning (422 `PLATFORM_NOT_ENABLED`) → "Platform "{X}" is not enabled for this agency.".
  - danger genérico → el código del backend (o `err.message` si no hay code).
- **Decisión clave sobre el payload**: el panel parte de los overrides
  persistidos (`reel.descriptionsOverride`) y SOLO modifica las claves de las
  plataformas que el usuario tocó en este Save (`buildPayload(subset)`). Así
  un "Save instagram" no promueve a override las captions snapshot de las
  otras redes (que están solo en el textarea como fallback visual). Si una
  caption ya era override y la dejamos vacía, se elimina del map (replace
  semantics → desaparece del override del back).

### `src/features/reels/editor/ReelEditor.jsx`
- Limpiados los `useState` legacy (`descs`, `setDescs`, `activeNet`,
  `setActiveNet`) que servían al panel anterior. Imports `useSocials` y
  `DEFAULT_DESCRIPTION` quedan retirados porque ya no se usan en este file.
- El render de la pestaña Descriptions ahora pasa `{reel, agencyId, refetchReel}`
  al `DescriptionsPanel`. `refetchReel` apunta al `refetch` que `useReel`
  expone, así que tras Save el panel re-pide el reel y vuelve a hidratar
  con los datos nuevos.

### `src/features/reels/editor/editor.css`
- Añadido bloque "Feature 21: per-reel description override panel" con
  estilos para `.desc-override-panel`, `.desc-readonly-banner`,
  `.desc-feedback{,-success,-warning,-danger}`, `.desc-override-list`,
  `.desc-override-row{,-head,-label}`, `.desc-override-textarea`
  (incluyendo `[readonly]`), `.desc-override-meta` y `.char-count.over`.
- Variables CSS existentes (`--bg-soft`, `--border`, `--accent`, `--danger`,
  `--success`, `--warning`, espaciados, radios, fonts) — sin nuevas
  dependencias visuales.

### `tests/support/mock-backend.js`
- **Re-leído entero antes de tocarlo** por la advertencia de concurrencia
  (sección música tocada por feature 22). Sólo se añadió código en la
  sección de reels — el bloque música queda intacto.
- Nuevo handler para `PATCH .../reels/.../descriptions`:
  - Pydantic-style: rechaza keys extra con 422 + `extraForbiddenError(field)`.
  - Valida que `descriptions_by_platform` sea object/null.
  - 404 `ADMIN_REEL_NOT_FOUND` si la tupla no resuelve un reel.
  - 409 `REEL_NOT_EDITABLE` si `publish_status` no está en
    `{'', 'pending', 'pending_review', 'needs-approval'}`.
  - 422 `PLATFORM_NOT_ENABLED` con `details.platform` cuando la plataforma
    no está en el whitelist `enabledPlatformsByAgency[agencyId]` (cuando el
    test no lo configura, acepta el set completo de plataformas conocidas
    `instagram | tiktok | youtube | facebook | linkedin | gbp | gmb | pinterest`
    para no romper specs preexistentes).
  - Persiste en el `reelsByAgency` store (in-memory) y devuelve el shape
    happy completo (`status:'saved', agency_id, site_id, source_property_id,
    descriptions_override`). Un PATCH con `{}` deja `descriptions_override`
    a `null` en el store.
- Nueva opción `enabledPlatformsByAgency` aceptada por `installMockBackend`.
- GET de reel ahora spreads `descriptions_override:null` y
  `publish_target_snapshot:null` por defecto, **antes** del spread del
  match, así los tests que seedean valores los preservan y los que no
  obtienen `null` (mismo shape que el back).
- `isKnownAdminStub` extendido con la regex de `.../descriptions` para
  que el guard 404 catch-all no tape al nuevo handler.

### `tests/reel_descriptions_override.spec.js` (nuevo)
- 4 tests × 3 viewports (desktop, tablet, mobile) = 12 ejecuciones.
- Cubre:
  1. Edit + Save instagram → PATCH body `{descriptions_by_platform:{instagram:<text>}}`,
     respuesta 200 con `status:'saved'` y `descriptions_override:{instagram:<text>}`,
     banner success, flag `override` visible en el header de la sección.
  2. Hidratación desde snapshot cuando `descriptions_override===null`.
  3. Reel `publish_status='published'` → textareas read-only + banner
     `desc-readonly-banner` visible + Save deshabilitado.
  4. Reset con override pre-seedeado → PATCH `{descriptions_by_platform:{}}`,
     y tras refetch la textarea vuelve al valor del snapshot.
  5. (extra) PATCH con `facebook` cuando el whitelist excluye facebook →
     422 con feedback "facebook ... not enabled" (cubre el camino
     `PLATFORM_NOT_ENABLED`).

## Hidratación y precedencia (decisión)

`baseline[platform] = descriptionsOverride?.[platform] ?? snapshot?.descriptions_by_platform?.[platform] ?? ''`

Idéntico al orden que aplica el worker (override → snapshot) según la
verificación §3 del review back. El flag visual `override` se calcula
contra `descriptionsOverride[platform] !== undefined`, no contra el
baseline, para distinguir "este caption viene del template" vs "está
explícitamente sobrescrito".

## Manejo de errores (decisión)

Branching por `err.status` + `err.body.error`:

| status | error code               | tono     | copy                                                 |
|--------|--------------------------|----------|------------------------------------------------------|
| 409    | `REEL_NOT_EDITABLE`      | danger   | This reel can no longer be edited.                   |
| 422    | `PLATFORM_NOT_ENABLED`   | warning  | Platform "{platform}" is not enabled for this agency. |
| 422    | otro / Pydantic genérico | danger   | (muestra el code o el mensaje del error)             |
| otros  | —                        | danger   | (code o mensaje del error)                           |

`details.platform` se lee del body — el back lo expone tal cual en el
422 según el review.

## Verificación

```bash
cd /opt/projects/4Reels-Frontend
./init.sh                                              # FAIL: 2 in_progress (feature 22 sigue así, documentado). Lint+build verdes.
npm run lint                                            # OK
npm run build                                           # OK
npm run test:smoke                                      # 46 passed / 2 skipped
node --test tests/unit/mapPublishStatus.unit.js \
            tests/unit/publishStatus.unit.js            # 24 passed
npx playwright test tests/reel_descriptions_override.spec.js   # 12 passed (4 tests × 3 viewports)
npx playwright test tests/reel_approve_schedule.spec.js tests/flows.spec.js  # 31 passed / 2 skipped (sin regresiones)
```

El único FAIL de `init.sh` es el contador "Hay 2 features en in_progress
(máximo 1)" — corresponde a la feature 22 (`agency_music_upload`) que
sigue `in_progress` esperando el deploy del back, según `progress/current.md`.
NO se intenta arreglar desde esta feature.

## Concurrencia — observaciones

- `tests/support/mock-backend.js` re-leído antes de cada edit; los cambios
  de la feature 22 (sección música, líneas 224-353 aprox.) quedan intactos.
- `src/features/reels/editor/editor.css` re-leído antes de añadir el bloque
  CSS nuevo; el hotfix Codex `editor-video-player:fullscreen` (líneas 118-127
  aprox.) queda intacto.
- No se tocó `src/features/music/` ni `tests/playwright/music_upload.spec.js`.

## Próximo paso

Pasar a reviewer (`task #17` en la tabla del leader). Cuando el back
deploye en `:8001`, hacer una verificación manual end-to-end abriendo un
reel real en `needs-approval`, editando instagram, recargando y confirmando
que el override persiste.
