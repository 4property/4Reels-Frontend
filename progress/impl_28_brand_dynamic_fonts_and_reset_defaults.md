# Feature 28 — brand_dynamic_fonts_and_reset_defaults (FRONT)

> Implementer report. Back ya cerrada y deployada en :8001
> (PIDs API=2604586, worker=2604587). Esta feature toca el front.

## Archivos creados

- `src/features/brand/fontsApi.js` — wrapper `apiRequest('/v1/admin/fonts')`.
  Exporta `fontsApi.listAvailableFonts()` y un alias suelto
  `listAvailableFonts()`. Sin lógica adicional: el endpoint es admin-only,
  global (sin `agency_id`).
- `tests/brand_dynamic_fonts.spec.js` — Playwright spec (4 tests × 3
  viewports = 12). Cubre:
  1. dropdown poblado dinámicamente desde `GET /v1/admin/fonts`
     (validando `await page.waitForResponse('**/fonts*')`, el conteo y
     el orden canónico, y que NO aparecen `Söhne` / `Helvetica`);
  2. seleccionar `Manrope` → click Save → PUT con
     `font_family: "Manrope"`, status 200, no 422;
  3. Reset font → hint "Using default" visible, `<select value="">` →
     click Save → PUT con `font_family: null`;
  4. Reset primary color (tras pintar `#abcdef` para tener algo que
     resetear) → hint visible → PUT con `primary_color: null` y
     `secondary_color` intacto.

## Archivos modificados

### `src/features/brand/hooks.js`

- Import `fontsApi` desde `./fontsApi.js`.
- Nuevo hook `useAvailableFonts()` que envuelve
  `fontsApi.listAvailableFonts()` con `useApi(..., [])` (deps vacías → se
  carga una vez al montar la página, sin agency_id porque el endpoint es
  global). Normaliza `items` a array para que el caller pueda `.map()`
  sin guardas y expone `count + loading + error + refetch`.

### `src/features/brand/BrandConfig.jsx`

- **Eliminado** el array `FONTS = ['Inter', 'Söhne', ...]` hardcoded.
- Importa `useAvailableFonts()` y lo pasa al `IdentityCard` (items +
  loading).
- Estado inicial de `primary`, `secondary`, `fontFamily` ahora es `null`
  (antes: `'#0F172A'`, `'#FFFFFF'`, `'Inter'`). `null` significa "usar
  el fallback del renderer" (webhook para colores, Inter para fuente).
  El `useEffect` de hidratación respeta `null` (`brand?.x ?? null`).
- `buildBrandBody` preserva `null` en `primary_color`, `secondary_color`
  y `font_family`: la key sigue presente, el valor puede ser `null`. El
  back acepta `str | None`.
- Nueva sub-componente `ColorField` (label + ColorInput + botón Reset +
  hint "Using default"). Sustituye a los dos `.field > ColorInput`
  inline anteriores. El botón Reset queda **deshabilitado** cuando el
  valor ya es `null` (no tiene sentido resetear lo que ya está en
  default). `data-testid="brand-primary-color-reset"` /
  `"brand-secondary-color-reset"` y los hints
  `"brand-{primary,secondary}-color-default-hint"`.
- Nueva sub-componente `FontField` (label + select dinámico + Reset).
  Primera `<option value="">Default (system fallback)</option>` que se
  serializa a `null` (`onChange` normaliza `'' → null`). Mientras
  `loading=true` el `<select>` queda disabled con texto "Loading
  fonts…". Test IDs: `brand-font-select`, `brand-font-reset`,
  `brand-font-default-hint`.
- JSDoc del componente actualizado documentando el contrato.

### `src/features/brand/brand.css`

- Añadidas reglas `.brand-input-row` (flex row para meter el botón
  Reset junto al input), `.brand-reset-btn` (estilo ghost, white-space:
  nowrap), y `.brand-default-hint` (texto pequeño en cursiva en
  `--t-muted`). Todo apoyado en variables CSS existentes; sin Tailwind
  ni CSS-in-JS.

### `tests/support/mock-backend.js`

- Nueva constante exportada-internamente `DEFAULT_ADMIN_FONT_CATALOG`
  con los 6 items canónicos (`Inter`, `Manrope`, `Plus Jakarta Sans`,
  `Montserrat`, `Poppins`, `Roboto`), todos `available: true`. El
  helper acepta override vía `options.adminFontCatalog` para tests
  futuros que necesiten un catálogo distinto.
- Nuevo route `GET /v1/admin/fonts` que devuelve
  `{items, count}` con los 6 items.
- Nuevo `allowedFontFamilies = new Set(catalog.map(f => f.family))`.
- Nuevo `brandByAgency = new Map()`. Antes el handler de `/brand` era
  un puro eco del body; ahora persiste por agencia para que un
  `save → refetch` reflej e `null` correctamente.
- Handler `GET /brand` actualizado: devuelve el `brand` persistido (o
  `null` si la agencia no tiene fila).
- Handler `PUT /brand` actualizado: si `body.font_family` está presente
  y no es `null`/`undefined`, valida contra `allowedFontFamilies`. Si
  no está → 422 con `unknownFontFamilyError(value)`, cuya `detail[0].msg`
  empieza por `UNKNOWN_FONT_FAMILY:` (mirror exacto del Pydantic
  field_validator del back). `null` se acepta. El body completo se
  guarda en `brandByAgency` y se devuelve en `{status: 'saved', brand}`.
- Añadida `/^\/v1\/admin\/fonts$/` a `isKnownAdminStub()` para que el
  catch-all 404 no se interponga.

### `tests/payload_contract.spec.js`

- El test "Brand save sends only the canonical Pydantic body" ya no
  aserta `font_family: expect.any(String)` para los tres campos `str |
  None`. Ahora asegura que las keys están presentes en el body (el
  front no las omite) y que el valor es `null` o `string`. La banned
  list y la afirmación de `200 / no 422` siguen igual.

### `tests/brand_logo_upload.spec.js`

- Misma actualización para el matcher del body PUT tras click
  "Remove logo": `primary_color`, `secondary_color`, `font_family`
  pueden ser `null` o `string` ahora.

## Shape exacto del PUT en los 3 escenarios

Todos sobre `PUT /v1/admin/agencies/{id}/brand`.

1. **Usuario selecciona "Manrope" del dropdown y guarda** (con un
   primary/secondary previamente hidratados desde una agencia que tiene
   colores guardados — ejemplo con `#0F172A` y `#FFFFFF`):
   ```json
   {
     "primary_color": "#0F172A",
     "secondary_color": "#FFFFFF",
     "logo_position": "bottom-right",
     "font_family": "Manrope",
     "logo_object_key": "",
     "intro_logo_object_key": ""
   }
   ```

2. **Usuario clic Reset en el font y guarda** (los colores quedan
   intactos):
   ```json
   {
     "primary_color": "#0F172A",
     "secondary_color": "#FFFFFF",
     "logo_position": "bottom-right",
     "font_family": null,
     "logo_object_key": "",
     "intro_logo_object_key": ""
   }
   ```

3. **Usuario clic Reset en primary color y guarda** (font y secondary
   intactos):
   ```json
   {
     "primary_color": null,
     "secondary_color": "#FFFFFF",
     "logo_position": "bottom-right",
     "font_family": "Inter",
     "logo_object_key": "",
     "intro_logo_object_key": ""
   }
   ```

Nota: para una agencia que nunca ha tenido brand row, el primer Save
emite los tres como `null` (estado hidratado: `null`); el back lo
acepta como `BrandSettingsUpsertPayload(primary_color=None,
secondary_color=None, font_family=None)`.

## Decisiones UX

- **Layout del botón Reset**: a la derecha del input en una flex row.
  Se valoró ponerlo debajo pero queda muy desconectado del input. La
  variante a la derecha es más compacta y deja claro el binding visual.
- **Estilo del botón**: clase existente `btn ghost` (secundaria, fondo
  transparente) + icono `refresh` (el SVG con flechas circulares — no
  hay `rotate-ccw` en el set de Icon.jsx). Texto "Reset" para ser
  explícito en lugar de relegarlo solo a un icono.
- **Disabled cuando ya está en default**: el botón se inhabilita
  cuando el valor ya es `null`/`''` — evita que el usuario haga clic
  sin efecto y deja claro que la acción ya está aplicada. El hint
  "Using default" se muestra en su lugar para confirmar el estado.
- **Tooltip por campo**: `"Use webhook fallback"` para colores (el
  render coge `primary_color`/`secondary_color` del payload del
  webhook cuando la agencia no override), `"Use Inter default"` para
  la fuente. El tooltip va vía `title=` para no introducir un
  componente Tooltip nuevo.
- **Hint "Using default"**: pequeño texto en cursiva debajo del input
  cuando el estado es `null`. Color `--t-muted` para que sea claro pero
  no compita con la label. Se muestra tanto en color como en fuente.
- **Dropdown "Default (system fallback)"**: primera opción del select
  con `value=""`. Texto explícito en lugar de un placeholder vacío
  para que el usuario entienda que es una opción explícita, no un
  "no seleccionado". El handler `onChange` mapea `'' → null` al setear
  el estado, así que el body siempre lleva la semántica correcta.

## Verificación

Comandos ejecutados desde `/opt/projects/4Reels-Frontend`:

- `./init.sh` ✅ — node v24.14.1, npm 11.13.0, sin TypeScript filtrado,
  package.json sin libs prohibidas, lint + build verdes.
- `npm run lint` ✅
- `npm run build` ✅ — `dist/assets/index-CqpeJSS9.css 123.89 kB`,
  `dist/assets/index-DQX742r3.js 397.84 kB`. Tamaño bundle estable
  (delta ~+1 kB CSS por las 4 reglas nuevas).
- `npm run test:smoke` ✅ — **46 passed / 2 skipped** (los 2 skipped
  son los del tema preexistentes, no relacionados).
- `npx playwright test tests/brand_dynamic_fonts.spec.js --reporter=list`
  ✅ — **12 passed** (4 tests × {desktop, tablet, mobile}).
- `npx playwright test tests/brand_logo_upload.spec.js tests/payload_contract.spec.js`
  ✅ — **12 passed** (todos los tests de brand existentes siguen verdes
  con el nuevo contrato `str | None`).
- `grep -rn "FONTS\s*=\|'Söhne'\|'Helvetica'" src/features/brand/` →
  **0 hits** (el array hardcoded y los strings retirados ya no están).
- `grep -rnE 'fetch\(' src/features/brand/` → **0 hits directos**. Los
  2 hits que aparecen son `refetch()` (el callback del hook `useApi`)
  y no llamadas a `window.fetch`.

## Notas para el reviewer

- El cambio de contrato `str → str | None` en el body de PUT /brand es
  visible en `payload_contract.spec.js` y `brand_logo_upload.spec.js`.
  Las dos specs siguen exigiendo que la key esté presente (el front
  no debe omitirla), solo aflojan el tipo del valor.
- El mock-backend ahora **persiste** el brand row por agencia. Tests
  que sólo verifican un único PUT no notan el cambio; tests que hagan
  GET → modificar → PUT → GET ahora ven la mutación de verdad. No
  hay specs existentes que dependieran del comportamiento "echo puro"
  del handler anterior.
- No marqué la feature como `done` (per instrucciones).
