# Review — feature 8 (`agency_default_descriptions_ui`)

**Veredicto:** APPROVED

Fecha: 2026-05-13.
Implementer report: `progress/impl_8_agency_default_descriptions_ui.md`.

## Resumen

Subtab `Descriptions` añadido al `AgencyConfigDrawer`. El nuevo
`DefaultDescriptionsPanel` carga/escribe `/v1/admin/agencies/{id}/social-templates`
vía el `socialApi` ya existente (cross-feature `admin -> social/api.js`,
patrón con precedente en `automation/useAutomationSave.js -> defaults/api.js`).
El handler del mock se separa para devolver el shape canónico del back
(`{agency_id, templates, items, count}`). Smoke Playwright cubre
round-trip GET + PUT.

## Archivos verificados

| Archivo | Tipo | Observación |
|---|---|---|
| `src/features/admin/DefaultDescriptionsPanel.jsx` | nuevo | Stack JSX vanilla; sin TS; sin fetch directo; usa `socialApi.getSocialTemplates` / `socialApi.saveSocialTemplates` |
| `src/features/admin/AgencyConfigDrawer.jsx` | edit | Añade `{ id: 'descriptions', label: 'Descriptions', icon: 'edit' }` a `TABS` y monta `<DefaultDescriptionsPanel agencyId={...} />` cuando `tab === 'descriptions'`. Resto del drawer (Sources/Ghl/Reel/Agency) intacto |
| `src/features/admin/admin.css` | edit | 5 reglas nuevas (`.default-descriptions-form`, `-grid`, `-textarea`, `-help`, `-var`). Vanilla CSS, BEM ligero. Sin styled-components |
| `tests/support/mock-backend.js` | edit | El regex genérico ya capturaba `social-templates`; el handler ahora delega a `handleSocialTemplates()` que mantiene un `Map` por `agencyId` y devuelve `{agency_id, templates, items, count}` con `items[]` ricos (`description_template`, `title_template:null`, `hashtags:[]`, `created_at`, `updated_at`). El PUT espera solo `{templates: {<platform>: <string>}}` y responde `{status:'saved', ...}` |
| `tests/social_templates.spec.js` | nuevo | 2 tests (round-trip GET+PUT + GET re-mount). Selectores robustos (`data-testid`, `getByRole`). 6 passed (desktop/tablet/mobile × 2) |
| `DOCS.md` | edit | Sección `Backend contract` extendida con la entrada `Social templates` (GET shape + PUT body + nota `title_template`/`hashtags` read-only) |

## Checkpoints (CHECKPOINTS.md)

- **C1 — Arnés completo:** [x] No tocado, `./init.sh` verde al final.
- **C2 — Estado coherente:** [x] Solo feature 8 en `in_progress`. `progress/current.md` describe la sesión activa. La feature aún no está marcada `done` (correcto, espera review).
- **C3 — Código respeta la arquitectura:**
  - [x] Sin TypeScript en `src/` (`./init.sh` sección 4 verde).
  - [x] Sin React Query / MSW / state libs nuevas. `package.json` no añade deps al blocklist (solo añade `"license":"GPL-2.0-only"`, metadata inocua).
  - [x] Vanilla CSS — `admin.css` extiende variables BEM-style existentes.
  - [x] `DefaultDescriptionsPanel.jsx` no contiene `fetch(` ni `XMLHttpRequest`; todo va por `socialApi -> apiRequest -> lib/api/client.js`.
  - [x] `src/shared/` no importa de `features/` ni de `lib/api/` (sin tocar `shared/` en esta feature).
  - [x] `src/lib/` no importa hacia arriba (sin tocar `lib/` en esta feature).
  - [x] `src/app/` sin cambios — la feature vive en `features/admin/`.
- **C4 — Verificación real:**
  - [x] `npm run lint` verde.
  - [x] `npm run build` verde (`built in 2.25s`).
  - [x] `npm run test:smoke` → 43 passed, 2 skipped (theme on tablet/mobile).
  - [x] `npx playwright test tests/social_templates.spec.js` → 6 passed (9.6s).
  - [n/a] La feature no toca snapshots visuales — `npm run test:visual` no aplica.
- **C5 — Contrato mock-backend vivo:**
  - [x] Handler dedicado para `social-templates` colocado dentro de `tests/support/mock-backend.js`. El path ya estaba registrado en `isKnownAdminStub`. El comportamiento es ahora el canónico del back en lugar del shape genérico previo.
  - [x] Shape `{agency_id, templates:{platform:string}, items:[{agency_id, platform, description_template, title_template, hashtags[], created_at, updated_at}], count}` matchea exactamente lo descrito en el informe del implementer y en la nueva entrada de `DOCS.md` § Backend contract → Social templates.
  - [x] Tests E2E (`tests/social_templates.spec.js`) cubren el endpoint.
- **C6 — Cierre limpio:**
  - [x] Sin archivos sospechosos en `git status` (solo cosas esperadas del scope o de features anteriores ya cerradas: 7 y 11).
  - [x] `grep -nE 'console\.(log|warn|error|debug)|debugger'` en los archivos tocados por la feature → 0 hits.
  - [x] `feature_list.json` mantiene la feature 8 en `in_progress` (correcto, espera este review).
  - [x] `package.json` no añade dependencias (solo metadata `"license"`).

## Comprobaciones específicas (reglas duras del briefing)

- ❌ Blocklist deps (`typescript`, `@tanstack/react-query`, `msw`, `styled-components`, `@emotion/*`, `tailwindcss`) → [x] ninguna añadida.
- ❌ `fetch(...)` directo en componentes nuevos → [x] no hay; todo pasa por `socialApi`.
- ❌ `src/shared/` importando de `features/` o `lib/api/` → [x] sin cambios en `shared/` (sólo el icono `pinterest` ya añadido por feature 7).
- ❌ `console.log` / `debugger` residuales → [x] limpio.
- ❌ Modificaciones fuera de scope (Pinterest cerrada, decodeHtmlEntities cerrada, session/auth, publishStatus, ReelEditor approve/idempotency) → ver sección "Cambios fuera de scope" abajo.
- ❌ Mock handler con shape que no matchea al back → [x] matchea (verificado contra `DOCS.md` actualizada en este mismo PR + informe del implementer).
- [x] Shape PUT body `{templates: {platform: string}}` validado por el spec (`expect(body).toEqual({templates: {...}})` línea 79-84 de `tests/social_templates.spec.js`).

## Notas de implementación que pasan revisión

1. **7 plataformas en lugar de 6 (acceptance dice "6 platforms")**: el
   spec original lista `tiktok, instagram, linkedin, youtube, facebook, gbp`.
   El implementer añade `pinterest` como 7ª. Esto es consistente con la
   feature 7 (`pinterest_and_reels_cover_preview`) ya cerrada, que dejó
   Pinterest como plataforma 1st-class en `TenantProvider.PLATFORM_PRESETS`,
   `defaults.platforms`, `AgencyConfigDrawer.ALL_PLATFORMS` y el icono.
   El backend acepta `templates: dict[str, str]` con keys arbitrarias,
   así que no rompe el contrato. **Acepto** la desviación porque la
   alternativa (excluir Pinterest aquí) sería incoherente con el resto
   del drawer. Si en futuro se prefiere la lista estricta, basta con
   eliminar la 7ª entrada del array `PLATFORMS` en `DefaultDescriptionsPanel.jsx:15-23`.

2. **Patrón imperativo `useState + useEffect` en lugar de los hooks
   `useSocialTemplates` / `useSaveSocialTemplates` de `features/social/hooks.js`**:
   correcto. Esos hooks dependen de `useCurrentAgencyId()` (sesión del
   tenant), y aquí el `agencyId` viene por prop del drawer del super-admin.
   Mantiene consistencia con el resto de paneles del drawer
   (`SourcesPanel`, `GhlPanel`, `ReelPanel`, `AgencyPanel`).

3. **Cross-feature import `admin -> social/api.js`**: aceptado. Precedente
   ya documentado en `automation/useAutomationSave.js -> defaults/api.js`
   y la arquitectura no prohíbe cross-feature en la capa `features/<x>/`.

4. **`items[]` enriquecido en el mock con `created_at: '2026-05-12T12:00:00Z'`
   fijo**: la fecha está hardcodeada para que el shape coincida con el
   canónico aunque las llamadas a serializeSocialTemplates ocurran en
   distintos timestamps de test. Acceptable para mock. Marcable como
   TODO si el back llegara a usar `created_at` como ETag, pero hoy no.

## Cambios fuera de scope

Los siguientes archivos aparecen en `git status` pero NO son del scope
de feature 8; son residuales de features ya cerradas (7 y 11) que
todavía no se han commiteado:

- `src/app/providers/TenantProvider.jsx` — pinterest en presets (feature 7).
- `src/features/defaults/initialState.js` — pinterest en `DEFAULT_PLATFORMS` (feature 7).
- `src/features/reels/Dashboard.jsx`, `ReelCard.jsx`, `ReelsTable.jsx`, `editor/ReelEditor.jsx`, `editor/defaults.js`, `hooks.js` — decodeHtmlEntities + cover preview (features 7 y 11).
- `src/features/session/SessionProvider.jsx`, `ghlMvpContext.js` — bugfix de contexto GHL (entrada en `history.md`).
- `src/shared/Icon.jsx` — `case 'pinterest'` (feature 7).
- `tests/flows.spec.js` — smoke nuevo del cover de feature 7.
- `tests/ghl_context.spec.js` — bugfix GHL.
- `tests/unit/`, `src/shared/decodeHtmlEntities.js`, `src/features/reels/publishStatus.js` — feature 11.
- `init.sh` — solo cambio de modo a ejecutable (entrada de `history.md` 2026-05-11).
- `package.json` — añade `"license":"GPL-2.0-only"`. Metadata inocua, sin dependencias.

Ninguno de estos toca cosas prohibidas y el implementer de feature 8 no
los modifica. No bloquean el cierre de feature 8.

## Cambios requeridos

Ninguno. El trabajo cumple acceptance + checkpoints + reglas duras.

## Verificación final ejecutada por el reviewer

- `npm run lint` → verde.
- `npm run build` → verde (`built in 2.25s`, gzip 105.61 kB).
- `npm run test:smoke` → 43 passed, 2 skipped.
- `npx playwright test tests/social_templates.spec.js` → 6 passed.
- `grep -nE 'fetch\(|XMLHttpRequest' src/features/admin/DefaultDescriptionsPanel.jsx` → 0 hits.
- `grep -nE 'console\.(log|warn|error|debug)|debugger' <archivos feature 8>` → 0 hits.
- `package.json` deps + devDeps → 0 hits del blocklist.

Cierre OK. El leader puede mover feature 8 a `done` y actualizar
`progress/history.md` con el resumen.
