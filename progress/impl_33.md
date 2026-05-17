# impl_33 — agency_outro_upload_ui (front, implementer)

- **Feature:** 33 — `agency_outro_upload_ui`
- **Agente:** Claude (rol implementer)
- **Estado:** pendiente de review (sigue `in_progress` en `feature_list.json`)
- **Verificación:** `./init.sh` ✅ — lint + build verdes.
  `npm run test:smoke` ✅ — 46 passed / 2 skipped.
  `npm run test:e2e` ✅ — **235 passed** / 2 skipped (incluye los 21 nuevos
  de `tests/agency_outro_upload.spec.js` × 3 viewports).

## 1. Archivos tocados

| Archivo                                                 | Tipo     | Motivo |
|---------------------------------------------------------|----------|--------|
| `src/features/defaults/api.js`                          | api      | Añadidos `outroUpload(agencyId, file)` (POST multipart), `outroDelete(agencyId)` (DELETE), `outroFileUrl(agencyId)` (URL string para `<video src>`) y `outroDownload(agencyId)` (blob escape hatch para producción). Mantiene `getDefaults`/`saveDefaults` intactos. |
| `src/features/defaults/hooks.js`                        | hooks    | Añadidos `useOutroUpload` y `useOutroDelete` (mismo patrón que `useLogoUpload`). `buildDefaultsBody` ahora añade `outro_enabled` al PUT body para mirror de `intro_enabled`. |
| `src/features/defaults/OutroCard.jsx`                   | component (new) | Sustituye al mockeado `<IntroOutroCard kind="Outro" />`. Maneja upload + delete reales, validación cliente (size ≤50MB, mime mp4/quicktime, duración 1–10s), Source segmented con `Brand card` disabled + tooltip "Coming soon", chip con duración + size, preview `<video>` apuntando al endpoint con bearer, error inline humanizando `INVALID_MIME` / `FILE_TOO_LARGE` / `INVALID_DURATION` del back. Probe de duración inyectable vía `window.__4reelsProbeOutroDuration` para tests headless. |
| `src/features/defaults/tabs/IntroOutroTab.jsx`          | tab      | El segundo card (`Outro`) ahora monta `<OutroCard>` (server-cabled); el primero (`Intro`) sigue usando el `IntroOutroCard` mockeado a la espera de feature 34. |
| `src/features/defaults/ReelDefaultsConfig.jsx`          | page     | Hidrata `state.outroEnabled` desde `defaults.outro_enabled` (top-level) con fallback al legacy `settings.outroEnabled`. Pasa `defaults`, `agencyId` y `refetch` al `IntroOutroTab` para que la nueva `OutroCard` consuma los `outro_*` sin disparar otro GET. |
| `src/shared/Segmented.jsx`                              | primitive | Extensión retrocompatible: cada `option` admite `disabled` y `title`. Si `disabled`, el `<button>` lleva `disabled` nativo + `aria-disabled="true"` + clase `is-disabled` y no dispara `onChange`. |
| `src/styles/forms.css`                                  | css      | Regla `.seg button.is-disabled, .seg button[disabled]` con `opacity: 0.45; cursor: not-allowed`. |
| `tests/support/mock-backend.js`                         | mock     | (a) Nuevos route handlers para `POST /outro/upload`, `GET /outro/file` y `DELETE /outro`. (b) Estado persistido en el mismo `defaultsByAgency` que la slice de defaults. (c) `surfaceDefaultsForGet` extendido para devolver `outro_enabled`, `outro_source`, `outro_object_key`, `outro_duration_seconds`. (d) `isKnownAdminStub` registra los tres nuevos paths para no caer en el 404 catch-all. |
| `tests/agency_outro_upload.spec.js`                     | tests (new) | 7 specs (×3 viewports = 21 corridas) — happy path, oversized, mime no-video, duración fuera de rango, brand-card disabled+tooltip, trash dispatcha DELETE, toggle preserva el chip. |
| `DOCS.md`                                               | docs     | Nuevo bloque "Agency outro upload (feature 33)" bajo § Backend contract, con los 3 endpoints + la extensión de `GET /defaults`. |

## 2. Mock handler — diff summary

`tests/support/mock-backend.js`:

- **Nuevos routes (después del bloque `defaultsByAgency`)**:
  - `POST /v1/admin/agencies/{id}/outro/upload` — parsea el form-data crudo
    para diferenciar mp4/quicktime, genera un `outro_object_key`
    `agencies/{id}/outro/outro-{n}.{ext}`, persiste el estado de outro sobre
    `defaultsByAgency` y responde `{outro_object_key, outro_duration_seconds, outro_source: "uploaded"}`.
    La duración por defecto es 5s; se puede override con
    `installMockBackend(page, { outroDurationOverride: 4.5 })`.
  - `GET /v1/admin/agencies/{id}/outro/file` — devuelve un buffer mínimo
    (`ftyp isom`, 12 bytes) con `Content-Type: video/mp4`. El smoke nunca
    reproduce; sólo verifica que la URL queda apuntando al endpoint.
  - `DELETE /v1/admin/agencies/{id}/outro` — limpia los campos `outro_*` en
    `defaultsByAgency` y responde `{outro_source: "none", outro_object_key: null}`.
- **`surfaceDefaultsForGet`** ahora añade `outro_enabled`, `outro_source`,
  `outro_object_key` (string|null) y `outro_duration_seconds` (number|null)
  al payload GET — mirror exacto del contrato que el back va a implementar.
- **`isKnownAdminStub`** registra:
  ```
  /^\/v1\/admin\/agencies\/[^/]+\/outro$/
  /^\/v1\/admin\/agencies\/[^/]+\/outro\/upload$/
  /^\/v1\/admin\/agencies\/[^/]+\/outro\/file$/
  ```
  para evitar el 404 catch-all del fallback genérico de `/v1/admin/`.

## 3. DOCS.md update

Bajo § Backend contract, justo antes de "Render templates", se añadió el
bloque **Agency outro upload (feature 33)** con:

- Los 3 endpoints (`POST /outro/upload`, `GET /outro/file`,
  `DELETE /outro`) con sus contratos de request/response.
- Los errores documentados (`INVALID_MIME`, `FILE_TOO_LARGE`,
  `INVALID_DURATION`).
- La extensión de `GET /defaults` con `outro_enabled`, `outro_source`,
  `outro_object_key`, `outro_duration_seconds`.
- El comportamiento del Source selector (`Uploaded video` /
  `Brand card` (Coming soon, deshabilitado) / `None`).
- Nota explícita: el endpoint `/outro/file` requiere bearer, así que
  un `<video src>` plano sólo funciona contra el mock; producción debe
  usar `defaultsApi.outroDownload` (blob + `URL.createObjectURL`).

## 4. Tests añadidos

`tests/agency_outro_upload.spec.js` — 7 specs × 3 viewports = 21 corridas:

1. **upload happy path** — `setInputFiles` con MP4 sintético → POST
   multipart sale (`Content-Type: multipart/form-data; boundary=...`),
   chip visible con duración + size, preview `<video src>` apuntando al
   endpoint `/outro/file`, botones Replace + Trash presentes.
2. **oversized** — `Object.defineProperty(file, 'size', { value: 51MB })`
   en `page.evaluate` (Playwright bloquea buffers >50MB en
   `setInputFiles`); error inline `File must be ≤50MB`, **0 POSTs**.
3. **non-mp4/mov** — `.txt`, error `Only MP4 or MOV`, **0 POSTs**.
4. **duration probe fail** — `window.__4reelsProbeOutroDuration` devuelve
   12s, error `Duration must be 1–10s`, **0 POSTs**.
5. **brand-card disabled + tooltip** — el `<button>` en el segmented tiene
   `disabled=""` y `title="Coming soon"`.
6. **trash → DELETE** — tras un upload exitoso, click en trash dispara un
   `DELETE /outro`, chip desaparece y vuelve el dropzone.
7. **toggle off/on preserva el chip** — flip del Toggle → `card-body`
   queda `display:none` (el chip sobrevive en el DOM, sólo se oculta);
   flip de vuelta → vuelve visible. **NO** se dispara ningún PUT ni DELETE.

## 5. Verification output

```
$ ./init.sh
── 1. Verificando entorno ──────────────  OK
── 2. Archivos base del arnés ──────────  OK
── 3. Validando feature_list.json ──────  OK
── 4. TypeScript filtrado ───────────────  OK
── 5. Lint ──────────────────────────────  OK
── 6. Build ─────────────────────────────  OK (CSS 128.19 kB; JS 414.99 kB)
── 7. Resumen ──────────────────────────  Entorno listo.

$ npm run test:smoke
46 passed (36.5s) / 2 skipped (pre-existing 'theme' specs)

$ npm run test:e2e
235 passed (1.5m) / 2 skipped
    ↳ incluye 21 nuevos en agency_outro_upload.spec.js (7 × desktop/tablet/mobile)
```

## 6. Open items for reviewer

1. **Probe de duración inyectable vía `window.__4reelsProbeOutroDuration`.**
   En headless Chromium un `<video>` no decodifica los bytes sintéticos de un
   MP4 vacío (no hay frames), así que `onloadedmetadata` nunca dispara con la
   carga útil que `setInputFiles` puede enviar. La inyección por `window`
   convive con el camino real (`defaultDurationProbe`) sin desactivar la
   validación: el override sigue alimentando el mismo gate `1 ≤ d ≤ 10`. Si
   prefieres el camino "prop", el componente también acepta
   `probeDurationSeconds` como prop con default; la inyección por `window`
   sólo se introdujo porque la `OutroCard` se monta vía la tab tree y no es
   posible inyectar la prop desde el test.

2. **`outroFileUrl` vs auth.** El leader pidió devolver un *string* para usar
   en `<video src>` y `<a href>`. Funciona contra el mock (que no exige
   bearer) pero NO contra `:8001` (el endpoint real requiere
   `Authorization: Bearer ...` igual que `/brand/logo/file/{filename}`).
   Mantengo el string como contrato primario (per spec) y añado
   `outroDownload(agencyId)` como blob fetcher para el flujo de producción
   — el reviewer puede decidir si la `OutroCard` debe pivotar a blob ya o
   esperar al deploy de :8001. Documentado en DOCS.md.

3. **`outro_enabled` en `buildDefaultsBody`.** Añadí la key top-level. Si
   el back de feature 33 también define `outro_enabled` con extra='forbid'
   en `defaults.py`, no veo conflicto (mirror exacto de `intro_enabled`).
   El mock acepta cualquier shape porque no hay forbid-list para `defaults`.

4. **Size en el chip tras un reload.** El backend no devuelve `size_bytes`
   en `GET /defaults` ni en la respuesta de upload (sólo `duration_seconds`).
   Mi `formatChipMeta` muestra duración + size **cuando hay file local**
   (i.e. justo después del upload); tras un page reload el chip muestra
   sólo la duración. Lo dejé así porque añadir `size_bytes` al contrato
   requeriría cambio en backend. Mencionar si quieres pedir `size_bytes` al
   back también.

5. **`Segmented` extension.** El primitive ahora admite `disabled` y `title`
   por opción. Es retrocompatible: los 14 consumidores existentes no
   pasan esas keys y caen al `false` / `undefined`. La CSS añade
   `.seg button.is-disabled, .seg button[disabled]` (sin pisar `.active`).

## 7. Manual QA checklist contra :8001 (cuando back 33 deploye)

- [ ] Abrir `/defaults` → tab "Intro & outro" → Outro card visible con
      el Toggle Enabled en su estado persistido.
- [ ] Source segmented muestra 3 botones; "Brand card" tiene cursor
      not-allowed y al hover tooltip "Coming soon".
- [ ] Pick un MP4 válido (≤50MB, 5s). Spinner aparece, luego chip con
      "outro.mp4 · 5s · 4.2MB", DevTools muestra `POST /outro/upload`
      con `Content-Type: multipart/form-data; boundary=...` → 200,
      respuesta `{outro_object_key, outro_duration_seconds: 5.0,
      outro_source: "uploaded"}`.
- [ ] Pick un MOV → mismo flow. Pick un PNG → error `Only MP4 or MOV`,
      ningún POST.
- [ ] Pick un MP4 de 12s → error `Duration must be 1–10s`, ningún POST.
- [ ] Pick un MP4 de 60MB → error `File must be ≤50MB`, ningún POST.
- [ ] Recargar la página → el chip se hidrata con la duración del back
      (size no, ver Open items #4). El preview `<video>` carga
      bytes del back (si el back devuelve `video/mp4` con bearer; ver
      Open items #2 — puede fallar si el back rechaza la GET sin
      cabecera, en cuyo caso el preview queda en blanco pero el chip
      sigue ahí).
- [ ] Click Trash → `DELETE /outro` → chip desaparece, dropzone vuelve.
- [ ] Flip Toggle OFF → card-body se oculta. Click "Save defaults" →
      `PUT /defaults` con `outro_enabled: false`. Flip ON + Save → PUT
      con `outro_enabled: true`.
- [ ] Ingestar property con `outro_enabled: true` y un outro persistido
      → el reel renderizado termina con el clip de outro.

## Notas

- **Sin nuevas deps** (TypeScript, React Query, MSW, styled-components,
  Tailwind, CSS-in-JS — blocklist respetada).
- **Componentes nunca llaman fetch directo** — `OutroCard` → `useOutroUpload`
  / `useOutroDelete` → `defaultsApi.outroUpload` / `outroDelete` →
  `apiRequest` en `lib/api/client.js`.
- **Sin `VITE_ADMIN_API_TOKEN`** ni ningún `VITE_*` con secretos.
- **Feature 34 (intro_upload)** no se ha pre-factorizado. La estructura
  está lista: `IntroOutroCard.jsx` (mockeado) sigue manejando el Intro;
  feature 34 puede factorizar `OutroCard.jsx` → `UploadVideoCard.jsx` con
  `kind` prop sin tocar mi código.
