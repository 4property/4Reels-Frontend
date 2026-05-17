# Sesion actual

> Este archivo se vacia al cerrar cada sesion y se mueve a `history.md`.
> Mientras trabajas, **mantenlo actualizado en tiempo real**, no al final.

---

# Feature 39 — live_state_sync_reels_dashboard_and_editor (implementer)

- **Feature en curso:** 39 — `live_state_sync_reels_dashboard_and_editor`
- **Inicio:** 2026-05-16
- **Agente:** Claude (rol implementer)
- **Feature dir:** `src/lib/hooks/`, `src/shared/`, `src/app/`, `src/features/reels/`, `src/features/reels/editor/`, `tests/`
- **Toca el mock?:** no (no se añade endpoint nuevo; el mock-backend existente cubre approve/reject + music override que usan los tests).

## Plan

- `src/lib/hooks/useToast.js` nuevo: módulo singleton con cola `queue + listeners`. Export `toast.success/error/info/dismiss` (imperativo, no Provider para ergonomía) + hook `useToast()` (devuelve `{toasts, dismiss}` para el Toaster). Auto-dismiss: 4000 ms success/info, 6000 ms error. Soporte `opts.id` para dedupe.
- `src/shared/Toaster.jsx` nuevo + estilos en `src/shared/shared.css` (mismo bundle global). Posición: bottom-right (consistente con el design system: el editor ya usa la zona top-right para badges de estado del reel; los toasts globales viven abajo-derecha para no chocar). Cada toast `<div role="status"|"alert" aria-live="polite"|"assertive">` con botón cerrar (X), fade-slide sutil sin animaciones bling-bling.
- `src/app/Shell.jsx`: montar `<Toaster />` dentro del root `<div>` (fuera de `<PageContainer>` para que aparezca en todas las rutas, incluido el editor overlay).
- `src/features/reels/DashboardRefetchContext.js` nuevo: `createContext(null)` con valor por defecto `null`. El editor consume con `useContext`. El Dashboard provee su `refetch` cuando renderiza `<Outlet/>` (cambio en `Shell.jsx ReelsRoute`).
- `src/app/Shell.jsx`: `ReelsRoute` ahora monta `<Dashboard exposeRefetch />` y envuelve el `<Outlet/>` con `<DashboardRefetchContext.Provider value={dashboardRefetch}>`. Pero el `refetch` está dentro del Dashboard, así que en su lugar usamos un patrón de "ref" — el Dashboard se renderiza dentro del Provider y un wrapper hold-state pasa el `refetch` callback al provider. Decisión más simple: el Dashboard expone su refetch via `useRef` que un componente padre crea; lo limpio es usar un patrón "lift state": el ReelsRoute crea un `refetchHolderRef.current = null` y pasa al Dashboard una prop `registerRefetch` que el Dashboard llama en un useEffect con su refetch. El Provider pasa `() => refetchHolderRef.current?.()` para que sea estable.
  - Patrón refinado: en `ReelsRoute` montar un `useState/useRef` que apunta al `refetch` del Dashboard; el Dashboard recibe `onRegisterRefetch={(fn) => ref.current = fn}` y lo llama en `useEffect`. El Provider entrega la función estable.
- `src/features/reels/editor/ReelEditor.jsx`: añadir `useState(false)` para `hasMutated`. Crear callback `onMutate = () => setHasMutated(true)` y pasarlo a cada panel (Photos, Music, Subtitles, Slides, Descriptions). En el handler de cierre (envoltorio de `onClose`), si `hasMutated && dashboardRefetch`, llamar `dashboardRefetch()` antes de `onClose()`.
- Cada panel (`PhotosPanel`, `MusicOverridePanel`, `SubtitlesPanel`, `SlidesPanel`, `DescriptionsPanel`) acepta nueva prop `onMutate` opcional:
  - Photos/Subtitles/Slides: el `useReelDebouncedOverride` debe disparar `onMutate` en éxito de PATCH (extender el hook con un callback `onMutated`).
  - Music: dentro de `handleChange` success → `onMutate?.()`.
  - Descriptions: dentro de `persist` success → `onMutate?.()`.
- Cada panel además llama `toast.success(...)` / `toast.error(...)` en éxito/fallo (manteniendo el feedback inline existente como `card .info`).
- `Dashboard.jsx`: `handleApprove`/`handleReject` envueltos en try/catch con `toast.success` y `toast.error`. Los botones quedan visualmente deshabilitados via `loading` flag del `useMutation`.
- Tests nuevos en `tests/reels_dashboard_live_sync.spec.js`:
  - Test 1: editor close tras PATCH music mueve reel B a primera fila (mock backend ya reordena por updated_at via persistencia mutativa — verificar; si no, mock manual con override del handler GET reels).
  - Test 2: approve dispara toast role=status con texto "Reel approved".
  - Test 3: approve fallido 500 dispara toast role=alert.
- Verificación: `npm run lint`, `npm run build`, `npm run test:e2e -- reels_dashboard_live_sync`, `npm run test:smoke`, `./init.sh`.

## Cierre — feature 39 lista para review

Feature 39 lista para review; reporte en `progress/impl_39_live_state_sync_reels_dashboard.md`. `./init.sh` verde (lint + build), `npm run test:smoke` verde (46 passed / 2 skipped), `npx playwright test tests/reels_dashboard_live_sync.spec.js` verde (9 passed: 3 specs × 3 viewports), regresión en specs de editor verde (`per_reel_photos|subtitles|slides|reel_music|reel_descriptions|reel_approve_schedule.spec.js` → 93 passed), full `npm run test:e2e` 330 passed / 2 skipped / 1 flake pre-existente (`templates.spec.js:17 [desktop]`, re-run aislado pasa; misma clase de paralelismo que reviews 32–37). Feature sigue `in_progress` en `feature_list.json` por contrato del implementer (no marca `done`).

- **Feature en curso:** —
- **Inicio:** —
- **Agente:** —
- **Modulos afectados:** —
- **Toca schema?:** —

---

## HOTFIX paralelo (no toca scope de feature 18)

**HOTFIX: el modo pantalla completa del preview de reel se ve recortado / agrandado.**

### Petición del usuario
> "en la pestaña reels cuando entro a ver la preview del reel, cuando le
> doy a modo pantalla completa el video se agranda demasiado, no se ve
> correctamente"

### Diagnóstico
`src/features/reels/editor/editor.css:118` aplica `object-fit: cover` a
`.editor-video-player`. Es correcto para el preview 3:4 incrustado en la
columna del editor — recorta para llenar el "phone frame". Pero al
entrar en fullscreen (controles nativos del `<video>`), el browser
escala el elemento al viewport conservando su CSS, así que un reel
vertical (9:16) en un monitor 16:9 se recorta drásticamente arriba y
abajo en vez de letterboxearse.

### Cambio
`src/features/reels/editor/editor.css` — añadida regla bajo el bloque
existente:

```css
.editor-video-player:fullscreen,
.editor-video-player:-webkit-full-screen {
  width: 100vw;
  height: 100vh;
  max-width: 100vw;
  max-height: 100vh;
  object-fit: contain;
  background: black;
}
```

Sólo activa en fullscreen real; la preview incrustada conserva su
`object-fit: cover`. `:-webkit-full-screen` para Safari/Chromium
antiguos; `:fullscreen` para los modernos (Chrome, Edge, Firefox,
Safari ≥16.4).

### Verificación
- `npm run lint` → verde.
- `npm run build` → verde (CSS pasa de 119.69 → 119.86 kB,
  `index-BOx8zj5P.css`, `index-CgTkfPAe.js`).
- `npm run test:smoke` → 46 passed / 2 skipped (los `theme` preexistentes).
- Sin tests dedicados a fullscreen (Playwright no tiene API estable para
  `requestFullscreen` en headless). Probar a ojo en navegador real.

Hotfix invocado explícitamente por el usuario con la palabra `hotfix`,
per `CLAUDE.md §Hotfix`.

---

## HOTFIX: /brand — quitar Live preview

**Petición del usuario** (palabra `hotfix` invocada explícitamente, `CLAUDE.md §Hotfix`):
> "en el frontend en la pestaña de /brand, quites el live preview"

### Cambio

- `src/features/brand/BrandConfig.jsx`:
  - Eliminada la función `LivePreview` (la tarjeta de la columna derecha con `<Cover>` de muestra + watermark + caption).
  - Eliminada la invocación `<LivePreview .../>` en el JSX principal.
  - Retirado el wrap `<div className="brand-layout">` (era un grid 2-cols identity+preview); ahora la página es un único `<div className="stack gap-8">` con `IdentityCard` + `LogoPlacementCard`.
  - Quitado el import huérfano de `Cover`.
  - Actualizado el JSDoc del componente (sin "+ live preview").
- `src/features/brand/brand.css`:
  - Eliminadas reglas muertas: `.brand-layout`, `.brand-preview-wrap`, `.brand-preview-label`, `.brand-preview-frame`, `.brand-watermark` (todas las posiciones `pos-*`), `.brand-caption`.
  - Eliminado bloque `.brand-outro*` también: el outro se removió de la UI en feature 6 pero el CSS había quedado huérfano.
  - Media queries simplificadas (sin referencias a `brand-layout` ni `brand-preview-wrap`).
  - CSS bundle pasa de ~119 kB → 121.58 kB (la diferencia es del index global; el CSS de brand es ahora más corto).

### Verificación

- `npm run lint` ✅
- `npm run build` ✅
- `npm run test:smoke` ✅ — **46 passed / 2 skipped**, incluido el spec `/brand` que renderiza sin errores de consola ni requests fallidos.
- No hay tests dedicados al live preview (era puramente visual). Probar a ojo en navegador real.

Hotfix limitado a `src/features/brand/`. Sin tocar nada relacionado con la sesión paralela de música (feature 22) ni otros features. Scope respetado.

### HOTFIX 2: /brand — quitar también Logo placement

**Petición del usuario** (palabra `hotfix` invocada explícitamente):
> "hotfix, quita tambien la parte de logo placement"

#### Cambio

- `src/features/brand/BrandConfig.jsx`:
  - Eliminada la función `LogoPlacementCard` y el constante `LOGO_POSITIONS` que la alimentaba.
  - Eliminada la invocación `<LogoPlacementCard .../>` del JSX principal.
  - Retirado el wrap `<div className="stack gap-8">` (ya no hace falta envolver una única card); `IdentityCard` es ahora el único hijo directo.
  - **Conservado** el state `logoPosition` y `setLogoPosition`: se hidrata desde el backend en el `useEffect` y se envía en el body del PUT vía `buildBrandBody` para preservar el valor actual de `logo_position`. Esto evita que el PUT lo cambie a un valor por defecto y mantiene intacto el contrato Pydantic del back (`BrandSettingsUpsertPayload`).
  - JSDoc actualizado explicando la decisión.
- `src/features/brand/brand.css`: sin cambios (las reglas usadas por la card eliminada, como `.brand-cols-2`, las sigue usando `IdentityCard`).

#### Verificación

- `npm run lint` ✅
- `npm run build` ✅ (CSS bundle igual: 121.58 kB; JS bundle baja a 386.88 kB)
- `npm run test:smoke` ✅ — **46 passed / 2 skipped**, smoke de `/brand` verde.

### HOTFIX 3: descripciones por red — policy + warning de links + fix sample booking_link

**Petición del usuario** (palabra `hotfix` invocada explícitamente):
> "que investigues que puede y que no puede haber en las descripciones de las distintas redes sociales para no permitir que se comentan errores, por ejemplo instagram no permite links en las descripciones pero youtube si... y asegurate de que se esten insertando los links correctamente"

#### Hallazgos de la investigación

| Red | Desc max | Title max | Links clicables | Hashtags útiles |
|-----|---------:|----------:|:---------------:|:---------------:|
| Instagram | 2200 | — | **NO** | sí (≤30) |
| TikTok | 2200 | — | **NO** | sí |
| YouTube | 5000 | 100 | sí | sí (≤15) |
| Facebook | 63206 | — | sí | sí (limitado) |
| LinkedIn | 3000 | — | sí | sí (3–5) |
| Google Business | 1500 | 58 | sí | **NO** |
| Pinterest | 500 | 100 | sí | sí (≤20) |

Fuentes: docs oficiales (Instagram Help, TikTok for Business, YouTube Creator Academy, etc.).

#### Bug encontrado y corregido

`src/app/providers/TenantProvider.jsx:42`: el sample de `{{booking_link}}` era `'ckpestateagents.ie/view/r8832'` **sin protocolo**. En redes que sí auto-detectan URLs (LinkedIn, Facebook, Pinterest), un string sin `http(s)://` puede no convertirse en link clicable. Fix: `'https://ckpestateagents.ie/view/r8832'`. El sample de `{{property_url}}` ya estaba correcto (`https://example.com/property/123`).

#### Cambios

- `src/features/reels/editor/defaults.js`:
  - Añadida `PLATFORM_POLICY` con campos `descLimit`, `titleLimit`, `supportsLinks`, `supportsHashtags`, `linkWarning`, `hashtagsNote`, `notes` para las 8 plataformas (incluido alias `gmb` ↔ `gbp`).
  - Helper `getPlatformPolicy(platformId)` con fallback a `DEFAULT_PLATFORM_POLICY`.
  - Helper `findLinksInText(text)` que detecta URLs absolutas (`https?://`), `www.X` y variables-de-link (`{{property_url}}`, `{{booking_link}}`).
  - `NETWORK_LIMITS` se mantiene como **alias derivado** de `PLATFORM_POLICY` para no romper imports existentes.
- `src/app/providers/TenantProvider.jsx`:
  - Fix sample `booking_link` con `https://` (ver bug arriba).
- `src/features/social/SocialConfig.jsx`:
  - Importa policy + `findLinksInText`.
  - Info banner per-red (`.platform-notes`) sobre qué soporta cada plataforma.
  - Warning amarillo (`.platform-warning`) bajo el textarea cuando hay URLs/variables-de-link y `supportsLinks: false`.
  - Chips de variables `{{property_url}}` y `{{booking_link}}` se muestran con `tag-chip-dim` + tooltip explicativo cuando la red activa no soporta links — el usuario aún puede insertarlos, pero está avisado.
  - Title input se mantiene visible en todas las redes (el back acepta `title_template` para cualquier red por feature 20); la label cambia para indicar cuándo la red no usa título nativamente ("saved but ignored at publish time").
  - `maxLength` del title input se aplica sólo cuando `policy.titleLimit > 0`.
  - Cuando `supportsHashtags: false` (GBP/GMB), oculta el HashtagsEditor y muestra una nota explicativa en su lugar.
- `src/features/reels/editor/DescriptionsPanel.jsx`:
  - Mismo patrón: importa policy + `findLinksInText`, muestra info banner per-red + warning de links bajo cada textarea cuando aplica.
- `src/features/social/styles.css`:
  - Estilos `.platform-notes`, `.platform-warning`, `.template-section-hint`, `.tag-chip-dim`. Compartidos por `DescriptionsPanel` vía bundle global (Vanilla CSS, no scoped).

#### Verificación

- `npm run lint` ✅
- `npm run build` ✅ (CSS 122.30 kB)
- `npm run test:smoke` ✅ — **46 passed / 2 skipped**
- `npx playwright test tests/social_templates.spec.js tests/music.spec.js tests/playwright/music_upload.spec.js` ✅ — **35 passed (suite) / 1 flake en feature 8 default descriptions; pasa 3/3 aislado en tablet, mismo flake preexistente que el reviewer del front 22 anotó como #F2 not-reproducible**.
- `npm run test:e2e` global ✅ — **138 passed / 2 skipped / 1 flake** (mismo, distinto viewport en cada run).
- Probar a ojo en navegador: en `/social` activar Instagram → ver info banner "URLs no son clicables", insertar `{{property_url}}` → ver warning amarillo. Cambiar a LinkedIn → warning desaparece. En `ReelEditor > Descriptions` → mismo comportamiento por red.

Scope respetado: `src/features/reels/editor/defaults.js`, `src/features/reels/editor/DescriptionsPanel.jsx`, `src/features/social/SocialConfig.jsx`, `src/features/social/styles.css`, `src/app/providers/TenantProvider.jsx`. Sin tocar back, sin tocar otros features, sin tocar la sesión paralela de música (feature 22).

---

# Sesión paralela — backlog UX reels + intro/outro upload + needs_approval editable (Claude, leader)

- **Inicio:** 2026-05-15
- **Agente:** Claude (rol leader, sin implementación)
- **Estado:** ninguna feature en `in_progress`; sólo se ha abierto backlog.

## Contexto

El usuario pidió planificar tres tandas de trabajo en este repo y `/opt/projects/4Reels-Backend`, en paralelo a feature #26 (`review_emails_chip_editor`) que está `in_progress` aquí. Decisiones tomadas en este turno vía `AskUserQuestion`:

1. **/defaults Intro & Outro**: abrir **intro y outro a la vez** (no sólo outro). UI cablea el card existente al backend real (multipart como feature 22 música y feature 9 logo).
2. **/reels paginación**: **page + total + filtros básicos** (`workflow_state`, `publish_status`, búsqueda). State persistente en URL.
3. **/reels editor en `needs_approval`**: persistir **reorder fotos**, **subtítulos** (texto+tiempos) y **slides** (escenas) al backend; cada PATCH re-encola render. Voiceover queda fuera por ahora.

## Backlog abierto (ids 32–37 paritarios cross-repo)

| id | name | dep | resumen |
|----|------|-----|---------|
| 32 | `reels_list_pagination_and_filters_ui` | back 32 | Dashboard/ReelsTable con paginación + filtros + búsqueda debounced; state en URL |
| 33 | `agency_outro_upload_ui` | back 33 | IntroOutroCard 'Outro' cableado a multipart upload + GET file + DELETE |
| 34 | `agency_intro_upload_ui` | back 34 | IntroOutroCard 'Intro' simétrico; factorizar `UploadVideoCard` si procede |
| 35 | `per_reel_photos_override_ui` | back 35 | PhotosPanel persiste reorder + selected con PATCH debounced; badge 'Re-rendering...'; 409 banner |
| 36 | `per_reel_subtitles_override_ui` | back 36 | SubtitlesPanel persiste cues; validación cliente in<out / no overlap |
| 37 | `per_reel_slides_override_ui` | back 37 | SlidesPanel persiste manifest; validar suma de durations vs target |

Mirror cross-repo: ids 32–37 abiertos también en `/opt/projects/4Reels-Backend/feature_list.json`.

## Próximo paso

- **NO arrancar** ninguna de estas mientras feature 26 (`review_emails_chip_editor`) esté `in_progress`. Las 32–37 esperan a que la 26 cierre + a que sus counterparts del back estén deployadas en :8001.
- Cuando se arranque 32 (paginación), confirmar UX del search (placeholder, alcance — title/slug only o también price/agent_name) con el usuario.
- 33 y 34 idealmente se mergean en orden (33 primero) para factorizar `UploadVideoCard`. El implementer del 33 decide si factoriza ya o lo deja para el 34.
- 35/36/37 pueden ir en paralelo (PRs independientes) una vez sus back counterparts estén deployadas; comparten el patrón de PATCH + render-status badge + 409 banner ya establecido por features 21 y 25.

---

# HOTFIX 2026-05-15 — switch /brand "show agent photo" (Claude)

**Petición del usuario** (palabra `hotfix` invocada explícitamente, `CLAUDE.md §Hotfix`):
> "hotfix, necesito que pongas un switch en brand para quitar la foto del agente inmobiliario y que no aparezca en el reel"

## Decisión arquitectural

Sin nuevo campo en el payload Pydantic de `/brand` (`BrandSettingsUpsertPayload` es `extra='forbid'` y `agency_brand_settings` no tiene columna JSONB libre). El toggle persiste en `agency_reel_defaults.settings.showAgentPhoto` (camelCase, alineado con `INITIAL_DEFAULTS`; default `true`). El back-end correspondiente sin migración Alembic — reúso del JSONB ya existente (mismo bucket que features 24 música y 31 subtítulos).

La UI vive en `/brand` (donde el usuario la pidió) pero el `Save brand` ahora emite **dos** PUTs: el existente a `/v1/admin/agencies/{id}/brand` y uno adicional a `/v1/admin/agencies/{id}/defaults` con `{settings: {showAgentPhoto}}`. El back hace shallow-merge del `settings` dict (`update_reel_defaults.py:66-67`), por lo que las demás keys (subtitle settings, music rules, INITIAL_DEFAULTS shape) quedan intactas.

## Cambio

- `src/features/brand/BrandConfig.jsx`:
  - Imports nuevos: `Toggle` (de `shared/`), `defaultsApi` y `useReelDefaults` (de `features/defaults/`).
  - State `showAgentPhoto` (default `true`) hidratado vía `useEffect` desde `reelDefaults.settings.showAgentPhoto`. Cualquier valor no `undefined` se coerce a `Boolean(...)`, así un legacy `false`, `0` o `""` se interpreta como "hide".
  - `handleSave` ahora emite el PUT `/brand` existente y, encadenado, un `defaultsApi.saveDefaults(agencyId, { settings: { showAgentPhoto } })`; tras éxito hace `refetchDefaults()` para sincronizar el hook con el nuevo valor.
  - Nuevo componente `AgentCard` con un solo `<Toggle>` ("Show agent photo in reels"). La sub-label avisa que los reels ya renderizados conservan la foto hasta regenerarse.
  - JSX principal envuelve `IdentityCard` + `AgentCard` en `<div className="stack gap-6">` para mantener la cadencia vertical existente sin tocar `brand.css`.

## Verificación

- `npm run lint` ✅
- `npm run build` ✅ (CSS 126.39 kB; JS 400.11 kB; sin warnings nuevos).
- `npm run test:smoke` ✅ — **46 passed / 2 skipped**, incluido el spec `/brand` que renderiza sin errores de consola ni requests fallidos.
- Smoke de `/defaults` también pasa: el PUT adicional no rompe el contrato existente (el back hace shallow-merge, no rechaza keys nuevas en `settings`).
- Sin tests dedicados al toggle (era visualmente decorativo en el repo hasta ahora). Probar a ojo en navegador real contra :8001.

## Scope respetado

- Solo se tocó `src/features/brand/BrandConfig.jsx`. No se editó `brand.css`, ni hooks, ni el resto del repo.
- No se introdujo TypeScript, React Query, MSW ni librerías nuevas (blocklist del CLAUDE.md respetado).
- Sin `VITE_*` con secretos.
- El componente nuevo `AgentCard` consume `Toggle` ya existente; no añade dependencias.

## Notas para validación manual contra :8001

- Necesita el back-end del hotfix correspondiente desplegado (commit del mismo turno en `/opt/projects/4Reels-Backend/modules/reels/application/use_cases/ingest_property_into_reel.py`).
- En `/brand`: flipar Toggle OFF + `Save brand` → DevTools Network debería mostrar dos PUTs en serie (brand + defaults), ambos 200.
- Recargar `/brand`: el toggle debe quedar OFF (hidratación desde el back).
- Ingestar property nueva vía webhook → el reel renderizado debe omitir la foto del agente.

---

# Feature 32 — reels_list_pagination_and_filters_ui (implementer)

- **Feature en curso:** 32 — `reels_list_pagination_and_filters_ui`
- **Inicio:** 2026-05-15
- **Agente:** Claude (rol implementer)
- **Feature dir:** `src/features/reels/`, `tests/`
- **Toca el mock?:** sí — `tests/support/mock-backend.js` route `GET /v1/admin/agencies/{id}/reels` debe parsear `page`, `page_size`, `workflow_state`, `publish_status`, `q` y devolver `{ items, count_total, page, page_size, has_more, count }` (alias legacy `count`).

## Plan

- `src/features/reels/api.js`: extender `reelsApi.list` para aceptar `{agencyId, page, pageSize, workflowState, publishStatus, q}` y construir query string (solo params definidos).
- `src/features/reels/hooks.js`: `useReels` ahora acepta filtros + paginación, devuelve `{ reels, countTotal, page, pageSize, hasMore, loading, refresh, agencyId }`.
- `Dashboard.jsx` + nuevo componente de controles (`ReelsToolbar`/inline) con: dropdown `page_size` (10/25/50, default 25), navegación `‹ Showing A–B of N ›`, dropdown `workflow_state`, dropdown `publish_status`, search input debounced 300ms. State persiste en URL via `useSearchParams` (no había patrón previo en repo; uso el helper estándar de react-router-dom).
- Skeleton sólo en la tabla; header/metrics/tabs no parpadean (memoizar counts del primer fetch o mantener overlay loading).
- Mock backend: actualizar handler de listado en `tests/support/mock-backend.js` para que respete `page/page_size/workflow_state/publish_status/q` y devuelva el shape nuevo.
- Tests: `tests/smoke.spec.js` ya cubre `/reels`; añadir spec dedicada `tests/reels_list_pagination.spec.js` con navegación de página, filtros, búsqueda con debounce y URL state reload.

## Cierre — feature 32 lista para review

Feature 32 lista para review; reporte en `progress/impl_32.md`. `./init.sh` verde, `npm run test:smoke` verde (46 passed / 2 skipped), `npm run test:e2e` verde (214 passed / 2 skipped). 18 specs nuevas en `tests/reels_list_pagination.spec.js`. Feature sigue `in_progress` en `feature_list.json` por instrucción del leader (no marcar `done`).

Review feature 32 (front) approved; ver `progress/review_32.md`.

---

# Feature 33 — agency_outro_upload_ui (implementer)

- **Feature en curso:** 33 — `agency_outro_upload_ui`
- **Inicio:** 2026-05-15 ~18:10
- **Agente:** Claude (rol implementer)
- **Feature dir:** `src/features/defaults/`, `tests/`
- **Toca el mock?:** sí — añadir POST `/v1/admin/agencies/{id}/outro/upload` (multipart), GET `/v1/admin/agencies/{id}/outro/file` (binario), DELETE `/v1/admin/agencies/{id}/outro` en `tests/support/mock-backend.js`, y extender la GET defaults para que incluya `outro_object_key`, `outro_duration_seconds`, `outro_source`.

## Plan

- `src/features/defaults/api.js`: añadir `outroUpload(agencyId, file)` (POST multipart), `outroDelete(agencyId)` (DELETE), `outroFileUrl(agencyId)` (string del path para preview).
- `src/features/defaults/hooks.js`: `useOutroUpload`, `useOutroDelete` envolviendo `useMutation`.
- `src/features/defaults/IntroOutroCard.jsx` en modo `Outro`: replace local-state mock por backend real. Source segmented: `Uploaded video` (enabled), `Brand card` (disabled + tooltip "Coming soon"), `None` (enabled → DELETE). Validación cliente (size ≤50MB, MIME mp4/quicktime, duración 1–10s) con probe local vía `<video> loadedmetadata`. Estados: idle, uploading (spinner), uploaded chip (size/duration + Replace + Trash), error inline. Toggle Enabled persiste `outro_enabled` vía PUT `/defaults` (estado del state existente; no nuevo endpoint).
- `tests/support/mock-backend.js`: handlers nuevos + extensión de `surfaceDefaultsForGet` para devolver `outro_object_key | null`, `outro_duration_seconds | null`, `outro_source ∈ {uploaded, none}`.
- `DOCS.md` § Backend contract: documentar los tres endpoints y la extensión de GET /defaults.
- Tests Playwright nuevos en `tests/agency_outro_upload.spec.js`: upload happy path → chip; oversized → error inline + no request; Brand card disabled + tooltip; trash → DELETE; reload preserva archivo.
- Verificación: `./init.sh`, `npm run test:smoke`, `npm run test:e2e` (al menos el spec dedicado).

Plan sin pre-factorizar `UploadVideoCard` (feature 34 lo hará). El kind `Intro` queda con su comportamiento mockeado actual; sólo `Outro` se cablea.

## Cierre — feature 33 lista para review

Feature 33 lista para review; reporte en `progress/impl_33.md`. `./init.sh` verde (lint + build), `npm run test:smoke` verde (46 passed / 2 skipped), `npm run test:e2e` verde (235 passed / 2 skipped). 21 specs nuevas (7 × 3 viewports) en `tests/agency_outro_upload.spec.js`. Feature sigue `in_progress` en `feature_list.json` por contrato del implementer (no marca `done`).

Review feature 33 (front) approved; ver `progress/review_33.md`.

---

# Feature 34 — agency_intro_upload_ui (implementer)

- **Feature en curso:** 34 — `agency_intro_upload_ui`
- **Inicio:** 2026-05-15 ~19:05
- **Agente:** Claude (rol implementer)
- **Feature dir:** `src/features/defaults/`, `tests/`
- **Toca el mock?:** sí — añadir POST `/v1/admin/agencies/{id}/intro/upload` (multipart), GET `/v1/admin/agencies/{id}/intro/file` (binario), DELETE `/v1/admin/agencies/{id}/intro` en `tests/support/mock-backend.js`, y extender la GET defaults para que incluya `intro_object_key`, `intro_duration_seconds`, `intro_source`. Registrar los 3 paths en `isKnownAdminStub`.

## Plan

- **Refactor**: factorizar `OutroCard.jsx` → `UploadVideoCard.jsx` con prop `kind: 'intro' | 'outro'` + objeto `copy`. La lógica de validación, probe inyectable y endpoints sale parametrizada del `kind`. `OutroCard.jsx` queda como wrapper delgado; `IntroCard.jsx` es nuevo y wraps con `OUTRO_COPY`/`INTRO_COPY` (constantes locales de la feature).
- `src/features/defaults/api.js`: añadir `introUpload(agencyId, file)`, `introDelete(agencyId)`, `introFileUrl(agencyId)`, `introDownload(agencyId)` simétricos a outro.
- `src/features/defaults/hooks.js`: añadir `useIntroUpload`, `useIntroDelete`. `buildDefaultsBody` ya emite `intro_enabled` — verificar y dejar como está.
- `src/features/defaults/tabs/IntroOutroTab.jsx`: reemplazar el legacy `IntroOutroCard kind="Intro"` por `<IntroCard>`.
- `src/features/defaults/ReelDefaultsConfig.jsx`: `state.introEnabled` ya se hidrata desde `defaults.intro_enabled` (front 33 ya lo hace para outro; intro estaba antes). Verificar.
- `tests/support/mock-backend.js`: 3 handlers nuevos para intro (POST/GET/DELETE), `surfaceDefaultsForGet` extiende con `intro_source`, `intro_object_key`, `intro_duration_seconds`. Registrar los nuevos paths en `isKnownAdminStub`.
- `DOCS.md` § Backend contract: bloque "Agency intro upload (feature 34)" simétrico al outro.
- Tests Playwright nuevos en `tests/agency_intro_upload.spec.js`: 7 scenarios × 3 viewports = 21 specs (espejo del outro).
- Smoke combinado: defaults tab con BOTH intro y outro mocked, chips y toggles persisten.
- Verificación: `./init.sh`, `npm run test:smoke`, `npm run test:e2e tests/agency_intro_upload.spec.js tests/agency_outro_upload.spec.js` (42 verde), full e2e.

## Cierre — feature 34 lista para review

Feature 34 lista para review; reporte en `progress/impl_34.md`. `./init.sh` verde (lint + build), `npm run test:smoke` verde (46 passed / 2 skipped), tests intro+outro combinados verde (45/45, 24 intro nuevos + 21 outro intactos tras el refactor). Full `npm run test:e2e` 257 passed / 2 skipped / 2 flake en `tests/social_templates.spec.js:233` (pre-existing según review_33, verde al re-run aislado). Refactor: factoricé `OutroCard` → `UploadVideoCard.jsx` shared component parametrizado por `kind` (intro/outro); `OutroCard.jsx` y nuevo `IntroCard.jsx` son thin wrappers de ~10 líneas. Feature sigue `in_progress` en `feature_list.json` por contrato del implementer (no marca `done`).

Review feature 34 (front) approved; ver `progress/review_34.md`. Verificación re-ejecutada: `./init.sh` exit 0, `npm run test:smoke` 46 passed / 2 skipped, `npm run test:e2e tests/agency_intro_upload.spec.js tests/agency_outro_upload.spec.js` 45 passed, full `npm run test:e2e` 259 passed / 2 skipped / 0 flake (la flake de `social_templates.spec.js:233` que el implementer flagó como aceptable pasó first-try aquí). Feature 34 marcada `done` en `feature_list.json`. Único nit no-bloqueante: el legacy `src/features/defaults/IntroOutroCard.jsx` quedó huérfano (no se importa en ningún sitio); el implementer pidió thumbs-up explícito antes de borrarlo — queda para el leader despachar como cleanup separado.

---

# Feature 35 — per_reel_photos_override_ui (implementer)

- **Feature en curso:** 35 — `per_reel_photos_override_ui`
- **Inicio:** 2026-05-15 ~19:59
- **Agente:** Claude (rol implementer)
- **Feature dir:** `src/features/reels/editor/`, `src/features/reels/`, `tests/`
- **Toca el mock?:** sí — `tests/support/mock-backend.js` añade route `PATCH /v1/admin/agencies/{id}/reels/{site}/{prop}/photos` (body `{photos: [{position, selected}, ...] | null}`, response `{photos_override, render_status}`); flip simulado de `render_status` `pending → done` tras ~200 ms; 409 `PHOTOS_OVERRIDE_LOCKED` cuando el reel ya está aprobado/publicado.

## Plan

- `src/features/reels/api.js`: añadir `reelsApi.patchReelPhotos(agencyId, siteId, sourcePropertyId, photos)` con body `{photos}` (array o `null`). Pydantic extra='forbid' en back; nada de strip silencioso.
- `src/features/reels/hooks.js`: hook `useReelPhotosOverride` (mismo patrón que `useReelMusicOverride`); además `useReel` adapter expone `photosOverride`, `renderStatus` (ya estaba) y `workflowState` raw para el banner 409.
- `src/features/reels/editor/PhotosPanel.jsx`: añadir debounced (500 ms) optimistic PATCH al toggle y al drop-end del reorder. Banner persistente 409 / rollback + toast en fail. Badge `Re-rendering...` mientras `render_status !== 'done'`; refetch del reel tras éxito y mientras la badge esté activa (intervalo simple ya usado en el repo).
- `tests/support/mock-backend.js`: handler PATCH photos con persistencia in-memory, flip `pending → done` con `setTimeout(200)` para que el badge aparezca brevemente en E2E. 409 cuando `workflow_state` esté en {approved, published}. Devolver `photos_override` y `render_status: 'pending'`.
- `tests/per_reel_photos_override.spec.js`: drop-reorder dispara 1 PATCH; toggle dispara 1 PATCH; multiples cambios <500 ms se agrupan en 1; 409 muestra banner y bloquea PATCH; fail genérico → rollback + toast.
- Verificación: `./init.sh`, `npm run test:smoke`, `npm run test:e2e tests/per_reel_photos_override.spec.js`, full `npm run test:e2e`.

## Cierre — feature 35 lista para review

Feature 35 lista para review; reporte en `progress/impl_35.md`. `./init.sh` verde (lint + build), `npm run test:smoke` verde (46 passed / 2 skipped), `npx playwright test tests/per_reel_photos_override.spec.js` verde (18 passed: 6 specs × 3 viewports), full `npm run test:e2e` 276 passed / 2 skipped / 1 flake en `tests/payload_contract.spec.js:20 › Brand save` (tablet) — pre-existing por review_33/34, re-run aislado de la spec entera pasa 6/6. Bug raíz descubierto y arreglado durante la implementación: `useReelImages` devolvía un array `images` nuevo en cada render (sin `useMemo`), provocando que el `useEffect([livePhotos])` del editor reseteara el state `photos` entre renders y que cualquier toggle/reorder se perdiera. El fix memoiza el adapter del hook; sin esto el test "multiple changes <500ms collapse into ONE PATCH" colapsaba con `selected:true` en todas las posiciones. Feature sigue `in_progress` en `feature_list.json` por contrato del implementer (no marca `done`).

Review feature 35 (front) approved; ver `progress/review_35.md`. Verificación re-ejecutada: `./init.sh` exit 0, `npm run test:smoke` 46 passed / 2 skipped, `npx playwright test tests/per_reel_photos_override.spec.js` 18 passed, full `npm run test:e2e` 275 passed / 2 skipped / 2 flakes en `tests/social_templates.spec.js:19 [tablet]` y `tests/templates.spec.js:17 [mobile]` (mismas flakes paralelas pre-existentes, re-run aislado de ambos archivos → 33 passed). Memoization fix de `useReelImages` aceptado como bug fix legítimo: deps `[data, agencyId, siteId, sourcePropertyId]` son completas, el único consumidor (`ReelEditor.jsx`) se beneficia, y el comportamiento post-PATCH es correcto (la rehydratación desde `reel.photosOverride` confirma la optimistic update). Feature 35 marcada `done` en `feature_list.json`. Nits no-bloqueantes registrados en `review_35.md` §6 (recomputo per-tile de índice seleccionado, badge sin i18n, dep array de `flush` no incluye `setPhotos` — todo cosmético).

---

# Feature 36 — per_reel_subtitles_override_ui (implementer)

- **Feature en curso:** 36 — `per_reel_subtitles_override_ui`
- **Inicio:** 2026-05-15 21:08 IST
- **Agente:** Claude (rol implementer)
- **Feature dir:** `src/features/reels/editor/`, `src/features/reels/`, `tests/`
- **Toca el mock?:** sí — `tests/support/mock-backend.js` añade route `PATCH /v1/admin/agencies/{id}/reels/{site}/{prop}/subtitles` (body `{cues: [{index, text, in_seconds, out_seconds}, ...] | null}`, response `{subtitles_override, render_status}`); flip simulado de `render_status` `pending → done` tras ~200 ms; 409 `SUBTITLES_OVERRIDE_LOCKED` cuando el reel ya está aprobado/publicado.

## Plan

- **Refactor**: extraer `LOCKED_COPY`, banner JSX y badge `Re-rendering...` JSX de `PhotosPanel.jsx` a `src/features/reels/editor/lockedReelHelpers.jsx` — componentes `LockedReelBanner` + `RerenderBadge` reutilizables; constante `LOCKED_COPY`; `useReelClientLocked(reel, serverLocked)` helper para el gate cliente. Refactorizar `PhotosPanel.jsx` para consumirlos (sin regresión de tests feature 35).
- `src/features/reels/api.js`: añadir `reelsApi.patchReelSubtitles(agencyId, siteId, sourcePropertyId, cues)` con body `{cues}` (array o `null`).
- `src/features/reels/hooks.js`: hook `useReelSubtitlesOverride` mismo patrón que `useReelPhotosOverride`; en `useReel` adapter exponer `subtitlesOverride` y `publishSubtitlesSnapshot`.
- `src/features/reels/editor/SubtitlesPanel.jsx`: refactorizar el componente actual stateless → conectado al backend. Auto-save debounce 1s; validación estricta cliente (mirrors back); inline error rojo en filas inválidas; PATCH NO se dispara si hay errores. Banner 409 vía `LockedReelBanner`. Badge `RerenderBadge` mientras `renderStatus==='pending'` con poll cada 1.5s. Optimistic + rollback en fail.
- `ReelEditor.jsx`: hidratar `subtitles` desde `reel.subtitlesOverride` o `reel.publishSubtitlesSnapshot` (fallback a `CRANFORD_SUBTITLES`); pasar `agencyId`, `reel`, `refetchReel` al panel; remover el wrapper `feature-stub`.
- `tests/support/mock-backend.js`: handler PATCH subtitles con persistencia, flip render_status, 409 si workflow_state ∈ {approved, published}. Surface `subtitles_override` en reel inspector GET.
- `tests/per_reel_subtitles_override.spec.js`: 9 specs (edit texto, edit in/out, add, delete, validation in>=out, validation overlap, 409 banner, 500 rollback). Foco: 1s debounce → 1 PATCH.
- `DOCS.md` § Backend contract: bloque "Per-reel subtitles override (feature 36)" simétrico al photos.
- Verificación: `./init.sh`, `npm run test:smoke`, `npm run test:e2e tests/per_reel_subtitles_override.spec.js tests/per_reel_photos_override.spec.js`, full `npm run test:e2e`.

## Cierre — feature 36 lista para review

Feature 36 lista para review; reporte en `progress/impl_36.md`. `./init.sh` verde (lint + build), `npm run test:smoke` verde (46 passed / 2 skipped), `npx playwright test tests/per_reel_subtitles_override.spec.js tests/per_reel_photos_override.spec.js` verde (45 passed: 27 subtítulos nuevos + 18 fotos intactos tras el refactor), full `npm run test:e2e` 303 passed / 2 skipped / 1 flake en `tests/social_templates.spec.js:19 [desktop]` (la misma flake paralela pre-existente que review_35 ya marcó; re-run aislado de la spec → 10/10 verde). Refactor: extraído `LOCKED_COPY`/`LockedReelBanner`/`RerenderBadge`/`isReelClientLocked` de `PhotosPanel.jsx` a `src/features/reels/editor/lockedReelHelpers.jsx`; `PhotosPanel` re-implementado consumiendo los helpers compartidos sin regresión de los testIds (`photos-locked-banner`, `photos-rerender-badge`). `SubtitlesPanel.jsx` re-implementado: auto-save debounce 1 s, validación cliente estricta (mirrors back: in≥0, out>in, no overlap, 1≤len(text)≤200, indices monotónicos), inline error rojo por fila, PATCH bloqueado mientras haya errores, optimistic + rollback en fail, badge `Re-rendering…` con poll 1.5 s, banner 409. `ReelEditor` hidrata `subtitles` desde `reel.subtitlesOverride` → `reel.publishSubtitlesSnapshot` → seed. Mock backend extendido con PATCH `/subtitles` (extra='forbid', validación item-level, 409 lock, flip render_status). DOCS.md actualizado con el bloque "Per-reel subtitles override (feature 36)" simétrico al de photos. Feature sigue `in_progress` en `feature_list.json` por contrato del implementer (no marca `done`).

Review feature 36 (front) approved; ver `progress/review_36.md`. Verificación re-ejecutada: `./init.sh` exit 0, `npm run test:smoke` 46 passed / 2 skipped, `npm run test:e2e -- tests/per_reel_subtitles_override.spec.js tests/per_reel_photos_override.spec.js` 45 passed (27 subtitles + 18 photos — confirma 0 regresión de feature 35 tras el refactor de `lockedReelHelpers.jsx`), full `npm run test:e2e` 303 passed / 2 skipped / 1 flake en `tests/social_templates.spec.js:19 [tablet]` (misma flake paralela pre-existente; re-run aislado → 30/30). Refactor evaluation: limpio — `LOCKED_COPY`/`LOCKED_WORKFLOW_STATES`/`isReelClientLocked`/`LockedReelBanner`/`RerenderBadge` única-fuente en `src/features/reels/editor/lockedReelHelpers.jsx`, `PhotosPanel.jsx` no tiene literales duplicados, `SubtitlesPanel.jsx` consume el mismo módulo, CSS unificado en `.reel-locked-banner` / `.reel-rerender-badge`. Acceptance checklist completa, hard rules todas verdes (sin TS, sin React Query/MSW/styled-components/Tailwind/CSS-in-JS, sin new deps, sin `fetch` directo, sin `VITE_*` secretos, sin `console.*`/`debugger`). Open items registrados en `review_36.md` §6-7 (todos no-bloqueantes): nit `setSubtitles` ausente en deps de `flush`, `validateCues` no memoizado per-row, y deferral de `useReelDebouncedOverride` para cuando feature 37 (slides) cree el tercer call-site del loop optimistic+debounce. Feature 36 marcada `done` en `feature_list.json`. Feature 37 (slides) podrá consumir `lockedReelHelpers.jsx` tal cual — los props `testId`/`copy`/`label` soportan los testIds y copy específicos que slides necesite sin re-extraer nada.

---

# Feature 37 — per_reel_slides_override_ui (implementer)

- **Feature en curso:** 37 — `per_reel_slides_override_ui`
- **Inicio:** 2026-05-15 ~21:55 IST
- **Agente:** Claude (rol implementer)
- **Feature dir:** `src/features/reels/editor/`, `src/features/reels/`, `tests/`
- **Toca el mock?:** sí — `tests/support/mock-backend.js` añade route `PATCH /v1/admin/agencies/{a}/reels/{s}/{p}/slides` (body `{slides: [{slide_id, position, duration_seconds, kind, ...kind-specific}, ...] | null}`, response `{manifest_override, render_status}`); flip simulado de `render_status` `pending → done` tras ~200 ms; 409 `SLIDES_OVERRIDE_LOCKED` cuando el reel ya está aprobado/publicado.

## Plan

- **Refactor 3rd call-site**: extraer `useReelDebouncedOverride` (snapshot+debounce+flush+rollback+poll loop) a `src/features/reels/editor/useReelDebouncedOverride.js`. Signature: `({reel, agencyId, overrideKey, patchFn, debounceMs, pollMs, refetchReel, getErrorCode}) => { schedule, flush, feedback, setFeedback, serverLocked, setServerLocked, rerendering, snapshotIfFirst, rollback, latestRef, saving }`. Re-wire `PhotosPanel` y `SubtitlesPanel` para consumir el shared hook (sin regresión: 18+27 = 45 specs deben seguir verde).
- `src/features/reels/api.js`: añadir `reelsApi.patchReelSlides(agencyId, siteId, sourcePropertyId, slides)` con body `{slides}` (array, `null` o `[]`).
- `src/features/reels/hooks.js`: hook `useReelSlidesOverride` mismo patrón que las anteriores; en `useReel` adapter exponer `manifestOverride` (lista persistida) y `targetDurationSeconds` derivado del back (si surface) o `null`.
- `src/features/reels/editor/SlidesPanel.jsx`: reescribir consumiendo `useReelDebouncedOverride` (debounce 500ms, optimistic+rollback, locked banner + rerender badge). Cambios cableados a PATCH: reorder DnD, edit `duration_seconds` (slider/range), toggle `enabled` (visibility). Validación cliente: `kind ∈ ALLOWED_KINDS` (inline error si user state corrupto), warning amarillo si `sum(duration_seconds) > target`, warning rojo si `sum > 1.5×target` — ambos NO bloquean (back decide 422). `target_duration_seconds` se lee de `useReelDefaults().defaults.duration_seconds` (fallback 30 s).
- Wire body: `{slide_id, position, duration_seconds, kind, ...}` — kind-specific fields: `google-review` → `url, status, rating?, author?`; `text` → `text`; `photo` → ninguno extra; `intro-video`/`outro-video` → ninguno extra. `label` se envía como kind-agnostic prop opcional.
- `ReelEditor.jsx`: hidratar `slides` desde `reel.manifestOverride` con fallback a `DEFAULT_SLIDES` (no hay snapshot intermediate en el back para slides). Quitar el wrapper `feature-stub` y el badge `preview` del tab `slides`. Pasar `agencyId`, `reel`, `refetchReel` al panel.
- `tests/support/mock-backend.js`: handler PATCH slides con persistencia + validación per-item discriminated-union-style (kind switch). Surface `manifest_override` en GET reel inspector. Registrar nuevo path en `isKnownAdminStub`. Lo más complejo: validar `kind`-specific fields y enforce 422 si sum > 1.5×target. `target_duration_seconds` se asume 30 s en el mock (mocked default).
- `DOCS.md` § Backend contract: bloque "Per-reel slides override (feature 37)" — endpoint, body, kind-specific validation, errors, GET inspector exposes `manifest_override`.
- `tests/per_reel_slides_override.spec.js`: 6 escenarios (reorder, edit duration, debounce-collapse, warning sum>target, 409 client-side, PATCH fail 500).
- Verificación: `./init.sh`, `npm run test:smoke`, `npm run test:e2e tests/per_reel_slides_override.spec.js tests/per_reel_subtitles_override.spec.js tests/per_reel_photos_override.spec.js`, full `npm run test:e2e`.

## Cierre — feature 37 lista para review

Feature 37 lista para review; reporte en `progress/impl_37.md`. `./init.sh` verde (lint + build), `npm run test:smoke` verde (46 passed / 2 skipped), `npm run test:e2e tests/per_reel_slides_override.spec.js tests/per_reel_subtitles_override.spec.js tests/per_reel_photos_override.spec.js` verde (63 passed: 18 slides nuevos + 27 subtítulos intactos + 18 fotos intactos tras el refactor del hook compartido), full `npm run test:e2e` 322 passed / 2 skipped / 0 flake. Refactor: extraído `useReelDebouncedOverride` (snapshot+debounce+flush+rollback+poll loop) a `src/features/reels/editor/useReelDebouncedOverride.js`; consumen el hook `PhotosPanel`, `SubtitlesPanel` y `SlidesPanel`. `SlidesPanel.jsx` re-implementado: debounce 500 ms, validación cliente "unknown kind" inline + warning amarillo si suma de durations > target_duration_seconds, warning rojo si supera 1.5×target (ninguno bloquea), optimistic + rollback en fail, badge `Re-rendering…` con poll 1.5 s, banner 409. `ReelEditor` hidrata `slides` desde `reel.manifestOverride` → `DEFAULT_SLIDES`; tab `slides` deja de ser stub. Mock backend extendido con PATCH `/slides` (extra='forbid', discriminated-union per-kind validation, ceiling 1.5×target → 422, 409 lock, flip render_status). DOCS.md actualizado con el bloque "Per-reel slides override (feature 37)" simétrico a las anteriores. `Toggle.jsx` ganó prop `disabled` opcional (retro-compatible). Feature sigue `in_progress` en `feature_list.json` por contrato del implementer (no marca `done`).

Review feature 37 (front) APPROVED; ver `progress/review_37.md`. Verificación re-ejecutada: `./init.sh` exit 0, `npm run test:smoke` 46 passed / 2 skipped, `npm run test:e2e -- tests/per_reel_slides_override.spec.js tests/per_reel_subtitles_override.spec.js tests/per_reel_photos_override.spec.js` 63 passed (18 slides + 27 subtitles + 18 photos — confirma 0 regresión de features 35/36 tras la extracción del `useReelDebouncedOverride`), full `npm run test:e2e` 319 passed / 2 skipped / 3 flakes pre-existentes en `tests/social_templates.spec.js:19 [desktop]`, `:233 [desktop]` y `tests/templates.spec.js:17 [tablet]` (mismas flakes paralelas documentadas en review_32/33/34/35/36; re-run aislado por proyecto → 11/11 passed). `useReelDebouncedOverride` extraction evaluation: clean — `debounceMs` parameter-driven (500/1000/500), `validateLatest` opcional (sólo subtitles lo usa), `lockedErrorCode` parameter-driven (`PHOTOS_OVERRIDE_LOCKED` / `SUBTITLES_OVERRIDE_LOCKED` / `SLIDES_OVERRIDE_LOCKED`), snapshot/rollback capturados dentro del hook (caller no recuerda nada), poll de render-status integrado. PhotosPanel y SubtitlesPanel sin código duplicado de debounce/poll/rollback. Acceptance checklist completa, hard rules todas verdes (sin TS, sin React Query/MSW/styled-components/Tailwind/CSS-in-JS, sin new deps — diff de `package.json` sólo añade un campo `license`, sin `fetch` directo, sin `VITE_*` secretos, sin `console.*`/`debugger`). Feature 37 marcada `done` en `feature_list.json`. Open items en `review_37.md §6` (todos para manual QA contra :8001 cuando la back feature 37 esté deployada): verificar que el back acepta los keys extra `enabled` / `label` que el front emite per-slide o trimearlos en `buildSlidesBody`; verificar shape de `manifest_override` GET; ejecutar los 14 pasos del checklist manual de `impl_37.md §8`.

---

# Feature 40 — manual_reel_regenerate_button (implementer)

- **Feature en curso:** 40 — `manual_reel_regenerate_button`
- **Inicio:** 2026-05-16
- **Agente:** Claude (rol implementer subagent)
- **Feature dir:** `src/features/reels/`, `src/features/reels/editor/`, `tests/`
- **Toca el mock?:** sí — POST `/v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/regenerate` con stub `{render_status:'pending', job_id, queued_at}`, flip `render_status` `pending → done` ~400 ms, 409 PUBLISHED_FORBIDDEN si reel `publish_status==='published'`, 409 ALREADY_IN_FLIGHT si reel tiene flag `_rerendering=true`.

## Plan

- `src/features/reels/api.js`: nuevo `reelsApi.regenerateReel(agencyId, siteId, sourcePropertyId, reason?)` → POST `/regenerate`. Body `{}` si `reason` undefined; `{ reason }` si string. Misma forma que `patchReelPhotos/Subtitles/Slides` pero POST.
- `src/features/reels/hooks.js`: nuevo hook `useRegenerateReel({ reel, agencyId, refetchReel })` retorna `{ triggerRegenerate, isRegenerating, errorCode, rerendering }`. POST en `triggerRegenerate`; en 200 setea `rerendering=true` + poll de `refetchReel` cada 1.5 s hasta `render_status==='done'`; en 409 setea `errorCode` (`REGENERATE_PUBLISHED_FORBIDDEN` / `REGENERATE_ALREADY_IN_FLIGHT`); cleanup del poll al unmount.
- `src/features/reels/editor/RegenerateReelButton.jsx` nuevo: botón "Render again" + modal de confirmación (CSS classes `modal-backdrop / modal-panel / modal-header / modal-title / modal-sub / modal-body / modal-footer` ya existentes en `src/styles/surfaces.css`, mismo patrón que `CreateAgencyModal.jsx`). Texto del modal: "This will re-render the reel using the current photos, subtitles and slides settings. Continue?". Botones Cancel / Render again. Renderiza `<RerenderBadge />` (reuse de `lockedReelHelpers.jsx`) cuando `rerendering`.
- `src/features/reels/editor/ReelEditor.jsx`: importa y monta `<RegenerateReelButton ... />` en el header (después del separator, antes de `Regenerate with AI` stub que dejaré como está para no romper otros tests). Pasa props `reel, agencyId, refetchReel, onMutate`. Visibilidad: hidden si `reel.renderStatus==='failed'`; disabled con tooltip si `reel.rawPublishStatus==='published'`; visible si `renderStatus==='completed'` (también visible si `'done'` por consistencia con datos reales — el back puede devolver cualquiera).
- `tests/support/mock-backend.js`: nuevo handler POST `/regenerate`. Persiste flag `_rerendering=true` durante ~400 ms para soportar el test 409 ALREADY_IN_FLIGHT (si la spec hace una segunda llamada antes de que el flag se libere → 409). Agregar regex a `isKnownAdminStub`.
- `tests/manual_reel_regenerate.spec.js`: 4 specs:
  - Happy path: abrir editor reel completed → click "Render again" → confirm modal aparece → click confirmar → mock recibe POST → badge "Re-rendering…" visible → tras flip, badge desaparece.
  - 409 published: reel con `publish_status='published'` → botón visible pero `disabled` con tooltip; click no-op.
  - 409 in_flight: reel con `_rerendering=true` (pre-seeded) → click + confirmar → toast con copia "A render is already in progress for this reel".
  - Cancel modal: click cancel → no POST.

## Decisiones

- Botón es **adicional** al stub `Regenerate with AI` ya existente en el header. Mantengo el stub para no romper la cabecera ni los tests que asuman su presencia; el nuevo botón usa label distinto ("Render again") + icon `refresh-cw` para evitar conflictos de selector.
- Modal de confirmación inline en `RegenerateReelButton.jsx` (no extraigo a un primitive `<ConfirmModal>` separado: hay sólo un consumidor, y los modales existentes en el repo siguen el mismo patrón inline). Si futuro reviewer pide extraer, está claro cómo hacerlo (simplificar params: `title`, `body`, `confirmLabel`, `cancelLabel`, `onConfirm`, `onClose`).
- Hook `useRegenerateReel` mantiene API simple según el contrato del líder: no consume `useReelDebouncedOverride` (no hay debounce ni rollback ni snapshot — sólo fire+poll). El poll loop es propio (≈10 líneas), inspirado en el del `useReelDebouncedOverride` pero standalone.

## Cierre — feature 40 lista para review

Feature 40 lista para review; reporte en `progress/impl_40.md`. `./init.sh` verde (lint + build), `npx playwright test tests/manual_reel_regenerate.spec.js` verde (12 passed: 4 specs × 3 viewports), `npm run test:smoke` verde (46 passed / 2 skipped), regresión en specs de override y editor verde: `npx playwright test tests/per_reel_photos_override.spec.js tests/per_reel_subtitles_override.spec.js tests/per_reel_slides_override.spec.js` → 63 passed; `npx playwright test tests/reel_descriptions_override.spec.js tests/reel_music_override.spec.js tests/reel_approve_schedule.spec.js tests/reels_dashboard_live_sync.spec.js` → 39 passed. Feature sigue `in_progress` en `feature_list.json` por contrato del implementer (no marca `done`).

Review feature 40 (front) APPROVED; ver `progress/review_40.md`. Verificación re-ejecutada: `./init.sh` exit 0, `npm run test:smoke` 46 passed / 2 skipped, `npx playwright test tests/manual_reel_regenerate.spec.js tests/per_reel_photos_override.spec.js tests/per_reel_subtitles_override.spec.js tests/per_reel_slides_override.spec.js` → 75 passed (12 feature-40 + 18 photos + 27 subtitles + 18 slides; 0 regresión post-sprint). 409 parsing key check PASS — hook y componente leen `err?.body?.error || err?.body?.code` (prefieren `error` per leader spec); mock-backend emite `error` consistente. Modal-primitive reuse PASS — `RegenerateConfirmModal` inline consume `modal-backdrop/panel/header/title/sub/footer` de `src/styles/surfaces.css` (mismas primitives que `CreateAgencyModal.jsx`); sin nuevo Modal component ni CSS file. Cleanup del poll verificado: `useEffect` retorna `() => clearInterval(id)` en `hooks.js:340`. Visibilidad: activa cuando `renderStatus ∈ {completed, done}` y `!isPublished`; visible+disabled+tooltip cuando publicado; null-safe (`String(reel?.x || '')`); hide defensivo extra en `failed` (no conflicta con la spec). Toast primitive reutilizado (`lib/hooks/useToast.js`, ya usado por 5 paneles del editor). Mock backend con `extra='forbid'` sobre `reason`, 200/404/409×2, flip de `render_status` a ~400 ms, registrado en `isKnownAdminStub`. Sin nuevas dependencias (`git diff package.json` sólo añade campo `license`). Acceptance checklist completa, hard rules todas verdes (sin TS, sin React Query/MSW/styled-components/Tailwind/CSS-in-JS, sin new deps, sin `fetch` directo, sin `VITE_*` secretos, sin `console.*`/`debugger`). Feature 40 marcada `done` en `feature_list.json`. Open items quedan para manual QA en :80 contra el back feature 40 deployado (7 pasos documentados en `review_40.md §9` + `impl_40.md §7`); el leader rebuildeará dist tras este review.
