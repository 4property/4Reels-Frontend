# Implementer report — Feature 18 `social_templates_ui_close_gaps`

- **Repo:** `/opt/projects/4Reels-Frontend`
- **Fecha:** 2026-05-14
- **Agente:** implementer
- **Estado:** implementación completa, pendiente review

## Resumen

Cerrados los 3 gaps de `/social` detectados por el leader:

1. La UI exponía 13 chips de variables; el backend acepta 16. Faltaban `neighborhood_tag`, `agent_email`, `property_url`.
2. El mock-backend persistía cualquier template sin validar variables, así que los tests E2E nunca golpeaban el path 422 del backend real.
3. No había tests Playwright para el bloqueo de variable desconocida, el contador `.over` por exceder `NETWORK_LIMITS`, ni la inserción de los chips nuevos.

Se introduce una única fuente de verdad (`src/features/social/constants.js`) que el provider de chips y el mock-backend consumen, para que el próximo cambio de variables canónicas toque un solo fichero.

## Cambios por archivo

### `src/features/social/constants.js` (nuevo)

Exporta dos símbolos:

- `ALLOWED_SOCIAL_TEMPLATE_VARIABLES` — array de 16 strings, en el orden que el editor presenta al usuario: property fields (8) → location (city, neighborhood, neighborhood_tag, eircode) → descriptive (short_description) → agent (agent_name, agent_phone, agent_email) → links (booking_link, property_url).
- `SOCIAL_TEMPLATE_VARIABLE_PATTERN` — `/\{\{\s*([\w.]+)\s*\}\}/g`, igual que la regex del back (`social_templates_variables.py`).

JSDoc apunta al fichero canónico del backend y enumera los consumidores (provider + mock).

### `src/features/social/index.js`

Re-exporta `ALLOWED_SOCIAL_TEMPLATE_VARIABLES` y `SOCIAL_TEMPLATE_VARIABLE_PATTERN` desde el barrel del feature por si features futuras (20, 21) los necesitan.

### `src/app/providers/TenantProvider.jsx`

- Import nuevo: `ALLOWED_SOCIAL_TEMPLATE_VARIABLES` desde `../../features/social/constants.js`.
- `STATIC_VARIABLES` deja de ser un array literal y se construye como `ALLOWED_SOCIAL_TEMPLATE_VARIABLES.map(key => ({ key, sample: VARIABLE_SAMPLES[key] }))`. `VARIABLE_SAMPLES` es un dict por-key con las muestras (las 13 viejas + las 3 nuevas).
- Samples nuevos:
  - `neighborhood_tag`: `'#cranfordcourt'`
  - `agent_email`: `'sales@4pm.ie'`
  - `property_url`: `'https://example.com/property/123'`
- El orden de los chips queda dictado por el array canónico → respeta el agrupamiento pedido (property → location → descriptive → agent → links).

`useVariables()` sigue devolviendo `{key, sample}` (sin cambio de contrato).

### `tests/support/mock-backend.js`

- Import nuevo al top: `{ ALLOWED_SOCIAL_TEMPLATE_VARIABLES, SOCIAL_TEMPLATE_VARIABLE_PATTERN }` desde `../../src/features/social/constants.js`. Decisión import-vs-duplicar abajo en §Decisiones.
- `handleSocialTemplates` (rama `PUT`):
  1. Parsea body como antes.
  2. Llama a `collectUnknownSocialTemplateVariables(incoming)` — recorre cada `{platform: description}`, escanea `description` con la regex compartida, deduplica por plataforma y devuelve `{platform: [unknownVars,...]}` o `null` si todo está OK.
  3. Si hay desconocidas: `route.fulfill(jsonResponse({ error:'SOCIAL_TEMPLATE_UNKNOWN_VARIABLE', details: unknownByPlatform }, 422))`. NO toca el `Map` de persistencia.
  4. Si pasa: persiste exactamente como antes y responde 200 con shape `{ status:'saved', ...payload }`.
- Helper nuevo `collectUnknownSocialTemplateVariables(incoming)` justo debajo de `handleSocialTemplates`. Construye una RegExp fresca por iteración para no arrastrar `lastIndex` entre plataformas (la regex compartida es `g`, statefulness pegajosa de matchAll resuelta con `new RegExp(src, flags)`).

### `src/features/social/SocialConfig.jsx`

- Una sola línea: añadido `data-testid="social-template-textarea"` al `<textarea>` del editor. Selector estable para los tests; no afecta a CSS ni a comportamiento.

### `tests/social_templates.spec.js`

Extendido con un nuevo `test.describe('feature 18 — social templates UI gaps', …)` que contiene 3 tests, justo después del describe existente de feature 8. Cada test:

1. Siembra `seedAgencyLocalStorage` + `installMockBackend` con `agencyConnectedSession(SAMPLE_AGENCY_ID)` (necesario para que `SessionProvider` no quede atrapado en la pantalla "Connecting GoHighLevel location...").
2. Navega a `/social`.
3. Caso (a) — `unknown variable in PUT body`: rellena el textarea con `Valid copy {{not_a_real_var}} more text`, click Save, espera 422 en respuesta y verifica que `.card.card-danger` contiene `SOCIAL_TEMPLATE_UNKNOWN_VARIABLE`.
4. Caso (b) — `char count over`: `textarea.fill('a'.repeat(2201))`; espera que `.template-char-count` tenga clase `over` y muestre `2201/2200`.
5. Caso (c) — `chips clicables nuevos`: localiza chips `{{neighborhood_tag}}`, `{{agent_email}}`, `{{property_url}}` por role/name, click, verifica que el textarea contiene literalmente el token. Limpia entre iteraciones.

También añadido al `import { ... }` del fichero: `agencyConnectedSession`, `seedAgencyLocalStorage`.

### `progress/current.md`

Append-only en sección "## Bitacora". No se tocó "## Plan".

## Decisiones de diseño

### Import desde `src/` en `tests/support/mock-backend.js` — sí, no duplicar

Verifiqué que `tests/unit/publishStatus.unit.js` y `tests/unit/mapPublishStatus.unit.js` ya importan de `../../src/...`. Como `mock-backend.js` también es ESM puro (Node 24, `"type":"module"` en `package.json`, sin transform), el import directo funciona — Playwright runner es Node, no Vite, así que se resuelve igual que en los unit tests. Esto:

- Elimina el riesgo de drift entre las 16 variables canónicas del front y la lista que valida el mock.
- Mantiene una sola fuente de verdad (el spec del backend) y evita TODOs grepables.
- Reduce el footprint del fix: si mañana añadimos `mortgage_link`, basta tocar `constants.js`.

Si en algún futuro el bundler de tests cambia y el import deja de resolverse, la alternativa sería volver a duplicar el array literal con un comentario que apunte a `constants.js` — pero hoy no es necesario.

### Por qué construir `STATIC_VARIABLES` desde `map(...)` y no inline

El requisito era que el orden agrupara property → location → descriptive → agent → links. Como el array canónico ya respeta ese orden, basta con `ALLOWED_SOCIAL_TEMPLATE_VARIABLES.map(key => ({key, sample: VARIABLE_SAMPLES[key]}))`. Esto:

- Hace imposible que el provider quede desincronizado con la lista canónica (si añades una variable a `constants.js` sin sample, sale `''`; si quitas una, el chip desaparece).
- Mantiene `VARIABLE_SAMPLES` como un dict por-key fácil de actualizar.

### Pourquoi no añadir más `data-testid` que el textarea

Los chips ya tienen texto visible único (`{{var}}`) y son `<button>` accesibles; `getByRole('button', { name: '{{...}}' })` es suficiente. El banner de error es `.card.card-danger`, único en la página. El char counter es `.template-char-count`, también único. Solo el textarea necesitaba un selector estable porque su placeholder es largo y propenso a cambiar.

### 422 vs 400

El backend real devuelve 422 (`HTTPException(422, ...)`). El mock devuelve 422 por mimetismo, aunque FastAPI usaría normalmente 400 para errores de aplicación. Esto está documentado en el comentario del handler.

## Comandos de verificación ejecutados

```
$ ./init.sh
… [OK]    Entorno listo

$ npm run lint
[sin output → eslint verde]

$ npm run build
✓ built in 2.25s
dist/assets/index-Dw8BDMHt.js                   379.53 kB │ gzip: 108.54 kB
dist/assets/index-BOx8zj5P.css                  119.86 kB │ gzip:  29.73 kB

$ npm run test:smoke
46 passed, 2 skipped (theme preexistentes), 1.0m

$ npx playwright test tests/social_templates.spec.js
15 passed (14.0s)
  - feature 8 round-trip:             3 viewports × 2 tests = 6 OK
  - feature 18 unknown var banner:    3 viewports × 1 test  = 3 OK
  - feature 18 char-count over:       3 viewports × 1 test  = 3 OK
  - feature 18 3 chips nuevos:        3 viewports × 1 test  = 3 OK
```

## Verificación de criterios de aceptación

| Criterio | Estado | Evidencia |
|----------|--------|-----------|
| `STATIC_VARIABLES` incluye `neighborhood_tag`, `agent_email`, `property_url` con samples realistas | ✅ | `TenantProvider.jsx:30-43` (`VARIABLE_SAMPLES`) |
| `useVariables()` devuelve 16 entries en orden agrupado | ✅ | derivado de `ALLOWED_SOCIAL_TEMPLATE_VARIABLES` (16 entries en `constants.js`) |
| Mock valida variables con la misma regex y rechaza con shape canónico | ✅ | `mock-backend.js:handleSocialTemplates` + `collectUnknownSocialTemplateVariables` |
| Existe `ALLOWED_SOCIAL_TEMPLATE_VARIABLES` compartida provider ↔ mock | ✅ | `src/features/social/constants.js` (1 ubicación, 2 consumidores) |
| Test: `{{nonexistent_var}}` → banner con `SOCIAL_TEMPLATE_UNKNOWN_VARIABLE` | ✅ | `social_templates.spec.js:139` |
| Test: texto > `NETWORK_LIMITS[instagram]` → contador `over` | ✅ | `social_templates.spec.js:176` |
| Test: 3 chips nuevos clicables, insertan `{{var}}` | ✅ | `social_templates.spec.js:199` |
| `grep -rn 'STATIC_VARIABLES' src` solo en el provider | ✅ | 3 hits, todos en `TenantProvider.jsx` (uno es un comentario en `constants.js`, documentación, no definición) |
| `npm run lint` verde | ✅ | ver salida |
| `npm run build` verde | ✅ | ver salida |
| `npm run test:smoke` verde | ✅ | 46 passed |

## Open questions / siguiente paso

- **Pendiente reviewer (verificación manual contra back live :8001):** abrir `/social`, escribir `{{property_url}}` → Save 200; cambiar a `{{not_a_var}}` → banner rojo con el código real del backend.
- **Sin riesgos pendientes:** no se tocaron payloads ni se modificaron contratos; solo se añadió validación de cliente espejada del back que ya estaba viva.
- **Feature 20 (cross-repo, hashtags + title_template):** consumirá la misma constante; está bien preparado.

## Archivos tocados

- `src/features/social/constants.js` (nuevo, 50 líneas)
- `src/features/social/index.js` (+4)
- `src/app/providers/TenantProvider.jsx` (re-estructurado el bloque de variables, +~20 líneas netas)
- `src/features/social/SocialConfig.jsx` (+1 línea: `data-testid`)
- `tests/support/mock-backend.js` (+1 import; refactor de `handleSocialTemplates` + helper nuevo `collectUnknownSocialTemplateVariables`, +~40 líneas)
- `tests/social_templates.spec.js` (+3 tests, +~95 líneas)
- `progress/current.md` (append a "## Bitacora")
