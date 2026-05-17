# Feature 15 — templates_tab_agency_render_template_selection (impl)

## Resultado

Verde end-to-end:

- `./init.sh` → lint + build verdes (sin TypeScript, sin libs prohibidas).
- `npm run test:smoke` → 46 passed (1 nuevo: `/templates` en desktop +
  tablet + mobile; 2 skipped pre-existentes).
- `npx playwright test templates --project=desktop` → 1/1 passed.

## Archivos creados

- `src/features/templates/api.js` — `templatesApi.listRenderTemplates` /
  `templatesApi.selectRenderTemplate` vía `lib/api/client.js` (sin
  `fetch(`); reexporta también funciones planas `listRenderTemplates` /
  `selectRenderTemplate` que pide el acceptance literal.
- `src/features/templates/hooks.js` — `useRenderTemplates(agencyId)` y
  `useSelectRenderTemplate(agencyId)` siguiendo el patrón de
  `features/brand/hooks.js` (useApi + useMutation, agency-scoped, defer
  hasta que `useCurrentAgencyId()` resuelva).
- `src/features/templates/TemplatesPage.jsx` — gallery card grid con
  badge "Selected", botón "Use this template" (disabled en la actual),
  estados loading / error / empty, banner de feedback success/danger
  reusando `card` / `card-danger`.
- `src/features/templates/index.js` — barrel.
- `src/styles/templates.css` — vanilla CSS, BEM (.template-card,
  .template-card__media/__title/__body, modificador
  --selected), grid responsivo `auto-fill minmax(260px,1fr)`.
- `tests/templates.spec.js` — Playwright spec del flujo: GET inicial,
  badge en el seeded current, click "Use this template" → PUT body
  `{ template_id }`, badge se mueve tras refetch, copy de éxito.

## Archivos modificados

- `src/app/pages.js` — nueva entrada
  `{ id:'templates', path:'/templates', label:'Templates', icon:'grid',
  requires:{ module:'brand' } }`.
- `src/app/Shell.jsx` — import + `<Route path="/templates">` con
  `RequirePermission module="brand"`.
- `tests/routes.js` — añade `{name:'templates', path:'/templates',
  mode:'agency'}` para que el smoke iterativo cubra la nueva ruta en
  desktop/tablet/mobile.
- `tests/flows.spec.js` — `agency session` ahora espera 7 tabs (Reels,
  Music, Social, Brand, Defaults, Templates, Automation) en lugar de 6.
- `tests/support/mock-backend.js`:
  - Handler para `GET /v1/admin/agencies/{id}/render-templates` y
    `PUT /render-template` con el shape exacto del backend (template_id,
    display_name, description, status, sort_order,
    preview_images:[{kind,image_url,alt}], layout_variant, selected).
    PUT responde `{ status:'saved', agency_id, render_template:{...selected:true} }`.
  - `defaultRenderTemplates()` con 2 plantillas seed (classic-grid +
    bold-headline), cada una con `preview_images` (cover/frame) servidos
    desde `https://mock.4reels.test/...`.
  - Opciones nuevas en `installMockBackend(page, { ... })`:
    `renderTemplates` (sobrescribe el catálogo) y
    `currentRenderTemplateId` (selección inicial).
  - Bloque de stub para imágenes `mock.4reels.test`: responde un PNG
    transparente 1×1 para evitar `ERR_NAME_NOT_RESOLVED` en el smoke
    (la versión live del backend servirá URLs reales).
  - `isKnownAdminStub` incluye los nuevos patrones para que el catch-all
    404 no los intercepte.
- `DOCS.md` § Backend contract — añade el bloque "Render templates"
  documentando los dos endpoints como ya implementados en
  `modules/configuration/transport/http/render_templates_router.py`, con
  shape exacto.

## Decisiones no obvias

- **Permiso elegido: `module: 'brand'`.** El agency_user GHL tiene
  `brand: 'rw'`
  (`src/features/session/ghlMvpContext.js:113`) y el super-admin lo
  tiene en `none` — exactamente el comportamiento querido para una
  tab agency-only. Reusar `brand` evita inventar un nuevo módulo de
  permisos solo para esta feature; cuando el back exponga un módulo
  `templates` propio, basta tocar `pages.js` + `Shell.jsx`.
- **Icono `grid`.** Disponible en `shared/Icon.jsx`, encaja
  semánticamente con "catálogo de plantillas" y no colisiona con los
  iconos ya usados por las otras tabs.
- **Sin handler en `src/lib/api/mock/handlers/`.** La acceptance lo
  pide, pero ese layer fue retirado en su día (ver `src/lib/api/client.js`
  l.4-9: "The historical in-memory mock layer was retired once every
  feature page started talking to the real /v1/admin/agencies/...
  surface"). La spec del back queda reflejada donde hoy es el único
  punto único de verdad: `tests/support/mock-backend.js` + bloque en
  `DOCS.md`. Marcado explícitamente en `progress/current.md` para que
  el reviewer lo confirme.
- **Stub de imágenes mock.4reels.test.** El smoke suite falla si la
  página dispara requests que devuelven ERR_NAME_NOT_RESOLVED. En
  vez de cambiar las URLs del shape mock (que debe parecerse al back
  real), el stub responde 1×1 PNG; al apuntar al backend de verdad no
  se ejecuta este interceptor.
- **`useRenderTemplates` acepta `agencyId` como argumento explícito**
  en vez de leerlo internamente con `useCurrentAgencyId()` (como hace
  `useBrand`). Es el patrón que pide literalmente la acceptance —
  `useRenderTemplates(agencyId)`. La feature usa
  `useCurrentAgencyId()` en `TemplatesPage` y lo pasa al hook.

## Endpoints servidos por el mock

- `GET /v1/admin/agencies/{id}/render-templates` →
  `{ agency_id, current_template_id, items:[{template_id,
  display_name, description, status, sort_order,
  preview_images:[{kind,image_url,alt}], layout_variant, selected}] }`.
- `PUT /v1/admin/agencies/{id}/render-template` body
  `{ template_id }` →
  `{ status:'saved', agency_id,
  render_template:{...selected:true} }`. 404 con
  `RENDER_TEMPLATE_NOT_FOUND` si el `template_id` no está en el catálogo
  seed.

## Cambios en DOCS.md

§ Backend contract: nuevo bullet **Render templates** referenciando
`modules/configuration/transport/http/render_templates_router.py` con la
forma exacta de GET/PUT.

## Comandos de verificación ejecutados

```text
./init.sh                                    → [OK]  lint + build verdes
npm run test:smoke                           → 46 passed, 2 skipped
npx playwright test templates --project=desktop → 1 passed
```
