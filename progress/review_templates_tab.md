# Review — feature 15 (templates_tab_agency_render_template_selection)

**Veredicto:** `approve`

## Resumen ejecutivo

Implementación limpia y consistente con `features/brand/` y
`features/defaults/`: api → hooks → page, vanilla JSX + vanilla CSS, sin
`fetch` en componentes, sin libs prohibidas. El shape mock coincide
exactamente con `_serialize_template` del backend
(`/opt/projects/4Reels-Backend/modules/configuration/transport/http/render_templates_router.py:146-162`)
y la respuesta del PUT replica el contrato
`{status:'saved', agency_id, render_template:{...selected:true}}`
(router.py:131). La desviación documentada por el implementer
(no añadir handler en `src/lib/api/mock/handlers/`) es razonable: ese
layer fue retirado del repo y hoy el único punto de mock es
`tests/support/mock-backend.js` (ver `src/lib/api/client.js:4-12`).

## Checklist de acceptance criteria

- [x] `src/app/pages.js:22` añade entrada
      `{ id:'templates', path:'/templates', label:'Templates', icon:'grid',
      requires:{ module:'brand' } }`.
- [x] `src/app/Shell.jsx:13,83-90` importa `TemplatesPage` y crea ruta
      `/templates` envuelta en `RequirePermission module="brand"`.
- [x] `src/features/templates/api.js` expone `listRenderTemplates(agencyId)`
      y `selectRenderTemplate(agencyId, templateId)` (ambos como métodos
      del objeto `templatesApi` y como funciones planas reexportadas)
      vía `apiRequest`. Sin `fetch(` directo.
- [x] `src/features/templates/hooks.js` expone
      `useRenderTemplates(agencyId)` y `useSelectRenderTemplate(agencyId)`
      siguiendo el patrón de `features/brand/hooks.js` (useApi +
      useMutation, agency-scoped, defer hasta que `agencyId` resuelve).
- [x] `src/features/templates/TemplatesPage.jsx` renderiza la lista con
      `template_id`, `display_name`, `description`,
      `preview_images[].image_url`/`alt`, badge "Selected" cuando
      `selected===true` (o coincide con `currentTemplateId`) y botón
      "Use this template" deshabilitado en la activa.
- [x] Botón dispara `selectRenderTemplate`, hace `refetch` y muestra
      feedback success/danger reutilizando `card` / `card-danger`
      (`TemplatesPage.jsx:22-38,61-69`).
- [x] `src/features/templates/index.js` exporta `TemplatesPage`.
- [x] **Desviación aceptada:** la acceptance pide handler en
      `src/lib/api/mock/handlers/`, pero ese directorio ya no existe
      (`src/lib/api/client.js:4-12` documenta la retirada del layer
      mock). El mock vive en `tests/support/mock-backend.js:386-449,553-593`
      con el shape exacto del backend y PUT que devuelve
      `{ status:'saved', agency_id, render_template:{...selected:true} }`,
      mas 404 con código `RENDER_TEMPLATE_NOT_FOUND` cuando el
      `template_id` no existe.
- [x] `DOCS.md:158-170` § Backend contract añade bullet "Render templates"
      referenciando `render_templates_router.py` con shape exacto GET/PUT.
- [x] Estilos en `src/styles/templates.css` — vanilla CSS, BEM,
      grid responsivo `auto-fill minmax(260px,1fr)`. Sin
      styled-components ni Tailwind.
- [x] `tests/support/mock-backend.js:553-593` siembra dos plantillas
      (`classic-grid`, `bold-headline`) con `preview_images` (cover/frame).
- [x] `tests/templates.spec.js` cubre (1) carga del tab, (2) dos cards
      visibles, (3) click en "Use this template" del no-activo, (4) badge
      "Selected" se mueve. Además valida body del PUT y status 200.
- [x] `grep -rn 'fetch(' src/features/templates` → 0 hits reales (el único
      match es la subcadena `refetch(` que NO es `fetch(`; verificado con
      `grep -nE '(^|[^a-zA-Z_])fetch\(' src/features/templates/*` → 0).
- [x] `npm run lint` y `npm run build` → verdes vía `./init.sh`.
- [x] `npm run test:smoke` → 46 passed / 2 skipped.

## Reglas duras del repo

- [x] Vanilla JS/JSX (sin `.ts`/`.tsx` en `src/`).
- [x] Vanilla CSS (`src/styles/templates.css`, sin CSS-in-JS).
- [x] Sin `fetch(` directo en componentes — `TemplatesPage` consume hooks,
      hooks llaman a `templatesApi`, `templatesApi` usa `apiRequest`.
- [x] Hooks viven en `lib/hooks/useApi.js` y `features/*/hooks.js`
      (correcto).
- [x] Sin libs prohibidas en `package.json` (init.sh verifica blocklist).
- [x] Todos los archivos dentro de `src/`, `tests/`, `src/styles/` o
      `DOCS.md`.
- [x] Sin `console.log` / `debugger` residual en el nuevo código (revisado
      `TemplatesPage.jsx`, `hooks.js`, `api.js`).

## Patrón consistente

- Estructura `api.js` + `hooks.js` + `*Page.jsx` + `index.js` idéntica a
  `features/brand/` y `features/defaults/`.
- Hooks usan `useApi` / `useMutation` de `lib/hooks/useApi.js`
  (mismo que `useBrand`, `useReelDefaults`).
- Manejo de loading/error y banner success/danger replica el patrón
  visible en otras pages (uso de `card` y `card-danger`).
- Nombres siguen `docs/conventions.md`: componente PascalCase, archivos
  CSS kebab-case, hooks `useX`.

## Mock = spec

Comparado contra `_serialize_template` (router.py:146-162):

| campo backend     | mock servido (`mock-backend.js:553-593`) |
|-------------------|-------------------------------------------|
| `template_id`     | OK |
| `display_name`    | OK |
| `description`     | OK |
| `status`          | OK ("active") |
| `sort_order`      | OK (1, 2) |
| `preview_images[].kind` / `.image_url` / `.alt` | OK |
| `layout_variant`  | OK |
| `selected`        | OK (calculado en GET por `tpl.template_id === currentId`) |

PUT response (`mock-backend.js:439-446`):
`{ status:'saved', agency_id, render_template:{ ...match, selected:true } }`
→ replica router.py:128-132 al pie de la letra.

## Permisos

- `src/features/session/ghlMvpContext.js:113`: agency_user tiene
  `brand: 'rw'`.
- `src/features/session/ghlMvpContext.js:154`: super-admin tiene
  `brand: 'none'` (y `admin:'rw'`).
- Por tanto `requires:{ module:'brand' }` en `pages.js:22` y el
  `RequirePermission` de `Shell.jsx:86` permiten ver la tab al
  agency_user y la ocultan al super-admin → comportamiento querido.
- Cuando el backend exponga un módulo de permisos `templates` propio,
  basta cambiar la línea en `pages.js` y la wrapper en `Shell.jsx`.

## DOCS.md

`DOCS.md:158-170` documenta los dos endpoints como ya implementados
referenciando el archivo del backend, con shape exacto del request y
response. Cumple el criterio.

## Verificación reproducible

```text
$ ./init.sh
[OK] node v24.14.1
[OK] feature_list.json válido (13 features)
[OK] Sin TypeScript en src/
[OK] package.json sin libs prohibidas
[OK] lint verde
[OK] build verde
[OK] Entorno listo.

$ npm run test:smoke
46 passed, 2 skipped (1.0m)
(incluye 3 viewports de /templates en desktop+tablet+mobile)

$ npx playwright test templates --project=desktop
3 passed (7.4s)
(templates.spec.js 1/1 + 2 sociales pre-existentes que matchean la palabra)

$ grep -nE '(^|[^a-zA-Z_])fetch\(' src/features/templates/*.{js,jsx}
(0 hits)
```

## Hallazgos menores (no bloquean)

- `TemplatesPage.jsx:99`: `isCurrent` aplica OR entre
  `tpl.template_id === currentTemplateId` y `tpl.selected`. Es defensivo
  (la lista del back ya marca `selected`), pero correcto y no
  problemático.
- `hooks.js:18`: `data?.current_template_id || null` colapsa cadena vacía
  a null. Inofensivo dado que el backend no devuelve string vacío en ese
  campo (router.py:70 devuelve `result.current_template_id` que es UUID
  o `None`).
- `mock-backend.js:397`: regex `\/render-templates?` matchea tanto
  `/render-templates` como `/render-template` por el `s?`. Funciona, y
  además se distingue por método dentro del handler. No hay falsos
  positivos.

Ninguno requiere cambio.

## Cambios requeridos

Ninguno. Feature lista para cerrar como `done`.
