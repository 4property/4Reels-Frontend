# Feature 9 — `agency_logo_upload` (implementer report)

## Resumen

Habilita el upload de logo en la pestana Brand. El boton estaba disabled
("Logo upload not implemented yet"); ahora hay un componente
`<LogoUploader>` que valida JPG/PNG cliente-side, postea el binario a
`POST /v1/admin/agencies/{id}/brand/logo`, muestra preview con la URL
devuelta por el backend, y soporta "Remove logo" via
`PUT /v1/admin/agencies/{id}/brand` con `logo_object_key: null`.

## Archivos modificados / creados

| Archivo | Tipo | Cambio |
|---|---|---|
| `src/features/brand/LogoUploader.jsx` | component (nuevo) | File picker oculto + boton Replace/Upload, preview, "Remove logo", validacion JPG/PNG <= 5 MB, gestion de `URL.createObjectURL` con revoke en unmount. |
| `src/features/brand/BrandConfig.jsx` | component (editado) | Reemplaza el bloque disabled (linea 156-164 antiguo) por `<LogoUploader>` dentro de `IdentityCard`. Estado `logoUrl` para preview, helper `buildBrandBody({...})` para construir el PUT, handler `handleLogoRemove` que dispara PUT inmediato con `logo_object_key: null`. |
| `src/features/brand/api.js` | api (editado) | Anade `brandApi.uploadLogo(agencyId, file)` que arma `FormData` con campo `file` y llama `apiRequest` con method POST + body=FormData. |
| `src/features/brand/hooks.js` | hook (editado) | Anade `useLogoUpload()` (envuelve `brandApi.uploadLogo` con `useMutation`). |
| `src/features/brand/brand.css` | css (editado) | Reglas `.brand-logo-actions`, `.brand-logo-remove`, `.brand-logo-error`. |
| `src/lib/api/client.js` | base (editado, minimo) | Si `body instanceof FormData`, omite la cabecera `Content-Type` (el browser pone `multipart/form-data; boundary=...`) y no serializa. El comportamiento JSON por defecto no cambia. Tambien anade un guard en `redact()` para no romper sobre FormData. |
| `tests/support/mock-backend.js` | mock handler | Anade el route stub para `POST /v1/admin/agencies/{id}/brand/logo`: devuelve `{object_key, url}` y registra la ruta en `isKnownAdminStub`. |
| `tests/brand_logo_upload.spec.js` | E2E (nuevo) | Smoke con dos tests: (1) upload + preview + remove round-trip; (2) rechazo cliente-side de un fichero no-imagen sin disparar request. |
| `DOCS.md` | docs | Anade el contrato del nuevo endpoint en seccion "Backend contract" como responsabilidad del backend real. |
| `feature_list.json` | estado | feature 9 -> `in_progress`. |
| `progress/current.md` | progreso | Plan + feature_dir + ¿toca mock?=si. |
| `progress/impl_9_agency_logo_upload.md` | este informe | Detalle de cambios y verificacion. |

## Output verificacion

### `npm run lint`

```
(sin output; exit 0)
```

### `npm run build`

```
dist/assets/inter-latin-ext-700-normal-TidjK2hL.woff             48.63 kB
dist/assets/inter-latin-ext-600-normal-CIVaiw4L.woff             48.67 kB
dist/assets/index-BCZHXoG3.css                                  118.20 kB │ gzip:  29.39 kB
dist/assets/index-DCQCm74W.js                                   372.09 kB │ gzip: 106.44 kB
✓ built in 2.24s
```

### `npm run test:smoke`

```
2 skipped
43 passed (59.5s)
```

(Los 2 skipped son los tests de tema en mobile, no relacionados.)

### `npx playwright test brand_logo_upload.spec.js`

```
6 passed (8.8s)
```

(2 tests x 3 viewports = 6.)

Tambien se corrio el resto del e2e completo (`npm run test:e2e`) por
buena vecindad: **76 passed, 2 skipped** — todo verde, incluido
`payload_contract.spec.js` que valida que el PUT /brand sigue siendo
canonico.

## Endpoint anadido al mock

- **Path**: `POST /v1/admin/agencies/{id}/brand/logo`
- **Header esperado**: `Content-Type: multipart/form-data; boundary=...`
  (lo pone el browser; el front no lo fuerza).
- **Body**: `FormData` con un solo campo `file` (JPG o PNG).
- **Response 200**:
  ```json
  {
    "object_key": "agencies/mock/brand/logo-1.png",
    "url": "https://mock.4reels.test/agencies/mock/brand/logo-1.png"
  }
  ```
- El handler detecta la extension mirando si el body multipart contiene
  `Content-Type: image/png` para devolver `.png` o `.jpg` (el shape es
  lo unico que importa, los bytes no se persisten).

El `PUT /v1/admin/agencies/{id}/brand` existente acepta
`logo_object_key` como string o null (no esta en `FORBIDDEN_KEYS.brand`),
asi que el "Remove logo" funciona sin tocar el handler de PUT.

## Decisiones no obvias

1. **`<LogoUploader>` como archivo separado** en
   `src/features/brand/LogoUploader.jsx` (vs. inline en
   `BrandConfig.jsx`): mantener `BrandConfig.jsx` legible y aislar la
   logica de validacion + `URL.createObjectURL` (que es facil de
   leak-ear) en su propio componente con su propio `useEffect` de
   limpieza. Props minimas: `agencyId`, `currentLogoUrl`,
   `onUpload(objectKey, url)`, `onRemove()`.

2. **`apiRequest` multipart con opt-in implicito** (`body instanceof
   FormData`): no introduzco un `apiRequestMultipart()` separado ni un
   flag explicito. El cambio en `client.js` es de ~6 lineas, no cambia
   el comportamiento por defecto (JSON), y mantiene una sola entrada al
   cliente HTTP. El test
   `payload_contract.spec.js (Brand save sends only the canonical
   Pydantic body)` sigue verde, confirmando que el JSON path no se ha
   tocado.

3. **`useLogoUpload` separado de `useSaveBrand`**: el upload es un POST
   multipart al endpoint `/brand/logo`; el save es un PUT JSON al
   `/brand`. Son verbos y shapes distintos, pre-existe el patron 1
   hook = 1 verb en `brand/hooks.js`, asi que sumo el tercer hook en
   lugar de mezclar.

4. **Remove dispara PUT inmediato** (vs. acumularlo y esperar a
   "Save brand"): la spec explicita lo pide ("Remove logo: llamar a PUT
   con `logo_object_key: null`"). Ademas, sin PUT inmediato el preview
   desaparece pero el backend sigue teniendo el logo, lo cual es
   confuso. Upload, en cambio, no auto-persiste el resto de campos:
   solo guarda preview + `logo_object_key` en estado y muestra
   "Logo uploaded. Click 'Save brand' to apply" — asi el usuario sigue
   teniendo el boton Save como cierre del cambio de colores/fuente.

5. **Siempre se envia `logo_object_key`** (string o `null`, antes era
   opcional con `if (logoObjectKey) body.logo_object_key = ...`). El
   backend va a aceptarlo en ambas formas, y enviarlo siempre permite
   modelar "limpiar slot" sin tener que enviar un body parcial. El
   campo no esta en `FORBIDDEN_KEYS.brand`, asi que el mock estricto lo
   acepta. Lo mismo para `intro_logo_object_key`.

6. **Preview con `URL.createObjectURL` mientras llega la respuesta del
   POST**: tras `setInputFiles` el componente crea un blob URL para
   feedback inmediato. Cuando el POST resuelve, si la respuesta trae
   una `url`, se revoca el blob y se pinta esa (lo que valida el
   smoke). Si la respuesta no trae url (caso degenerado), se mantiene
   el blob. Hay `URL.revokeObjectURL` en el cleanup del `useEffect` y
   en cada nueva subida para evitar memory leaks.

## Fix post-implementación: deletion contract null → ""

Tras coordinar con la implementación del back (feature 10), se cambia el
contrato de "Remove logo": el PUT envía `logo_object_key: ""` en vez de
`logo_object_key: null`. Las columnas `agency_brand_settings.logo_object_key`
son `Text NOT NULL DEFAULT ""` en el back; `None`/`null` se interpreta como
"no tocar", y `""` como "sin logo". Documentado en docs/API.md del back.

La decisión 5 ("Siempre se envía `logo_object_key`") se mantiene intacta:
el campo se sigue enviando siempre en cada PUT, solo cambia de `null` a
`""` cuando significa borrar. Análogo para `intro_logo_object_key`.

Archivos tocados:
- `src/features/brand/BrandConfig.jsx` — `buildBrandBody` ahora usa `''`
  como fallback en `logo_object_key` / `intro_logo_object_key`, y
  `handleLogoRemove` invoca `buildBrandBody({ logo_object_key: '' })`.
- `src/features/brand/LogoUploader.jsx` — docstring actualizado para
  reflejar el nuevo contrato (`""` = borrar; `null` = no tocar).
- `DOCS.md` § "Backend contract" — sección "Brand logo upload"
  reescrita: el PUT acepta strings (no `string | null`), `""` borra,
  `null` se ignora, columnas `Text NOT NULL DEFAULT ""`.

Tests ajustados:
- `tests/brand_logo_upload.spec.js` — el smoke ahora afirma
  `expect(brandPutBodies[0].logo_object_key).toBe('')` (antes
  `.toBeNull()`); comentario y docstring del bloque también
  actualizados.

`tests/support/mock-backend.js` no necesita cambios: el handler de
`PUT /brand` ya acepta `logo_object_key` como cualquier string y no
está en `FORBIDDEN_KEYS.brand`.

Verificación local tras el fix:
- `npm run lint` → exit 0.
- `npm run build` → ok (`✓ built`).
- `npm run test:smoke` → 43 passed, 2 skipped.
- `npx playwright test brand_logo_upload.spec.js` → 6 passed
  (2 tests × 3 viewports).
