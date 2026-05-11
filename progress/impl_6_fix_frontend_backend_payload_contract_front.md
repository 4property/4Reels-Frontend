# Feature 6 — fix_frontend_backend_payload_contract (front)

> Implementer 4reels-front. Fecha: 2026-05-07. Estado: revisión pendiente
> (NO marcar `done`).

## Resumen

Alinea los payloads que el front envía a `/v1/admin/agencies/{id}/{brand,
automation, defaults, sources}` con los modelos Pydantic
`extra='forbid'` del backend. Los renombrados (`source_name → name`,
`source_status → status`, `font → font_family`) se aplican tanto en el
body como en el form state. Los campos huérfanos de Brand
(`tagline`, `watermark_enabled`, `outro_enabled`, `outro_headline`,
`outro_sub`) se eliminan de la UI. Los 7 toggles huérfanos de
Automation (`quiet_hours_enabled`, `skip_weekends`, `auto_captions`,
`regen_on_update`, `review_emails`, `review_window_enabled`,
`review_window_hours`) y `platforms` mantienen su UI pero se persisten
vía `/defaults` con keys namespaced (`automation.<key>`) en
`defaults.settings`. Se añade un hook compuesto
`useAutomationSave` que dispara los dos PUTs (`/automation` +
`/defaults`) con shallow-merge previo del `settings` blob para no perder
keys que escriben otros tabs.

El mock-backend de Playwright se endurece para responder 422 con shape
Pydantic-like (`{detail:[{loc:['body',<field>], msg:'Extra inputs are not
permitted', type:'extra_forbidden'}]}`) cuando el front filtra cualquiera
de los campos retirados, y se añade un handler PUT explícito para
`/sources/{ingestion_source_id}` que también valida.

## Archivos modificados / creados

### `src/features/admin/`
- `api.js` — añade `reconfigureAgencySource(agencyId, ingestionSourceId,
  body)` (PUT). `upsertAgencySource` (POST) preservado.
- `AgencyConfigDrawer.jsx` (`SourcesPanel`) — form state usa `name`
  (renombrado desde `source_name`); `submit` con `editingId` llama al
  PUT, sin `editingId` POST. Body POST: `{ site_id, name, site_url?,
  status: 'active' }`. Body PUT: `{ name, site_url? }`. Mensaje de
  validación `'site_id and name are required.'`.

### `src/features/brand/`
- `BrandConfig.jsx` — eliminadas secciones UI tagline/watermark/outro
  (cards y campos de form state). `font → font_family` en todo el state
  local, hidratación lee `brand?.font_family`. Body save:
  `{ primary_color, secondary_color, logo_position, font_family,
  logo_object_key?, intro_logo_object_key? }`. Comentario al inicio del
  módulo documenta el retiro de los campos legacy.
- `hooks.js` / `api.js` — sin cambios (el body lo construye el
  componente).

### `src/features/automation/`
- `hooks.js` — añade `buildAutomationBody(state)` que sólo emite
  `{ approval_required, trigger_on_status?, publish_window_*?,
  publish_days? }`. `publishMode === 'review' → approval_required:true`.
  `useSaveAutomationRules` retenido para callers que sólo quieran el
  slice de automation.
- `useAutomationSave.js` (nuevo) — hook compuesto que:
  1. GET `/defaults` para leer `settings`/`platforms`/`intro_enabled`/
     `duration_seconds` actuales (404 → arranca de
     `INITIAL_DEFAULTS`).
  2. PUT `/automation` con `buildAutomationBody`.
  3. PUT `/defaults` con `platforms` + `settings` shallow-merge
     (existing settings + 7 keys namespaced de Automation).
- `AutomationConfig.jsx` — UI visual intacta. Hidrata `publishMode` desde
  `useAutomationRules().automation` y los 7 toggles + `platforms` desde
  `useReelDefaults().defaults` (settings con keys namespaced). `handleSave`
  delega a `useAutomationSave`.
- `AutoPublishDetails.jsx`, `ReviewModeDetails.jsx`, `ModeCard.jsx`,
  `api.js` — sin cambios estructurales (son UI puros y siguen recibiendo
  los 7 toggles + platforms como props).

### `src/features/defaults/`
- `initialState.js` — añade `DEFAULT_PLATFORMS = ['instagram', 'tiktok',
  'facebook', 'gbp']` y `AUTOMATION_SETTINGS_KEYS` (las 7 keys
  namespaced); `INITIAL_DEFAULTS` arranca con `platforms` y los 7
  toggles con sus defaults históricos.
- `hooks.js` — `buildDefaultsBody(state)` exporta el body canónico
  (`intro_enabled`, `duration_seconds`, `settings`, y `platforms` cuando
  está en state). Reutilizado por `useAutomationSave`.
- `ReelDefaultsConfig.jsx` — hidrata `platforms` y los 7 toggles desde
  `defaults.platforms` / `defaults.settings`; `handleSave` envía la
  forma canónica (incluye `platforms`).

### `tests/support/mock-backend.js`
- Handler PUT explícito para
  `/v1/admin/agencies/{id}/sources/{ingestion_source_id}` que valida
  `extra='forbid'` (rechaza `source_name`/`source_status`).
- Handler POST `/sources` valida idem.
- Handler PUT
  `/v1/admin/agencies/{id}/{brand|defaults|automation|...}` parsea el
  body y rechaza con 422 (shape Pydantic-like) cualquier campo en
  `FORBIDDEN_KEYS[slice]`:
  - `brand`: `font, tagline, watermark_enabled, outro_enabled,
    outro_headline, outro_sub`.
  - `automation`: `publish_mode, platforms, review_window_enabled,
    review_window_hours, quiet_hours_enabled, skip_weekends,
    auto_captions, regen_on_update, review_emails`.
  - `sourcesCreate` / `sourcesUpdate`: `source_name, source_status`.
- `extraForbiddenError(field)` produce el detail Pydantic-like.

### `tests/payload_contract.spec.js` (nuevo)
- 2 tests:
  - "Brand save sends only the canonical Pydantic body" — abre
    `/brand`, dispara save, asserta el body PUT contiene los 4 campos
    canónicos y NO contiene ninguno de los 6 retirados, y asserta
    response 200 (no 422).
  - "Automation save splits between /automation and /defaults" — abre
    `/automation`, dispara save, asserta los dos PUTs (body de
    `/automation` con `approval_required` y SIN `publish_mode/platforms`
    + 7 toggles legacy; body de `/defaults` con `platforms` array y
    `settings['automation.quietHoursEnabled']` /
    `settings['automation.autoCaptions']`), 0 respuestas 422.

### `DOCS.md`
- Sección Brand: reescrita para reflejar el shape exacto de
  `BrandSettingsUpsertPayload` (`primary_color`, `secondary_color`,
  `logo_position`, `font_family`, `logo_object_key?`,
  `intro_logo_object_key?`); eliminadas menciones de watermark/outro
  como funciones persistidas en /brand.
- Sección Automation: documenta el split en dos endpoints
  (`/automation` con la slice canónica + `/defaults` con `platforms` y
  los toggles namespaced bajo `settings`).
- Línea 5 (cabecera): reemplaza "Real backend — everything mocked." por
  "talks to the live backend through `src/lib/api/client.js`. Playwright
  tests stub responses with `tests/support/mock-backend.js`".

### `.env.example`
- `VITE_API_URL` y `VITE_USE_MOCK` marcados como LEGACY (la única
  consumidora viva es el fallback de `BASE_URL` en `client.js`); los
  tests Playwright ya no los leen.

## Verificación local

| Comando | Resultado |
|---|---|
| `npm run lint` | green |
| `npm run build` | green (`✓ built in 1.67s`) |
| `npm run test:smoke` | green (40 passed, 2 skipped) |
| `npx playwright test tests/payload_contract.spec.js` | green (6 passed) |
| `grep -rn 'source_name|source_status|publish_mode|review_window|quiet_hours|skip_weekends|auto_captions|regen_on_update|review_emails|tagline|watermark_enabled|outro_enabled|outro_headline|outro_sub' src` | 0 hits productivos. Hits restantes (no productivos): `mode-card-tagline` (clase CSS de la `ModeCard` de Automation, semántica UI no-Brand), `tagline=` props en `AutomationConfig.jsx`/`ModeCard.jsx` (label visual, no campo persistido), `brand-watermark` (clase CSS del LivePreview de Brand, decorativa), `outro*`/`outroEnabled`/`outroCard` en `defaults/initialState.js` y `defaults/tabs/IntroOutroTab.jsx`/`VideoTab.jsx` (concepto independiente: outro card de la pantalla Defaults, no `outro_*` de Brand), `outro-video` en `reels/editor` (slide del editor), comentario explicativo del retiro en `BrandConfig.jsx:25`. |

## Decisiones cerradas (alineadas con el usuario)

1. **Brand huérfanos**: ELIMINADOS de la UI (no se mueven a defaults).
2. **Automation huérfanos**: 7 toggles persistidos en `defaults.settings`
   con keys namespaced (`automation.quietHoursEnabled`, etc.). UI sigue
   en Automation.
3. **Platforms**: UI en Automation, save vía `/defaults`. Hook
   compuesto persiste ambos endpoints.
4. **Renames** completos en form state (no sólo body keys).
5. **Mock riguroso**: 422 con shape Pydantic-like en Sources/Brand/
   Automation cuando aparece campo prohibido.

## Desviaciones del spike

- **`useAutomationSave` exportado desde `src/features/automation/`**
  (no desde `defaults/`). Why: la pantalla consumidora vive en
  Automation, y el hook compone `automationApi` + `defaultsApi` (es la
  capa "feature" de Automation que sabe del split). Mantiene la regla de
  que `features/<x>` puede importar de otras `features/<y>`.
- **No se elimina `VITE_API_URL` ni `VITE_USE_MOCK`**, sólo se marcan
  LEGACY en `.env.example`. Why: el fallback de `client.js` sigue
  leyendo `VITE_API_URL` cuando `VITE_MVP_API_URL` no está definido;
  eliminar la var ahora rompería entornos de desarrollo locales que
  todavía la usan. La documentación deja claro que es legacy y los tests
  no la consumen.

## Próximo paso (NO lo ejecuta el implementer)

- Pasar al `reviewer` para validar y, si aprueba, marcar feature 6
  `done` en `feature_list.json` y mover el resumen a `progress/history.md`.
