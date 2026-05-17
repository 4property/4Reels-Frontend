# Review — feature 9 (`agency_logo_upload`)

**Veredicto:** APPROVED

## Notas previas

- La feature pasó por dos pasadas del implementer:
  1. Implementación inicial: `<LogoUploader>` completo + handlers + tests + handler de mock multipart.
  2. **Fix post-implementación** (corrección del contrato): "Remove logo" pasa de `logo_object_key: null` a `logo_object_key: ""` tras coordinar con el back (columnas `agency_brand_settings.logo_object_key` son `Text NOT NULL DEFAULT ""`; `""` = limpiar, `null` = no tocar). Documentado al final de `progress/impl_9_agency_logo_upload.md`.
- El fix está aplicado completo: `grep -rn 'logo_object_key: null' src/ tests/` devuelve **0 hits**. El empty string aparece en `src/features/brand/BrandConfig.jsx:97` (handler de remove) y en `tests/brand_logo_upload.spec.js:92` (aserción del smoke).

## Checkpoints

- **C1 (arnés)**: [x] `AGENTS.md`, `CLAUDE.md`, `init.sh`, `feature_list.json`, `progress/current.md` presentes. `./init.sh` ejecutable.
- **C2 (estado coherente)**: [x] Feature 9 marcada `in_progress` en `feature_list.json`; `progress/impl_9_agency_logo_upload.md` describe la sesión activa incluyendo el fix post-impl; `progress/current.md` refleja la feature en curso.
- **C3 (arquitectura)**:
  - [x] Sin TypeScript en `src/`.
  - [x] Sin React Query / MSW / state libs nuevas (verificado en `package.json`; el único delta es `license`).
  - [x] Vanilla CSS (`brand.css` añade tres reglas, sin styled-components ni Tailwind).
  - [x] Ningún componente nuevo hace `fetch(...)` directo. `LogoUploader.jsx` consume `useLogoUpload` → `brandApi.uploadLogo` → `apiRequest` (cliente unificado). `BrandConfig.jsx` solo consume hooks.
  - [x] `src/shared/` no importa de `features/` ni de `lib/api/` (verificado por grep).
  - [x] `src/lib/` no importa de `features/`, `app/`, `shared/` (verificado por grep).
  - [x] `src/app/` no se tocó.
- **C4 (verificación)**:
  - [x] `npm run lint` → exit 0 (sin output).
  - [x] `npm run build` → `✓ built in 2.23s`.
  - [x] `npx playwright test brand_logo_upload.spec.js` → **6 passed (2 tests × 3 viewports)**.
  - [x] `npm run test:smoke` → **43 passed + 2 skipped** (los 2 skipped son theme en mobile, no relacionados).
  - [x] `payload_contract.spec.js` (Brand save sends only the canonical Pydantic body) → 6 passed; el cambio en `client.js` no rompe el JSON path.
- **C5 (mock-backend)**:
  - [x] `tests/support/mock-backend.js` añade el route `POST /v1/admin/agencies/{id}/brand/logo` (regex `\/brand\/logo(\?|$)`) que devuelve `{object_key, url}` y registra la ruta en `isKnownAdminStub` (`/^\/v1\/admin\/agencies\/[^/]+\/brand\/logo$/`).
  - [x] El shape `{object_key, url}` matchea lo documentado en `DOCS.md` § "Backend contract — Brand logo upload" (multipart, response 200).
  - [x] La sección de `DOCS.md` describe el contrato post-fix: `logo_object_key` es string (no `string | null`), `""` borra, `null` se ignora; columnas `Text NOT NULL DEFAULT ""`.
- **C6 (sesión limpia)**:
  - [x] No `console.log` ni `debugger` residuales en `src/features/brand/` ni `src/lib/api/client.js` (el `console.error` en `logApiError` es pre-existente y forma parte del trace canónico).
  - [x] Feature 9 reflejada como `in_progress` en `feature_list.json`.
  - [x] `package.json` solo añade el campo `license`; ninguna dep nueva, ningún script nuevo.

## Validaciones específicas pedidas

1. **`<LogoUploader>` (`src/features/brand/LogoUploader.jsx`)**: cumple todo:
   - Preview con `<img data-testid="brand-logo-preview" src={previewSrc}>` (líneas 92-98).
   - Validación cliente: `ACCEPTED_MIME = ['image/jpeg', 'image/png']` y `MAX_BYTES = 5 * 1024 * 1024` (líneas 6-7); mensajes de error específicos (50-57).
   - `URL.createObjectURL` con revoke en cleanup: `useEffect` con cleanup (29-33), revoke al re-subir (60), revoke en remove (80-83), revoke tras llegar `url` remoto (67-70).
2. **`brandApi.uploadLogo` (`src/features/brand/api.js:25-32`)**: arma `FormData` con campo `file`, llama `apiRequest(..., { method: 'POST', body: form })`. Correcto.
3. **`useLogoUpload` (`src/features/brand/hooks.js:33-43`)**: envuelve `brandApi.uploadLogo` con `useMutation`, valida `agencyId` y `file` antes de disparar.
4. **`src/lib/api/client.js` (cambio opt-in implícito para FormData)**:
   - `isMultipart = typeof FormData !== 'undefined' && body instanceof FormData` (línea 56) — detección por instancia, no por flag.
   - Headers: rama multipart omite `Content-Type` (`...(isMultipart ? {} : { 'Content-Type': 'application/json' })`, línea 59) — el browser pone `multipart/form-data; boundary=...`.
   - Body: rama JSON sigue siendo `JSON.stringify(body)` (línea 69); rama multipart pasa `body` tal cual (67).
   - `redact()` tiene guard para FormData (línea 206) → el trace no rompe sobre uploads.
   - El test `payload_contract.spec.js (Brand save sends only the canonical Pydantic body)` sigue verde → confirma que el camino JSON no se afectó.
5. **Mock handler (`tests/support/mock-backend.js:294-311`)**: route multipart con shape `{object_key, url}`, detecta extensión vía `guessLogoExt` (mira `Content-Type: image/png` en el body multipart → `png` o `jpg`). Registrado en `isKnownAdminStub` (línea 406).
6. **Smoke `tests/brand_logo_upload.spec.js`** (2 tests):
   - "upload + remove via the Brand tab" (29-107): sube un PNG, valida que el POST multipart tiene `Content-Type: multipart/form-data; boundary=...`, que el `<img>` apunta a `https://mock.4reels.test/agencies/mock/brand/logo-\d+\.png`, que el botón "Remove logo" dispara `PUT /brand` con `logo_object_key: ""` (línea 92, `toBe('')`), y que tras remove desaparece el preview y el botón Replace vuelve a "Upload".
   - "rejects non-image files client-side without firing a request" (109-141): pasa un `.txt`, espera el `data-testid="brand-logo-error"` con texto `/JPG or PNG/` y verifica `uploadCalls === 0`.
   - Selectores robustos (`data-testid` y `getByRole`), usa `tests/support/mock-backend.js` (`installMockBackend`).
7. **`DOCS.md` § "Backend contract — Brand logo upload"** (líneas 138-156): documenta multipart `file`, response `{object_key, url}`, columnas `Text NOT NULL DEFAULT ""`, semántica `""` = borrar / `null` = no tocar, `BrandSettingsUpsertPayload` con `extra='forbid'` en el resto de keys. Coincide con el contrato del fix post-impl.

## Fuera de scope (no responsabilidad de feature 9)

Los siguientes archivos están modificados en el working tree pero pertenecen a otras features ya cerradas o en curso (7 Pinterest, 8 default-descriptions, 11 html-entities, etc.):

- `src/app/providers/TenantProvider.jsx`, `src/features/admin/AgencyConfigDrawer.jsx`, `src/features/admin/admin.css`, `src/features/admin/DefaultDescriptionsPanel.jsx` (feature 8).
- `src/features/defaults/initialState.js`, `src/features/reels/Dashboard.jsx`, `src/features/reels/ReelCard.jsx`, `src/features/reels/ReelsTable.jsx`, `src/features/reels/editor/ReelEditor.jsx`, `src/features/reels/editor/defaults.js`, `src/features/reels/hooks.js`, `src/features/reels/publishStatus.js`, `src/shared/decodeHtmlEntities.js`, `tests/flows.spec.js`, `tests/ghl_context.spec.js`, `tests/social_templates.spec.js`, `tests/unit/`, `src/features/session/SessionProvider.jsx`, `src/features/session/ghlMvpContext.js`, `src/shared/Icon.jsx` (Pinterest icon — feature 7).
- En `tests/support/mock-backend.js` además del logo route, hay un bloque `handleSocialTemplates` (feature 8/social-templates) y un stub mejorado de reels — ambos ortogonales al logo upload y no degradan el handler nuevo.

Verifiqué que **el implementer no tocó nada extra en el scope de feature 9**: BrandConfig.jsx, LogoUploader.jsx, brand/api.js, brand/hooks.js, brand/brand.css, lib/api/client.js, mock-backend.js (porción del logo), tests/brand_logo_upload.spec.js y DOCS.md son los archivos relevantes y todos están dentro del alcance declarado en el informe.

## Cambios requeridos

Ninguno.

## Conclusión

El implementer entregó:
- Un componente nuevo `<LogoUploader>` aislado, sin leaks de blob URL, con validación cliente fuerte y feedback claro (uploading / error / success).
- Una extensión mínima y opt-in de `apiRequest` para `FormData` que no degrada el camino JSON (verificado por `payload_contract.spec.js`).
- Un handler de mock con shape canónico `{object_key, url}` y registro en `isKnownAdminStub`.
- Smoke en 3 viewports cubriendo el round-trip completo + el rechazo cliente-side.
- Fix post-implementación correctamente aplicado: `""` (no `null`) para borrar, propagado a código, tests y `DOCS.md`. `grep -rn 'logo_object_key: null' src/ tests/` confirma 0 hits.

Toda la verificación (`lint`, `build`, `test:smoke`, `playwright brand_logo_upload`, `payload_contract`) en verde. **Aprobado.**
