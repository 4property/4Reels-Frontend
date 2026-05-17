# review_25_per_reel_music_override (FRONT)

Reviewer del frontend para feature 25 (`per_reel_music_override`).
Valida el trabajo descrito en `progress/impl_25_per_reel_music_override.md`
y cierra el cross-repo (back 25 done y deployada en :8001, PIDs
API=2493396, worker=2493397).

## Veredicto

**APPROVED.**

El override de pista por reel queda cableado al editor con paridad de
patrón con feature 21 (Descriptions override): hook
`useReelMusicOverride` → `patchReelMusic` → `apiRequest`, sin `fetch`
directo en `src/features/reels/`. El selector se monta inline en el
`ReelEditor` (no en `ReelCard`), reusa `useTracks` para poblar las
opciones y respeta `EDITABLE_PUBLISH_STATUSES` de
`publishStatus.js` (compartido con feature 21). Rollback del select en
error, feedback con copy específico por código (409 `REEL_NOT_EDITABLE`,
404 `ADMIN_REEL_NOT_FOUND`, 404 `ADMIN_MUSIC_TRACK_NOT_FOUND`),
disabled + readonly banner cuando el reel ya no es editable. El campo
muerto `music: ''` del adapter quedó eliminado y reemplazado por
`musicId` + `music` denorm `{music_id, display_name}`. Mock-backend
implementa la matriz completa del contrato (200 happy, 404/404/409 +
422 `extra='forbid'`) y persiste la mutación entre PATCH y GET, lo que
permite que el spec verifique el round-trip end-to-end. Lint, build,
smoke y la spec dedicada todos verdes.

## Acceptance criteria (mapeo)

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| 1 | Selector dropdown en `ReelCard.jsx` o `ReelsTable.jsx` (decisión UX del implementer) | OK | Decisión justificada: vive en `ReelEditor` (paridad con feature 21 Descriptions). `src/features/reels/editor/MusicOverridePanel.jsx` + `ReelEditor.jsx:223-227` |
| 2 | PATCH con `{music_id: <id\|null>}`; spinner + feedback | OK | `MusicOverridePanel.jsx:74-99` (PATCH + setFeedback success); `MusicOverridePanel.jsx:134-142` (spinner inline "Saving…" / "Loading tracks…") |
| 3 | `publish_status` no editable → disabled + tooltip | OK | `MusicOverridePanel.jsx:103-106,124-125` (disabled + `title` con copy "La pista no se puede cambiar tras aprobar/publicar."); banner readonly `MusicOverridePanel.jsx:145-152` |
| 4 | 409/403/404 con mensajes específicos | OK | `MusicOverridePanel.jsx:50-72` (`reportError` cubre 409 REEL_NOT_EDITABLE, 404 ADMIN_MUSIC_TRACK_NOT_FOUND, 404 ADMIN_REEL_NOT_FOUND y fallback `err.body.error`); rollback del `<select>` al valor previo `MusicOverridePanel.jsx:96` |
| 5 | `music: ''` muerto reemplazado por `music_id` + denorm | OK | `grep -rn "music: ''" src tests` → 0 hits; `hooks.js:50-63` surface `musicId` + `music {music_id, display_name}` |
| 6 | Test Playwright cubre track → PATCH id, default pool → PATCH null, reel approved → disabled | OK | `tests/reel_music_override.spec.js:88-240` (3 escenarios × 3 viewports = 9/9) |
| 7 | `grep -rn "music: ''" src` → 0 hits | OK | Confirmado |
| 8 | lint/build/test:smoke verdes | OK | Ver "Verificación" abajo |

## Checks adicionales (del brief del leader)

### Decisión UX: editor inline, no card

El implementer eligió montar el panel inline en `ReelEditor` entre el
banner de status y `editor-body`, **no** en `ReelCard`. Justificación
correcta:

- Paridad con feature 21 (Descriptions override): el override también
  vive dentro del editor, no en la card del grid.
- La card es read-only (no expone otros controles editables): añadir un
  dropdown ahí desbalancearía la jerarquía visual.
- El panel queda fuera de las tabs, siempre visible — `<select>` de una
  línea, no merece pestaña propia.

Revisado `ReelEditor.jsx:223-227`: el panel se monta una vez por
`ReelEditorInner` (lazy, después de validar `reel`), recibe
`refetchReel` para resincronizar con el back tras el PATCH. `ReelCard`
no se ha modificado (verificado con `grep MusicOverridePanel src tests`
→ solo aparece en editor + tests).

### Componente nuevo `MusicOverridePanel.jsx`

- `<select>` con "Agency default pool" (`value=""`) como primera opción
  + tracks de `useTracks()` (`MusicOverridePanel.jsx:117-133`).
- Hidrata desde `reel.musicId` y resync via `useEffect` cuando el reel
  cambia tras refetch (`MusicOverridePanel.jsx:42-48`).
- **Rollback en error verificado**: `handleChange` guarda
  `previous = value`, hace `setValue(nextValue)` optimistamente, y en
  el `catch` ejecuta `setValue(previous)` + `reportError(err)`
  (`MusicOverridePanel.jsx:74-99`).
- `disabled = !editable || saving || tracksLoading` cubre los tres
  estados (no editable, PATCH en vuelo, lista cargando).
- Surface estructurada: `data-testid` en panel, select, spinner,
  readonly banner, tracks-error, feedback — permite asserts robustos
  en el spec.

### Mock-backend handler PATCH /music

- Ubicado en `tests/support/mock-backend.js:325-436`.
- Matriz completa del contrato:
  - **422 extra_forbidden** si llega cualquier key fuera de
    `{music_id}` (`mock-backend.js:347-353`).
  - **404 ADMIN_REEL_NOT_FOUND** si la tupla (site, source_property)
    no existe en `reelsByAgency` (`mock-backend.js:362-377`).
  - **409 REEL_NOT_EDITABLE** si `publish_status` no está en el set
    editable (`mock-backend.js:379-390`), reusando
    `EDITABLE_PUBLISH_STATUSES` declarado en línea 213 (mismo set que
    el back).
  - **404 ADMIN_MUSIC_TRACK_NOT_FOUND** si la pista no existe en
    `musicByAgency` para la agencia (cross-agency colapsado aquí,
    `mock-backend.js:392-406`).
  - **200 happy** persiste `music_track_id` + `music{music_id,
    display_name}` en la entrada del reel y devuelve `{status:'saved',
    reel_id, music_id}` (`mock-backend.js:408-434`).
- **Persistencia verificada**: el handler muta `reels[idx]` así que el
  siguiente GET (handler en `mock-backend.js:438-478`) surfacea el
  nuevo `music_track_id` + `music`. El spec `clearing the override` se
  apoya en esto: el reel se seedea con `music_track_id: 'mock-music-beta'`,
  el PATCH lo limpia a null y el refetch confirma que el select queda
  en `""` (default pool).
- `isKnownAdminStub` registra `/reels/.../music$`
  (`mock-backend.js:1009`) para que las requests no caigan al 404
  por defecto.

### Spec nuevo `tests/reel_music_override.spec.js`

Ubicación correcta — no en `tests/playwright/...` (el brief lo pedía
explícito; los otros specs nuevos también viven en `tests/` raíz).

Cobertura (3 escenarios × 3 viewports = 9 ejecuciones):

1. **editable + 2 tracks** (líneas 89-173): dropdown listado
   `["Agency default pool", "Alpha Theme", "Beta Vibes"]`, PATCH con
   `{music_id:"mock-music-alpha"}`, response 200 + `status:'saved'`,
   feedback "Re-rendering with new track…" visible, select queda en
   alpha tras refetch.
2. **clear override** (líneas 175-219): reel seeded con
   `music_track_id:'mock-music-beta'` → dropdown empieza en Beta,
   `selectOption('')` dispara PATCH `{music_id:null}`, feedback
   contiene "agency default pool", select vuelve a `""`.
3. **approved reel** (líneas 221-240): `publish_status:'published'` →
   select `disabled`, `[data-testid="music-override-readonly"]`
   visible.

Las requests se interceptan vía `page.on('request')` con regex
`/\/reels\/[^/]+\/[^/]+\/music(\?|$)/` que matchea solo la PATCH del
panel (no las GET de música global). El spec verifica que la URL
contiene el path canónico `/v1/admin/agencies/{a}/reels/{s}/{p}/music`.

### `music: ''` muerto eliminado

`adaptReelSummary` (`hooks.js:154-191`) ya no expone `music: ''`.
Confirmado con `grep -rn "music: ''" src tests` → 0 hits. La superficie
correcta queda en `useReel` que expone `musicId` y `music` denorm para
consumidores futuros (la card podría mostrar un chip "Override: <track>"
si se quisiera, pero el implementer decidió no añadirlo y queda como
trabajo opcional).

### Disabled si no editable: reuso de `EDITABLE_PUBLISH_STATUSES`

`MusicOverridePanel.jsx:6` importa `isPublishStatusEditable` de
`../publishStatus.js`. El set `EDITABLE_PUBLISH_STATUSES` (declarado en
`publishStatus.js:49-54` por feature 21) cubre `{'', 'pending',
'pending_review', 'needs-approval'}` — el mismo gate del back. No hay
duplicación: el panel comparte la fuente con `DescriptionsPanel`.

### Paridad de patrón con feature 21

| Aspecto | Descriptions (feature 21) | Music (feature 25) |
|---|---|---|
| Verbo en `api.js` | `patchReelDescriptions` | `patchReelMusic` |
| Hook | `useReelDescriptionsOverride` | `useReelMusicOverride` |
| Editable gate | `EDITABLE_PUBLISH_STATUSES` | `EDITABLE_PUBLISH_STATUSES` (mismo set) |
| Ubicación UI | Tab "Descriptions" del editor | Panel inline del editor |
| Body shape | `{descriptions_by_platform: {...}}` | `{music_id: <id\|null>}` |
| 409 / 404 / 422 manejados | sí | sí |

Coherencia total. Cualquiera que aprenda el patrón de override en un
feature lo lee igual en el otro.

## Verificación

```
cd /opt/projects/4Reels-Frontend
./init.sh                                 # verde (lint+build incluidos)
npm run test:smoke                        # 46 passed / 2 skipped (theme legacy)
npx playwright test tests/reel_music_override.spec.js
                                          # 9 passed (3 × 3 viewports)
grep -rn "music: ''" src tests            # 0 hits
grep -rnE 'fetch\(' src/features/reels/   # solo refetch() (hook API, no red)
grep -rn 'patchReelMusic\|useReelMusicOverride' src tests
                                          # 5 hits esperados (api, hooks, panel)
grep -rn 'MusicOverridePanel' src tests   # 3 hits (panel + ReelEditor import +
                                          #         JSX render)
```

Todo verde:

- `./init.sh` → "[OK] Entorno listo".
- `npm run test:smoke` → **46 passed / 2 skipped** (los 2 skipped son
  los tests de `theme` preexistentes, no relacionados con esta feature).
- `npx playwright test tests/reel_music_override.spec.js` → **9 passed
  (11.3s)**.
- `grep "music: ''"` → 0 hits.
- `grep fetch(` en `src/features/reels/` → solo aparece `refetch()`
  (hook return, no llamada de red).

## Conclusiones

APPROVED. La entrega satisface los 8 criterios del feature_list, mantiene
la disciplina arquitectónica del repo (componente → hook → api →
`lib/api/client.js`, sin `fetch` directo, sin libs prohibidas, Vanilla
CSS, sin TypeScript), reutiliza el set `EDITABLE_PUBLISH_STATUSES` de
feature 21 evitando duplicación, y cierra el contrato del back 25 con
una matriz de mock-backend que ejercita los 4 códigos de error
relevantes. Procedo al cierre cross-repo (feature_list.json + history.md
+ current.md) en el commit siguiente.
