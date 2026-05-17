# Review — feature 7 (`pinterest_and_reels_cover_preview`)

**Veredicto:** APPROVED

Reviewer: agente reviewer (Claude). Implementer original: Codex.
Fecha: 2026-05-12.

## Contexto

El implementer no dejó `progress/impl_7_pinterest_and_reels_cover_preview.md`;
la bitácora vive en `progress/current.md`. El working tree mezcla cambios
de varias features (ver "Fuera de scope" al final). Esta review evalúa
solo los archivos que materializan el acceptance de la feature 7.

## Acceptance — verificación punto por punto

1. **"Pinterest aparece en la lista de redes conectables/seleccionables
   junto al resto de plataformas"** — OK
   - `src/app/providers/TenantProvider.jsx:44` añade `pinterest` al
     `PLATFORM_PRESETS` con nombre, icono y color (#E60023).
   - `src/app/providers/TenantProvider.jsx:122-160` lo incluye en
     `desiredOrder` y mapea `byPlatform.get('pin')` como alias por si el
     backend lo devuelve abreviado.
   - `src/features/admin/AgencyConfigDrawer.jsx:560-567` lo añade a
     `ALL_PLATFORMS` (selector admin).
   - `src/features/admin/AgencyConfigDrawer.jsx:845` lo añade a los
     defaults del formulario de Reel Settings.

2. **"Los presets de redes, defaults, límites de descripción e
   iconografía reconocen `pinterest`"** — OK
   - Presets: `TenantProvider.jsx:44`.
   - Defaults: `src/features/defaults/initialState.js:6` añade
     `pinterest` a `DEFAULT_PLATFORMS`.
   - Límites: `src/features/reels/editor/defaults.js:69` añade
     `pinterest: 500` a `NETWORK_LIMITS` (consumido por
     `DescriptionsPanel.jsx` y `SocialConfig.jsx`).
   - Iconografía: `src/shared/Icon.jsx:85` añade el `case 'pinterest'`
     con SVG dedicado.

3. **"Las tarjetas y tabla de `/reels` pasan la URL real de
   `featured_image_url` como `src` de `Cover`"** — OK
   - `src/features/reels/hooks.js:adaptReelSummary` expone tanto
     `cover` como `coverUrl` con el valor `item.featured_image_url`.
   - `src/features/reels/ReelCard.jsx:19-24` renderiza
     `<Cover src={reel.coverUrl} kind={reel.cover || 'default'} ratio="3/4" label={reel.title} />`.
   - `src/features/reels/ReelsTable.jsx:40-45` hace lo mismo en la
     tabla.

4. **"Las tarjetas y tabla de `/reels` no usan `video=\"hover\"` ni
   cargan `/assets/property/reel.mp4` al pasar el ratón"** — OK
   - `grep -rn 'video="hover"' src/` solo devuelve el comentario JSDoc
     en `src/shared/Cover.jsx:9`. No queda ningún consumidor del modo
     hover.
   - `grep -rn '/assets/property/reel' src/` solo devuelve los usos
     legítimos en `src/shared/Cover.jsx` (`REEL_VIDEO_SRC` constante,
     queda como código muerto pero no se invoca desde tarjetas/tabla),
     `IntroOutroCard.jsx` y `SlideRow.jsx` (paneles del editor, no son
     `/reels`).
   - El smoke `tests/flows.spec.js:62` arma una propiedad con
     `featured_image_url`, intercepta `/assets/property/reel.mp4` con
     `route.abort`, hace hover y verifica que `mockVideoRequests === 0`
     y que no hay `<video class="cover-media">` en el `.reel-card`.

5. **"Si no hay `featured_image_url`, se mantiene un placeholder estable
   en lugar de una caja negra"** — OK
   - `adaptReelSummary` (en `hooks.js:103-105`) deja `cover: ''` y
     `coverUrl: ''` cuando `featured_image_url` falta.
   - ReelCard/ReelsTable pasan `kind={reel.cover || 'default'}` y
     `src={reel.coverUrl}`.
   - `src/shared/Cover.jsx:87-109` (rama final): con `src=''` y
     `kind='default'`, `PHOTO_MAP['default']` es `undefined`; se cae a
     la rama del placeholder de rayas (`PLACEHOLDER_PALETTE.default`)
     que pinta un fondo claro estable con el `label`.

6. **`npm run lint` verde** — OK
   - `./init.sh` se ejecuta hasta "lint verde / build verde". Sin
     warnings.

7. **`npm run build` verde** — OK (mismo `./init.sh`).

8. **`npm run test:smoke` verde** — OK
   - Salida: `43 passed (59.9s), 2 skipped`. Coincide con lo declarado
     en `progress/current.md`. Los 2 skipped son el test de tema en
     tablet y mobile (preexistentes, no introducidos por esta feature).
   - El nuevo test `agency session › renders reel cards with the
     property cover image, not the mock video` pasa en desktop, tablet
     y mobile.

## Checkpoints (CHECKPOINTS.md)

- C1 (arnés): [x] AGENTS.md, CLAUDE.md, init.sh, feature_list.json,
  progress/current.md, docs/, CHECKPOINTS.md presentes;
  `./init.sh` exit 0.
- C2 (estado coherente): [x] feature 7 sigue en `in_progress` (el
  cierre lo hará el leader). `progress/current.md` describe esta
  sesión. `progress/history.md` está al día con la sesión previa.
- C3 (arquitectura): [x]
  - Sin TypeScript en src/.
  - `package.json` solo añade el campo `"license": "GPL-2.0-only"`. No
    introduce libs del blocklist.
  - Sin `fetch(...)` directo en `ReelCard.jsx`, `ReelsTable.jsx`,
    `AgencyConfigDrawer.jsx`, `TenantProvider.jsx`, `initialState.js`,
    `editor/defaults.js`, `reels/hooks.js`, `shared/Icon.jsx`.
  - `src/shared/Icon.jsx` no importa de features/ ni de lib/api/.
  - `src/lib/` intacto.
- C4 (verificación real): [x] lint, build, test:smoke verdes. La
  feature toca UI: hay smoke nuevo en `tests/flows.spec.js` con
  selectores robustos (`page.getByRole`, `page.getByText`,
  `page.locator('.reel-card .cover-media')`) y usa el helper
  `installMockBackend` de `tests/support/mock-backend.js`.
  Visual snapshots no aplican (la feature no introduce nuevos
  componentes de "look", solo cambia la fuente de la imagen).
- C5 (mock contract): [x] `tests/support/mock-backend.js:90-130`
  extiende el handler de `/v1/admin/agencies/{id}/reels` para servir
  los reels seedados con `installMockBackend({ reels: [...] })`. El
  shape (`featured_image_url`, `site_id`, `source_property_id`,
  `slug`, `workflow_state`, `publish_status`, etc.) coincide con el
  `AgencyReelSummary` que `adaptReelSummary` consume y con el
  contrato actual del backend.
- C6 (sesión cerrada bien): [x] sin `console.log` ni `debugger` en
  los archivos modificados de la feature. No hay `.tmp_vite_*.log`
  visibles. `package.json` solo añade un campo `license`, justificado
  por el `LICENSE` nuevo (no es una nueva dependencia).

## Reglas duras del reviewer

- Blocklist deps (typescript, @tanstack/react-query, msw,
  styled-components, @emotion/\*, tailwindcss): no añadidas. OK.
- `fetch(...)` directo en componentes de la feature: no encontrado. OK.
- `src/shared/` importando de `features/` o `lib/api/`: no. OK.
- `console.log` / `debugger` residuales en archivos de la feature: no.
  OK.

## Cambios requeridos

Ninguno para la feature 7.

## Fuera de scope (no afectan al veredicto, pero el leader debe saberlo)

El working tree tiene cambios que **no** pertenecen a la feature 7 y
quedan sin commitear. Documentados aquí para que el leader decida
si los promueve a features propias o los descarta antes de cerrar:

- `src/features/session/SessionProvider.jsx` — añade rama
  `decryptErrorKind === 'network'` con copy específico de "could not
  reach the backend decrypt endpoint". Suena a feature 5
  (`frontend_admin_auth_lockstep`) o a un follow-up suyo.
- `src/features/session/ghlMvpContext.js` — añade campo
  `decryptErrorKind` a la normalización del contexto GHL y modifica
  `mergeContexts` para no descartar contexts cifrados sin ids. Mismo
  origen que el anterior.
- `tests/ghl_context.spec.js` (untracked) — smoke nuevo que cubre el
  banner "Network/CORS error" cuando el decrypt no llega al backend.
  Pertenece al cambio anterior, no a esta feature.
- `src/features/reels/publishStatus.js` (untracked) — extrae
  `mapPublishStatus` del `hooks.js` y le añade dos cambios de semántica
  que NO estaban antes: distingue `partial` (→ `published`) y `failed`
  (→ `failed` nuevo, antes caía en `rejected`). Cambio razonable, pero
  no está en el acceptance de la feature 7.
- `src/features/reels/hooks.js` — solo cambia el import de
  `mapPublishStatus` para apuntar al módulo nuevo. Cambio derivado del
  anterior.
- `src/features/reels/editor/ReelEditor.jsx` — añade estado
  `submitting`, manejo de `idempotent_replay` en el approve, y
  protección anti-doble-click en approve/reject. Mejora real, pero
  pertenece a otra feature (¿ehl_approve_idempotency / reels_anti_double_click?).
- `tests/unit/mapPublishStatus.unit.js` (untracked) — tests unitarios
  para `mapPublishStatus`. Útiles, pero parte del cambio anterior.
- `LICENSE` (untracked) y `package.json` `"license": "GPL-2.0-only"`
  — cambio de licenciamiento. Cambio organizativo, fuera de scope de
  feature 7.
- `init.sh` — solo cambia el permission bit a ejecutable, sin diff de
  contenido. Cosmético.

Recomendación al leader: separar estos cambios antes de cerrar la
feature 7 (commits/branches distintos), o registrarlos como features
propias en `feature_list.json`. Tal y como están, el smoke verde sí
cubre que ninguno de ellos rompe la feature 7, pero mezclarlos en el
mismo commit dificultará la trazabilidad.
