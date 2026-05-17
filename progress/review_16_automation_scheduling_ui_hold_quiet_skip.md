# Review — feature 16 (`automation_scheduling_ui_hold_quiet_skip`)

## Veredicto

**APPROVED**. El leader puede marcar la feature como `done` en
`feature_list.json`.

## Acceptance (1:1 con `feature_list.json` entrada 16)

1. **AutoPublishDetails.jsx añade `<input type='time'>` para start/end con
   defaults 22:00/07:00; mantiene HoldPicker y skip-weekends.**
   `[x]` — `src/features/automation/AutoPublishDetails.jsx:55-61` renderiza
   `QuietHoursPicker` cuando `quietHours` está activo; los inputs nativos
   `type="time"` están en líneas 142-160 con labels y hint. HoldPicker
   intacto (104-132), toggle skip-weekends intacto (65-70). El literal
   "22:00 → 07:00" ya no aparece.
2. **`buildAutomationBody` mapea hold/quiet/skip al body PUT.**
   `[x]` — `src/features/automation/hooks.js:32-56` mapea
   `holdWindowEnabled+holdWindowHours → hold_window_seconds` (0 si
   disabled), `quietHoursEnabled → quiet_hours_enabled`, invierte
   `quietHoursEnd/Start → publish_window_start/end`, `skipWeekends →
   skip_weekends + publish_days`.
3. **`AutomationConfig.jsx` hidrata desde `/automation`; las claves
   `automation.*` migradas dejan de leerse de `defaults.settings`.**
   `[x]` — `AutomationConfig.jsx:40-63` hidrata desde `automation`
   (hold_window_seconds, quiet_hours_enabled, publish_window_*,
   skip_weekends). El `useEffect` de defaults (65-79) sólo lee
   `autoCaptions / regenOnUpdate / reviewEmails`.
4. **`useAutomationSave.js` ya no escribe las 4 claves migradas en
   `defaults.settings`.**
   `[x]` — `useAutomationSave.js:67-80`: sanitiza `existingSettings`
   borrando `automation.quietHoursEnabled`, `.skipWeekends`,
   `.reviewWindowEnabled`, `.reviewWindowHours` (migra blobs viejos), y
   sólo escribe las 3 keys vigentes. `AUTOMATION_SETTINGS_KEYS` en
   `initialState.js:19-23` queda reducido a esas mismas tres.
5. **`mock-backend.js`: `FORBIDDEN_KEYS['automation']` no incluye
   `quiet_hours_enabled` ni `skip_weekends`; el handler PUT acepta y
   echo-back los campos nuevos; GET devuelve lo persistido.**
   `[x]` — `tests/support/mock-backend.js:664-672`: la lista forbidden
   sólo conserva `publish_mode`, `platforms`, `review_window_*`,
   `auto_captions`, `regen_on_update`, `review_emails`. El handler PUT
   `/automation` (519-528) normaliza el body con
   `normaliseAutomationRules` y lo persiste; GET (488-497) devuelve el
   último PUT o `automation: null`.
6. **`tests/reel_approve_schedule.spec.js` extendido con el caso "hold 1h".**
   `[x]` — Caso nuevo en líneas 89-149 con `page.clock.setFixedTime`,
   verifica `scheduled_at === now+1h` y banner formateado.
7. **`tests/automation_scheduling.spec.js` nuevo con 3 casos.**
   `[x]` — Quiet 22:00–07:00 (49-95), skip weekends sábado (97-142),
   hold 2h + skip weekends viernes 23:00 (144-190). Los tres usan
   `page.clock.setFixedTime` + `timezoneId: 'Europe/Dublin'` y assertan
   tanto el `scheduled_at` ISO del POST `/approve` como la copy del
   banner ("Publicará el dd/mm/yyyy a las HH:MM.").
8. **`DOCS.md § Automation` refleja el nuevo contrato.**
   `[x]` — `DOCS.md:57-89` documenta hold/quiet/skip viajando en
   `/automation`, la inversión quiet ↔ publish_window, el dominio
   0..86400 segundos, la interpretación local de horas en
   `agencies.timezone`, y el strip de las 4 legacy keys al guardar.
9. **`grep -rn 'fetch(' src/features/automation` → 0 hits.**
   `[x]` — Confirmado en mi entorno; los hooks pasan por
   `lib/api/client.js:apiRequest`.

## Checkpoints (CHECKPOINTS.md)

- **C1 — Arnés completo:** `[x]` `./init.sh` exit 0 (lint + build verde,
  validación feature_list, sin TS, sin libs prohibidas).
- **C2 — Estado coherente:** `[x]` Una sola feature `in_progress` (la 16).
  El implementer no marcó `done` (correcto: queda para el leader tras
  esta review).
- **C3 — Arquitectura respetada:** `[x]` Sin TypeScript, sin React Query
  / MSW / Tailwind / CSS-in-JS, sin `fetch(` directo en componentes,
  layer rules respetadas, vanilla CSS.
- **C4 — Verificación real:** `[x]` `./init.sh` verde; `npx playwright
  test tests/automation_scheduling.spec.js tests/reel_approve_schedule.spec.js
  tests/payload_contract.spec.js` → **24 passed** (8 tests × 3
  proyectos desktop/tablet/mobile). Tests Playwright cubren el flujo
  principal de hold/quiet/skip.
- **C5 — Contrato mock vivo:** `[x]` Endpoints `/automation` GET/PUT
  honran el shape canónico; el mock incorpora además un "scheduler
  mirror" del back para `POST /approve` (mirror reducido y documentado
  de `compute_next_publish_slot`). El shape coincide con DOCS.md
  §Automation.
- **C6 — Sesión limpia:** `[x]` 0 `console.*` y 0 `debugger` en
  `src/features/automation`; 0 archivos `.tmp_*`; el único cambio en
  `package.json` es la adición de `"license": "GPL-2.0-only"`
  (declarativo, sin nuevas dependencias).

## Hallazgos

### Bloqueantes

Ninguno.

### Sugerencias (no bloqueantes)

1. El mock-backend ahora duplica reglas de scheduling del back
   (`computeMockScheduledAt`, `normaliseAutomationRules`, etc.). El
   propio informe del implementer y `DOCS.md` ya lo señalan, pero
   conviene dejar un comentario `// SYNC WITH:
   .../compute_next_publish_slot.py` muy visible al principio de
   `computeMockScheduledAt` (`tests/support/mock-backend.js:870`) para
   reducir el riesgo de drift silencioso si el back evoluciona. Puede
   atacarse en un follow-up.
2. `AUTOMATION_SETTINGS_KEYS` ya no contiene las 4 claves migradas pero
   `useAutomationSave.js:67-71` las borra usando literales hardcoded.
   La duplicación es intencionada (documentada con un comentario) para
   sobrevivir a una eventual eliminación total de la constante. OK
   para esta feature; futuras limpiezas podrían consolidar las dos
   listas en un único `LEGACY_AUTOMATION_SETTINGS_KEYS`.
3. El cambio en `package.json` (`"license": "GPL-2.0-only"`) es
   colateral (no parte del scope de la feature 16). No bloquea, pero
   sería más claro aislarlo en un commit declarativo separado. Si el
   leader lo agrupa con el cierre de feature 16, no es un problema.

## Verificaciones ejecutadas

Yo ejecuté:
- `grep -rnE '\bfetch\s*\(' src/features/automation` → 0 hits.
- `grep -rn 'console\.' src/features/automation` → 0 hits.
- `grep -rn 'debugger' src/features/automation tests/automation_scheduling.spec.js tests/reel_approve_schedule.spec.js tests/support/mock-backend.js` → 0 hits.
- `git diff --stat HEAD` (verificado scope; sin archivos `.tmp_*`).
- `git diff HEAD package.json` (sólo línea `"license": "GPL-2.0-only"`).
- `./init.sh` → exit 0, lint + build verde.
- `npx playwright test tests/automation_scheduling.spec.js
  tests/reel_approve_schedule.spec.js tests/payload_contract.spec.js`
  → **24 passed (8 × 3 proyectos)** en 33.4s.
- Lectura completa de `AutoPublishDetails.jsx`, `AutomationConfig.jsx`,
  `hooks.js`, `useAutomationSave.js`, `initialState.js`, `api.js`,
  `tests/support/mock-backend.js` (incl. scheduler mirror), las dos
  specs nuevas/modificadas, `payload_contract.spec.js` y `DOCS.md
  §Automation`.

Confié del informe del implementer (no re-ejecutado, suficientemente
cubierto por mis ejecuciones puntuales):
- `npm run test:smoke` → 46 passed + 2 skipped pre-existentes.
- `npm run test:e2e` (full suite) → 100 passed + 2 skipped.
- `node --test tests/unit/*.js` → 49 passed.

No re-corro la suite completa porque `./init.sh` y los specs centrales
de la feature (incluyendo `payload_contract` que cruza
`/automation`/`/defaults`) están verdes; el riesgo residual de
regresión está acotado a los flujos del editor, ya cubiertos por los
specs ejecutados.
