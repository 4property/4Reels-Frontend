# Review — feature 14 (map_backend_publish_status_values)

**Veredicto:** APPROVED

## Resumen

Verificado el mapeo de los `publish_status` reales del backend
(`pending_review`, `pending_publish`, `skipped`) contra el acceptance
de la feature 14. Todos los puntos del acceptance se cumplen; `./init.sh`
y `npm run test:smoke` quedan en verde; el test unitario nuevo pasa
14/14. No se han tocado archivos del backend.

## Verificación punto por punto

### 1. `src/features/reels/publishStatus.js`

- `pending_review` → `'needs-approval'`: línea 46
  (`if (status === 'awaiting_review' || status === 'pending_review') return 'needs-approval';`).
- `awaiting_review` se conserva como alias legacy: misma línea 46.
- `pending_publish` → `'publishing'`: línea 47.
- `skipped` → `'skipped'`: línea 48.
- Case-insensitive: línea 42 sigue haciendo `.toLowerCase()` antes del
  match. Test `PENDING_REVIEW maps to "needs-approval"` cubre el
  caso (test 13/14, verde).
- JSDoc (líneas 1-40) lista los valores reales que emite hoy el
  backend (`pending`, `pending_review`, `pending_publish`, `skipped`,
  `failed`, `rejected`, `published`, `partial`) y marca explícitamente
  `awaiting_review` como alias legacy. La nota sobre los badges UI
  refleja las dos nuevas entradas (`publishing`, `skipped`). [OK]

### 2. `src/shared/StatusBadge.jsx`

- `publishing` (`cls: 'info'`, `label: 'Publishing…'`): línea 11.
- `skipped` (`cls: ''`, `label: 'Skipped'`): línea 12.
- Entradas pre-existentes intactas: `ready`, `rendering`,
  `needs-review`, `needs-approval`, `failed`, `published`,
  `scheduled`, `rejected`, `draft` (líneas 2-10). El shape del componente
  (línea 15 onwards) no cambió. [OK]

### 3. `src/features/admin/AgencyConfigDrawer.jsx`

- Línea 810:
  `Reels stop at <code>pending_review</code> until manually approved.`
  Antes era `awaiting_review`. `grep "awaiting_review" src/` ya no
  encuentra el archivo. [OK]

### 4. `tests/unit/publishStatus.unit.js`

- Existe; usa `node:test` (`import { test } from 'node:test'`, línea 17)
  y `node:assert/strict`. Sin Vitest/Jest. [OK]
- Cubre los 14 casos del acceptance:
  1. `awaiting_review` → `needs-approval`
  2. `pending_review` → `needs-approval`
  3. `pending_publish` → `publishing`
  4. `skipped` → `skipped`
  5. `published` → `published`
  6. `partial` → `published`
  7. `approved` → `published`
  8. `rejected` → `rejected`
  9. `failed` → `failed`
  10. `''` → `pending` (fallback)
  11. `null, null` → `pending` (fallback)
  12. `null, 'rendering'` (fallback a `workflow_state`)
  13. `PENDING_REVIEW` (case-insensitive)
  14. `unknown_state` (passthrough)
- Resultado de `node --test tests/unit/publishStatus.unit.js`:
  `tests 14 / pass 14 / fail 0`. [OK]

### 5. Sin regresiones en `ReelCard.jsx` / `ReelEditor.jsx`

- `src/features/reels/ReelCard.jsx:54`:
  `{reel.publishStatus === 'needs-approval' ? (` — sigue como antes.
- `src/features/reels/editor/ReelEditor.jsx:318`:
  `const canApproveOrReject = reel.publishStatus === 'needs-approval';`
  — sigue como antes.
- Como el map ahora devuelve `'needs-approval'` también para
  `pending_review`, ambos componentes recuperan los botones
  Approve/Reject sin tocar nada — coherente con el síntoma reportado
  (`/reels` no mostraba el botón). [OK]
- `Dashboard.jsx:40,48` también usa `'needs-approval'` como key del
  filtro/contador; no se rompe. [OK]

### 6. `./init.sh` y `npm run test:smoke`

- `./init.sh`: lint verde, build verde, sin TS en `src/`, sin libs
  prohibidas, feature_list válido. Entorno OK. [OK]
- `npm run test:smoke`: 43 passed, 2 skipped (tests de tema
  pre-existentes, no relacionados con esta feature). [OK]

### 7. Backend no tocado

- `/opt/projects/4Reels-Backend` no aparece en los archivos modificados
  del informe. El backend tiene cambios sin commit pre-existentes
  (otras features de backend), pero ninguno se introdujo en este
  trabajo — el implementer trabajó exclusivamente sobre
  `4Reels-Frontend`. [OK]

## Checkpoints (CHECKPOINTS.md)

- C1 — Arnés completo: [x] (init.sh verde, archivos base presentes).
- C2 — Estado coherente: [x] (esta feature aún en estado `pending` en
  `feature_list.json`; el leader la marcará `done` tras este review).
- C3 — Arquitectura: [x] (sin TS, sin libs prohibidas; los 4 archivos
  tocados son módulos puros / componentes shared / componentes feature
  sin `fetch` directo; `shared/StatusBadge.jsx` sólo recibe `status`
  por prop y no importa de `features/` ni de `lib/api/`;
  `publishStatus.js` es un módulo puro string→string).
- C4 — Verificación real: [x] (lint, build, test:smoke, unit test
  todos verdes).
- C5 — Mock contract: [x] N/A (esta feature no añade endpoints
  nuevos; sólo reinterpreta valores ya presentes en el shape).
- C6 — Cierre limpio: [x] (sin `console.*` / `debugger` en los
  archivos tocados; sin nuevas deps en `package.json`).

## Cambios requeridos

Ninguno.

## Notas / observaciones no bloqueantes

- El informe del implementer menciona la coexistencia de
  `tests/unit/mapPublishStatus.unit.js` (legacy, 10 casos, sigue
  verde) y el nuevo `tests/unit/publishStatus.unit.js` (14 casos).
  El acceptance pedía explícitamente el nuevo archivo; mantener el
  antiguo no rompe nada, pero es housekeeping pendiente para una
  futura feature. No bloquea esta aprobación.
- `tests/reel_approve_schedule.spec.js:38-39` aún usa
  `awaiting_review` como `publish_status` en la fixture. Es correcto:
  prueba precisamente el alias legacy, que el map sigue soportando.
  No requiere cambio.
