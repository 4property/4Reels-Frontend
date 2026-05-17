# Plan — UI de "esperar antes de publicar" en Automation (front-A)

> Plan persistido el 2026-05-13 por el leader, aprobado por el usuario.
> Sin implementación todavía. La feature se abre como `pending` en
> `feature_list.json` (entrada 16) y se ejecutará en una próxima sesión
> vía `implementer` + `reviewer`.

> **Contexto completo (cross-repo):** ver
> `/opt/projects/4Reels-Backend/progress/plan_scheduled_publish_window_v2.md`.
> Este archivo cubre sólo la parte frontend (feature 16 del front,
> que depende de la feature 13 del back).

---

## 1. Contexto

### 1.1 Síntoma reportado
El usuario configura un reel para que espere un tiempo antes de
publicarse desde la pestaña *Automation* y se publica al instante.

### 1.2 Causa raíz (resumen)
La pestaña *Automation* guarda los tres controles relevantes ("Hold
window", "Quiet hours", "Skip weekends") en
`/v1/admin/agencies/{id}/defaults.settings` con claves namespaced
(`automation.reviewWindowEnabled`, `automation.reviewWindowHours`,
`automation.quietHoursEnabled`, `automation.skipWeekends`). El backend
**ignora** esas claves al calcular el `scheduleDate` del POST a GHL.
Sólo lee `publish_window_start`, `publish_window_end` y `publish_days`
del PUT `/automation`, que la pestaña **no envía**.

La feature 13 del back añadirá 3 columnas
(`hold_window_seconds`, `quiet_hours_enabled`, `skip_weekends`) al
schema y al payload Pydantic. Esta feature de front (id 16) hace los
PUTs correctos y mueve las tres claves de `defaults.settings` a
`/automation`.

---

## 2. Modelo (acordado con el usuario)

| UI control existente | Estado actual (persistencia) | Nuevo destino |
|---|---|---|
| Toggle "Hold each reel before posting" + chip 30m/1h/2h/4h/8h/24h + input custom | `defaults.settings['automation.reviewWindowEnabled']` y `.reviewWindowHours` | `/automation.hold_window_seconds: int` (0 ↔ disabled) |
| Toggle "Respect quiet hours" + **NUEVO: time pickers start/end (defaults 22:00 / 07:00)** | `defaults.settings['automation.quietHoursEnabled']` | `/automation.quiet_hours_enabled: bool` + `/automation.publish_window_start` / `.publish_window_end` (horas **permitidas** = inverso del quiet) |
| Toggle "Don't publish on weekends" | `defaults.settings['automation.skipWeekends']` | `/automation.skip_weekends: bool` + `/automation.publish_days: string[]` (`['mon'..'fri']` si skip, `['mon'..'sun']` si no) |

**Timezone:** se interpreta como hora local de la agency
(`agencies.timezone`, configurable en `CreateAgencyModal.jsx` /
`AgencyConfigDrawer.jsx`). El front no convierte; el back hace el
mapping en `compute_next_publish_slot` (feature 14).

---

## 3. Archivos a tocar

### 3.1 `src/features/automation/AutoPublishDetails.jsx`

- **Mantener:** Toggle hold window + `HoldPicker` (chip selector +
  input custom). UI ya existente.
- **Añadir:** dos `<input type="time">` (start y end) cuando el
  toggle "quiet hours" esté activo. Defaults: `22:00` y `07:00`.
- **Mantener:** Toggle skip weekends.
- **Mantener:** `<network chips>` (independiente, persiste en
  `defaults.platforms`).
- **Eliminar:** el texto hardcoded "22:00 → 07:00" del toggle de quiet
  hours (ahora las horas son editables).

### 3.2 `src/features/automation/hooks.js:25-36` (`buildAutomationBody`)

Nuevo mapping del state al body PUT `/automation`:

```javascript
export function buildAutomationBody(state) {
  const body = {
    approval_required: state.publishMode === 'review',
  };
  if (state.triggerOnStatus !== undefined && state.triggerOnStatus !== null) {
    body.trigger_on_status = state.triggerOnStatus;
  }

  // Hold window
  body.hold_window_seconds = state.holdWindowEnabled
    ? Math.round((state.holdWindowHours ?? 0) * 3600)
    : 0;

  // Quiet hours (invertido: publish_window = horas permitidas)
  body.quiet_hours_enabled = Boolean(state.quietHoursEnabled);
  if (state.quietHoursEnabled) {
    body.publish_window_start = state.quietHoursEnd;   // p. ej. "07:00"
    body.publish_window_end = state.quietHoursStart;   // p. ej. "22:00"
  }

  // Skip weekends
  body.skip_weekends = Boolean(state.skipWeekends);
  body.publish_days = state.skipWeekends
    ? ['mon', 'tue', 'wed', 'thu', 'fri']
    : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  return body;
}
```

### 3.3 `src/features/automation/AutomationConfig.jsx:35-68` (hidratación)

Leer **siempre** desde `/automation` (no de `/defaults.settings`):

```javascript
useEffect(() => {
  if (!automation) return;
  // hold
  setHoldWindowEnabled((automation.hold_window_seconds ?? 0) > 0);
  setHoldWindowHours((automation.hold_window_seconds ?? 0) / 3600);
  // quiet (invertir publish_window → quietHours)
  setQuietHoursEnabled(Boolean(automation.quiet_hours_enabled));
  if (automation.publish_window_start && automation.publish_window_end) {
    setQuietHoursStart(automation.publish_window_end);   // back guarda al revés
    setQuietHoursEnd(automation.publish_window_start);
  }
  // skip
  setSkipWeekends(Boolean(automation.skip_weekends));
}, [automation]);
```

Eliminar la lectura de
`settings[AUTOMATION_SETTINGS_KEYS.reviewWindowEnabled]`,
`.quietHoursEnabled`, `.skipWeekends` del `useEffect` que hidrataba
desde defaults (esos toggles ya no viven allí).

Mantener la lectura desde `defaults.settings` de
`auto_captions`, `regen_on_update`, `review_emails`,
`review_window_*` (no afectan al `scheduleDate`).

### 3.4 `src/features/automation/useAutomationSave.js:28-104`

- Mantener el PUT a `/automation` con el body extendido.
- Eliminar de `mergedSettings` las claves
  `automation.reviewWindowEnabled`, `automation.reviewWindowHours`,
  `automation.quietHoursEnabled`, `automation.skipWeekends` (ya no
  viajan por `defaults`).
- **Auditar:** si esas claves se leen desde otro componente, migrar
  esa lectura a `/automation` también; si no se leen, borrarlas.

### 3.5 `tests/support/mock-backend.js:453-637`

- **Quitar** de `FORBIDDEN_KEYS['automation']`:
  `quiet_hours_enabled`, `skip_weekends`. (Mantener
  `review_window_enabled`, `review_window_hours`, `auto_captions`,
  `regen_on_update`, `review_emails`, `publish_mode`, `platforms` —
  siguen siendo de `/defaults`.)
- Aceptar y echo-back `hold_window_seconds`,
  `quiet_hours_enabled`, `skip_weekends`, `publish_window_*`,
  `publish_days` en el handler PUT `/automation`.
- GET `/automation` debe devolver shape coherente con defaults reales
  del back (cuando no hay rules, `null`; tras un PUT, persiste).

### 3.6 Tests E2E

- **Extender** `tests/reel_approve_schedule.spec.js`: tras configurar
  hold window = 1 h, aprobar reel y verificar que el banner muestra
  un `scheduled_at` ~1 h en el futuro (mock backend computa el slot).
- **Nuevo** `tests/automation_scheduling.spec.js`:
  - Caso A: quiet hours 22:00–07:00 activadas, aprobar reel a las
    23:00 local mediante system clock mock → banner "Publicará el
    [día siguiente] a las 07:00".
  - Caso B: skip weekends activado, aprobar reel sábado 10:00 →
    banner "Publicará el lunes …".
  - Caso C: hold 2 h + skip weekends, aprobar viernes 23:00 → banner
    apunta al lunes a las 07:00.

### 3.7 `DOCS.md:57-73`

Actualizar la sección "Automation" para reflejar:
- `hold_window_seconds`, `quiet_hours_enabled`, `skip_weekends` viajan
  en `/automation` (no en `/defaults.settings`).
- La semántica invertida quiet ↔ publish_window.
- El back interpreta horas en hora local de la agency
  (`agencies.timezone`).

---

## 4. Componentes reutilizables

- `<input type="time">` nativo del browser. No requiere librería.
- Para validación opcional, `formatScheduledAt` ya existe en
  `src/shared/formatScheduledAt.js:41-80` (parsea ISO UTC → local).
- `apiRequest` en `src/lib/api/client.js` sin cambios.
- `useApi` / `useMutation` hooks genéricos sin cambios.
- `Toggle.jsx` de `src/shared/` reutilizable.

---

## 5. Verificación end-to-end

**Tests automatizados:**
- `npm run lint && npm run build` exit 0.
- `npx playwright test
   tests/reel_approve_schedule.spec.js
   tests/automation_scheduling.spec.js -q` → 100 %.
- `./init.sh` (con el back live en `:8001`) verde.

**Smoke manual contra el back live (rama `ghl` + features 13-15
desplegadas):**
1. Loguear como admin de una agency con `agencies.timezone="Europe/Dublin"`.
2. Ir a Automation → activar hold 1 h, quiet hours 22:00–07:00,
   skip weekends. Save.
3. Refrescar la página; los tres controles deben estar tal como se
   guardaron (round-trip OK).
4. Crear un reel y aprobarlo un sábado 10:00 Dublin.
5. Banner debe decir "Publicará el lunes a las 07:00".
6. En GHL Social Planner verificar que el post aparece como
   **Scheduled** con la fecha y hora correctas.

---

## 6. Fuera de scope

- Validación IANA del input de timezone (sigue siendo input text libre
  en `CreateAgencyModal.jsx` / `AgencyConfigDrawer.jsx`).
- Preview en vivo del próximo slot calculado dentro de la pestaña
  Automation.
- Migrar `auto_captions` y `regen_on_update` fuera de `defaults.settings`.

---

## 7. Notas para la próxima sesión

- **Bloqueo cross-repo:** esta feature **NO** se puede arrancar hasta
  que back-13 esté desplegada en `:8001`. Sin el schema, el PUT
  `/automation` con `hold_window_seconds` explota con 422
  (`extra='forbid'`).
- El leader del front debe verificar que back-13 está cerrada (status
  `done` en
  `/opt/projects/4Reels-Backend/feature_list.json` entrada 13) antes
  de marcar front-16 como `in_progress`.
- El mock-backend del front es la spec del back real; tras este cambio
  ambos contratos deben quedar alineados.
