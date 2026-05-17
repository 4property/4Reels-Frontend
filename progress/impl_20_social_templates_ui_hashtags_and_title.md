# Implementer report — feature 20 (frontend)
## social_templates_ui_hashtags_and_title

- **Inicio:** 2026-05-14
- **Agente:** implementer (subagente, sesión leader Claude)
- **Backend par:** feature 20 back cerrada como `done` —
  `/opt/projects/4Reels-Backend/progress/review_20_extend_social_templates_payload_with_title_and_hashtags.md`
- **Estado final:** code-complete, pendiente review

## Resumen

El editor `/social` ahora persiste y muestra tres campos por red:
`description_template` (textarea, ya existía), `title_template` (input
una línea, nuevo) y `hashtags` (chip editor inline, nuevo). El PUT
sube siempre el shape rico `{templates:{platform:{description_template,
title_template, hashtags}}}` que la feature 20 del back acepta y
normaliza. El GET sigue devolviendo `templates: {platform: string}` por
backward-compat, pero el frontend ya no lee de ahí: pivota `items[]`
para hidratar los tres campos.

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/features/social/constants.js` | Añadidos `HASHTAG_PATTERN = /^#[\w-]{1,50}$/` y `MAX_HASHTAGS_PER_PLATFORM = 30`. Se reutilizan en componente y mock. |
| `src/features/social/api.js` | `saveSocialTemplates` es passthrough sobre el valor por plataforma — acepta string (legacy, `DefaultDescriptionsPanel`) y objeto rico (nuevo, `SocialConfig`). El back acepta ambos. JSDoc actualizado. |
| `src/features/social/hooks.js` | `useSocialTemplates` ahora pivota `data.items[]` a `richTemplates: {platform: {description_template, title_template, hashtags}}` en vez de leer `data.templates`. Mantiene la firma `{agencyId, loading, refetch}` para el componente. |
| `src/features/social/SocialConfig.jsx` | Estado pasa de `templates: {platform: string}` a `templates: {platform: {description_template, title_template, hashtags[]}}`. Añadidos: `<input>` para title, `HashtagsEditor` (componente local) con chips + input. Helpers `cloneRich`, `cloneEntry`, `buildRichPayload`, `normaliseHashtag`. `Reset` y `Reset this network` re-clonan desde `initialTemplates` con el shape rico. Tras Save, se vuelve a hidratar con la respuesta refrescada (`setHydrated(false)`). |
| `src/features/social/styles.css` | Estilos para `.template-title-input`, `.hashtag-editor`, `.hashtag-chip{,-label,-remove}`, `.hashtag-input`, `.hashtag-error`. Sin CSS-in-JS, reusa tokens `--accent`, `--surface`, etc. |
| `tests/support/mock-backend.js` | `handleSocialTemplates` reescrito para aceptar ambos shapes (legacy string + rico objeto), normalizar con `normaliseIncomingSocialTemplates`, validar variables en description+title con shape de detalles mixto (flat si solo description, nested si title), validar hashtags (regex + cap 30) con 422 `SOCIAL_TEMPLATE_INVALID_HASHTAG`, y persistir los 3 campos. `serializeSocialTemplates` ahora produce items[] con los 3 campos y `templates{}` legacy con solo description. **Solo modificada la sección social-templates — nada de música tocado.** |
| `tests/social_templates.spec.js` | Añadido bloque `feature 20 — social templates title + hashtags` con 5 tests (ver § Tests). |
| `progress/current.md` | Bitácora actualizada en sección "Bitacora (feature 20 front)". Sin tocar hotfix ni música. |

## Decisiones de UX

### Hashtags — normalisation
- `trim` + `toLowerCase` + prefijar `#` si falta. Justificación: Instagram,
  TikTok y LinkedIn tratan los hashtags case-insensitive en el motor de
  búsqueda. Almacenar `#Dublin` y `#dublin` como entradas distintas confunde
  al usuario y rompe el de-dupe trivial.
- Si el resultado normalizado no matchea `HASHTAG_PATTERN`, NO se añade y
  se muestra una banda `.card.card-danger.hashtag-error` con el texto
  original que el usuario tecleó (no la versión normalizada) para que
  entienda qué falló.
- Duplicados (después de normalizar) se descartan silenciosamente: el
  caso es siempre un error humano y el toast adicional sería ruido.

### Hashtags — separadores de chip
- **Enter** y **coma** siempre commitean.
- **Espacio** commitea solo si hay texto en el draft. Esto permite teclear
  prefijos con espacios sueltos durante la edición sin que se cree un chip
  vacío.
- Pegar texto con comas dispara el commit por cada substring entre comas
  (`handleChange`), preservando el último fragmento como draft. Útil al
  pegar `dublin, cork, realestate` de golpe.
- **Backspace** sobre input vacío elimina el último chip (UX habitual en
  Gmail, Slack). El usuario ahorra un click.

### Cap 30
- Al alcanzar `MAX_HASHTAGS_PER_PLATFORM = 30`, el input se deshabilita
  y su placeholder cambia a "Max 30 hashtags reached". El cap se enforce
  client-side antes de tocar el back; el mock backend además devuelve
  422 `SOCIAL_TEMPLATE_INVALID_HASHTAG` con `details.count` si por algún
  bug se le cuela un payload sobredimensionado.

### Title placeholders
- Placeholder por red en `TITLE_PLACEHOLDERS` (`SocialConfig.jsx`).
  Variantes: "Catchy hook (optional)" / "Hook for the first second" /
  "Headline for the post" / "Video title" / "Post headline" / "Update
  title" / "Pin title". Mantiene el sufijo "(optional)" en todos para
  comunicar que el campo nunca es obligatorio.

## Shape exacto del PUT

```json
{
  "templates": {
    "instagram": {
      "description_template": "Visit {{property_title}} now",
      "title_template": "Tu título",
      "hashtags": ["#dublin", "#cork", "#realestate"]
    },
    "tiktok": {
      "description_template": "...",
      "title_template": "",
      "hashtags": []
    }
  }
}
```

- Solo platforms con al menos un campo no vacío se incluyen — un platform
  con description/title/hashtags todos vacíos se omite del payload (función
  `buildRichPayload`). Esto evita resetear entradas que el usuario no ha
  tocado en una sesión.
- Para el `DefaultDescriptionsPanel` legacy (feature 8, agency-config
  drawer), el callsite sigue pasando `{platform: "string"}` y `saveSocialTemplates`
  lo manda tal cual; el back lo normaliza server-side. Test de feature 8
  sigue verde (verifica que el body exacto es `{templates:{platform: string}}`).

## Mock backend — validation logic

`tests/support/mock-backend.js:handleSocialTemplates`:

1. **Normalización**: `normaliseIncomingSocialTemplates` convierte cada
   entrada a `{description_template, title_template, hashtags}`. String →
   `{description_template: <string>, title_template: '', hashtags: []}`
   (espejo de la backward-compat del back).
2. **Variables desconocidas**: `collectUnknownSocialTemplateVariables`
   escanea description+title independientemente con
   `SOCIAL_TEMPLATE_VARIABLE_PATTERN`. Para cada plataforma:
   - Si solo description tiene unknowns → `details[platform] = [var, ...]` (flat).
   - Si title tiene unknowns → `details[platform] = {description_template?: [...], title_template: [...]}` (nested, description_template aparece solo si también tiene unknowns).
   - Devuelve 422 con `details.unknown_variables_by_platform` envolviendo
     el map. Mismo shape que el back, replica del `social_templates_router.py`.
3. **Hashtags inválidos**: `collectInvalidHashtags` aplica `HASHTAG_PATTERN`
   a cada hashtag y comprueba `length > MAX_HASHTAGS_PER_PLATFORM`. Devuelve
   422 con `details.hashtag_errors_by_platform: {platform: {invalid?: [...], count?: N, max?: 30}}`.
4. **Persistencia**: si pasa, el store guarda el objeto rico. `serializeSocialTemplates`
   genera la respuesta GET con `templates: {platform: description}` (legacy,
   description-only) y `items[]` con los 3 campos por entry.

## Tests añadidos

En `tests/social_templates.spec.js` bajo `feature 20 — social templates title + hashtags`:

1. **PUT body carries the 3 fields**: rellena description+title, añade 3
   hashtags vía Enter/space/comma, hace Save, intercepta el body y verifica
   `templates.instagram = {description_template, title_template, hashtags}`.
2. **Reload hydrates from items[]**: seed → save → `page.reload()` →
   verifica title input y 3 chips visibles. Confirma que el GET hidrata
   desde `items[]` correctamente.
3. **Invalid hashtag dropped**: teclea `bad@hashtag` + Enter → chip NO
   creado, banner `[data-testid="social-template-hashtag-error"]` visible.
4. **Cap 30**: añade 30 chips → input `disabled`, placeholder regex
   `/Max 30 hashtags/i`. Verifica que el chip count es exactamente 30.
5. **Unknown var in title_template surfaces 422 banner**: description con
   var válida, title con `{{not_a_var}}` → PUT 422, banner `.card.card-danger`
   contiene `SOCIAL_TEMPLATE_UNKNOWN_VARIABLE`. Ejercita el path nested del
   shape de details.

Cada uno corre en los 3 viewports (desktop/tablet/mobile) → 15 tests añadidos.

## Verificación

| Comando | Resultado |
|---|---|
| `npm run lint` | verde |
| `npm run build` | verde, CSS 119.86 → 122.00 kB (gzip 29.99 kB), JS sin cambio significativo |
| `npm run test:smoke` | **46 passed / 2 skipped** (los `theme` skips preexistentes) |
| `npx playwright test tests/social_templates.spec.js --project=desktop` | **10/10 passed** |
| `npx playwright test tests/social_templates.spec.js --project=mobile` | **10/10 passed** |
| `npx playwright test tests/social_templates.spec.js --project=tablet` | **9/10 passed** (el fallo es `feature 8 — Descriptions subtab loads, edits, and saves via PUT`, **flaky preexistente** — reproducido también con `git stash` en HEAD limpio, sin mis cambios; fuera de scope). |
| `./init.sh` | **NO completa** únicamente por la regla `máximo 1 in_progress` en `feature_list.json` (features 20 y 22 ambas in_progress; 22 está `code-complete awaiting back deploy` desde la sesión anterior — fuera de scope. Si el leader cierra primero la 22 o reagrupa el `feature_list.json`, init.sh quedará verde). Lint y build internos del init.sh sí pasan. |

## Reglas de scope respetadas

- ✅ Sin TypeScript, sin React Query, sin MSW, sin Tailwind, sin styled-components, sin CSS-in-JS.
- ✅ Componentes no llaman `fetch` directo: `SocialConfig` → `hooks` → `socialApi` → `apiRequest`.
- ✅ Layer rules respetadas.
- ✅ Mock = spec del backend real (shapes 422 idénticos).
- ✅ Feature 20 NO marcada `done` en `feature_list.json` — lo decide el reviewer/leader.
- ✅ **NO tocado** nada de música ni el hotfix `editor-video-player:fullscreen`.
- ✅ En `mock-backend.js` solo se modificó la sección `handleSocialTemplates`
  y helpers asociados (variables/hashtags/serialize). Sección de música intacta.
