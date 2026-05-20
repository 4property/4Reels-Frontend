# impl — Subtitles font dropdown wired to dynamic catalog

Trabajo acotado: completar la migración de la pestaña **Subtitles**
(`/defaults`) al catálogo de fuentes que sirve el backend
(`GET /v1/admin/fonts`). La pestaña Brand ya lo hacía vía
`useAvailableFonts` (feature 28); la Subtitles seguía con la lista
hardcoded `Inter / Söhne / Manrope / Plus Jakarta Sans / Helvetica /
Montserrat`. El backend acaba de añadir **Barlow Semi Condensed** y debe
verse también aquí.

## Archivos tocados

- `src/features/defaults/tabs/SubtitlesTab.jsx` — refactor del
  `<select>` de "Font family".
- `tests/support/mock-backend.js` — añadir Barlow Semi Condensed al
  `DEFAULT_ADMIN_FONT_CATALOG` para que el mock siga en sync con
  `app/api/admin/fonts.py`.
- `tests/brand_dynamic_fonts.spec.js` — actualizar las aserciones de
  count (6 → 7) y de la última entrada de la lista para reflejar la
  nueva fuente.
- `tests/subtitles_autocaptions.spec.js` — añadir test focal (3
  viewports x 1 test = 3 corridas) que valida que `Barlow Semi
  Condensed` aparece en el `<select>` de la pestaña Subtitles y que
  `Söhne` / `Helvetica` no.

## Antes / Después del dropdown (SubtitlesTab.jsx)

### Antes
```jsx
<select className="select" value={subFont} onChange={(e) => set({ subFont: e.target.value })}>
  <option>Inter</option><option>Söhne</option><option>Manrope</option>
  <option>Plus Jakarta Sans</option><option>Helvetica</option><option>Montserrat</option>
</select>
```

### Después
```jsx
const { items: fontItems, loading: fontsLoading } = useAvailableFonts();
...
<select
  className="select"
  value={subFont}
  onChange={(e) => set({ subFont: e.target.value })}
  disabled={fontsLoading}
  data-testid="subtitles-font-select"
>
  {fontsLoading ? (
    <option value={subFont}>Loading fonts…</option>
  ) : (
    <>
      {/* Si el valor guardado es una fuente legacy retirada en feature 28
          la dejamos renderizada para no perder la selección. */}
      {subFont && !fontItems.some((f) => f.family === subFont) && (
        <option value={subFont}>{subFont}</option>
      )}
      {fontItems.map((font) => (
        <option key={font.family} value={font.family}>
          {font.display_name || font.family}
        </option>
      ))}
    </>
  )}
</select>
```

El resto de la pestaña (peso, tamaño, color, fondo, posición, alineación,
max chars per line, AI subtitles toggle, etc.) queda **intacto**. El
`onChange` sigue siendo el mismo `set({ subFont: e.target.value })` —
ningún consumer aguas abajo cambia.

## Verificación

### `./init.sh`
Exit 0. Resumen:
- lint verde
- build verde
- node v24.14.1, npm 11.13.0
- feature_list.json válido (33 features)
- Sin TypeScript en src/
- Sin libs prohibidas

### Playwright focal

```
$ npx playwright test tests/brand_dynamic_fonts.spec.js
  12 passed (12.1s)   # 4 tests x 3 viewports (desktop/tablet/mobile)
```

```
$ npx playwright test tests/subtitles_autocaptions.spec.js
  12 passed (12.2s)   # 4 tests x 3 viewports (incluye el nuevo
                     # 'font dropdown is fed by GET /v1/admin/fonts (Barlow visible)')
```

### Grep negativo (post-cambio)

```
$ grep -n "Söhne\|Helvetica" src/features/defaults/tabs/SubtitlesTab.jsx
# (vacío, exit 1)
```

## Decisiones no obvias

- Mantengo `value={subFont}` también durante el `loading`. Eso evita
  que React reescriba el campo controlado a `""` (que podría dispararse
  como `onChange` si el placeholder de "Loading fonts…" tuviera value
  vacío) y conserva la selección actual mientras el catálogo carga.
- Cuando `subFont` es un legacy retirado (Söhne / Helvetica / Sohne en
  un `defaults` antiguo del backend), lo seguimos pintando como una
  `<option>` adicional al inicio del bloque para que el `<select>`
  refleje la selección real persistida. No se puede volver a
  seleccionar una vez que el usuario abre el dropdown y cambia, lo cual
  es el comportamiento deseado (los renders del backend tampoco la
  aceptan ya: el back valida contra el catálogo canónico).
- Bumpeo el mock catálogo (`DEFAULT_ADMIN_FONT_CATALOG` en
  `tests/support/mock-backend.js`) en el mismo PR para no dejar el
  mock desincronizado con el back. Sin esto, el spec `brand_dynamic_fonts`
  fallaría en cuanto la suite asuma 7 fuentes (y, sobre todo, la suite
  de mocks dejaría de reflejar la realidad del producto, que era
  precisamente lo que motivó esta tarea).
- El `data-testid="subtitles-font-select"` se añade pensando en futuros
  tests de override (per-reel subtitles, social templates) que quieran
  comprobar la presencia del dropdown sin scrapear el DOM.

## Pendiente / fuera de scope

- No marco features como `done` en `feature_list.json` (no hay feature
  ID asociada a este pequeño follow-up; es una continuación del
  trabajo de feature 28).
- No edité backend ni reinicié servicios.
- No instalé librerías nuevas.
