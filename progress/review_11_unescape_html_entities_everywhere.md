# Review — feature 11 (`unescape_html_entities_everywhere`)

**Veredicto:** APPROVED

Reviewer: agente reviewer (Claude). Implementer: Codex.
Fecha: 2026-05-12.

## Contexto

El implementer dejo el informe en
`progress/impl_11_unescape_html_entities_everywhere.md` y la bitacora
en `progress/current.md`. El cambio anade una utilidad pura para
decodificar entidades HTML y la aplica a los 4 puntos donde se pinta
`title` (3 vistas + un filtro de busqueda). El resto del working tree
contiene cambios de features previas ya documentados en
`progress/review_7_pinterest_and_reels_cover_preview.md`; esta review
los re-anota en "Fuera de scope" sin afectar al veredicto.

## Acceptance — verificacion punto por punto

1. **"`src/shared/decodeHtmlEntities.js` exporta funcion pura
   `decode(s)` con tests unitarios (10+ casos)"** — OK
   - El archivo exporta `decodeHtmlEntities` (named + default) en
     `src/shared/decodeHtmlEntities.js:52-66`. Es una funcion `string
     → string` pura, sin side effects, sin dependencias.
   - Implementacion: regex unico
     `/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi` + tabla pequena de named
     entities (`amp`, `lt`, `gt`, `quot`, `apos`, `nbsp`) +
     `String.fromCodePoint()` para numericas, con guarda de rango
     `[0, 0x10FFFF]` (linea 42).
   - `tests/unit/decodeHtmlEntities.unit.js` aporta 15 casos
     (numerica decimal, named comunes, hex, mezcla, sin entidades,
     no-string, double-encoding, named desconocida, astral plane,
     `&nbsp;` → U+00A0, case-insensitive, out-of-range).
   - `node --test tests/unit/decodeHtmlEntities.unit.js`
     → `tests 15  pass 15  fail 0`.

2. **"Los 4 componentes citados muestran 'Jacob's Island' en lugar
   de 'Jacob&#8217;s Island'"** — OK
   - `src/features/reels/ReelCard.jsx:16` calcula
     `const title = decodeHtmlEntities(reel.title);` y lo usa en
     linea 25 (`label={title}` del `<Cover>`) y en linea 48
     (`<div className="reel-card-title">{title}</div>`).
   - `src/features/reels/ReelsTable.jsx:34` calcula
     `const title = decodeHtmlEntities(r.title);` por fila y lo usa
     en linea 47 (`<Cover label={title} />`) y en linea 51
     (`<div className="reels-table-title">{title}</div>`).
   - `src/features/reels/editor/ReelEditor.jsx:318` cambia
     `{reel.title}` por `{decodeHtmlEntities(reel.title)}` en
     `editor-header-title`. No toca el bloque approve/reject ni el
     resto del editor.
   - `src/features/reels/Dashboard.jsx:30-31` — ver punto 3.

3. **"El filtro de busqueda del Dashboard compara strings
   decodificados"** — OK
   - `src/features/reels/Dashboard.jsx:27-34`:
     ```
     if (search) {
       const haystack = `${decodeHtmlEntities(r.title)} ${r.address}`.toLowerCase();
       if (!haystack.includes(search.toLowerCase())) return false;
     }
     ```
   - Asi, buscar `Jacob's` encuentra reels cuyo `r.title` venga del
     backend como `Jacob&#8217;s Island`.
   - No se muta `r.title`; los componentes hijos siguen recibiendo
     el reel original y aplican su propia decodificacion (no se
     decodifica dos veces).

4. **`./init.sh` (`npm run lint && npm run build`)** — OK
   - `npm run lint` → sin warnings/errores.
   - `npm run build` → `✓ built in 2.23s`,
     `dist/assets/index-EiCWwArL.js 364.88 kB │ gzip: 104.67 kB`.

5. **`node --test tests/unit/decodeHtmlEntities.unit.js`** — OK
   - 15 pass, 0 fail, 0 skipped, ~110 ms.

6. **`npm run test:smoke`** — OK
   - `43 passed (1.0m), 2 skipped`. Los 2 skipped son los
     preexistentes `theme › flips the data-theme attribute` en
     tablet y mobile (ya documentados en la review de feature 7,
     ningun cambio en esta feature los introduce).

## Checkpoints (CHECKPOINTS.md)

- C1 (arnes): [x] AGENTS.md, CLAUDE.md, init.sh, feature_list.json,
  progress/current.md, docs/ y CHECKPOINTS.md presentes. `./init.sh`
  termina verde (lint + build verdes).
- C2 (estado coherente): [x] feature 11 sigue en `in_progress` (el
  cierre lo hara el leader). `progress/current.md` describe esta
  sesion. Informe del implementer en
  `progress/impl_11_unescape_html_entities_everywhere.md`.
- C3 (arquitectura): [x]
  - Sin TypeScript: los 5 archivos modificados/creados son `.js` /
    `.jsx`. Test en `.js`.
  - `package.json` no anade deps (ni del blocklist ni otras). El
    unico delta es el campo `"license": "GPL-2.0-only"`,
    preexistente del working tree (no introducido por esta feature
    — ya documentado en review de feature 7).
  - Sin `fetch(...)` directo en los 4 componentes. Los unicos
    matches de `fetch` en los archivos son `refetch()` (hook), no
    HTTP directo.
  - `src/shared/decodeHtmlEntities.js` no importa nada (verificado:
    `grep -nE "^import"` no devuelve hits). Cumple regla
    `shared/ ↛ features/`, `shared/ ↛ lib/api/`.
  - El test importa solo desde `src/shared/` y `node:test` /
    `node:assert/strict`.
- C4 (verificacion real): [x] lint, build, test:smoke verdes; unit
  tests verdes (15/15). La feature toca strings de UI ya cubiertos
  por los smoke; selectores robustos en
  `tests/flows.spec.js` (no impactados). El implementer documenta
  manualmente los 15 casos del unit test.
- C5 (mock contract): [x] no aplica — la feature es 100% cliente,
  no anade endpoints ni handlers nuevos.
  `tests/support/mock-backend.js` no cambia por esta feature.
- C6 (sesion cerrada bien): [x] sin `console.log` ni `debugger` en
  los archivos de la feature (verificado por grep). `package.json`
  no anade dependencias.

## Reglas duras del reviewer

- Blocklist deps (typescript, @tanstack/react-query, msw,
  styled-components, @emotion/\*, tailwindcss): no anadidas. OK.
- `fetch(...)` directo en componentes de la feature: no. OK.
- `src/shared/decodeHtmlEntities.js` importando de `features/`,
  `lib/api/` o `app/`: no — no tiene ningun import. OK.
- `console.log` / `debugger` residuales en archivos de la feature:
  no. OK.
- Modificaciones fuera de scope (Pinterest cerrada, session/auth,
  publishStatus, ReelEditor approve/idempotency): el implementer
  declara explicitamente que SOLO toca `editor-header-title:318` en
  el ReelEditor y deja intactos los cambios previos de feature 7 y
  los cambios de idempotency/anti-doble-click pendientes; verificado
  por diff. OK.

## Cambios requeridos

Ninguno para la feature 11.

## Fuera de scope (no afectan al veredicto)

El working tree mezcla cambios de varias features previas no
commiteadas. Ya estan documentados en
`progress/review_7_pinterest_and_reels_cover_preview.md` y se repiten
aqui para que el leader decida cuando promueverlos a commits/branches
propios:

- `src/features/session/SessionProvider.jsx`,
  `src/features/session/ghlMvpContext.js`, `tests/ghl_context.spec.js`
  — rama `decryptErrorKind === 'network'` con copy "could not reach
  the backend decrypt endpoint". Pertenece a feature 5 o follow-up.
- `src/features/reels/publishStatus.js` (untracked),
  `src/features/reels/hooks.js`, `tests/unit/mapPublishStatus.unit.js`
  (untracked) — extraccion de `mapPublishStatus` + tests unitarios +
  semantica nueva `partial`/`failed`. No es parte de feature 11.
- `src/features/reels/editor/ReelEditor.jsx` (bloque approve/reject)
  — estado `submitting`, manejo de `idempotent_replay` y proteccion
  anti-doble-click. **El implementer de feature 11 NO ha tocado este
  bloque**; estaba ya en el working tree pre-feature-11. Pertenece a
  otra feature ("approve idempotency" / "anti-doble-click").
- `src/features/reels/ReelCard.jsx`, `src/features/reels/ReelsTable.jsx`
  — los cambios de `<Cover kind={reel.cover || 'default'}
  src={reel.coverUrl}>` y la retirada de `video="hover"` SON cambios
  de feature 7. El implementer de feature 11 los mantuvo intactos y
  encima anadio `decodeHtmlEntities`. Esto es lo esperado.
- `src/app/providers/TenantProvider.jsx`,
  `src/features/admin/AgencyConfigDrawer.jsx`,
  `src/features/defaults/initialState.js`,
  `src/features/reels/editor/defaults.js`,
  `src/shared/Icon.jsx` — todos cambios de feature 7 (Pinterest +
  reels cover), ya revisados y aprobados.
- `tests/flows.spec.js`, `tests/support/mock-backend.js` — test +
  helper de feature 7.
- `init.sh` (chmod), `LICENSE` (untracked), `package.json` campo
  `"license"`, `DOCS.md` y `progress/history.md` — cambios
  organizativos preexistentes.

Recomendacion al leader: estos cambios fuera de scope deben separarse
en commits propios antes de cerrar feature 11 y/o registrarse como
features adicionales en `feature_list.json` (en particular, el bloque
`ReelEditor.submitting + idempotent_replay` y la
`mapPublishStatus`/`publishStatus.js` extraction tienen mas peso y
merecen su feature ID propia).
