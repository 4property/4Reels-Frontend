# impl_24_agency_music_selection_rules (FRONT)

Implementer del frontend para feature 24 (`agency_music_selection_rules`).
Cross-repo con back feature 24 (deployada y verificada en :8001, PIDs API=2414786 / worker=2414787).

## Resumen

Conecta el toggle "Fall back to full library if no default track exists"
(antes decorativo en `MusicRules.jsx`) al ciclo GET/PUT
`/v1/admin/agencies/{id}/defaults`. Hidrata desde
`defaults.settings.music.selection_rules.fallback_to_full_library`
(default `true` si ausente — la fuente de verdad es el back, que ya
surface el default en GET; el front mantiene un fallback defensivo
para `loading=true` o `defaults=null`). Persiste con un PUT que
preserva el resto del blob `settings.*` y, dentro de `settings.music`,
preserva otras claves hermanas mediante deep-merge en JS.

## Archivos modificados

| Path | Tipo | Cambio |
|---|---|---|
| `/opt/projects/4Reels-Frontend/src/features/music/MusicRules.jsx` | Componente | Toggle conectado a `useReelDefaults` + `defaultsApi.saveDefaults`. Loading / saving / error state. Disabled cuando `!agencyId` o GET/save in-flight. Optimistic update con rollback en error. JSDoc documenta la decisión de merge. |
| `/opt/projects/4Reels-Frontend/tests/support/mock-backend.js` | Mock | Handler `/defaults`: nuevo `defaultsByAgency` Map para persistir el round-trip; GET ahora surfacea el default `music.selection_rules.fallback_to_full_library=true` (no `defaults:null`); PUT valida claves desconocidas bajo `settings.music.*` y `settings.music.selection_rules.*` y devuelve 422 `extra_forbidden`; shallow-merge de `settings.*` para imitar al back (`update_reel_defaults.py:67`). Helpers `findUnknownKey` + `surfaceDefaultsForGet` + constantes `ALLOWED_SETTINGS_MUSIC_KEYS` / `ALLOWED_SETTINGS_MUSIC_SELECTION_RULES_KEYS`. |
| `/opt/projects/4Reels-Frontend/tests/playwright/music_rules.spec.js` | Test (nuevo) | Carga `/music`, navega a "Selection rules", verifica `aria-pressed=true` inicial sin PUT emitido (default surface), click → PUT body contiene `settings.music.selection_rules.fallback_to_full_library=false` y mock devuelve 200, reload preserva `aria-pressed=false`, re-click → PUT con `true`. 3 viewports verdes. |

No se tocó `src/features/defaults/hooks.js` ni `api.js` (los hooks
existentes — `useReelDefaults`, `defaultsApi.saveDefaults` — bastan; la
acceptance pedía "useDefaults / useUpdateDefaults" pero la realidad
del repo son los nombres `useReelDefaults` / `useSaveReelDefaults`, y
el componente termina invocando directamente `defaultsApi.saveDefaults`
porque el body que necesita construir incluye campos que viven fuera
de `settings` — ver "Shape exacto del PUT" abajo). El uso es
consistente con `useAutomationSave.js`, que tampoco pasa por la
`useMutation` y compone el PUT manualmente.

## Shape exacto del PUT

`PUT /v1/admin/agencies/{id}/defaults` body:

```json
{
  "intro_enabled": true,
  "duration_seconds": 30,
  "platforms": ["instagram", "tiktok", "facebook", "gbp", "pinterest"],
  "settings": {
    "...resto del settings persistido (Format, Subtitles, Audio, Captions, automation.*, etc.)": "preservado",
    "music": {
      "...otras claves de settings.music que existieran": "preservadas",
      "selection_rules": {
        "...otras claves de selection_rules que existieran": "preservadas",
        "fallback_to_full_library": false
      }
    }
  }
}
```

Top-level keys (`intro_enabled`, `duration_seconds`, `platforms`) se
toman del `defaults` que devolvió el GET; si está ausente se usan los
fallbacks de `INITIAL_DEFAULTS` (introEnabled=true, duration_seconds=30,
platforms=DEFAULT_PLATFORMS). Esto mantiene paridad con cómo
`useAutomationSave.js` construye su PUT.

## Decisión sobre el merge (load-bearing)

El back hace shallow-merge a **nivel top-level de `settings.*`**
(`update_reel_defaults.py:67`: `{**existing_settings, **dict(data.settings)}`).
No recursa dentro de `settings.music`. Por tanto, si el front PUTea
sólo `settings.music = {selection_rules: {...}}`, cualquier futura
clave hermana bajo `settings.music.*` quedaría destruida.

Mitigación elegida: deep-merge en JS sobre el sub-documento `music`:

```js
settings.music = {
  ...(existing.settings.music || {}),
  selection_rules: {
    ...(existing.settings.music?.selection_rules || {}),
    fallback_to_full_library: nextValue,
  },
}
```

Hoy `selection_rules` sólo contiene `fallback_to_full_library` y `music`
sólo contiene `selection_rules` (el back rechaza otras claves con
`extra='forbid'`), así que el merge es equivalente a una sobreescritura
limpia — pero el patrón documenta la intención y es robusto si el back
extiende el modelo en el futuro. JSDoc en `MusicRules.jsx` explica el
contrato en detalle.

El mock-backend imita exactamente esta semántica: shallow-merge en
`settings.*`, sin recursar en `settings.music.*`. Esto permite que el
test E2E valide la lógica del front en condiciones equivalentes al
back real.

## Capas / reglas

- `MusicRules.jsx` no llama `fetch` directo: usa `useReelDefaults`
  (lectura) y `defaultsApi.saveDefaults` (escritura, que va por
  `apiRequest` → `lib/api/client.js`). `grep -rn "fetch(" src/features/music`
  sigue dando 0 hits.
- `shared/` no tocado.
- `lib/` no tocado.
- `defaults/` no modificado: se reusan los exports existentes.
- Vanilla JS/JSX + vanilla CSS (sólo se añadieron `data-testid` y
  estilos inline mínimos en `MusicRules.jsx`; ninguna nueva regla
  CSS). Ninguna dependencia nueva.

## Verificación

| Comando | Resultado |
|---|---|
| `./init.sh` | OK (lint + build verdes) |
| `npm run lint` | verde |
| `npm run build` | verde (CSS 122.30 kB, JS 393.04 kB / gzip 112.83 kB) |
| `npm run test:smoke` | **46 passed / 2 skipped** (los 2 skip son los `theme` preexistentes — feature 13 dejó la cookie de theme detrás) |
| `npx playwright test tests/playwright/music_rules.spec.js` | **3 passed** (desktop / tablet / mobile) |
| `npx playwright test tests/payload_contract.spec.js` | **6 passed** (regresión: cero) |
| `npx playwright test tests/music.spec.js tests/automation_scheduling.spec.js tests/playwright/music_upload.spec.js` | **15 passed** (regresión: cero) |

## Aceptación (mapeo)

- [x] `MusicRules.jsx` Toggle conectado: lee
      `fallback_to_full_library` de `defaults.settings.music.selection_rules`
      (default true si ausente).
- [x] PUT preserva el resto del settings blob (deep-merge sobre
      `settings.music`).
- [x] Loading state durante GET (toggle disabled + nota "Saving…"
      cuando aplica).
- [x] Error state inline si PUT falla, con rollback del valor
      optimista.
- [x] Si GET devuelve blob sin `music.selection_rules`, Toggle se
      muestra `true` sin escribir nada hasta cambio explícito (el back
      hoy surface el default en GET; el front mantiene fallback
      defensivo para `loading=true` / `defaults=null`).
- [x] Reusa `useReelDefaults` / `defaultsApi`. Sin `fetch` directo.
- [x] Test Playwright cubre off → PUT con `false` + reload preserva +
      on → PUT con `true`.
- [x] Sin agencia seleccionada → toggle disabled (paridad con Library).

## Notas para el reviewer

- El cambio del mock-backend `/defaults` GET de `defaults: null` a
  un objeto con `settings.music.selection_rules` afecta el comportamiento
  observado por otras pantallas en tests E2E. Verificado: `payload_contract`
  / `music` / `automation_scheduling` / `music_upload` siguen verdes. El
  `defaultsBody.settings` que emite la pestaña Automation ahora puede
  llevar la clave `music: {selection_rules: {fallback_to_full_library:
  true}}` (la hereda del GET), válida bajo el contrato Pydantic del back.
- El acceptance pidió `useDefaults`/`useUpdateDefaults`; en el repo
  esos hooks se llaman `useReelDefaults`/`useSaveReelDefaults`. El
  componente termina llamando directamente a `defaultsApi.saveDefaults`
  (no a `useSaveReelDefaults`) porque el body que construye no es el
  que `buildDefaultsBody` genera a partir del `state` plano de la
  pestaña Defaults — necesita explicit-set `intro_enabled` /
  `duration_seconds` / `platforms` desde el GET para no sobrescribirlos.
  Mismo patrón que `useAutomationSave.js`.
- No se marca `done`. El leader debe lanzar reviewer (tarea #27) y, si
  aprueba, cerrar feature 24 front + cross-repo.
