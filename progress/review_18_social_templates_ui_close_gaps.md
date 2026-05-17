# Review: feature 18 — social_templates_ui_close_gaps (2026-05-14)

## Veredicto

APPROVED (con 1 hallazgo fyi sobre el sample de `neighborhood_tag` — defendible, no bloquea).

## Cumplimiento de acceptance criteria

- [x] **`STATIC_VARIABLES` incluye `neighborhood_tag`, `agent_email`, `property_url`.**
  Evidencia: `src/app/providers/TenantProvider.jsx:27-44` (`VARIABLE_SAMPLES` con las 3 nuevas claves). Samples: `neighborhood_tag: '#cranfordcourt'` (l.36), `agent_email: 'sales@4pm.ie'` (l.41), `property_url: 'https://example.com/property/123'` (l.43). Ver §Hallazgos #1 sobre el `#` de `neighborhood_tag`.
- [x] **`useVariables()` devuelve 16 entries en orden agrupado.**
  Evidencia: `src/features/social/constants.js:24-41` enumera 16 keys en el orden property (8) → location (3, incluyendo `neighborhood_tag` y `eircode`) → descriptive (1) → agent (3) → links (2). `TenantProvider.jsx:46-49` deriva `STATIC_VARIABLES` con `.map(...)` sin reordenar; `useVariables()` (`TenantProvider.jsx:197-199`) devuelve el array exacto.
- [x] **`handleSocialTemplates` valida con la misma regex `{{var}}` y rechaza con 422 + body `{error,details}`.**
  Evidencia: `tests/support/mock-backend.js:855-866` (rama PUT) llama `collectUnknownSocialTemplateVariables` y, si hay desconocidas, hace `route.fulfill(jsonResponse({error:'SOCIAL_TEMPLATE_UNKNOWN_VARIABLE', details:unknownByPlatform}, 422))`. La regex se importa de `src/features/social/constants.js:49` (`/\{\{\s*([\w.]+)\s*\}\}/g`) — idéntica a `modules/configuration/domain/social_templates_variables.py:42` (`r"\{\{\s*([\w.]+)\s*\}\}"`, módulo `re` no necesita flag global porque usa `finditer`).
- [x] **Una sola constante `ALLOWED_SOCIAL_TEMPLATE_VARIABLES` exportada y compartida.**
  Evidencia: `src/features/social/constants.js:24` (definición única). Re-export en `src/features/social/index.js:4-6`. Importada en `src/app/providers/TenantProvider.jsx:17` y `tests/support/mock-backend.js:15`. `grep -rn 'ALLOWED_SOCIAL_TEMPLATE_VARIABLES' src tests` devuelve **7 hits** (1 def, 1 re-export, 2 imports, 1 doc en TenantProvider, 1 doc en constants.js, 1 uso en mock-backend) — todos coherentes con una sola fuente.
- [x] **Test E2E: `{{nonexistent_var}}` → banner con código.**
  Evidencia: `tests/social_templates.spec.js:139-174`. Verde en los 3 viewports.
- [x] **Test E2E: texto > NETWORK_LIMITS[instagram]=2200 → contador con clase `over`.**
  Evidencia: `tests/social_templates.spec.js:176-197`. Asserta `toHaveClass(/\bover\b/)` y `toContainText('2201/2200')`.
- [x] **Test E2E: las 3 nuevas variables aparecen como chips clicables que insertan `{{var}}` en el textarea.**
  Evidencia: `tests/social_templates.spec.js:199-221`. Itera sobre `neighborhood_tag`, `agent_email`, `property_url`; cada chip clickeable y el textarea termina con `{{var}}` literal.
- [x] **`grep -rn 'STATIC_VARIABLES' src` devuelve solo el provider.**
  Evidencia: 4 hits — 3 en `TenantProvider.jsx` (comentario + definición + consumo de la variable) y 1 mención en el docstring de `constants.js` (l.10) que solo documenta el consumer, no define la constante. Cumple el espíritu del criterio (una sola definición).
- [x] **`npm run lint` verde.** Ejecutado por el reviewer, sin output (ESLint silencioso = verde).
- [x] **`npm run build` verde.** `dist/assets/index-BOx8zj5P.css 119.86 kB`, `dist/assets/index-Dw8BDMHt.js 379.53 kB`, "built in 2.27s".
- [x] **`npm run test:smoke` verde.** 46 passed, 2 skipped (theme preexistentes), 1.0m.

## Verificación ejecutada

- `./init.sh` → verde en los 7 pasos (entorno, archivos base, feature_list válido, sin TS, lint, build, resumen OK).
- `npm run lint` → verde (no warnings, no errors).
- `npm run build` → verde, build en 2.27s.
- `npm run test:smoke` → **46 passed / 2 skipped / 0 failed** (los 2 skipped son `theme` preexistentes, no introducidos por feature 18).
- `npx playwright test tests/social_templates.spec.js` → **15 passed** (feature 8: 2 tests × 3 viewports = 6; feature 18: 3 tests × 3 viewports = 9).
- `grep -rn 'STATIC_VARIABLES' src` → 4 hits, todos en archivos esperados.
- `grep -rn 'ALLOWED_SOCIAL_TEMPLATE_VARIABLES' src tests` → 7 hits coherentes con una sola fuente.
- `grep -rnE 'â€|Â·|â‚¬|â‰¤|â†|âŒ˜|âœ' src/features/social src/app/providers/TenantProvider.jsx tests/support/mock-backend.js tests/social_templates.spec.js` → **0 hits, sin mojibake**.
- `grep -n 'data-testid="social-template-textarea"' src` → **1 ocurrencia** (`SocialConfig.jsx:221`); el componente `TemplateEditor` solo se renderiza para la red activa, así que en DOM existe a lo sumo 1 textarea con ese testid.
- Hotfix `editor.css` (preview fullscreen) intacto: las reglas `:fullscreen` / `:-webkit-full-screen` siguen en `src/features/reels/editor/editor.css:125-126`. El implementer NO tocó este archivo.

## Hallazgos

1. **[fyi] Sample de `neighborhood_tag` con prefijo `#`.**
   El plan en `progress/current.md:16` documentó `neighborhood_tag → "#cranfordcourt"` y el implementer lo respetó al pie de la letra. PERO el backend lo rellena así (`modules/reels/application/content_generator.py:74-76`):
   ```
   "neighborhood_tag": (
       (getattr(property_item, "property_area_label", "") or "").lower().replace(" ", "")
   ),
   ```
   → es un **slug plano** (sin `#`), no un hashtag. Para "Cranford Court" el back emite `cranfordcourt`, no `#cranfordcourt`. El usuario añade el `#` literalmente en su template (p. ej. `🏠 #{{neighborhood_tag}}`) si quiere un hashtag.
   El sample del front induce a error: si el usuario ve el chip con preview `#cranfordcourt` y escribe en su template `{{neighborhood_tag}}` esperando un hashtag, el output real será `cranfordcourt` (sin `#`). El sample correcto sería `cranfordcourt` (sin almohadilla). No bloquea porque el comportamiento de la variable a la hora de publicar no cambia; solo el preview es engañoso. Decisión leader: dejar como está (el nombre `_tag` ya sugiere hashtag al usuario y la solución es que él añada `#{{neighborhood_tag}}` en su template) o pedir al implementer un cambio quirúrgico en `TenantProvider.jsx:36` a `'cranfordcourt'`. Recomiendo lo segundo para alinear el preview con la realidad del pipeline, pero NO bloqueo el done de la feature por esto.

2. **[fyi] La regex `SOCIAL_TEMPLATE_VARIABLE_PATTERN` se exporta con flag `g`, y el helper construye una RegExp fresca por iteración para evitar arrastre de `lastIndex`.**
   `tests/support/mock-backend.js:905-908` hace `new RegExp(SOCIAL_TEMPLATE_VARIABLE_PATTERN.source, SOCIAL_TEMPLATE_VARIABLE_PATTERN.flags)` en cada plataforma. Esto es correcto y defensivo — `matchAll` requiere el flag `g` y consume `lastIndex` por iteración. Múltiples ocurrencias del mismo `{{var}}` en un template se deduplican con un `Set` local (`seen`), preservando el orden de la primera aparición. Verificado por inspección de código + tests E2E que pasan.

3. **[fyi] El mock devuelve 422 vía `jsonResponse(body, 422)` (no es throw).**
   `tests/support/mock-backend.js:816-822` define `jsonResponse(body, status=200)` que retorna `{status, contentType, body}` para `route.fulfill`. La rama de error en `handleSocialTemplates:857-866` llama `route.fulfill(jsonResponse({...}, 422))` — Playwright lo entrega como respuesta HTTP 422 al fetch, no como network error. El hook `useSaveSocialTemplates` lo recibe en `err.body.error`, que `SocialConfig.jsx:41` muestra en el banner. Confirmado por test E2E (`putStatuses.toContain(422)` + `banner.toContainText('SOCIAL_TEMPLATE_UNKNOWN_VARIABLE')`).

4. **[fyi] Las 7 redes (instagram, tiktok, facebook, linkedin, youtube, gbp, pinterest) siguen apareciendo.**
   `TenantProvider.jsx:140-148` mantiene `desiredOrder = [instagram, tiktok, youtube, facebook, linkedin, gbp, pinterest]` sin cambio. Ningún cambio en `adaptSocialAccounts`. El smoke test de `/social` pasó.

5. **[fyi] El `data-testid="social-template-textarea"` es único en DOM activo.**
   `SocialConfig.jsx` solo renderiza `<TemplateEditor>` para la red activa (línea 156-165, dentro del único `<TemplateEditor>`); el switch entre redes solo cambia el contenido del textarea, no añade nuevos. No hay risk de match ambiguo.

6. **[fyi] Sin mojibake en archivos tocados.**
   El grep de patrones mojibake clásicos (`â€`, `Â·`, `â‚¬`, `â‰¤`, `â†`, `âŒ˜`, `âœ`) sobre los 4 archivos tocados devuelve 0 hits. El sample `price: '€385,000'` y otros caracteres UTF-8 (`·`, `€`) están bien codificados.

7. **[fyi] El hotfix paralelo (preview fullscreen) está intacto.**
   `src/features/reels/editor/editor.css:125-126` mantiene las reglas `:fullscreen` y `:-webkit-full-screen` con `object-fit: contain`. No tocado por la feature 18.

## Recomendación de cierre

**APPROVED** — marcar `id: 18` con `status: done` en `feature_list.json` y mover el bloque de feature 18 de `progress/current.md` a `progress/history.md` (NO arrastrar el hotfix, que es independiente).

Si el leader quiere abordar el hallazgo #1 antes de cerrar, sería un cambio de 1 línea en `src/app/providers/TenantProvider.jsx:36`:
```
- neighborhood_tag: '#cranfordcourt',
+ neighborhood_tag: 'cranfordcourt',
```
y un push del implementer (no requiere nuevos tests, ni cambia el flujo end-to-end). Pero la feature en su forma actual cumple todos los acceptance criteria literales del `feature_list.json:18`.
