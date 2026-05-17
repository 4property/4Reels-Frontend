# Explore: frontend /social + mock backend (2026-05-14)

## TL;DR

La UI del `/social` ya está funcional con un textarea por red y soporte de variables via chips clicables. El mock backend en `mock-backend.js` cubre `GET` y `PUT` correctamente. **Gap crítico**: UI expone 13 variables pero backend soporta 16 (faltan `neighborhood_tag`, `agent_email`, `property_url`). El mock no valida variables desconocidas (no rechaza con 422). No hay soporte en UI para `title_template` ni `hashtags` que el backend sí persiste (read-only). Los limits de red están definidos pero no cubre `gmb` vs `gbp`.

## UI vs backend: redes

- **UI muestra**: 7 redes en `useSocials()` → instagram, tiktok, youtube, facebook, linkedin, gbp, pinterest (línea 125-133 en TenantProvider.jsx).
- **Backend acepta** (según router docstring): instagram, tiktok, facebook, linkedin, youtube, gbp, pinterest (línea 58-61 en social_templates_router.py).
- **Mismatch**: ninguno. Ambos alinean en 7 plataformas. Nota: backend lista tanto `gbp` como `gmb` como aliases en el adaptador de redes (línea 42-43), pero la tabla `agency_social_templates` usa `gbp` como PK canónico.

## UI vs backend: variables

- **UI chips** (STATIC_VARIABLES en TenantProvider.jsx línea 20-34): property_title, price, bedrooms, bathrooms, size_m2, property_type, city, neighborhood, eircode, short_description, agent_name, agent_phone, booking_link. Total: **13 variables**.
- **Backend acepta** (ALLOWED_TEMPLATE_VARIABLES en social_templates_variables.py línea 21-40): property_title, price, bedrooms, bathrooms, size_m2, property_type, city, neighborhood, **neighborhood_tag**, eircode, short_description, agent_name, agent_phone, **agent_email**, booking_link, **property_url**. Total: **16 variables**.
- **Variables que UI permite insertar manualmente pero backend rechaza**: ninguna (la UI no tiene campo de texto libre, solo chips validados).
- **Variables que backend soporta pero UI nunca expone en chips**:
  - `neighborhood_tag`
  - `agent_email`
  - `property_url`
  - **Impacto**: usuario no puede insertar estas 3 variables vía UI, pero si alguien las escribe manualmente en la REST API, serán persistidas. Cuando se reedite vía UI, se pierden.

## Mock backend handler

- **¿Existe?** Sí.
- **Archivo:línea**: `/opt/projects/4Reels-Frontend/tests/support/mock-backend.js:831-857` (función `handleSocialTemplates`).
- **GET (línea 835-836)**: Retorna `{ agency_id, templates: {platform: descriptionString}, items: [...], count }`. Shape correcto según contrato del router.
- **PUT (línea 839-854)**: Acepta `{ templates: {platform: descriptionString} }`, normaliza plataformas a minúsculas, persiste en memoria (`socialTemplatesByAgency` Map).
- **Gap**: El mock **NO valida variables desconocidas** (no rechaza con 422 como hace el backend en social_templates_router.py línea 109-111). Un test podría pasar variables inválidas que el backend rechazaría en producción.

## Hashtags / title_template

- **¿UI los soporta?** No. SocialConfig.jsx línea 51-52 solo tiene `text` (description). No hay campos para `title_template` o `hashtags[]`.
- **¿Backend los soporta?** Sí. La tabla `agency_social_templates` tiene columnas `title_template` (nullable) y `hashtags` (JSON array). El router los serializa en la respuesta GET (línea 168-169), pero el PUT payload (SocialTemplatesReplacePayload) **solo acepta `{templates: {platform: description}}`** —son read-only desde la UI.
- **Cómo afecta al usuario**: Si un operario backend inserta `title_template` o `hashtags`, la UI no los mostrará ni permitirá editarlos. Pero el GET los devuelve en `items[]` (línea 87), así que un cliente "inteligente" podría leerlos. El admin UI actual ignora completamente esos campos.

## Manejo de errores

- **¿UI muestra 422 con código del backend?** Sí, parcialmente.
- **Archivo:línea del catch**: SocialConfig.jsx línea 38-42. El error se captura en el catch de `handleSave()`, accede a `err?.body?.error` y lo muestra en `statusMessage`.
- **Gap**: El mock backend no genera 422 para variables desconocidas. El test (`tests/social_templates.spec.js`) no valida ese caso. En producción, si un usuario escribe `{{unknown_var}}`, el PUT fallará con 422 SOCIAL_TEMPLATE_UNKNOWN_VARIABLE (social_templates_router.py línea 210), pero la UI nunca ha testeado este error path.

## NETWORK_LIMITS

- **Definidos en**: `/opt/projects/4Reels-Frontend/src/features/reels/editor/defaults.js:61-70`. Estructura: `{ instagram: 2200, tiktok: 2200, youtube: 5000, facebook: 63206, linkedin: 3000, gmb: 1500, gbp: 1500, pinterest: 500 }`.
- **¿Cubre todas las redes del backend?** Sí con matiz. Ambos aceptan 7 redes (instagram, tiktok, facebook, linkedin, youtube, gbp, pinterest). El NETWORK_LIMITS también define `gmb: 1500` como alias de gbp, que no es directamente una plataforma del backend pero se usa en adaptadores. Todos los límites se aplican en el contador de caracteres (SocialConfig.jsx línea 71).

## Tests E2E existentes

- `/opt/projects/4Reels-Frontend/tests/social_templates.spec.js` — 2 tests:
  1. "Descriptions subtab loads, edits, and saves via PUT" (línea 17-88): valida que GET se lance, UI muestre 7 plataformas como textareas, edición, PUT con body correcto.
  2. "GET pre-populates textareas from existing templates" (línea 90-112): valida que GET lee valores guardados anteriormente.
- **Gap**: No hay test de error 422 (variable desconocida). No hay test de character limit (charCount > limit). No hay test de hashtags/title_template (esos campos no existen en UI aún).

## Gaps concretos a cerrar

- **Agregar 3 variables faltantes a UI**: `neighborhood_tag`, `agent_email`, `property_url` en STATIC_VARIABLES (TenantProvider.jsx línea 20-34).
- **Mock backend debe validar variables desconocidas**: Implementar lógica en `handleSocialTemplates()` para rechazar con 422 si una variable no está en la lista canónica.
- **Test E2E de variable desconocida**: Agregar test en `social_templates.spec.js` que intente guardar `{{bad_var}}` y valide error 422.
- **Documentar read-only fields**: Clarificar en comentarios de SocialConfig que `title_template` y `hashtags` son gestionados por backend, no por UI (o implementar soporte futuro).
- **Validar character limits en tests**: Agregar test que cumpla y otro que exceda `NETWORK_LIMITS[net]` por red.

