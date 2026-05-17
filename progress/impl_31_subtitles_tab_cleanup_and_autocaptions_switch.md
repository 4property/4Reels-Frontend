# impl_31_subtitles_tab_cleanup_and_autocaptions_switch (front)

> Fecha: 2026-05-15
> Agente: implementer (Claude)
> Feature: 31 — subtitles_tab_cleanup_and_autocaptions_switch (FRONT)
> Repo: `/opt/projects/4Reels-Frontend`
> Estado final: implementado y verificado. **NO marca done** — pendiente
> reviewer.

## Contexto

Back feature 31 ya estaba cerrada y deployada en `:8001`. El render del
back cabla los 11 ajustes `sub*` + `automation.autoCaptions` al filter
graph de ffmpeg. Esta feature front cubre el lado UI:

1. Quitar el componente `<LivePreview>` (el frame 3:4 + summary) de
   `/defaults`.
2. Añadir un toggle "Auto-generate AI subtitles" al inicio de la
   pestaña Subtitles para activar/desactivar la IA desde la UI.
3. Atenuar las cards de Typography y Background&position cuando
   autoCaptions está off (los controles siguen editables).
4. Eliminar la card "Word highlight" / Karaoke (la pulida del back
   feature 31 no la honra, así que es deadcode).

## Archivos modificados

- `src/features/defaults/ReelDefaultsConfig.jsx`
  - Eliminado import `LivePreview`.
  - Eliminada la invocación `<LivePreview state={state} />` del JSX.
  - Sin más cambios — el layout sigue siendo `defaults-layout` (side nav
    + content), y el `defaults-content` queda como única columna.

- `src/features/defaults/LivePreview.jsx` — **eliminado**.
  - Decisión: borrar el archivo en vez de dejarlo como deadcode. Ya no
    se importa desde ningún otro sitio (verificado con grep antes y
    después), así que conservarlo sería ruido para futuros greps,
    listados del directorio y eventuales tareas de auditoría. Aporte
    cero a runtime.

- `src/features/defaults/tabs/SubtitlesTab.jsx`
  - Importa `AUTOMATION_SETTINGS_KEYS` desde `../initialState.js`.
  - Quita del destructuring de `state` los campos
    `subHighlightWord` y `subHighlightColor`.
  - Añade al principio del JSX una nueva card
    `data-testid="auto-captions-card"` con el `<Toggle>` cableado a
    `state[AUTOMATION_SETTINGS_KEYS.autoCaptions]`.
  - Calcula `subduedClass = autoCaptions ? '' : ' subtitles-tab-subdued'`
    y lo añade al `className` de las cards Typography y Background &
    position. La regla CSS aplica sólo `opacity: 0.55` — los controles
    quedan totalmente interactivos para que el operador pueda preparar
    estilo antes de re-activar IA.
  - Elimina por completo la card "Word highlight" con sus inputs
    `subHighlightWord` (Toggle) y `subHighlightColor` (ColorInput).

- `src/features/defaults/initialState.js`
  - Eliminadas las claves `subHighlightWord: true` y
    `subHighlightColor: '#2b57f6'` del objeto `INITIAL_DEFAULTS`.
  - `AUTOMATION_SETTINGS_KEYS.autoCaptions` ya existía con default
    `true`; sin cambios ahí (el back ya lo trata como flag canónico).

- `src/features/defaults/defaults.css`
  - Eliminadas las reglas dead asociadas al LivePreview:
    `.defaults-preview-wrap`, `.defaults-preview-label`,
    `.defaults-preview-frame`, `.defaults-sub`, `.defaults-sub-span`,
    `.defaults-summary`, `.defaults-summary-grid`,
    `.defaults-summary-grid .val`.
  - `.defaults-content` pasa de `display: grid; grid-template-columns:
    1fr 300px` a `display: flex; flex-direction: column` para que las
    cards ocupen todo el ancho disponible ahora que no hay columna de
    preview.
  - Añadida regla `.subtitles-tab-subdued { opacity: 0.55; }`. Sin
    `pointer-events: none` — los controles tienen que seguir editables.
  - Media queries actualizadas: quitadas refs a `.defaults-preview-wrap`
    y `.defaults-preview-frame` (la columna 1fr/300px ya no existe
    tampoco en mobile, así que la regla `grid-template-columns: 1fr` no
    aplica).

- `tests/subtitles_autocaptions.spec.js` — **nuevo**.
  - 3 tests, 3 viewports (desktop / tablet / mobile) → 9 corridas, todas
    verdes.

## Decisión sobre borrar `LivePreview.jsx` vs dejarlo como deadcode

Borrarlo. Justificación:

- Después de quitar el import en `ReelDefaultsConfig.jsx` no hay otro
  consumidor en `src/` ni en `tests/` (verificado con
  `grep -rn 'LivePreview' src tests`).
- El archivo era el único punto donde quedaban referencias a las
  variables `subHighlightWord` y `subHighlightColor` después de
  limpiarlas en `initialState.js` y `SubtitlesTab.jsx`. Mantenerlo como
  deadcode obligaría a borrar también ese par de variables internas
  para evitar warnings de ESLint sobre props no usados — más complejo
  que simplemente eliminar el archivo.
- No hay tests dedicados al componente que se pierdan; el smoke de
  `/defaults` no comprueba la presencia del preview (acabo de añadir
  asserts negativos en el spec nuevo para que **no esté presente**).
- Si en el futuro se quiere reintroducir un preview, se hará con
  contenido diferente (subdivisión por canal, ejemplo dinámico de la
  línea, etc.); reciclar este archivo añadiría confusión.

## Tests añadidos

`tests/subtitles_autocaptions.spec.js` cubre los criterios de
aceptación que el leader pidió:

1. **toggle is present, karaoke + live-preview are gone**
   - Navega a `/defaults`, click en tab Subtitles.
   - Localiza la card `[data-testid="auto-captions-card"]` y verifica
     que el Toggle es visible y `aria-pressed="true"` (default seed).
   - Verifica que el texto "Word highlight" y "Karaoke" tienen `count
     === 0`.
   - Verifica que `.defaults-preview-wrap` y `.defaults-preview-frame`
     tienen `count === 0` (la UI ya no instancia LivePreview).

2. **flipping off + save PUTs `automation.autoCaptions=false`**
   - Intercepta los PUT a `/v1/admin/agencies/{id}/defaults`.
   - Click en el toggle → `aria-pressed="false"`.
   - Click en "Save defaults" → poll por al menos un PUT.
   - Verifica que el body contiene
     `settings['automation.autoCaptions'] === false`.

3. **reload re-hydrates the toggle to its persisted value**
   - Pre-siembra `defaultsByAgency` con
     `settings['automation.autoCaptions'] = false`.
   - Carga la página → toggle está off.
   - Reload → toggle sigue off.

## Verificación

```bash
cd /opt/projects/4Reels-Frontend
./init.sh                                        # arnés verde (node, lint, build)
npm run lint                                     # verde
npm run build                                    # verde (CSS 124.82 kB / JS 396.99 kB)
npm run test:smoke                               # 46 passed / 2 skipped (theme preexistentes)
npx playwright test tests/subtitles_autocaptions.spec.js   # 9 passed
npx playwright test tests/payload_contract.spec.js          # 6 passed (round-trip /defaults intacto)
grep -rn 'subHighlightWord\|subHighlightColor\|LivePreview' src tests
  # → 0 hits en src/
  # → 1 hit en tests/subtitles_autocaptions.spec.js (docstring "(c) The
  #   `<LivePreview>` panel..." — referencia textual, no código)
grep -rn '"Karaoke"\|Word highlight' src
  # → 0 hits
```

## Próximo paso

Lanzar **reviewer** front para feature 31:

- Validar que `LivePreview.jsx` no se vuelva a importar por accidente.
- Validar que el toggle realmente envía la clave canónica
  `automation.autoCaptions` (no una propia tipo `autoCaptions`).
- Confirmar que las cards atenuadas siguen siendo interactivas (es decir,
  que el CSS no metió `pointer-events: none`).
- Verificar que `INITIAL_DEFAULTS` ya no expone `subHighlightWord` /
  `subHighlightColor` ni en la seed ni en el round-trip GET.
- Cross-repo: el back ya consume `automation.autoCaptions` en feature 31
  (ya cerrada). Reviewer puede confirmar a ojo con un PUT real desde la
  UI si quiere.

## Notas

- No tocado nada fuera del scope front de feature 31:
  - El back ya estaba cerrado por el implementer back; cero cambios en
    `/opt/projects/4Reels-Backend`.
  - Otros tabs de `/defaults` (Format, Video, Audio, Captions,
    Intro/outro) intactos.
- El smoke `/defaults` sigue verde — el cambio de `display: grid` a
  `display: flex` en `.defaults-content` no rompe ningún test ni
  cambia el layout visible para tabs distintos a Subtitles (todos
  renderizan en una sola columna).
