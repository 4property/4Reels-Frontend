# review_31_subtitles_tab_cleanup_and_autocaptions_switch (front)

> Fecha: 2026-05-15
> Agente: reviewer (Claude)
> Feature: 31 — subtitles_tab_cleanup_and_autocaptions_switch (FRONT)
> Repo: `/opt/projects/4Reels-Frontend`
> Veredicto: **APPROVED**

## Resumen

Cleanup UI de la pestaña Subtitles del `/defaults`. Tres movimientos
limpios:

1. Borrado total de `src/features/defaults/LivePreview.jsx` (deadcode)
   y de su uso desde `ReelDefaultsConfig.jsx`. Decisión correcta:
   ningún otro consumidor del archivo, el back feature 31 ya cubre el
   render real, y mantenerlo como deadcode obligaba a conservar
   variables (`subHighlightWord/Color`) que también desaparecen.
2. Card "Auto-generate AI subtitles" añadida al inicio de
   `SubtitlesTab.jsx` con `data-testid="auto-captions-card"`. El Toggle
   escribe a `state[AUTOMATION_SETTINGS_KEYS.autoCaptions]`, que se
   resuelve a la clave canónica `'automation.autoCaptions'` que el back
   feature 31 lee del settings jsonb. Cuando off, las cards Typography
   y Background & position reciben `subtitles-tab-subdued`
   (`opacity: 0.55`) sin `pointer-events: none` — siguen plenamente
   editables.
3. Card "Word highlight" / Karaoke eliminada. Claves
   `subHighlightWord` y `subHighlightColor` borradas también del seed
   `INITIAL_DEFAULTS`. No quedan referencias en `src/` ni en `tests/`.

## Validaciones ejecutadas

| Check | Resultado |
| --- | --- |
| `./init.sh` | verde (lint + build) |
| `npm run lint` | verde |
| `npm run build` | verde, `index-D6mTPGrN.css` 124.82 kB / `index-BoDSts3E.js` 396.99 kB |
| `npm run test:smoke` | 46 passed / 2 skipped (theme pre-existentes) |
| `npx playwright test tests/subtitles_autocaptions.spec.js` | 9 passed (3 tests × desktop/tablet/mobile) |
| `npx playwright test tests/payload_contract.spec.js` | 6 passed (round-trip /defaults intacto) |
| `grep -rn 'subHighlightWord\|subHighlightColor\|LivePreview' src` | 0 hits |
| `grep -rn 'Karaoke\|Word highlight' src` | 0 hits |
| `grep -rnE 'fetch\(' src/features/defaults/` | 0 hits (hook → api → client.js respetado) |
| `grep -rn 'auto-captions-card' src tests` | 1 hit en `SubtitlesTab.jsx` (card), 4 en spec dedicada |

## Puntos a destacar

- **Clave canónica correcta.** El toggle envía
  `'automation.autoCaptions'` (vía `AUTOMATION_SETTINGS_KEYS.autoCaptions`),
  exactamente la que el back feature 31 lee. Coherente con
  `useAutomationSave.js`, que escribe la misma clave desde la pantalla
  Automation (los dos puntos de escritura no colisionan: el de
  Automation va vía `automationState.captions`; el de Subtitles tab va
  por el state directo del form de Defaults; ambos terminan en el
  mismo PUT `/defaults` con shallow merge previo).
- **Cards atenuadas siguen interactivas.** Confirmado por inspección
  del CSS (`subtitles-tab-subdued` sólo aplica `opacity: 0.55`) y por
  inspección del JSX (sin `disabled`/`readOnly` condicionales). El
  operador puede preparar config antes de re-encender la IA.
- **CSS limpiado y coherente.** Bloques dead `.defaults-preview-*`,
  `.defaults-sub*` y `.defaults-summary*` borrados. `.defaults-content`
  pasa a `flex column` (la columna 300px era exclusivamente para el
  LivePreview). Media queries actualizadas en consecuencia.
- **`useAutomationSave` no se rompe.** Sigue escribiendo
  `autoCaptions`, `regenOnUpdate`, `reviewEmails` — ninguna referencia
  a `subHighlight*`. El test `payload_contract.spec.js` confirma que el
  round-trip `/defaults` sigue verde.
- **Bundle CSS bajado.** El informe del implementer reporta CSS
  124.82 kB. Tras el build local sale el mismo número con un nuevo
  hash (`index-D6mTPGrN.css`). El delta vs antes del cleanup no es
  llamativo (las reglas eliminadas son pocas), pero al menos no sube.
- **Tests E2E sólidos.** Las 3 specs nuevas cubren los 3 criterios
  duros: existencia del toggle, ausencia de Karaoke + LivePreview, PUT
  con `automation.autoCaptions=false`, rehidratación tras reload.

## Riesgos / follow-ups

- Sin riesgos abiertos en el front. El back feature 31 ya está
  deployado en `:8001` (PIDs API=2869266, worker=2869267), así que el
  contrato end-to-end debería funcionar sin más coordinación.
- Posible follow-up futuro (fuera de scope): reinstaurar un preview en
  `/defaults` con un mock dinámico (no estático como el LivePreview
  borrado). Si se hace, la columna 300px tendría que volver al CSS;
  hoy quedaría como nueva feature.

## Veredicto

**APPROVED**. Cleanup limpio, criterios de aceptación cumplidos, tests
verdes, contrato con back feature 31 respetado. Procedo a cerrar
cross-repo: `feature_list.json` id 31 → done, append a `history.md`,
reset de `current.md`.
