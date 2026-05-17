# impl 10 — `wire_automation_publish_window_to_ghl_schedule`

## Resumen

Cuando el backend amplía la respuesta del `POST /approve` con un campo
nuevo `scheduled_at` (ISO8601 UTC), el banner de éxito en el
`ReelEditor` pasa de `"Reel approved."` a
`"Publicará el dd/mm/yyyy a las HH:MM."` (TZ local del browser). Cuando
`scheduled_at` es `null` o falta, se conserva el comportamiento actual
("Reel approved." o "Reel already approved, publish in progress." si
fue un replay idempotente).

Frontend-only: una utility pura (`formatScheduledAt`) y una integración
mínima en `handleApprove`. El handler del mock se amplía con un opt-in
para los tests. Sin nuevas dependencias.

## Archivos creados / modificados

| Archivo | Tipo | Motivo |
|---|---|---|
| `src/shared/formatScheduledAt.js` | nuevo (shared util) | Helper puro ISO8601 UTC → `"dd/mm/yyyy a las HH:MM"`, con TZ override para tests |
| `tests/unit/formatScheduledAt.unit.js` | nuevo (unit test) | 10 casos vía `node --test` (UTC, Dublin, NY, LA edge, null/empty/inválido/no-string, offset suffix, midnight) |
| `src/features/reels/editor/ReelEditor.jsx` | modificado (component) | `handleApprove` lee `result.scheduled_at` y prefiere el mensaje programado cuando llega no-nulo; preserva idempotent replay y anti-doble-click intactos |
| `tests/support/mock-backend.js` | modificado (test infra) | Handler `POST /approve` y `POST /reject` para reels individuales + handler `GET /reels/{site}/{prop}` para que el editor monte; opt-in `installMockBackend(page, { approveScheduledAt, approveIdempotentReplay })` |
| `tests/reel_approve_schedule.spec.js` | nuevo (Playwright spec) | Caso A: `scheduled_at` presente → banner formateado. Caso B: `scheduled_at: null` → banner legacy |
| `DOCS.md` | edit (backend contract) | Apartado nuevo "Approve scheduling" en § Backend contract |
| `feature_list.json` | edit | Feature 10 → `in_progress` |
| `progress/current.md` | edit | Header de sesión + plan + decisiones |
| `progress/impl_10_wire_automation_publish_window_to_ghl_schedule.md` | nuevo | Este informe |

No se ha tocado ningún archivo fuera del scope (Pinterest,
decodeHtmlEntities, social-templates, brand logo, session, publishStatus,
ReelEditor idempotency/anti-doble-click): todos esos cambios previos
permanecen exactamente como estaban.

## Decisiones técnicas

1. **`Intl.DateTimeFormat` en vez de `date-fns`/`dayjs`/`moment`.** El
   blocklist de `docs/architecture.md` ya proscribe deps de fecha. Para
   un único banner basta con `Intl.DateTimeFormat` (estándar, todos los
   browsers target). Usamos `formatToParts` y montamos a mano la cadena
   `"dd/mm/yyyy a las HH:MM"` para garantizar el orden/ punctuation
   exactos del spec aunque cambie el locale.

2. **TZ del display: local del browser por defecto, override en tests.**
   `formatScheduledAt(iso)` sin opciones usa la TZ resuelta por
   `Intl.DateTimeFormat` (la del navegador). Para tests reproducibles,
   el helper acepta `{ timeZone: 'UTC' | 'Europe/Dublin' | ... }`.
   Esto evita que los unit tests fallen en CI según el huso del runner.

3. **Helper en `src/shared/` (no inline en el componente).**
   - Permite unit test puro con `node --test` (sin React, sin DOM).
   - Respeta `layer rules` de `ARCHITECTURE.md`: shared/ no importa de
     features/ ni de lib/api/. Cumple.

4. **Copy en español (`"Publicará el ..."`).** El resto de copy de
   módulos admin (Sources, Defaults, Brand) ya está en español según
   bitácoras (`progress/impl_8_*.md`, `progress/impl_9_*.md`).
   Mantenemos consistencia.

5. **Idempotent replay vs scheduled_at.** En `handleApprove`:
   - `scheduled_at` no-nulo → mensaje programado (gana siempre).
   - `scheduled_at` null + `idempotent_replay: true` →
     `"Reel already approved, publish in progress."` (preservado).
   - `scheduled_at` null + sin replay → `"Reel approved."` (legacy).
   Si el back un día devuelve `scheduled_at` + `idempotent_replay`,
   el usuario ve la fecha (que es lo útil) y se pierde el aviso de
   replay (poco accionable). El test no cubre esa combinación porque
   el back no la documenta en este sprint; cubrirla cuando aparezca.

6. **El helper acepta offsets no-Z.** `new Date('2026-05-15T09:00:00+02:00')`
   normaliza a UTC antes del format → robusto si el back devuelve algún
   día un offset no-Z (hoy promete UTC con `Z`).

7. **El mock-backend handler para `POST /approve` también amplía el shape
   de `POST /reject`** (mismo handler) para consistencia, pero los tests
   sólo asertan approve. El handler GET de la reel individual responde
   con `has_video: false` para que el `<video>` no salga del overlay.

## Output de la verificación

### `node --test tests/unit/formatScheduledAt.unit.js`

```
ℹ tests 10
ℹ suites 0
ℹ pass 10
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms ~130
```

Casos cubiertos:
1. ISO UTC → `15/05/2026 a las 09:00` (TZ=UTC).
2. Zero-pad de día/mes/hora/minuto < 10.
3. TZ Europe/Dublin con DST: `09:00Z` → `10:00`.
4. TZ America/New_York con EDT: `09:00Z` → `05:00`.
5. TZ America/Los_Angeles cruza medianoche → fecha del día anterior.
6. `null` / `undefined` / `""` → `null`.
7. No-strings (number, object, bool) → `null`.
8. Strings no parseables → `null` (no throw).
9. Offset `+02:00` se normaliza a UTC.
10. Medianoche UTC sale como `00:00` (no `24:00`).

### `npm run lint`

```
> 4reels@0.0.0 lint
> eslint .
```

Sin warnings ni errores.

### `npm run build`

```
✓ built in 2.24s
dist/assets/index-lzl_JQZq.js   372.84 kB │ gzip: 106.75 kB
```

Bundle creció ~0.75 kB (gzip ~0.31 kB) vs. el build anterior, todo
atribuible al helper + branch nuevo en `handleApprove`.

### `npm run test:smoke`

```
2 skipped
43 passed (1.0m)
```

Los 2 skipped son los `theme › flips the data-theme attribute` en
tablet/mobile (no relacionados con esta feature).

### `npx playwright test tests/reel_approve_schedule.spec.js`

```
6 passed (9.7s)
```

(2 tests × 3 viewports.)

### `npm run test:e2e` (full suite, por buena vecindad)

```
2 skipped
82 passed (1.3m)
```

Sin regresiones en feature 6 (payload_contract), 8 (social_templates),
9 (brand_logo_upload), 11 (no spec aparte), música, smoke, flows,
ghl_context, admin_auth.

## Endpoints añadidos / cambiados en el mock

### Handler nuevo: `POST /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/approve`

- **Request body**: ninguno.
- **Response 200**:
  ```json
  {
    "status": "approved",
    "agency_id": "<uuid>",
    "site_id": "ckp.ie",
    "source_property_id": "42",
    "idempotent_replay": false,
    "scheduled_at": "2026-05-15T09:00:00Z"
  }
  ```
  - `scheduled_at`: `string | null`. `null` por default; el test opta-in
    via `installMockBackend(page, { approveScheduledAt: '2026-05-15T09:00:00Z' })`.
  - `idempotent_replay`: `false` por default; el test opta-in via
    `installMockBackend(page, { approveIdempotentReplay: true })`.
  - Estos campos cubren el shape canónico que el back va a empezar a
    devolver. Si el back añade más campos no-breaking, el front los
    ignora.

### Handler nuevo: `POST /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/reject`

- Mismo shape sin `scheduled_at` / `idempotent_replay`. Existe sólo para
  no romper si un test futuro decide ejercitar reject.

### Handler nuevo: `GET /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}`

- Busca la reel en la lista seedada por el test (`options.reels`) y la
  devuelve dentro de `{ reel: ... }` con `has_video: false`. 404 si no
  hay match. Necesario para que el editor monte cuando se navega
  directamente a `/reels/{site}/{prop}`.

### Handler nuevo: `GET /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/images`

- Responde `{ items: [], count: 0 }` por defecto. No hay opt-in para
  seedear imágenes hoy (no lo necesita ningún test); fácil de añadir
  cuando lo pida una feature futura.

### `isKnownAdminStub`

- Extendido con los 3 patterns nuevos para que el catch-all 404 (`No
  mock stub for this admin path`) no se dispare en estos endpoints.

## Cambios en `DOCS.md`

Añadido el ítem "Approve scheduling" en § Backend contract, justo
debajo de "Approvals — transactional emails …". Documenta:

- Shape del response de `POST /approve` (`scheduled_at: string | null`,
  ISO8601 UTC).
- Semántica: `null`/missing = inmediato (copy legacy); string = programado
  (banner formateado en TZ local del browser).
- Interacción con `idempotent_replay`: `scheduled_at` gana cuando ambos
  vienen no-vacíos.

## Comprobación de acceptance

- [x] Tras un `POST /approve` exitoso, si la respuesta trae
  `scheduled_at`, el ReelEditor muestra
  `"Publicará el dd/mm/yyyy a las HH:MM."` en vez de `"Reel approved."`.
  → caso A del spec `reel_approve_schedule.spec.js`.
- [x] Si `scheduled_at` es null/missing, el mensaje sigue siendo
  `"Reel approved."` (comportamiento actual).
  → caso B del spec.
- [x] Smoke test del flujo con scheduleDate.
  → `tests/reel_approve_schedule.spec.js` cubre A y B en desktop +
  tablet + mobile (6 verdes).
- [x] `npm run lint` verde.
- [x] `npm run build` verde.
- [x] `npm run test:smoke` verde (43 passed, 2 skipped existentes).

## Estado

Pendiente revisión por el agente reviewer. NO marcado `done`.
