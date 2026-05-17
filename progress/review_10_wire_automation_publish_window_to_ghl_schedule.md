# Review — feature 10 (wire_automation_publish_window_to_ghl_schedule)

**Veredicto:** APPROVED

Fecha de la revisión: 2026-05-13.
Revisor: agente reviewer (`.claude/agents/reviewer.md`).

## Alcance auditado

- `src/shared/formatScheduledAt.js` (nuevo, helper puro)
- `tests/unit/formatScheduledAt.unit.js` (nuevo, `node --test`)
- `src/features/reels/editor/ReelEditor.jsx` (modificado, sólo
  `handleApprove` — añade rama `scheduled_at`)
- `tests/support/mock-backend.js` (handlers approve/reject/GET reel y
  opt-ins `approveScheduledAt`, `approveIdempotentReplay`)
- `tests/reel_approve_schedule.spec.js` (nuevo, 2 casos × 3 viewports)
- `DOCS.md` (§ Backend contract — Approve scheduling)
- `feature_list.json` (status feature 10 → `in_progress`)
- `progress/current.md` + `progress/impl_10_*.md` (bookkeeping)

Los demás archivos modificados en el working tree (LogoUploader,
DefaultDescriptionsPanel, decodeHtmlEntities, publishStatus, etc.)
pertenecen a features 7/8/9/11 ya cerradas previamente. La feature 10
no las pisa.

## Verificaciones contractuales (reviewer.md)

### Stack / extensiones

- [x] `.js` puro para el helper (`src/shared/formatScheduledAt.js`).
- [x] `.jsx` para el componente (`ReelEditor.jsx`). Sin `.ts`/`.tsx`.

### Layer rules

- [x] `src/shared/formatScheduledAt.js` no importa de `features/`,
  `lib/api/` ni `app/`. De hecho, no tiene imports — es una función
  pura sobre `Intl.DateTimeFormat`.
- [x] `ReelEditor.jsx` consume el approve vía `useApproveReel()` (en
  `features/reels/hooks.js`, que delega en `lib/api/client.js`). No hay
  `fetch(...)` directo en el componente. Confirmado con grep.

### Dependencias

- [x] `package.json` no añade ninguna lib del blocklist
  (`typescript`, `@tanstack/react-query`, `msw`, `styled-components`,
  `@emotion/*`, `tailwindcss`).
- [x] No se añade `date-fns`, `dayjs`, `moment` ni otra lib de fecha.
  El helper usa `Intl.DateTimeFormat`/`Date` del stdlib. El único
  cambio en `package.json` es `"license": "GPL-2.0-only"` (organizativo,
  no funcional).

### Helper puro — edge cases

- [x] Exporta `formatScheduledAt` como named + default. Imports lo usan
  como named (`import { formatScheduledAt } from ...`).
- [x] Función pura: no I/O, no mutaciones, no React, no DOM.
- [x] `null`, `undefined`, `""` → `null`. Cubierto por test 6.
- [x] No-string (number, object, bool) → `null`. Cubierto por test 7.
- [x] ISO inválido / unparseable → `null`. Cubierto por test 8. No
  lanza excepciones (verificado por `assert.equal` en lugar de
  `assert.throws`).
- [x] Offset no-Z (`+02:00`) → normaliza a UTC antes del format.
  Cubierto por test 9.
- [x] Midnight UTC → `00:00`, no `24:00`. Cubierto por test 10.

### TZ — decisión documentada

- [x] `impl_10_*.md` § 2 "Decisiones técnicas" documenta TZ local del
  browser por defecto, con override `timeZone` para tests. Razón:
  permitir al admin ver la hora "como en su oficina" sin hacer math
  mental, y deterministic en CI.
- [x] Tests unit fuerzan TZ explícita (`UTC`, `Europe/Dublin`,
  `America/New_York`, `America/Los_Angeles`) — no fallan según el huso
  del runner.
- [x] Smoke Playwright fuerza `timezoneId: 'UTC'` en el context.
  Output esperado `15/05/2026 a las 09:00` para input
  `2026-05-15T09:00:00Z`. Verificado verde.

### `handleApprove` — conmutación del mensaje

- [x] Lee `result?.scheduled_at` del response y aplica `formatScheduledAt`.
- [x] Si `scheduled_at` formatea no-null → `"Publicará el ${label}."`.
- [x] Si `scheduled_at` null/missing + `idempotent_replay: true` →
  `"Reel already approved, publish in progress."` (preservado).
- [x] Si `scheduled_at` null/missing + sin replay → `"Reel approved."`
  (legacy preservado).
- [x] El bloque de idempotencia / anti-doble-click previo
  (`submitting`, guarda `if (submitting) return;`, `setSubmitting`
  en try/finally) está intacto. El implementer sólo añadió la rama
  `scheduled_at`; la lógica de approve no se ha tocado.

### Copy en español

- [x] `"Publicará el dd/mm/yyyy a las HH:MM."` con punto final.
  Consistente con el resto de la app admin/sources/automation
  (features 8/9 cierran con copy en español).

### Contrato `scheduled_at` (snake_case)

- [x] grep sobre `src/` y `tests/` confirma que el front consume
  `result?.scheduled_at` (snake_case, ISO8601 UTC). No hay literales
  `scheduleDate` (camelCase) en código del front. La descripción
  legacy del `feature_list.json` usaba `scheduleDate` como string
  conversacional, pero el código respeta el contrato `scheduled_at`.

### Mock backend — handler opt-in

- [x] `installMockBackend(page, { approveScheduledAt })` permite
  inyectar el campo en la respuesta. `null` por defecto (regresión
  preserva legacy copy). String → caso scheduled.
- [x] `installMockBackend(page, { approveIdempotentReplay })` permite
  ejercitar el branch idempotente (no usado por feature 10 hoy, pero
  cableado para tests futuros).
- [x] Shape del response coincide con DOCS.md § "Approve scheduling":
  `{ status, agency_id, site_id, source_property_id, idempotent_replay,
  scheduled_at }`.
- [x] `isKnownAdminStub` extendido con los 3 patterns nuevos para no
  disparar el catch-all 404.
- [x] GET `/v1/admin/.../reels/{site}/{prop}` añadido para que el
  editor monte cuando se navega directamente. Devuelve
  `has_video: false` para evitar romper el `<video>` en headless.

### Smoke — `tests/reel_approve_schedule.spec.js`

- [x] 2 tests: caso A (con `scheduled_at`) → banner formateado; caso B
  (sin `scheduled_at`) → legacy copy preservado.
- [x] Selectores robustos: `editor.getByRole('button', { name: /^Approve$/ })`
  scoping en `.editor-overlay` para no colisionar con el botón
  Approve del ReelCard del Dashboard detrás.
- [x] Asserts con `getByText('Publicará el 15/05/2026 a las 09:00.')`
  exact y `getByText(/^Reel approved\.$/)` no-presence en el caso A.
  Y al revés en el caso B.
- [x] Usa `tests/support/mock-backend.js` (no `fetch` directo en el
  test).
- [x] 6 verde (2 tests × 3 viewports desktop/tablet/mobile).

### Sin cambios fuera de scope

- [x] `ReelEditor.jsx` solo añade la rama `scheduled_at` en
  `handleApprove`. El bloque `submitting` / `idempotent_replay`
  estaba ya presente (feature 7-era informal); preservado intacto.
- [x] No toca Pinterest, decodeHtmlEntities (sólo el import nuevo
  para el helper), social-templates UI, brand logo, session,
  `publishStatus.js`, ni la lógica del approve más allá de la
  conmutación del mensaje.

### Console / debugger / regresión

- [x] grep no encuentra `console.log` ni `debugger` en
  `src/shared/formatScheduledAt.js`,
  `src/features/reels/editor/ReelEditor.jsx`,
  `tests/reel_approve_schedule.spec.js`,
  `tests/unit/formatScheduledAt.unit.js`,
  ni `tests/support/mock-backend.js` (cambios feat-10).
- [x] Regresión `"Reel approved."` cuando `scheduled_at` es null
  preservada — caso B del smoke lo asserta explícitamente
  (`editor.getByText('Reel approved.')` visible,
  `getByText(/Publicará el/)` count 0).

## Output de ejecución (verde end-to-end)

### `npm run lint`

```
> 4reels@0.0.0 lint
> eslint .
```

Sin warnings ni errores.

### `npm run build`

```
dist/assets/index-lzl_JQZq.js   372.84 kB │ gzip: 106.75 kB
✓ built in 2.29s
```

### `node --test tests/unit/formatScheduledAt.unit.js`

```
✔ 10 tests pass, 0 fail, duration ~134 ms
```

Los 10 casos del impl:
1. ISO UTC → `15/05/2026 a las 09:00`
2. Zero-pad
3. Dublin (BST +1) → `10:00`
4. New York (EDT -4) → `05:00`
5. LA cruza medianoche → `14/05/2026 a las 18:00`
6. null/undefined/empty → null
7. Non-string → null
8. Unparseable → null (no throw)
9. Offset +02:00 normaliza a UTC
10. Midnight → `00:00`

### `npm run test:smoke`

```
2 skipped
43 passed (1.0m)
```

Los 2 skipped son `theme › flips the data-theme attribute` en
tablet/mobile (regresión preexistente no relacionada con feature 10).

### `npx playwright test tests/reel_approve_schedule.spec.js`

```
6 passed (9.6s)
```

(2 tests × 3 viewports desktop/tablet/mobile.)

### `./init.sh`

```
[OK]    Entorno listo. Puedes empezar a trabajar.
```

## Checkpoints `CHECKPOINTS.md`

- C1 — Arnés completo: [x]
- C2 — Estado coherente: [x] (una sola feature `in_progress`;
  bitácora actualizada).
- C3 — Arquitectura: [x] (helper en `shared/` sin cross-imports;
  componentes vía hooks/api; sin TS/RQ/MSW/tailwind/styled).
- C4 — Verificación real: [x] (lint+build+unit+smoke+spec verdes).
- C5 — Contrato mock-backend vivo: [x] (handler approve documentado
  en DOCS.md § Approve scheduling, registrado en `isKnownAdminStub`,
  opt-in para tests).
- C6 — Sesión bien: [x] (sin console.log/debugger; package.json sin
  deps nuevas; feature_list.json refleja in_progress correctamente).

## Reglas duras del reviewer — todas en verde

- ✓ No añade dep del blocklist.
- ✓ No añade lib de fecha (`date-fns`, `dayjs`, `moment`); usa
  `Intl.DateTimeFormat`.
- ✓ Ningún componente nuevo hace `fetch(...)` directo.
- ✓ `src/shared/formatScheduledAt.js` no importa de `features/`,
  `lib/api/` ni `app/`.
- ✓ Sin `console.log` ni `debugger`.
- ✓ No toca código fuera del scope (Pinterest, decodeHtmlEntities
  cerrada, social-templates UI, brand logo, session, publishStatus;
  ReelEditor solo añade la conmutación del mensaje, no modifica el
  approve idempotency block).
- ✓ Regresión `"Reel approved."` preservada cuando `scheduled_at` es
  null (caso B del smoke).

## Cambios requeridos

Ninguno. Feature 10 lista para cerrar a `done` en `feature_list.json`
por el leader.

## Nota cross-repo

El back debe emitir `scheduled_at: string | null` (ISO8601 UTC) en el
response del approve cuando el motor de scheduling resuelva un slot
futuro. El front ignora `null`/missing (preserva legacy copy). Esto es
forward-compatible: el front no rompe si el back tarda en empezar a
emitir el campo.
