# Review feature 21 — `per_reel_description_override_ui` (frontend)

- **Fecha:** 2026-05-14
- **Agente:** reviewer (frontend), invocado por leader Claude
- **Veredicto:** **APPROVED** (sin cambios solicitados)
- **Informe del implementer:** `progress/impl_21_per_reel_description_override_ui.md`
- **Backend de referencia (cerrado):** `/opt/projects/4Reels-Backend/progress/review_21_per_reel_description_override_endpoint.md`

## Resumen

La feature 21 cierra el lado UI del per-reel description override:

- Nuevo verb `patchReelDescriptions` en `src/features/reels/api.js` que pega al
  PATCH `/v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/descriptions`
  reutilizando el helper `reelPath`.
- `useReelDescriptionsOverride()` mutation en `hooks.js`. `useReel` ahora
  expone `descriptionsOverride`, `publishDescriptionsSnapshot` y
  `rawPublishStatus` además del shape existente (`adaptReelSummary` queda
  intacto para el resto del UI).
- `EDITABLE_PUBLISH_STATUSES` + `isPublishStatusEditable` exportados desde
  `publishStatus.js` con los 4 estados `{'', 'pending', 'pending_review',
  'needs-approval'}` — alineado con el back (decisión §5 del review back).
- `DescriptionsPanel.jsx` reescrito a layout por plataforma con textarea
  editable, contador, Save por red, Save all, Reset y banner read-only.
  Hidratación con precedencia override → snapshot → ''. Feedback de error
  por tono (success/warning/danger) con copy diferenciado para 409/422.
- `tests/support/mock-backend.js` añade el handler PATCH .../descriptions
  con shape correcto (404/409/422/extra-forbidden) + opción
  `enabledPlatformsByAgency`. El bloque música (features 18/22) y el de
  social-templates (feature 20) **quedan intactos** (verificado por grep).
- Spec nuevo `tests/reel_descriptions_override.spec.js` cubre edit+save,
  read-only, reset y PLATFORM_NOT_ENABLED (4 tests × 3 viewports = 12
  ejecuciones, todas verdes).

## Validación contra los acceptance criteria

| # | Criterio | Estado |
|---|---|---|
| 1 | Pestaña Descriptions con panel por red, textarea editable, contador, Save por red O Save all | OK (`DescriptionsPanel.jsx` líneas 223-277; `Save all` + per-platform Save + contador `NETWORK_LIMITS[net]` con clase `over`) |
| 2 | Hidratación con precedencia override → snapshot → '' | OK (`DescriptionsPanel.jsx` líneas 44-61; idéntico al orden que aplica el worker según review back §3) |
| 3 | Save dispara PATCH al path tupla `agency_id/site_id/source_property_id` | OK (`api.js` líneas 16-20 + 43-47; spec verifica URL exacta en líneas 129-133) |
| 4 | Tras Save el editor refleja el override; cambio de template global no afecta reels con override | OK (refetch tras Save en `DescriptionsPanel.jsx:146`; back garantiza que `content_fingerprint` excluye descripciones — feature 21 back §5) |
| 5 | publish_status no editable → read-only + banner | OK (`isPublishStatusEditable` línea 39 → `readOnly` línea 263 + `desc-readonly-banner` línea 200-208 + Save deshabilitados; spec read-only test verifica los 3 viewports) |
| 6 | 409 REEL_NOT_EDITABLE y 422 PLATFORM_NOT_ENABLED con feedback diferenciado | OK (`reportError` líneas 84-107: danger para 409, warning con nombre de plataforma para 422; el caso 422 está testeado en spec; el 409 está testeado defensivamente en el mock pero no se cubre con una spec dedicada — ver hallazgo H4) |
| 7 | Mock backend sirve el PATCH con shape correcto | OK (`tests/support/mock-backend.js` líneas 226-323; valida extra-forbid, dict_type, 404/409/422 happy con shape `{status:'saved', agency_id, site_id, source_property_id, descriptions_override}`) |
| 8 | Tests Playwright cubren happy + read-only + reset (+ 422) | OK (4 tests × 3 viewports, 12 verdes en 12.9 s) |
| 9 | lint, build, test:smoke verdes | OK (`./init.sh` lint+build verdes; smoke 46 passed / 2 skipped en 1 min; spec dedicado 12/12; sin regresiones en `reel_approve_schedule.spec.js` 9/9) |

## Decisiones del implementer — validación crítica

### 1. Payload subset vs back replace-total (riesgo crítico levantado por el leader)

**Confirmado pero mitigado**: el back implementa replace TOTAL en
`/opt/projects/4Reels-Backend/modules/reels/application/use_cases/update_reel_descriptions_override.py`
línea 213 (`descriptions_override=coerced_override or None`), lo cual
**borraría** overrides de otras plataformas si el frontend mandara solo el
subset tocado.

El frontend NO comete ese error: `buildPayload` en
`DescriptionsPanel.jsx:114-133` arranca **desde**
`reel.descriptionsOverride` (los overrides persistidos) y SOLO **modifica
encima** las plataformas del subset. Por tanto, "Save instagram" cuando
existe override previo de facebook envía `{instagram: <new>, facebook:
<persisted>}`, lo que sobrevive a la replace-total del back. Una caption
vacía en una plataforma del subset hace `delete payload[platform]` → la
elimina del override del back.

**Decisión coherente y APPROVED.** La afirmación del implementer ("Save de
una red NO promueve las captions del snapshot de otras redes a overrides")
es correcta: si la otra plataforma no tenía override previo, no aparece en
el payload, y el back conserva su comportamiento original (template
snapshot). Solo se promueve a override lo que ya era override + lo que
acaba de tocar el usuario.

### 2. Precedencia override → snapshot → ''

Validada contra el back: `IngestPropertyIntoReelUseCase` aplica el merge
per-platform sobre `publish_descriptions_by_platform`, que es lo que
consume `property_publisher.py` (review back §3). El frontend mimetiza la
misma precedencia en `DescriptionsPanel.jsx:44-61`. APPROVED.

### 3. EDITABLE_PUBLISH_STATUSES (4 valores)

Set en `publishStatus.js` línea 49: `{'', 'pending', 'pending_review',
'needs-approval'}`. Coincide al pie de la letra con
`_EDITABLE_PUBLISH_STATUSES` del back (`update_reel_descriptions_override.py:43-65`).
La inclusión de `'needs-approval'` es defensiva (el back hoy emite
`pending_review` desde `publish_reel.py:225`) pero coherente con la nota
del back de que `needs-approval` es "the canonical post-render gate".
APPROVED.

### 4. Banner read-only vs 409 defensivo

La UI bloquea inputs (textareas readOnly + Save disabled) cuando
`!editable`, por lo que el 409 solo se ve si alguien manipula DevTools o si
el reel cambia de estado entre carga y Save. El handler está testeado
**indirectamente**: el mock devuelve 409 con `error: 'REEL_NOT_EDITABLE'`
(mock-backend.js línea 283) y el `reportError` lo mapea a "This reel can no
longer be edited." (DescriptionsPanel.jsx:88-94). No hay test E2E dedicado
al camino "PATCH a reel published vía manipulación del UI" — ver hallazgo
H4 (no bloqueante).

### 5. `./init.sh` falla por "2 in_progress"

Confirmado no bloqueante (deuda procedural del leader, feature 22 sigue
in_progress esperando deploy del back). El resto del init (lint, build)
verde.

## Verificaciones ejecutadas en esta review

```text
./init.sh                                         → FAIL solo por "2 in_progress" (esperado); lint+build verdes  ✅
npm run lint                                       → 0 errores                                                    ✅
npm run build                                      → bundle OK                                                    ✅
npm run test:smoke                                 → 46 passed / 2 skipped (1.0m)                                 ✅
npx playwright test tests/reel_descriptions_override.spec.js → 12 passed (12.9s)                                  ✅
npx playwright test tests/reel_approve_schedule.spec.js      → 9 passed (sin regresiones)                          ✅
grep -rnE 'fetch\(' src/features/reels/editor/    → 0 fetch directos (solo `refetch()`)                          ✅
grep music + social-templates en mock-backend.js  → handlers intactos (líneas 372-510 música; 702-983 templates)  ✅
```

Re-lectura defensiva por concurrencia:
- `tests/support/mock-backend.js` — la sección música (features 18/22)
  se conserva entera (líneas 105-110, 373-499, 1001+).
- `src/features/reels/editor/editor.css` no se inspeccionó (no era parte
  del scope crítico de este review), pero el implementer reportó que el
  hotfix `editor-video-player:fullscreen` queda intacto.

## Concurrencia — observaciones

- Otros agentes activos no introdujeron conflictos detectables en los
  archivos críticos (`DescriptionsPanel.jsx`, `hooks.js`, `api.js`,
  `publishStatus.js`, `mock-backend.js`, spec nuevo).
- El bloque música de `mock-backend.js` (feature 22 in_progress) y el
  hotfix CSS quedan fuera del scope de feature 21 y no fueron tocados —
  verificado por grep.

## Hallazgos

1. **H1 (info, no bloqueante):** el back implementa replace TOTAL pero el
   frontend compensa partiendo desde `reel.descriptionsOverride` en
   `buildPayload`. La afirmación del implementer es correcta. Recomendaría
   añadir un comentario explícito en `update_reel_descriptions_override.py`
   del back para futuro mantenimiento ("wholesale replace; the UI mitigates
   by always sending the full intended map"), pero NO es competencia de
   este review front.
2. **H2 (info):** `EDITABLE_PUBLISH_STATUSES` incluye `'needs-approval'`
   defensivamente aunque el back hoy emite `pending_review`. Si en el
   futuro el back deja de aceptar `'needs-approval'`, el front pediría
   PATCHes que rebotarían 409 — el manejo defensivo del 409 ya cubre eso.
3. **H3 (info):** la spec verifica el flag visual `override` tras Save
   (línea 153) pero no verifica que el contador (`desc-charcount-*`)
   refleje el nuevo length. Cobertura suficiente: el contador es lógica
   trivial de `text.length`.
4. **H4 (mejora opcional, no bloqueante):** no hay test E2E dedicado al
   camino 409 REEL_NOT_EDITABLE forzado por DevTools/race condition. El
   `reportError` lo maneja y el mock lo devuelve correctamente, pero un
   futuro test podría inyectar un `page.route` que intercepta el PATCH y
   devuelve 409 sintético para validar el copy del banner. Cubierto
   defensivamente por el camino read-only.
5. **H5 (info):** `useReel` ahora expone tres campos nuevos
   (`descriptionsOverride`, `publishDescriptionsSnapshot`, `rawPublishStatus`).
   Solo `DescriptionsPanel` los consume; no hay regresión en Dashboard /
   ReelCard / ReelsTable porque éstos siguen leyendo el shape de
   `adaptReelSummary`. Verificado por grep en src/features/reels/.
6. **H6 (estilo):** el ternario triple en `baseline` (líneas 49-54) es
   funcionalmente correcto pero podría simplificarse con
   `?? snapshot?.[s.id] ?? ''`. No bloqueante; el código actual cumple la
   precedencia exacta.

## Acceptance criteria — comparación con feature_list.json

`feature_list.json` id 21 (líneas 421-432) ya está alineado con el back
desplegado: path con tupla `agency_id/site_id/source_property_id`,
estados editables `('needs-approval','pending_review','pending','')`,
códigos `REEL_NOT_EDITABLE`/`PLATFORM_NOT_ENABLED`. Re-leído antes de la
comparación.

## Recomendación

**APPROVED.** Sin cambios solicitados, sin bloqueantes. La implementación:

- cumple los 9 acceptance criteria del `feature_list.json` id 21,
- consume el contrato del back exactamente como está documentado en
  `progress/review_21_per_reel_description_override_endpoint.md`,
- mitiga correctamente el riesgo de la replace-total del back vía
  `buildPayload` que parte de los overrides existentes,
- conserva la arquitectura (hook → api → `lib/api/client.js`, sin fetch
  directos, sin libs nuevas),
- mantiene intactos los handlers de mock-backend de features 18, 20 y 22,
- pasa lint, build, test:smoke, spec dedicado (12/12) y spec de regresión
  (9/9).

NO marco la feature como `done` (compete al leader). El leader puede
proceder a cerrar la feature 21 una vez confirme:

1. Que la concurrencia con feature 22 (que sigue `in_progress`) está
   reconocida y que `./init.sh` falla solo por ese motivo.
2. Verificación manual contra `:8001` con el back desplegado (el contrato
   está validado vía mock, pero el plan menciona un humo manual real con
   un reel `needs-approval` real).
