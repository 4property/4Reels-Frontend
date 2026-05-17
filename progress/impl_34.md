# impl_34 — agency_intro_upload_ui (front, implementer)

- **Feature:** 34 — `agency_intro_upload_ui`
- **Agente:** Claude (rol implementer)
- **Estado:** pendiente de review (sigue `in_progress` en `feature_list.json`)
- **Verificación:** `./init.sh` ✅ — lint + build verdes.
  `npm run test:smoke` ✅ — 46 passed / 2 skipped (pre-existing theme specs).
  `npm run test:e2e tests/agency_intro_upload.spec.js tests/agency_outro_upload.spec.js` ✅ — **45 passed** (8 nuevos intro × 3 viewports + 7 outro × 3 = 24 + 21).
  `npm run test:e2e` (full) → 257 passed / 2 skipped / 2 flake en
  `tests/social_templates.spec.js:233` (pre-existing; verde al re-run aislado;
  el leader lo nombró explícitamente como aceptable).

## 1. Refactor — `UploadVideoCard.jsx`

**Sí**, factoricé `OutroCard` → `UploadVideoCard`. La signatura:

```jsx
<UploadVideoCard
  kind="intro" | "outro"
  copy={INTRO_COPY | OUTRO_COPY}
  enabled
  setEnabled
  duration
  setDuration
  defaults          // { intro_*, outro_* }
  agencyId
  refetchDefaults
  probeDurationSeconds  // optional, default reads window.__4reelsProbe{Intro|Outro}Duration
/>
```

`copy` shape:

```js
{ title, subtitle, previewTag, previewNoneLabel, durationLabel,
  durationHint, chipFallbackName, removeAria, deleteFallbackError }
```

`OutroCard.jsx` y `IntroCard.jsx` son ahora wrappers de ~10 líneas que
solo inyectan `kind` + `copy`:

```jsx
export function OutroCard(props) {
  return <UploadVideoCard kind="outro" copy={OUTRO_COPY} {...props} />;
}
```

Detalles internos del refactor:

- `kindFields(kind)` mapea `kind` → `{ source, objectKey, durationSeconds }`
  (los nombres de campos persistidos: `intro_source` vs `outro_source`, etc).
- `kindTestIds(kind)` genera todos los `data-testid` (`${kind}-card`,
  `${kind}-file-chip`, etc) para que los tests de outro sigan funcionando
  sin cambios y los nuevos de intro sigan el mismo patrón.
- `defaultDurationProbe(kind)` devuelve una función que prioriza el hook
  `window.__4reelsProbe{Intro|Outro}Duration` para que las dos cards
  coexistan en la misma tab sin colisión.
- Las validaciones (size ≤50MB, mime, duración 1–10s, mensajes de error
  humanizados desde `INVALID_MIME` / `FILE_TOO_LARGE` / `INVALID_DURATION`)
  viven una sola vez en `UploadVideoCard`. Single source.

Los 21 tests de outro siguen verdes después del refactor.

## 2. Archivos tocados

| Archivo                                                 | Tipo      | Motivo |
|---------------------------------------------------------|-----------|--------|
| `src/features/defaults/api.js`                          | api       | Añadidos `introUpload`, `introDelete`, `introFileUrl`, `introDownload`. Factoricé los helpers internos `uploadVideo`/`deleteVideo`/`fileUrl`/`downloadVideo` por kind. Outro mantiene su superficie pública. |
| `src/features/defaults/hooks.js`                        | hooks     | Añadidos `useIntroUpload`, `useIntroDelete` (mismo patrón que outro). `buildDefaultsBody` ya emitía `intro_enabled` desde feature 33 — confirmado, sin cambios. |
| `src/features/defaults/UploadVideoCard.jsx`             | comp (new) | Componente shared parametrizado por `kind` (intro/outro). Owns validación, probe inyectable, segmentado, preview, chip, dropzone, error humanizado. |
| `src/features/defaults/OutroCard.jsx`                   | comp      | Reescrito como wrapper delgado: `<UploadVideoCard kind="outro" copy={OUTRO_COPY} {...props} />`. |
| `src/features/defaults/IntroCard.jsx`                   | comp (new) | Wrapper delgado para intro: `<UploadVideoCard kind="intro" copy={INTRO_COPY} {...props} />`. |
| `src/features/defaults/tabs/IntroOutroTab.jsx`          | tab       | El primer card ahora monta `<IntroCard>` (server-cabled) en lugar del legacy `IntroOutroCard kind="Intro"` mockeado. Outro queda igual. Eliminados los props mock (`introSource`, `introFile`). |
| `tests/support/mock-backend.js`                         | mock      | (a) 3 route handlers nuevos para `POST /intro/upload`, `GET /intro/file`, `DELETE /intro` (espejo exacto de los de outro). (b) Estado persistido en el mismo `defaultsByAgency`. (c) `surfaceDefaultsForGet` extendido con `intro_source`, `intro_object_key`, `intro_duration_seconds`. (d) `isKnownAdminStub` registra los 3 paths nuevos. |
| `tests/agency_intro_upload.spec.js`                     | tests (new) | 7 scenarios + 1 combinado = 8 × 3 viewports = 24 corridas. Espejo del outro spec + un test combinado que sube intro y outro en la misma página y verifica que no se interfieren. |
| `DOCS.md`                                               | docs      | Nuevo bloque "Agency intro upload (feature 34)" bajo § Backend contract, simétrico al de outro, con los 3 endpoints + la extensión de `GET /defaults` con `intro_*`. |
| `feature_list.json`                                     | state     | Feature 34 `pending` → `in_progress`. NO se marca `done` (contrato implementer). |
| `progress/current.md`                                   | log       | Anotación de feature 34 en curso con plan. |

No tocados (confirmado): `ReelDefaultsConfig.jsx` ya hidrataba
`state.introEnabled` desde `defaults.intro_enabled` (feature 33 lo añadió
para outro y mantuvo el de intro intacto). `Segmented` ya soportaba
`disabled+title` (feature 33). `forms.css` ya tenía el estilo dim
(feature 33).

## 3. Mock handler — diff summary

`tests/support/mock-backend.js`:

- **Nuevos routes (después del bloque outro)**:
  - `POST /v1/admin/agencies/{id}/intro/upload` — parsea el form-data crudo
    para diferenciar mp4/quicktime, genera un `intro_object_key`
    `agencies/{id}/intro/intro-{n}.{ext}`, persiste el estado de intro sobre
    `defaultsByAgency` y responde `{intro_object_key, intro_duration_seconds, intro_source: "uploaded"}`.
    Duración por defecto 3s (vs 5s de outro — visual: intro es típicamente
    más corto). Override vía `installMockBackend(page, { introDurationOverride: N })`.
  - `GET /v1/admin/agencies/{id}/intro/file` — devuelve 12 bytes mínimos
    (`ftyp isom`) con `Content-Type: video/mp4`. Espejo del de outro.
  - `DELETE /v1/admin/agencies/{id}/intro` — limpia los campos `intro_*` en
    `defaultsByAgency` y responde `{intro_source: "none", intro_object_key: null}`.
- **`surfaceDefaultsForGet`** ahora añade `intro_source`,
  `intro_object_key` (string|null) y `intro_duration_seconds` (number|null)
  al payload GET — `intro_enabled` ya estaba.
- **`isKnownAdminStub`** registra:
  ```
  /^\/v1\/admin\/agencies\/[^/]+\/intro$/
  /^\/v1\/admin\/agencies\/[^/]+\/intro\/upload$/
  /^\/v1\/admin\/agencies\/[^/]+\/intro\/file$/
  ```

## 4. DOCS.md update

Bajo § Backend contract, después del bloque "Agency outro upload (feature 33)"
y antes de "Render templates", se añadió el bloque
**Agency intro upload (feature 34)** con:

- Los 3 endpoints (`POST /intro/upload`, `GET /intro/file`, `DELETE /intro`)
  con sus contratos exactos.
- Los errores documentados (`INVALID_MIME`, `FILE_TOO_LARGE`, `INVALID_DURATION`).
- La extensión adicional de `GET /defaults` con `intro_source`,
  `intro_object_key`, `intro_duration_seconds` (mientras que `intro_enabled`
  ya existía desde antes).
- Nota explícita sobre auth en `<video src>` (mismo problema que outro:
  producción debe usar `defaultsApi.introDownload` + objectURL).
- Confirmación de que la card monta IntroCard + OutroCard, ambos son
  thin wrappers de `UploadVideoCard`, y que la copy difiere por kind:
  intro = "Plays at the start of every reel"; outro = "Plays at the end".

## 5. Tests añadidos + confirmación que outro sigue verde

`tests/agency_intro_upload.spec.js` — 8 specs × 3 viewports = 24 corridas:

1. **upload happy path** — `setInputFiles` con MP4 sintético → POST
   multipart sale (`Content-Type: multipart/form-data; boundary=...`),
   chip visible con duración (3s) + size, preview `<video src>` apunta a
   `/intro/file`, Replace + Trash presentes.
2. **oversized** — `Object.defineProperty(file, 'size', { value: 51MB })`;
   error inline `File must be ≤50MB`, **0 POSTs**.
3. **non-mp4/mov** — `.txt`, error `Only MP4 or MOV`, **0 POSTs**.
4. **duration probe fail** — `window.__4reelsProbeIntroDuration` devuelve
   12s → error `Duration must be 1–10s`, **0 POSTs**.
5. **brand-card disabled + tooltip** — el `<button>` tiene
   `disabled=""` y `title="Coming soon"`.
6. **trash → DELETE** — tras un upload exitoso, click en trash dispara un
   `DELETE /intro`, chip desaparece, vuelve el dropzone.
7. **toggle off/on preserva el chip** — flip del Toggle → card-body
   `display:none` (chip sobrevive en DOM, sólo oculto); flip de vuelta →
   visible. **NO** se dispara ningún PUT ni DELETE.
8. **combined** (smoke combinado) — defaults tab con ambos cards;
   upload intro + upload outro → ambos chips visibles, ambos POSTs en su
   path correcto (1 y 1), toggle intro off oculta sólo su chip, outro
   permanece visible.

**Outro tests (21/21 verde tras el refactor):**

```
$ npm run test:e2e tests/agency_outro_upload.spec.js
21 passed (14.8s)
```

**Combinado intro+outro (45/45 verde):**

```
$ npm run test:e2e tests/agency_intro_upload.spec.js tests/agency_outro_upload.spec.js
45 passed (21.0s)
```

## 6. Verification output

```
$ ./init.sh
── 1. Verificando entorno ──────────────  OK (node v24.14.1, npm 11.13.0)
── 2. Archivos base del arnés ──────────  OK
── 3. Validando feature_list.json ──────  OK (31 features)
── 4. TypeScript filtrado ───────────────  OK (sin .ts/.tsx en src/, sin libs prohibidas)
── 5. Lint ──────────────────────────────  OK (lint verde)
── 6. Build ─────────────────────────────  OK (build verde)
── 7. Resumen ──────────────────────────  Entorno listo.

$ npm run test:smoke
46 passed (37.2s) / 2 skipped (pre-existing 'theme' specs)

$ npm run test:e2e tests/agency_intro_upload.spec.js tests/agency_outro_upload.spec.js
45 passed (21.0s)
  ↳ 24 nuevos en agency_intro_upload (7 × 3 + 1 combined × 3)
  ↳ 21 outro intactos (7 × 3)

$ npm run test:e2e (full)
257 passed / 2 skipped / 2 flake (tests/social_templates.spec.js:233 — pre-existing
  según review_33; verde al re-run aislado: 30 passed).
```

## 7. Open items for reviewer

1. **Refactor compartido `UploadVideoCard`.** Single source of truth para
   validación, probe, segmented y preview. `OutroCard`/`IntroCard` son
   wrappers triviales (~10 líneas). El refactor no cambia el contrato
   de outro y los 21 specs de outro siguen verdes.

2. **`probeDurationSeconds` ahora es por-kind.** El hook `window.__4reelsProbeOutroDuration` sigue
   funcionando exactamente igual. El nuevo `window.__4reelsProbeIntroDuration` es
   independiente para que las dos cards no se interfieran en la misma tab.
   Si prefieres unificar (un solo hook compartido), el cambio es trivial —
   pero la separación es más segura para tests futuros que monten ambas
   cards a la vez.

3. **`introDurationOverride` en `installMockBackend`.** Default 3s
   (vs 5s del outro). Es arbitrario, pero refleja la asunción de que
   intros suelen ser más cortos. Override disponible para tests.

4. **`size_bytes` post-reload (heredado del review 33).** El backend
   sigue sin devolver `*_size_bytes` en GET `/defaults`, así que el chip
   muestra duración + size sólo justo tras el upload; tras reload, sólo
   duración. Mismo trade-off que outro. Sin cambio.

5. **`outro_enabled` ya estaba en `buildDefaultsBody` por feature 33,
   `intro_enabled` también desde antes.** Sin cambios al body PUT.
   Confirmado: ambos toggles persisten al ejecutar "Save defaults".

6. **El componente legacy `IntroOutroCard.jsx`** (mockeado) sigue en
   `src/features/defaults/IntroOutroCard.jsx`. Ya no se usa en ningún
   sitio (`IntroOutroTab.jsx` ahora monta IntroCard + OutroCard). Lo
   dejé en el repo por si el reviewer prefiere borrarlo en un paso
   separado para mantener el diff de esta feature acotado. Si decides
   borrarlo, también desaparecen `Preview` y `Controls` internos del
   archivo. Manda con un thumbs-up y lo limpio.

## 8. Manual QA contra :8001 (cuando back 34 deploye)

- [ ] Abrir `/defaults` → tab "Intro & outro" → ver **dos** cards (Intro
      y Outro) con sus Toggles persistidos.
- [ ] Source segmented en ambos: 3 botones; "Brand card" disabled con
      tooltip "Coming soon".
- [ ] **Intro**: subir MP4 3s ≤50MB → DevTools muestra `POST /intro/upload`
      multipart → 200, chip "intro.mp4 · 3s · ~4MB", preview `<video>` carga
      del `/intro/file` (si bearer va — ver open item).
- [ ] **Outro**: subir MP4 5s ≤50MB → DevTools muestra `POST /outro/upload`
      multipart → 200, chip + preview.
- [ ] **Subir MOV intro** → mismo flow. Subir PNG → error `Only MP4 or MOV`,
      ningún POST.
- [ ] **Validación límites intro**: MP4 12s → error `Duration must be 1–10s`,
      ningún POST. MP4 60MB → error `File must be ≤50MB`, ningún POST.
- [ ] **Recargar página** → ambos chips se hidratan con duración del back;
      size desaparece (open item heredado del review 33).
- [ ] **Click Trash intro** → `DELETE /intro` → chip intro desaparece;
      outro intacto. Y viceversa.
- [ ] **Toggle Intro OFF + Save** → `PUT /defaults` con
      `intro_enabled: false`. Toggle ON + Save → `intro_enabled: true`.
      Misma idea con outro_enabled, no se mezclan.
- [ ] **Ingestar property** con `intro_enabled: true` + intro persistido y
      `outro_enabled: true` + outro persistido → el reel renderizado tiene:
      intro al inicio → fotos → outro al final.
- [ ] **Preview `<video src>` y auth**: si el back exige `Authorization` y
      el preview queda en blanco, pivotar a `defaultsApi.introDownload` con
      `URL.createObjectURL` (la pieza ya está en `api.js`).

## Notas

- **Sin nuevas deps** (TypeScript, React Query, MSW, styled-components,
  Tailwind, CSS-in-JS — blocklist respetada).
- **Componentes nunca llaman fetch directo** — `UploadVideoCard` →
  `useIntroUpload`/`useOutroUpload` (etc) → `defaultsApi.introUpload`/...
  → `apiRequest` en `lib/api/client.js`.
- **Sin `VITE_ADMIN_API_TOKEN`** ni ningún `VITE_*` con secretos.
- **Refactor seguro**: 21/21 outro tests verdes después del refactor.
  Los testIds y la API pública del componente se preservan; lo que cambió
  fueron los nombres de los hooks internos del componente (ahora por
  kind) y la deduplicación de la copy + validación.
