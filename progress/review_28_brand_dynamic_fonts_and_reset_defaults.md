# Review feature 28 — brand_dynamic_fonts_and_reset_defaults (FRONT)

> Reviewer report. Back ya cerrada y deployada en :8001
> (PIDs API=2604586, worker=2604587). Esta review valida el lado
> frontend y, dado que pasa, dispara el cierre cross-repo.

## Veredicto

**APPROVED** — la feature cumple los 9 acceptance criteria del plan,
todos los grep checks devuelven los hits esperados (0 hardcoded /
0 fetch directos), `./init.sh` y todos los tests específicos verdes,
y el smoke real contra :8001 confirma que el contrato GET /fonts del
mock está alineado con el back.

## Validación punto a punto

1. **`fontsApi.js` + `useAvailableFonts()`** — OK.
   - `src/features/brand/fontsApi.js` usa `apiRequest('/v1/admin/fonts')`
     (no fetch directo) y exporta tanto el `fontsApi` namespaced como
     `listAvailableFonts()` suelto.
   - `useAvailableFonts()` en `src/features/brand/hooks.js:41-49`
     envuelve con `useApi(..., [])`: deps vacías ⇒ carga una vez en
     montaje, sin agency_id (el endpoint es global). Normaliza
     `items` a array y derivar `count`. Surface estándar
     `{items, count, loading, error, refetch}`.
   - Cache: el hook `useApi` cachea por las deps en el ciclo de vida
     del componente. Como `BrandConfig` se monta una vez por visita a
     `/brand`, hay 1 fetch por visita; al navegar fuera y volver, se
     refetchea. Comportamiento correcto para un catálogo
     admin-global pequeño (6 entries).

2. **Primera opción del dropdown** `value=""` ⇒ `null` en PUT — OK.
   - `BrandConfig.jsx:300` emite la option literal:
     ```jsx
     <option value="">Default (system fallback)</option>
     ```
   - `handleSelect` en `FontField` (líneas 281-284) normaliza
     `'' → null` antes de llamar `onChange`, así el state nunca
     contiene string vacío.
   - `buildBrandBody` (líneas 58-71) toma `font_family: fontFamily`
     directamente del state; como state es `null`, el body lleva
     `null` (la key sigue presente, NO se omite). Verificado por la
     spec `Reset font -> Save -> PUT carries font_family: null` que
     asserta tanto `body.toHaveProperty('font_family')` como
     `body.font_family).toBeNull()`.

3. **Botón Reset** clase `btn ghost` + icono `refresh` + texto — OK.
   - `ColorField` (líneas 243-269) y `FontField` (líneas 279-328)
     muestran el botón con `className="btn ghost brand-reset-btn"`,
     icono `<Icon name="refresh" size={13} />` y texto "Reset".
   - **Disabled cuando el valor ya es null**: ambos comprueban
     `isDefault = value === null || value === undefined` (color) o
     `... || value === ''` (font), y pasan `disabled={isDefault}`.
     Evita el PUT redundante.
   - **Tooltip por campo**: `title="Use webhook fallback"` para los
     dos colores, `title="Use Inter default"` para la fuente.
     Diferenciados como pide el plan.
   - **Hint "Using default"** en cursiva: `.brand-default-hint`
     (brand.css:71-76) `font-style: italic; color: var(--t-muted);
     font-size: 12px`. Se muestra cuando `isDefault === true`
     mediante render condicional `{isDefault && <div ...>}`. Test
     IDs: `brand-{primary,secondary}-color-default-hint` y
     `brand-font-default-hint`.

4. **Mock-backend** handler `/fonts` + persistencia `/brand`
   + 422 enum — OK.
   - `tests/support/mock-backend.js:830-840` instala
     `await page.route(/\/v1\/admin\/fonts(\?|$)/, ...)` que devuelve
     `{items: adminFontCatalog, count: adminFontCatalog.length}`. El
     catálogo viene del default `DEFAULT_ADMIN_FONT_CATALOG` con los
     6 items canónicos (líneas 1065-1076) y es override-able vía
     `options.adminFontCatalog`.
   - `brandByAgency = new Map()` (línea 846) sustituye al echo puro
     anterior; ahora un GET tras un PUT refleja la mutación.
   - PUT validation (líneas 998-1007): si el body tiene
     `font_family` no-null/undefined que no está en
     `allowedFontFamilies`, responde 422 con
     `unknownFontFamilyError(value)` cuyo shape es mirror exacto del
     back: `{detail: [{loc: ['body','font_family'],
     msg: 'UNKNOWN_FONT_FAMILY: <value>', type: 'value_error'}]}`
     (líneas 1083-1093). `null` se acepta sin validar.
   - `isKnownAdminStub` (línea 1098) incluye `/^\/v1\/admin\/fonts$/`
     para que el catch-all 404 no se interponga. Correcto.

5. **Specs adyacentes** — OK, contrato no relajado.
   - `tests/payload_contract.spec.js:58-70`: las tres keys siguen
     siendo **obligatorias** (`expect(body).toHaveProperty(...)`),
     solo el value admite `null | string`. La banned list (`font`,
     `tagline`, `watermark_enabled`, ...) sigue intacta. Las
     aserciones `200 / no 422` también.
   - `tests/brand_logo_upload.spec.js:108-117`: misma actualización
     en el matcher del body PUT tras "Remove logo". Las keys
     `primary_color`, `secondary_color`, `font_family` siguen
     requeridas; `logo_position` sigue como string.
   - Verificación práctica: las dos specs pasan **sin** el cambio
     del implementer si el body lleva strings, y también lo hacen
     con `null` tras feature 28. Es decir: el contrato se ha
     ampliado, no relajado.

## Comandos ejecutados

```
./init.sh                                    → OK (lint+build verdes)
npm run lint                                  → OK
npm run build                                 → OK (CSS 123.89 kB, JS 397.84 kB)
npm run test:smoke                            → 46 passed / 2 skipped
npx playwright test tests/brand_dynamic_fonts.spec.js
                                              → 12 passed (4 × 3 viewports)
npx playwright test tests/payload_contract.spec.js \
                    tests/brand_logo_upload.spec.js
                                              → 12 passed

grep -rn "FONTS\s*=\|'Söhne'\|'Helvetica'" src/features/brand/
                                              → 0 hits

grep -rnE 'fetch\(' src/features/brand/
                                              → 2 hits ambos `refetch()`
                                                (callbacks del useApi),
                                                NO llamadas a window.fetch

grep -rn 'useAvailableFonts\|listAvailableFonts' src tests
                                              → 6 hits, todos legítimos
                                                (fontsApi + hooks +
                                                BrandConfig)
```

Smoke manual contra :8001:

```
curl -fsS -H 'Authorization: Bearer test-admin-token' \
     http://127.0.0.1:8001/v1/admin/fonts
→ 200 OK, count=6, items=[Inter, Manrope, Plus Jakarta Sans,
                           Montserrat, Poppins, Roboto]
```

El shape devuelto por el back coincide exactamente con el contrato
que el mock-backend ofrece a los tests, y con la lista que el
implementer puso en `DEFAULT_ADMIN_FONT_CATALOG`. No hay drift.

## Notas

- El test 4 (`Reset primary color`) usa `.brand-cols-2 .field .input`
  para localizar el text input del swatch porque `ColorInput` no
  expone testID por sí mismo. Funciona, pero a futuro convendría
  añadir un `data-testid` al `ColorInput` mismo si esto se repite en
  otras specs — fuera de scope.
- El comportamiento "disabled cuando ya es null" hace que la spec
  `Reset primary color` tenga que pintar `#abcdef` antes de poder
  clicar reset. Esto es deseable (no queremos PUTs vacíos) y la spec
  lo cubre correctamente.
- Cadena brand customisation: feature 6 (estructura del brand body
  con primary/secondary/font), feature 9 (logo upload), feature 28
  (catálogo dinámico + reset). Pendiente sólo feature 29
  (`secondary_color` en `side_banner` — back side, no toca el front
  directamente).

## Cierre cross-repo

Aplicado:

1. `feature_list.json` id 28: `status: in_progress → done`,
   `started_at` eliminado, `review:
   progress/review_28_brand_dynamic_fonts_and_reset_defaults.md`
   añadido.
2. `progress/history.md`: bloque del cierre añadido con la fecha
   2026-05-14.
3. `progress/current.md`: sección de feature 28 (header + Plan +
   Bitacora + Próximo paso) eliminada hasta el `---` que precede al
   HOTFIX paralelo. Header reseteado a `—`. Hotfixes paralelos
   conservados intactos.

`./init.sh` final tras el cierre: verde, `feature_list.json válido
(23 features)`.
