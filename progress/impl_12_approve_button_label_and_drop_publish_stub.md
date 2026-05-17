# Implementation report — feature 12

**Feature:** `approve_button_label_and_drop_publish_stub`
**Estado al cerrar implementer:** `in_progress` → revisión pendiente
**Fecha:** 2026-05-13

## Resumen

Renombrado el botón primario `Approve` a `Approve & Publish` en el header del
editor de reels y eliminada la rama `else` del ternario `canApproveOrReject`
que renderizaba el botón coming-soon `Publish` con el tooltip "Manual publishing
from the editor is on the roadmap...". Cuando un reel no está en
`publishStatus === 'needs-approval'` el header ya no muestra ningún botón de
publicación.

El backend ya publica al recibir `POST /approve` (ver
`progress/explore_backend_approve_publish.md`): `regenerate_reel.py:255` fuerza
`approval_required=False` y encola `reel_publish`, que dispara MEDIA PUBLISH a
las redes vía GoHighLevel. La coexistencia de los dos botones sugería dos pasos
cuando en realidad uno (Approve) hace ambos; el cambio elimina esa ambigüedad.

## Archivos modificados

| Archivo | Tipo | Cambio |
|---|---|---|
| `src/features/reels/editor/ReelEditor.jsx` | component | EditorHeader: label `Approve` → `Approve & Publish` (línea 361). Ternario `canApproveOrReject ? <approve+reject> : <publish-stub>` reemplazado por `canApproveOrReject && <approve+reject>`. Borradas líneas 372-381 (botón Publish coming-soon y su tooltip). |
| `tests/reel_approve_schedule.spec.js` | test | Selectores `getByRole('button', { name: /^Approve$/ })` actualizados a `/^Approve & Publish$/` en líneas 71 y 109. El comentario "don't collide with the ReelCard Approve button" sigue siendo correcto: la ReelCard mantiene el texto literal "Approve" (no se modificó), y el regex `/^Approve & Publish$/` desambigua de forma natural. |

## Archivos NO tocados (intencional)

- `src/features/reels/ReelCard.jsx` — la tarjeta del Dashboard mantiene el botón
  inline "Approve" (acceptance del feature solo pide cambio en el editor).
- `src/features/automation/ReviewModeDetails.jsx` — ya usa "Approve & publish"
  en una explicación textual del modo automático; no es un botón funcional.
- `tests/support/mock-backend.js` — la variable `isApprove` se basa en el path
  `/approve` (no en el label visible).
- Backend.

## Verificación ejecutada

```text
$ ./init.sh
[OK] lint verde
[OK] build verde
[OK] Entorno listo

$ npm run test:smoke
43 passed (58.0s) — 2 skipped (theme tests con SKIP esperado)

$ grep -rn "Manual publishing from the editor" src/
(0 hits)

$ grep -rn 'name: /\^Approve\$/' tests/
(0 hits)

$ grep -rn "Approve & Publish" src/
src/features/reels/editor/ReelEditor.jsx:361:            {approving ? <Spinner /> : <Icon name="check" size={14} />} Approve & Publish
```

## Acceptance criteria → estado

| Criterio | Estado |
|---|---|
| Label "Approve & Publish" en el botón primario del header cuando `publishStatus === 'needs-approval'` | OK (línea 361) |
| Rama else del ternario eliminada; cuando `publishStatus !== 'needs-approval'` el header no muestra botón de publicación | OK (ahora es `&&` simple, líneas 353-371) |
| Tooltip "Manual publishing from the editor" fuera del bundle | OK (`grep` devuelve 0 hits) |
| Smoke tests del approve siguen verdes con los nuevos selectores | OK — `test:smoke` 43 passed |
| `npm run lint` verde | OK |
| `npm run build` verde | OK |
| `npm run test:smoke` verde | OK |

## Notas / decisiones no obvias

- **Spec `reel_approve_schedule.spec.js` en `tablet` falla, pero NO es regresión
  introducida por esta feature.** Verificado haciendo `git stash` del cambio y
  re-ejecutando `npx playwright test tests/reel_approve_schedule.spec.js
  --project=tablet`: los 2 tests también fallan en el código pre-cambio con el
  mismo síntoma — el click sobre el botón Approve es interceptado por
  `.editor-preview-col` a anchura tablet (claim: layout pre-existente que
  superpone preview sobre header en ese viewport). Tras revertir el stash, el
  cambio queda íntegro. El target del feature es `test:smoke` (que sólo corre
  `smoke flows`, no este spec) y permanece verde. El bug de layout tablet del
  approve banner queda fuera del scope de feature 12; debería tratarse como
  feature aparte si interesa fix.
- El `&&` simple deja un `<></>` con dos botones; alternativa con `<Fragment>`
  explícito no aporta nada — el `&&` es idiomático en el resto del repo (ver
  el render condicional de `StatusBadge` en línea 335).
- No se tocó la ReelCard porque (a) el acceptance solo menciona el editor y
  (b) modificarla cambiaría el comportamiento del approve inline en Dashboard,
  que tiene su propio flujo y selectores.

## Pendiente

- Reviewer.
- Si el reviewer aprueba: cambiar estado a `done` en `feature_list.json`,
  mover este resumen al final de `progress/history.md`, vaciar
  `progress/current.md`.
