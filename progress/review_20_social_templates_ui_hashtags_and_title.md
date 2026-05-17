# Review: feature 20 — social_templates_ui_hashtags_and_title (frontend) (2026-05-14)

## Veredicto

**APPROVED** — code-complete, lista para que el leader marque `status: done`
en `feature_list.json` una vez resuelva la deuda procedural del segundo
`in_progress` (feature 22). El implementer cumple los 8 acceptance criteria
literales, los checks adicionales del prompt y las reglas duras de
`CLAUDE.md`/`AGENTS.md`.

## Cumplimiento de acceptance criteria

- [x] **AC1 — `SocialConfig.jsx` muestra title input + chip editor de hashtags por red.**
  Evidencia: `src/features/social/SocialConfig.jsx:335-343` (input `template-title-input` con `data-testid="social-template-title"`) y `:460-490` (`HashtagsEditor` con chips `data-testid="social-template-hashtag-chip"` + input `data-testid="social-template-hashtag-input"`). Ambos se renderizan dentro de `TemplateEditor` por cada red (el switch activa una red a la vez, igual que en feature 18).
- [x] **AC2 — `saveSocialTemplates` envía shape rico, acepta string para backward-compat.**
  Evidencia: `src/features/social/api.js:24-28` — `saveSocialTemplates` es passthrough: hace `PUT` con `{templates}` tal cual le llega. El callsite nuevo (`SocialConfig.jsx:67-68` → `buildRichPayload`) emite siempre el objeto rico `{description_template, title_template, hashtags[]}`; el callsite legacy `DefaultDescriptionsPanel` (feature 8) sigue mandando `{platform: descriptionString}`. El back acepta ambos shapes nativamente. Verificado por test `tests/social_templates.spec.js:81-86` (feature 8: body con strings) y `:288-292` (feature 20: body con objeto rico).
- [x] **AC3 — `useSocialTemplates` hidrata de `items[]`, no de `templates{}`.**
  Evidencia: `src/features/social/hooks.js:27-35`. Pivota `data.items[]` (cada uno con `platform`, `description_template`, `title_template`, `hashtags`) en `richTemplates: {platform: {…}}`. Ignora `data.templates` (el map legacy description-only). El componente consume `richTemplates` (no `templates`) en `SocialConfig.jsx:33`.
- [x] **AC4 — Hashtags como chips con identidad visual coherente.**
  Evidencia: `src/features/social/styles.css:282-310`. Chip rectangular pill con border de `--accent`, fondo `--accent-soft-2`, mismo lenguaje visual que `.tag-chip-inline` (los chips de variables `{{var}}`). Botón de cierre `×` con hover invertido `--accent → #fff`. Mobile: layout responsive a `max-width: 900px` y `560px` ya existente (líneas 330-343), el chip editor se adapta vía `flex-wrap`.
- [x] **AC5 — Validación cliente de hashtags (regex, normalización, dedup, cap 30, mensaje al rechazar).**
  Evidencia: `src/features/social/SocialConfig.jsx:227-232` (`normaliseHashtag`: trim + lowercase + `#` prefix); `:402-418` (`commit`: valida `HASHTAG_PATTERN`, dedup silencioso, mensaje inline en `errorMessage`); `:400` (cap 30 vía `atCap = hashtags.length >= MAX_HASHTAGS_PER_PLATFORM`); `:486-487` (input `disabled` + placeholder "Max 30 hashtags reached" al llegar al cap). Regex y cap importados de `constants.js:60,68`.
- [x] **AC6 — Mock-backend acepta shape rico, persiste, refleja en GET. 422 SOCIAL_TEMPLATE_INVALID_HASHTAG. Mantiene validación variables de feature 18.**
  Evidencia: `tests/support/mock-backend.js:969-1024` (`handleSocialTemplates` re-escrito), `:1033-1054` (`normaliseIncomingSocialTemplates`), `:1069-1112` (`collectUnknownSocialTemplateVariables` con shape mixto flat/nested), `:1121-1140` (`collectInvalidHashtags` con `details: {hashtag_errors_by_platform: {platform: {invalid?, count?, max?}}}`), `:1390-1421` (`serializeSocialTemplates` produce `items[]` con los 3 campos y `templates{}` legacy description-only). Coincide exactamente con la spec del back (review_20 back, secciones `social_templates_router.py:175-193` y `:198-215`).
- [x] **AC7 — Test Playwright: editar title + 3 hashtags + Save → PUT body contiene los 3 campos; recargar → chips persisten; hashtag inválido → toast/feedback.**
  Evidencia: `tests/social_templates.spec.js:232-404`, bloque `feature 20 — social templates title + hashtags` con 5 tests:
  1. `:233-293` — PUT body lleva los 3 campos (Enter/space/comma separators ejercitados).
  2. `:295-327` — Reload hidrata title input y 3 chips desde `items[]`.
  3. `:329-348` — Hashtag inválido (`bad@hashtag`) → no chip + banner `[data-testid="social-template-hashtag-error"]`.
  4. `:350-371` — Cap 30 → input `disabled` + placeholder `/Max 30 hashtags/i`.
  5. `:373-403` — Variable inválida en `title_template` → 422 + banner `SOCIAL_TEMPLATE_UNKNOWN_VARIABLE` (ejercita el path nested del shape de detalles).
- [x] **AC8 — `npm run lint`, `npm run build`, `npm run test:smoke` verdes.**
  Verificación del reviewer abajo (todo verde).

## Verificación ejecutada por el reviewer

| Comando | Resultado |
|---|---|
| `./init.sh` | **rojo SOLO por `2 features en in_progress (máximo 1)`**. Pasos 1-7 internos verdes (lint, build, sin TS, sin libs prohibidas). Documentado en el prompt como deuda del leader, NO defecto del implementer. |
| `npm run lint` | verde. |
| `npm run build` | verde. |
| `npm run test:smoke` | **46 passed / 2 skipped** (los 2 skipped son `theme` preexistentes; sin fallos). |
| `npx playwright test tests/social_templates.spec.js --reporter=list` | **30/30 passed** (10 desktop + 10 tablet + 10 mobile). Tiempo total 22.1s. El supuesto flaky de tablet en feature 8 NO se reprodujo en esta corrida. |
| `npx playwright test tests/social_templates.spec.js --project=tablet --reporter=list` | **10/10 passed** en una segunda ejecución específica para tablet. Confirma que el flaky reportado por el implementer es intermitente y no causado por feature 20. |
| `grep -rnE 'fetch\(' src/features/social` | **0 hits** (la única ocurrencia es `refetch()` del hook, no `fetch()` literal). Layer rule respetada. |
| `grep -rn 'HASHTAG_PATTERN\|MAX_HASHTAGS_PER_PLATFORM' src tests` | 13 hits coherentes: 1 def + 5 usos en `SocialConfig.jsx` + 4 imports/usos en `mock-backend.js` + 1 doc en `constants.js` + 1 mención en test name + 1 import. Una sola fuente. |
| `grep -rn 'hashtag_errors_by_platform' tests/support/mock-backend.js src tests` | 4 hits, todos coherentes (1 docstring + 1 uso en handler + 1 docstring en `constants.js`; nada fuera de la spec). |
| `git diff HEAD -- tests/support/mock-backend.js` (hunks) | Diff total muestra ambas secciones (feature 22 música y feature 20 social). Los hunks correspondientes a feature 20 son: nuevo `handleSocialTemplates` (líneas 969+), `normaliseIncomingSocialTemplates` (1033+), `collectUnknownSocialTemplateVariables`+`scanUnknownVariables` (1069+), `collectInvalidHashtags` (1121+) y `serializeSocialTemplates` actualizado (1390+). Las secciones de música (`handleMusic*`, `parseMultipartUpload`, `ACCEPTED_AUDIO_MIME`) son de la sesión previa de feature 22 y **no se han tocado en este turno** — coherente con la afirmación del implementer. |
| Hotfix `editor-video-player:fullscreen` en `editor.css` | Intacto. Reviewer verifica que `src/features/reels/editor/editor.css` no aparece en la lista de archivos modificados por feature 20. |

## Hallazgos

1. **[fyi — deuda procedural del leader] `./init.sh` rojo por 2 `in_progress` en `feature_list.json`.**
   Features 20 y 22 ambas `in_progress`: 22 quedó "code-complete awaiting back deploy" desde la sesión anterior y 20 se abrió en este turno. Esto NO es defecto del implementer de feature 20 — es una violación de la regla `one_feature_at_a_time` heredada del leader. Antes de marcar la 20 `done`, el leader debe decidir qué hacer con la 22 (cerrarla como `done` si el back ya deployó, o reagrupar el ciclo). El paso "Validando feature_list.json" del init.sh es el único que falla. Sin esta deuda, todo verde.

2. **[fyi — preexistente] Flaky en feature 8 tablet NO reproducido por el reviewer.**
   El implementer documentó que `feature 8 — Descriptions subtab loads, edits, and saves via PUT` falla intermitentemente solo en tablet y que reproducía también en HEAD limpio sin sus cambios (sesión propia con `git stash`). En las 2 corridas del reviewer (full 30/30 + tablet-only 10/10), el test pasó en 1.5s/1.8s en ambas. **Es flaky timing-sensitive, no introducido por feature 20.** No bloquea el cierre. Recomendación opcional al leader: abrir follow-up para estabilizarlo (probablemente waiting más explícito en el `getByRole('button', { name: /^Descriptions$/ }).click()` antes del primer `expect.poll`).

3. **[fyi — confirmado] No se tocó música en `tests/support/mock-backend.js`.**
   El diff completo del mock-backend muestra (a) los hunks de feature 22 que ya estaban en el árbol antes de este turno (`parseMultipartUpload`, `ACCEPTED_AUDIO_MIME`, ruteo `POST /music/upload`) y (b) los hunks nuevos de feature 20 al final del archivo (las 5 funciones de social-templates). Los `handleMusic*` no cambian de cuerpo. Coherente con el plan: el implementer respetó la sección música.

4. **[fyi — correcto] Shape PUT exacto del nuevo editor.**
   `SocialConfig.jsx:260-275` (`buildRichPayload`) emite siempre `{templates: {platform: {description_template: <str>, title_template: <str>, hashtags: <str[]>}}}` y descarta plataformas totalmente vacías (descripción/title/hashtags todos vacíos) para no resetear silenciosamente entradas que el usuario no tocó — la semántica "explicit empty wins" del back lo trataría como borrado. Decisión defensiva razonable, alineada con `feature 20 back` review.

5. **[fyi — correcto] `DefaultDescriptionsPanel` (feature 8) sigue mandando string.**
   `tests/social_templates.spec.js:81-86` asserta `body.templates.instagram = 'IG · {{property_title}} · {{price}}'` (string plano, no objeto). El test feature 8 pasa en los 3 viewports → la backward-compat de `saveSocialTemplates` y del mock funciona como contrato.

6. **[fyi — defendible] Hashtags normalizados a lowercase silenciosamente.**
   `normaliseHashtag` aplica `toLowerCase()` antes de validar. Esto significa que si el usuario escribe `#Dublin`, se persiste como `#dublin`. Coherente con el comportamiento case-insensitive de Instagram/TikTok/LinkedIn, y documentado en el impl report como decisión de UX. El test `:295-327` confirma que la hidratación post-reload preserva la forma normalizada (`#one`, `#two`, `#three` con minúsculas). Si el back en algún punto futuro decidiera distinguir mayúsculas, el front normalizaría preventivamente; no veo riesgo. **No bloquea.**

7. **[fyi — defendible] El cap 30 se aplica en `commit`, no en `handleChange` ni `onBlur`.**
   Si el usuario pega 35 hashtags separados por comas mientras `hashtags.length === 28`, los primeros 2 entran (commits 29 y 30), el 31º falla silenciosamente en `commit` (returns early por `atCap`). El handler de paste podría mostrar un toast indicando "30 of 35 added". No es bloqueante porque el mock backend devolvería 422 con `count: 35, max: 30` si por algún bug se le colara, y el usuario ve el cap visualmente en `Hashtags (N/30)`. **No bloquea.**

8. **[fyi — correcto] Constantes no re-exportadas desde `index.js`.**
   `src/features/social/index.js` solo re-exporta `ALLOWED_SOCIAL_TEMPLATE_VARIABLES` y `SOCIAL_TEMPLATE_VARIABLE_PATTERN` (feature 18). Los nuevos `HASHTAG_PATTERN` y `MAX_HASHTAGS_PER_PLATFORM` se importan donde se necesitan vía path explícito (`SocialConfig.jsx` y `tests/support/mock-backend.js`). No es un defecto — el barrel `index.js` solo expone lo que cruza módulos; estos dos viven dentro del feature de social.

## Reglas de scope respetadas

- Sin TypeScript, React Query, MSW, Tailwind, styled-components, CSS-in-JS.
- Componentes no llaman `fetch` directamente (`grep -rnE 'fetch\(' src/features/social` → 0 hits literales).
- Layer rules: `SocialConfig` → `hooks` → `socialApi` → `apiRequest` (vía `lib/api/client.js`). Sin shortcuts.
- Mock = spec del backend real: los 422 reflejan exactamente los shapes de `social_templates_router.py` (flat vs nested para variables, `hashtag_errors_by_platform: {platform: {invalid?, count?, max?}}` para hashtags).
- Feature 20 NO marcada `done` por el implementer en `feature_list.json` — sigue `in_progress`, queda a discreción del leader cerrarla.
- Hotfix `editor-video-player:fullscreen` intacto.
- Sección música en `tests/support/mock-backend.js` intacta.

## Recomendación de cierre

**APPROVED.** Marcar `id: 20` con `status: done` en `feature_list.json` y
mover el bloque de feature 20 de `progress/current.md` a
`progress/history.md`. Pero **antes** resolver la deuda procedural del
hallazgo #1: o cerrar la feature 22 (si el back deployó) o reagrupar el
ciclo, para que `./init.sh` quede verde tras el done de la 20.

Los hallazgos del 2 al 8 son fyi defendibles que NO requieren cambios
para cerrar — opcionalmente el leader puede abrir follow-ups para el
flaky de feature 8 tablet (#2) y el paste >30 hashtags (#7).
