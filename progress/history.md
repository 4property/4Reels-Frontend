# Bitácora — sesiones anteriores

> Append-only. Cada cierre de sesión añade una entrada al final.
> Formato: `## YYYY-MM-DD — feature <id>: <name>`.

## 2026-05-06 - feature 2: align_music_endpoint_front_to_back

- **Resultado:** done (APPROVED por review local).
- **Archivos principales:** `src/features/music/{api.js,hooks.js,MusicConfig.jsx,MusicLibrary.jsx,MusicRules.jsx,music.css}`, `tests/support/mock-backend.js`, `tests/music.spec.js`, `DOCS.md`, `feature_list.json`.
- **Cambios clave:** Music consume `/v1/admin/agencies/{id}/music`; el mock Playwright sirve CRUD canonico; la UI lista, crea, edita y borra tracks con `music_id`.
- **Tests:** `npm run lint --silent`, `npm run build --silent`, `npm run test:smoke` (40 passed, 2 skipped), `npm run test:e2e` (43 passed, 2 skipped).
- **Documentos:** `progress/impl_2_align_music_endpoint_front_to_back.md`, `progress/review_2_align_music_endpoint_front_to_back.md`.

## 2026-05-06 - feature 3: resolve_session_me_endpoint

- **Resultado:** done (APPROVED por review cross-repo en back).
- **Archivos principales:** `src/features/session/api.js`, `src/features/session/SessionProvider.jsx`, `src/features/session/session.css`, `feature_list.json`.
- **Cambios clave:** eliminado `getCurrentUser` y la rama `ApiSessionProvider`; el provider raiz usa siempre `GhlMvpSessionProvider`; no quedan literales `/me` en `src/`.
- **Tests reportados:** `npm run lint`, `npm run build`, `npm run test:smoke` (40 passed, 2 skipped).
- **Documentos:** `progress/impl_3_resolve_session_me.md`, `../4reels back/progress/review_3_resolve_session_me.md`.

## 2026-05-07 - feature 5: frontend_admin_auth_lockstep

- **Resultado:** done (APPROVED por review cross-repo en `../4reels back/progress/review_5_frontend_admin_auth_lockstep.md`).
- **Archivos principales:** `src/lib/api/authToken.js` (nuevo), `src/lib/api/client.js`, `src/features/session/SessionProvider.jsx`, `tests/support/mock-backend.js`, `tests/admin_auth.spec.js` (nuevo, 9 passed), `.env.example`, `DOCS.md`, `feature_list.json`.
- **Cambios clave:** `apiRequest` adjunta `Authorization: Bearer <token>` cuando hay sesion autorizada; el `agency_token` que devuelve `POST /v1/sessions/gohighlevel/session` se persiste en `sessionStorage` (`4reels.adminBearer`) y se limpia al `reset()` y al recibir 401 en `/v1/admin/*`; admin-direct mode con input local super-admin oculto detras de `MVP_ADMIN_ENABLED` (sin `VITE_ADMIN_API_TOKEN`); banner especifico para 503 `AGENCY_AUTH_NOT_CONFIGURED`.
- **Cross-repo:** mirror de la feature 5 del back, que emite `agency_token`/`agency_token_expires_at` (HS256, scope `agency`, issuer `4reels-back`). Sin secretos en el bundle.
- **Tests reportados:** `npm run lint` verde, `npm run build` verde (gzip 103.53 kB), `npm run test:smoke` (40 passed, 2 skipped), `npx playwright test tests/admin_auth.spec.js` (9 passed). Back: `pytest -q` 416 passed, `apps.api --check` y `apps.worker --check` exit 0.
- **Documentos:** `progress/impl_5_frontend_admin_auth_lockstep_front.md`, `../4reels back/progress/impl_5_frontend_admin_auth_lockstep_back.md`, `../4reels back/progress/review_5_frontend_admin_auth_lockstep.md`.

## 2026-05-07 - feature 6: fix_frontend_backend_payload_contract

- **Resultado:** done (APPROVED por review cross-repo en `../4reels back/progress/review_6_fix_frontend_backend_payload_contract.md`).
- **Archivos principales:** `src/features/admin/{api.js,AgencyConfigDrawer.jsx}` (Sources `name`/`status` canonicos + `reconfigureAgencySource` PUT), `src/features/brand/BrandConfig.jsx` (4 campos canonicos + `font_family`, retira tagline/watermark/outro), `src/features/automation/{hooks.js,useAutomationSave.js (nuevo),AutomationConfig.jsx}` (PUT `/automation` solo con `approval_required` + window/days/trigger; hook compuesto que dispara `/automation` + `/defaults` con shallow-merge previo de `settings`), `src/features/defaults/{initialState.js,hooks.js,ReelDefaultsConfig.jsx}` (incluye `platforms` + 7 toggles namespaced en `defaults.settings`), `tests/support/mock-backend.js` (rechazo 422 con shape Pydantic-like), `tests/payload_contract.spec.js` (nuevo, 6 passed across desktop/tablet/mobile), `DOCS.md`, `.env.example` (LEGACY mark on `VITE_API_URL`/`VITE_USE_MOCK`), `feature_list.json`.
- **Cambios clave:** alineado del payload front<->back contra Pydantic `extra='forbid'`. Los 7 toggles huerfanos de Automation (`quietHours*`, `skipWeekends`, `autoCaptions`, `regenOnUpdate`, `reviewEmails`, `reviewWindow*`) y `platforms` se persisten en `defaults.settings` con keys namespaced (`automation.<key>`); UI sigue en la pantalla Automation. Brand elimina tagline/watermark/outro de UI y body. Sources `source_name`/`source_status` renombrados a `name`/`status`; editar usa `PUT /v1/admin/agencies/{id}/sources/{ingestion_source_id}`.
- **Cross-repo:** mirror de la feature 6 del back. La back-side anadio 18 casos de tests negativos parametrizados en `tests/integration/{configuration,ingestion}/` y mapeo `ingestionSourceId` en `test_http_surface_contract.py`. Cierre del contrato cross-repo iniciado por feature 4 de Phase 3.
- **Tests reportados:** `npm run lint` verde, `npm run build` verde (`built in 1.67s`), `npm run test:smoke` (40 passed, 2 skipped), `npx playwright test tests/payload_contract.spec.js` (6 passed, 19.4s). Back: `pytest -q` 434 passed (baseline 416 + 18 nuevos), `apps.api --check` y `apps.worker --check` exit 0.
- **Cierre Phase 4:** features 5 y 6 cerradas. Phase 4 DONE 2026-05-07.
- **Documentos:** `progress/impl_6_fix_frontend_backend_payload_contract_front.md`, `../4reels back/progress/impl_6_fix_frontend_backend_payload_contract_back.md`, `../4reels back/progress/review_6_fix_frontend_backend_payload_contract.md`.

## 2026-05-11 - config local: frontend -> backend test 4robert

- **Resultado:** configurado localmente.
- **Archivos principales:** `.env.local` (ignorado por git), `init.sh` (modo ejecutable), `progress/history.md`.
- **Cambios clave:** `VITE_MVP_API_URL` y fallback `VITE_API_URL` apuntan a `http://127.0.0.1:8001`; `VITE_USE_MOCK=false`; modo admin local sigue activo sin embeder bearer tokens. Se usa `127.0.0.1` para evitar ambiguedad `localhost`/IPv6.
- **Backend test:** `/opt/projects/4robert/.env` usa `WEBHOOK_PORT=8001` y `ADMIN_API_DISABLE_AUTH_FOR_TESTING=true`. Verificado `GET /health/live -> {"status":"ok"}` y `GET /v1/admin/agencies` devuelve 2 agencias.
- **Frontend dev:** Vite levantado con `npm run dev -- --host 0.0.0.0`; URL local `http://localhost:5173/`.
- **Tests/verificacion:** `./init.sh` verde tras hacer ejecutable el script; `curl http://127.0.0.1:5173/` devuelve el HTML de Vite.

## 2026-05-11 - bugfix: ghl custom page context error

- **Resultado:** bugfix implementado y verificado.
- **Archivos principales:** `src/features/session/ghlMvpContext.js`, `src/features/session/SessionProvider.jsx`, `tests/ghl_context.spec.js`.
- **Cambios clave:** el contexto cifrado de HighLevel conserva ahora el tipo de fallo de descifrado (`network` o `backend`); la pantalla Connect GoHighLevel muestra la guia de backend URL/CORS cuando el endpoint de decrypt no es alcanzable y reserva el aviso de `GO_HIGH_LEVEL_APP_SHARED_SECRET` para fallos HTTP del backend.
- **Contexto operativo:** `.env.local` apunta `VITE_MVP_API_URL` y `VITE_API_URL` a `http://127.0.0.1:8001`; en una custom page real de GHL ese host debe ser alcanzable desde el navegador que abre la pagina, o sustituirse por una URL publica HTTPS con CORS configurado.
- **Tests/verificacion:** `npm run lint`, `npm run build`, `npm run test:e2e -- tests/ghl_context.spec.js` (3 passed), `npm run test:smoke` (40 passed, 2 skipped), `./init.sh` final verde. Playwright requirio instalar Chromium localmente con `npx playwright install chromium`.
- **Seguimiento:** tras reproducir el mensaje real, se confirmo que el backend local no era visible desde el sandbox pero si habia una API real escuchando fuera de el como PID `177367` en `*:8001`; `GET /health/live` y `OPTIONS /v1/sessions/gohighlevel/context` responden correctamente. La UI se ajusto para no repetir dos veces el error bruto `Network/CORS error calling ...` cuando ya muestra la guia especifica de backend/CORS.

## 2026-05-12 — Feature 7 `pinterest_and_reels_cover_preview` cerrada

# Sesion actual

> Este archivo se vacia al cerrar cada sesion y se mueve a `history.md`.
> Mientras trabajas, **mantenlo actualizado en tiempo real**, no al final.

- **Feature en curso:** 7 `pinterest_and_reels_cover_preview`
- **Inicio:** 2026-05-12
- **Agente:** Codex

## Plan

- Añadir Pinterest a presets, defaults, límites y selector admin.
- Corregir las portadas de `/reels` para usar `featured_image_url` como imagen.
- Quitar la reproducción/carga del video mock en hover en tarjetas y tabla de reels.
- Verificar lint/build/smoke si el entorno lo permite.

## Bitacora

- `./init.sh` inicial verde: lint y build pasan; smoke no se ejecuta por el script.
- Se detecta la causa probable de la portada negra: `ReelCard` y `ReelsTable` pasan la URL en `kind`, pero `Cover` solo usa URLs reales por `src`; además `video="hover"` activa el mp4 mock.
- Pinterest añadido a presets de tenant, selector admin, defaults, límites de descripciones e icono.
- `/reels` usa ahora `Cover src={featured_image_url}` en cards y tabla, sin `video="hover"`.
- Se añade smoke Playwright que comprueba portada real y cero requests a `/assets/property/reel.mp4` en hover.
- Verificación final:
  - `./init.sh` verde.
  - `npm run test:smoke` verde: 43 passed, 2 skipped.

## Proximo paso

Pendiente review/cierre formal de feature.

## 2026-05-12 — Feature 11 `unescape_html_entities_everywhere` cerrada

# Sesion actual

> Este archivo se vacia al cerrar cada sesion y se mueve a `history.md`.
> Mientras trabajas, **mantenlo actualizado en tiempo real**, no al final.

## Feature en curso

`11 — unescape_html_entities_everywhere` (status: in_progress)

## Plan

- Crear `src/shared/decodeHtmlEntities.js` (vanilla, sin DOMParser ni
  deps nuevas: regex para entidades numericas decimales/hex + tabla
  pequena de named entities relevantes para titulos WP).
- Aplicar la utilidad al pintar `title` en:
  - `src/features/reels/ReelCard.jsx:46`
  - `src/features/reels/ReelsTable.jsx:48`
  - `src/features/reels/editor/ReelEditor.jsx:317`
  - `src/features/reels/Dashboard.jsx:28` (filtro de busqueda) y donde
    sea relevante.
- Tests unit en `tests/unit/decodeHtmlEntities.unit.js` con `node --test`
  (>=10 casos: numerica decimal, numerica hex, named comunes `&amp;`,
  `&lt;`, `&gt;`, `&quot;`, `&apos;`, `&nbsp;`, mezcla, no-strings,
  cadenas vacias, doble decode `&amp;#8217;`, paso por verbatim si no
  hay entidades, unicode astral via `&#128512;`).

## Feature dir

`src/shared/` (utilidad pura) y `src/features/reels/` (consumidores).

## Toca el mock?

No. La utilidad es puro string→string en el cliente; no hay endpoint
ni handler nuevo.

## Decision tecnica

- Elegida la opcion (b) recomendada por el brief: regex + tabla
  basica de named entities. Razon: `DOMParser` no esta disponible en
  Node `--test` sin `jsdom`/`linkedom`, y la regla del proyecto
  prohibe instalar deps sin permiso del leader. Una funcion pura es
  trivialmente testable en Node, y la cobertura de entidades que
  necesita WordPress (`&#8217;`, `&amp;`, `&#039;`, `&quot;`, etc.)
  cabe sin problema en una tabla pequena.
- La utilidad es idempotente para strings ya decodificados (no hay
  entidades que decodificar → devuelve la cadena tal cual).
- Manejo defensivo: si el input no es string, lo devuelve tal cual
  (ningun consumidor depende de coercion).

## 2026-05-12 — Feature 8 `agency_default_descriptions_ui` cerrada

# Sesion actual

> Este archivo se vacia al cerrar cada sesion y se mueve a `history.md`.
> Mientras trabajas, **mantenlo actualizado en tiempo real**, no al final.

## Feature en curso: 8 — agency_default_descriptions_ui

UI de descripciones por defecto por plataforma en el AgencyConfigDrawer.

### Plan

- Anadir subtab "Descriptions" al AgencyConfigDrawer.
- Crear `src/features/admin/DefaultDescriptionsPanel.jsx` que carga
  GET `/v1/admin/agencies/{id}/social-templates` y guarda con PUT.
- Reutilizar `socialApi` existente (`features/social/api.js`) para no
  duplicar el path canonico.
- Actualizar `tests/support/mock-backend.js` para que `/social-templates`
  devuelva el shape canonico `{agency_id, templates, items, count}` en
  lugar del shape generico actual.
- Anadir smoke Playwright cubriendo el round-trip GET + PUT.

### Feature dir

- `src/features/admin/` (nuevo `DefaultDescriptionsPanel.jsx` + edit
  drawer).
- `src/features/social/` (read-only: reuso de `socialApi`).
- `src/features/admin/admin.css` (estilos del panel).
- `tests/support/mock-backend.js` (handler con shape canonico).
- `tests/social_templates.spec.js` (smoke nuevo).

### Toca el mock?

Si — el handler de `/v1/admin/agencies/{id}/social-templates` ya existe
pero devolvia el shape generico (`{agency_id, brand:null, ..., templates:{}, ...}`).
Lo divido en un handler dedicado que devuelve el shape canonico del back:
- GET: `{agency_id, templates: {platform: descriptionString}, items: [...], count}`
- PUT: `{status:'saved', agency_id, templates, items, count}`

### Decisiones

1. **Componente**: nuevo `<DefaultDescriptionsPanel>` montado por el
   drawer. Consistente con la separacion del drawer (un panel por subtab),
   evita engordar AgencyConfigDrawer.jsx que ya pasa de 1000 lineas.
2. **API**: reutilizo `socialApi` de `features/social/api.js` — ya tiene
   `getSocialTemplates(agencyId)` y `saveSocialTemplates(agencyId, templates)`.
   Cross-feature import (admin -> social) ya hay precedente en
   `automation/useAutomationSave.js -> defaults/api.js`.
3. **Hook**: NO uso `useSocialTemplates`/`useSaveSocialTemplates` de
   `features/social` porque esos leen `agencyId` de la sesion via
   `useCurrentAgencyId`, y en el drawer admin la agencia viene por prop
   (no de la sesion). Sigo el patron imperativo de los demas paneles del
   drawer (useState + useEffect + llamada directa a la api).
4. **Plataformas**: incluyo las 7 (las 6 de la spec + pinterest).
   Pinterest ya esta presente en el resto del drawer (ALL_PLATFORMS line 567)
   y el back acepta keys arbitrarias (`templates: dict[str, str]`).
   Mantener consistencia con feature 7 cerrada.
5. **Variables permitidas**: hint visual con la lista del catalogo
   `STATIC_VARIABLES` de TenantProvider (13 placeholders). Al estar el
   admin drawer fuera del SessionProvider del tenant, repito la lista
   inline en el panel para no anadir dependencias raras. La fuente de
   verdad real esta en el back (`content_generator.py`); marco como
   "TODO sync con back" en `impl_8`.

## 2026-05-13 — Feature 9 `agency_logo_upload` cerrada (con fix post-impl: contrato delete = "" no null)

# Sesion actual

> Este archivo se vacia al cerrar cada sesion y se mueve a `history.md`.
> Mientras trabajas, **mantenlo actualizado en tiempo real**, no al final.

## Feature en curso: 9 — `agency_logo_upload`

**Estado**: in_progress

### Plan

- Anadir endpoint `POST /v1/admin/agencies/{id}/brand/logo` (multipart) al cliente front (`brandApi.uploadLogo`) y al stub Playwright de `tests/support/mock-backend.js` con shape `{object_key, url}`.
- Extender `apiRequest` en `src/lib/api/client.js` con soporte opt-in para `FormData` (sin tocar el comportamiento JSON por defecto): si `body instanceof FormData`, no se serializa y no se anade `Content-Type` (boundary lo pone el browser).
- Crear `src/features/brand/LogoUploader.jsx` (componente nuevo) + estilos en `brand.css` con file picker (`accept="image/jpeg,image/png"`), validacion cliente (max 5 MB, MIME jpg/png), preview, estados loading/error/success y boton "Remove logo".
- Cablear en `BrandConfig.jsx`: sustituir el bloque disabled (linea 156-164) por `<LogoUploader currentLogoUrl=... onUpload=... onRemove=...>`. Tras upload exitoso, guardar `logo_object_key` en estado y disparar `save` con el resto del payload de Brand. Tras remove, set `logo_object_key = null` en el siguiente PUT.
- Smoke nuevo `tests/brand_logo_upload.spec.js`: upload (file chooser -> preview visible -> object_key persistido) + remove (PUT con `logo_object_key: null` y vuelta al placeholder).

### Feature dir: `src/features/brand/`

### Toca el mock?: si (handler multipart logo en `tests/support/mock-backend.js`)

Endpoints anadidos al stub Playwright:

- `POST /v1/admin/agencies/{id}/brand/logo` (multipart/form-data, campo `file`)
  -> 200 `{object_key: string, url: string}`.

El stub `PUT /v1/admin/agencies/{id}/brand` existente ya acepta cualquier payload sin keys prohibidas; `logo_object_key: null` no esta en `FORBIDDEN_KEYS.brand` y por tanto pasa.

## 2026-05-13 — Feature 10 `wire_automation_publish_window_to_ghl_schedule` cerrada (cierre del batch Phase 4)

# Sesion actual

> Este archivo se vacia al cerrar cada sesion y se mueve a `history.md`.
> Mientras trabajas, **mantenlo actualizado en tiempo real**, no al final.

## Feature en curso: 10 — wire_automation_publish_window_to_ghl_schedule

Indicador de próximo slot programado tras aprobar reel. El backend amplía
la respuesta del POST `/approve` con un campo `scheduled_at` (ISO8601
UTC o `null`). Si llega no-nulo, el ReelEditor muestra
"Publicará el dd/mm/yyyy a las HH:MM" en TZ local del browser. Si es
`null`/missing, el mensaje sigue siendo "Reel approved." (comportamiento
actual).

## Plan

- Crear helper puro `src/shared/formatScheduledAt.js` (vanilla, sin libs)
  que recibe ISO8601 UTC y devuelve `"dd/mm/yyyy a las HH:MM"` en TZ
  configurable (default: TZ local del browser). Para tests
  reproducibles, expone un parámetro `timeZone` explícito.
- Edge cases del helper: `null`/`undefined` → `null`; empty string →
  `null`; ISO inválido → `null`. No tira excepciones.
- Editar `src/features/reels/editor/ReelEditor.jsx` `handleApprove`:
  preferir `result.scheduled_at` (si no-nulo) para construir el mensaje
  "Publicará el dd/mm/yyyy a las HH:MM"; fallback al copy actual
  ("Reel approved." o el de idempotent replay).
- Extender el mock de `tests/support/mock-backend.js` con un handler
  para `POST /v1/admin/agencies/.../reels/.../approve` que devuelva
  `scheduled_at` cuando el test lo pida (`options.approveScheduledAt`).
- `tests/reel_approve_schedule.spec.js` (nuevo): caso A approve con
  `scheduled_at` → banner con fecha formateada. Caso B approve sin
  `scheduled_at` → banner "Reel approved." (regresión).
- `tests/unit/formatScheduledAt.unit.js` (nuevo, `node --test`) con 8+
  casos: ISO válido (TZ UTC), null, undefined, '', ISO inválido,
  edge cases de TZ (Europe/Dublin), formato exacto (zero-pad).

## Feature dir

`src/features/reels/editor/` + `src/shared/`.

## ¿Toca el mock?

Sí. Añade handler `POST /v1/admin/agencies/{id}/reels/{site}/{prop}/approve`
con respuesta `{ status, scheduled_at? }`. Opt-in para tests via
`installMockBackend(page, { approveScheduledAt: "2026-05-15T09:00:00Z" })`.

## Decisiones tomadas

1. **TZ del display**: TZ local del browser (default) para que el admin
   vea la hora "como si fuera de Dublín" cuando trabaja desde Dublín.
   El helper acepta `timeZone` explícita en tests para reproducibilidad.
2. **Helper en `shared/`** (no inline en el componente): el unit test
   con `node --test` necesita importarlo aislado de React.
3. **Copy en español**: "Publicará el {fecha} a las {hora}." mantiene el
   resto de la app en español (mensajes admin/sources/automation).
4. **Idempotent replay**: si la respuesta lleva `idempotent_replay: true`
   y también `scheduled_at`, prevalece `scheduled_at`. Si lleva
   `idempotent_replay: true` y `scheduled_at` es null, conserva el copy
   actual "Reel already approved, publish in progress.".

## Estado

In progress. Se reportará `done -> ...` para que el reviewer audite.

## 2026-05-13 — feature 12: approve_button_label_and_drop_publish_stub

- **Resultado:** done (APPROVED por reviewer local).
- **Origen de la tarea.** El usuario reportó que el botón "Publish" del
  editor aparece desactivado tras configurar `approval_required=true`. El
  diagnóstico (ver `progress/explore_backend_approve_publish.md`) confirmó
  que el backend ya publica al recibir `POST /approve` — el "bug" era un
  malentendido de UX: dos botones que sugerían dos pasos cuando en realidad
  "Approve" hace los dos.
- **Decisión de scope (leader).** No tocar backend; cambio sólo en
  frontend: renombrar el botón a "Approve & Publish" y eliminar el stub
  coming-soon que confunde. Tweak en 1 componente, escalado mínimo:
  1 implementer + 1 reviewer, sin explorers (no toca componentes
  compartidos).
- **Archivo único modificado.** `src/features/reels/editor/ReelEditor.jsx`
  (EditorHeader).
- **Documentos:**
  - `progress/explore_backend_approve_publish.md` (diagnóstico).
  - `progress/impl_12_approve_button_label_and_drop_publish_stub.md` (implementer).
  - `progress/review_12_approve_button_label_and_drop_publish_stub.md` (reviewer, Veredicto: APPROVED).

## 2026-05-13 — feature 13: fix_mojibake_in_source_files

- **Resultado:** done (APPROVED por reviewer local).
- **Origen de la tarea.** El usuario reportó símbolos raros en la UI
  (placeholder de búsqueda, kbd hint, separadores, fallbacks del editor,
  samples de TenantProvider). Tras descartar HTML-entity decoding (ya
  cubierto por feature 11), el diagnóstico encontró UTF-8 doblemente
  codificado (latin1↔utf-8) en múltiples archivos `.jsx`/`.js`.
- **Decisión de scope (leader).** 13 archivos, 38 ocurrencias en 11
  patrones conocidos. Fix por reemplazos explícitos por pares (no
  encode-blind del archivo entero) para no corromper caracteres UTF-8
  ya correctos. Sin tocar backend. 1 implementer + 1 reviewer.
- **Archivos modificados.** 11 en `src/` (incluye
  `src/app/Topbar.jsx`, `src/app/Shell.jsx`,
  `src/app/providers/TenantProvider.jsx`,
  `src/features/admin/AdminView.jsx`,
  `src/features/reels/editor/ReelEditor.jsx`) y 2 en `tests/`.
- **Cambios clave.** Caracteres restaurados a su forma correcta:
  `—` (em dash), `…` (ellipsis), `'` (right single quote), `·`
  (middle dot), `€` (euro), `≤` (less-or-equal), `→` (right arrow),
  `⌘` (command), `✔` (check). Todos los archivos siguen siendo UTF-8
  válido; sin cambios de lógica ni indentación.
- **Tests/verificación.** `grep -rn -P 'â€|Â·|â‚¬|â‰¤|â†|âŒ˜|âœ' src/ tests/`
  → 0 hits. `./init.sh` verde. `npm run test:smoke` 43 passed, 2
  skipped, 0 fail.
- **Documentos:**
  - `progress/explore_mojibake_inventory.md` (inventario de 13 archivos
    y 38 ocurrencias).
  - `progress/impl_13_fix_mojibake_in_source_files.md` (implementer).
  - `progress/review_13_fix_mojibake_in_source_files.md` (reviewer,
    Veredicto: APPROVED).

## 2026-05-13 — feature 14: map_backend_publish_status_values

- **Resultado:** done (APPROVED por reviewer local).
- **Origen de la tarea.** El usuario reportó que en `/reels` un reel en
  `pending_review` no mostraba forma de publicarlo. Diagnóstico: drift de
  contrato entre backend (`publish_reel.py:225` usa
  `publish_status="pending_review"`) y frontend (`publishStatus.js:23`
  solo mapeaba `awaiting_review`). Cuando llegaba `pending_review` no se
  traducía a `needs-approval` y `ReelCard.jsx:54` / `ReelEditor.jsx:318`
  no renderizaban los botones Approve/Reject.
- **Decisión de scope (leader).** Aceptar `pending_review` (manteniendo
  `awaiting_review` por compatibilidad) y aprovechar para cubrir
  `pending_publish` (badge `Publishing…`) y `skipped` (badge `Skipped`).
  Añadir test unit nuevo de mapeo. Sin tocar backend. 1 implementer +
  1 reviewer, sin explorers.
- **Archivos modificados.** `src/features/reels/publishStatus.js`,
  `src/shared/StatusBadge.jsx`,
  `src/features/admin/AgencyConfigDrawer.jsx`, y nuevo
  `tests/unit/publishStatus.unit.js` (14 casos cubriendo valores reales,
  alias legacy, fallback a `workflow_state`, fallback a `'pending'` y
  case-insensitivity).
- **Tests/verificación.** `./init.sh` verde.
  `node --test tests/unit/publishStatus.unit.js` 14/14.
  `npm run test:smoke` 43 passed, 2 skipped (theme tests pre-existentes).
  `ReelCard.jsx` / `ReelEditor.jsx` / `Dashboard.jsx` siguen comparando
  contra `'needs-approval'` (sin cambios).
- **Documentos:**
  - `progress/impl_14_map_backend_publish_status_values.md` (implementer).
  - `progress/review_14_map_backend_publish_status_values.md` (reviewer,
    Veredicto: APPROVED).

## 2026-05-13 — feature 15: templates_tab_agency_render_template_selection

**Resultado:** done (reviewer approve).

- Nueva tab `/templates` agency-only en `src/app/pages.js` + Shell, con
  `requires: { module: 'brand' }` (visible solo para agency_user).
- `src/features/templates/` (api.js, hooks.js, TemplatesPage.jsx, index.js)
  + `src/styles/templates.css`. Cableado a los endpoints ya existentes en
  back:
  - `GET /v1/admin/agencies/{id}/render-templates`
  - `PUT /v1/admin/agencies/{id}/render-template`
- Mock canónico en `tests/support/mock-backend.js` (≥2 plantillas con
  preview_images). Test Playwright dedicado `tests/templates.spec.js`.
- `DOCS.md` § "Backend contract" documenta los dos endpoints.
- Desviación documentada: `src/lib/api/mock/handlers/` ya no existe en
  el repo; la spec del back vive en `mock-backend.js` + `DOCS.md`.
- Verificación: `./init.sh` verde, `npm run test:smoke` 46 passed/2
  skipped, `npx playwright test templates --project=desktop` 1/1 pass.
- Informes: `progress/impl_templates_tab.md`,
  `progress/review_templates_tab.md`.

**Pendiente (no esta sesión):** los micro-fixes de ReelCard/hooks.js
descritos en `progress/explore_price_and_socialdot.md` siguen pendientes.

## 2026-05-13 — feature 16: automation_scheduling_ui_hold_quiet_skip

**Resultado:** done (reviewer APPROVED).

- **Feature activa:** 16 — `automation_scheduling_ui_hold_quiet_skip`.
- **Inicio:** 2026-05-13.
- **Dependencia desbloqueada:** backend feature 13 estaba `done`.
- **Plan de referencia:** `progress/plan_automation_scheduling_ui.md`.
- **Informe implementer:** `progress/impl_16_automation_scheduling_ui_hold_quiet_skip.md`.
- **Informe reviewer:** `progress/review_16_automation_scheduling_ui_hold_quiet_skip.md`.

### Plan de ejecución (implementer)

1. Releer plan + AGENTS + arquitectura + tests existentes.
2. Auditar consumidores de `AUTOMATION_SETTINGS_KEYS` y de hidratación.
3. Editar `src/features/automation/AutoPublishDetails.jsx`: time-pickers quiet hours, eliminar texto "22:00 → 07:00".
4. Editar `hooks.js:buildAutomationBody`: mapping hold/quiet/skip al body PUT.
5. Editar `AutomationConfig.jsx`: hidratar desde `automation` no de defaults.
6. Editar `useAutomationSave.js`: quitar claves automation.* de mergedSettings.
7. Limpiar `initialState.js` (drop de las 4 claves migradas).
8. Mock-backend: quitar FORBIDDEN_KEYS de automation; persistir hold/quiet/skip; mirror reducido de `compute_next_publish_slot` para computar `scheduled_at`.
9. Extender `tests/reel_approve_schedule.spec.js` con caso "hold 1h" + viewport forzado en los 3 tests del fichero.
10. Nuevo `tests/automation_scheduling.spec.js` (3 casos con clock mock).
11. Actualizar `tests/payload_contract.spec.js` para verificar la nueva ubicación de las claves.
12. Actualizar `DOCS.md §Automation`.
13. `npm run lint && npm run build && npm run test:smoke` + playwright specs específicos + e2e completo.
14. Escribir informe en `progress/impl_16_automation_scheduling_ui_hold_quiet_skip.md`.
15. Reviewer.

### Verificación final ejecutada

- `./init.sh` → verde (lint + build).
- `npm run test:smoke` → 46 passed, 2 skipped (theme pre-existente).
- `npx playwright test tests/reel_approve_schedule.spec.js tests/automation_scheduling.spec.js` → 18 passed (6 × 3 viewports).
- `npx playwright test tests/payload_contract.spec.js` → 6 passed.
- `npm run test:e2e` → 100 passed, 2 skipped.
- `node --test tests/unit/*.js` → 49 passed.
- `grep -rnE '\bfetch\s*\(' src/features/automation` → 0 hits.

### Decisiones

- El mock-backend computa ahora `scheduled_at` (mirror reducido de
  `compute_next_publish_slot`) usando el clock pinned de la página
  (`page.clock.setFixedTime`) más las reglas seedeadas vía
  `installMockBackend({ automationRulesByAgency })`. El opt-in
  explícito (`approveScheduledAt`) sigue funcionando.
- `quietHoursStart` / `quietHoursEnd` representan el rango
  **silencioso** (ej. 22:00 → 07:00). En el wire los invierto a
  `publish_window_start` / `publish_window_end` (07:00 → 22:00) para
  alinear con la semántica del back.
- Mantengo `auto_captions`, `regen_on_update`, `review_emails` como
  antes en `defaults.settings`; sólo migran hold/quiet/skip + los
  legacy `review_window_*`.
- Aplico `viewport: 1280×800` explícito en los 6 tests del editor
  para esquivar una fragilidad pre-existente del layout en tablet
  768px (preview-col intercepta el botón Approve del header).
- `page.clock.setFixedTime` en vez de `pauseAt`: este último congela
  setTimeout/rAF y deja el editor atascado en "loading".

## HOTFIX 2026-05-14 — Brand logo preview & remove (segundo hotfix del día)

**Petición**: "en /brand subo una imagen del logo pero no puedo ver la preview del logo que he subido, ademas tampoco me deja quitar el logo para poner el logo por defecto que vendria del webhook".

**Diagnóstico**: dos bugs encadenados por la asunción rota de que `GET /brand` devuelve `logo_url` (no lo hace, sólo `logo_object_key`). El stream `/brand/logo/file/{filename}` requiere `Authorization: Bearer`, así que poner la URL relativa como `<img src>` no funcionaba — el browser no manda headers de auth y la ruta resuelve contra el host del front.

**Cambios**:
- `src/lib/api/client.js`: añadido `apiFetchBlob(path)` (misma resolución que `apiRequest` pero devuelve Blob para endpoints binarios protegidos).
- `src/features/brand/api.js`: añadido `brandApi.downloadLogo(agencyId, objectKey)` que extrae el filename del `agencies/{safe}/{filename}` y golpea el stream con auth.
- `src/features/brand/LogoUploader.jsx`: reescrito el lifecycle del preview. Ahora acepta `logoObjectKey` (no `currentLogoUrl`), hace fetch+blob con `URL.createObjectURL`, revoca al desmontar, mantiene `localPreview` hasta que el resolved-fetch reemplaza (sin flicker). `hasLogo` y `canRemove` basan en `logoObjectKey` además de blobs locales, así que el botón Remove aparece siempre que hay logo persistido.
- `src/features/brand/BrandConfig.jsx`: quitado `logoUrl` state; pasa `logoObjectKey` al `IdentityCard` → `LogoUploader`.
- `tests/support/mock-backend.js`: handler nuevo para `GET .../brand/logo/file/{filename}` (PNG 1×1 transparente) y patrón en `isKnownAdminStub`.
- `tests/brand_logo_upload.spec.js`: aserciones actualizadas para `blob:` URL y regresión de `Authorization: Bearer` en el GET al stream.

**Verificación**: `npm run lint` + `npm run build` verdes (379.31 kB JS, 119.69 kB CSS); `npx playwright test tests/brand_logo_upload.spec.js` 6/6; `npm run test:smoke` 46 passed / 2 skipped (theme pre-existente).

**Notas**: el cambio toca `src/lib/api/client.js` (cross-feature), correcto porque cualquier endpoint binario protegido futuro reusará `apiFetchBlob`. `DOCS.md §Brand logo upload` aún describe `url` en la respuesta del POST (correcto pero ya no se usa en el front); decisión del back si se deprecia.

## HOTFIX 2026-05-14 — ReelEditor abre Subtitles por defecto

**Petición**: "en /reels al hacer click en un reel concreto en lugar de aparecer primero la pestaña de photos aparezca primero la de subtitles".

**Cambios** en `src/features/reels/editor/ReelEditor.jsx`:
- Línea 103: `useState('photos')` → `useState('subtitles')`.
- Línea 48 (TABS): elimino `stub: true` de la entrada `subtitles` (el panel ya está plenamente funcional; `editor.css:307` habría dejado la pestaña por defecto al 70% de opacidad).

El orden visual de las pestañas en el tab bar se mantiene (Photos | Subtitles | Descriptions | Slides | Voiceover); solo cambia cuál arranca seleccionada.

**Verificación**: `npm run lint` verde; `npm run build` verde (378.40 kB JS, 119.69 kB CSS, 2.26s); `npm run test:smoke` 46 passed / 2 skipped. Ningún test asumía Photos como pestaña activa por defecto.

## 2026-05-14 — feature 18: social_templates_ui_close_gaps

**Resultado:** done (reviewer APPROVED, con 1 `fyi` no bloqueante aplicado al cerrar).

- **Archivos principales:**
  - `src/features/social/constants.js` (nuevo) — fuente única `ALLOWED_SOCIAL_TEMPLATE_VARIABLES` (16 keys) + `SOCIAL_TEMPLATE_VARIABLE_PATTERN`.
  - `src/features/social/index.js` — re-exporta la constante y la regex.
  - `src/app/providers/TenantProvider.jsx` — `STATIC_VARIABLES` derivado de la constante canónica vía `VARIABLE_SAMPLES`. Añadidos samples para `neighborhood_tag`, `agent_email`, `property_url`.
  - `src/features/social/SocialConfig.jsx` — `data-testid="social-template-textarea"` para selectores estables.
  - `tests/support/mock-backend.js` — `handleSocialTemplates` valida cada `description_template` con la regex canónica y devuelve 422 + `{error:'SOCIAL_TEMPLATE_UNKNOWN_VARIABLE', details:{platform:[var,...]}}` cuando hay variables desconocidas.
  - `tests/social_templates.spec.js` — 3 tests nuevos: (a) save con `{{nonexistent_var}}` → banner con código del backend, (b) > 2200 chars en instagram → contador con clase `over`, (c) las 3 nuevas variables aparecen como chips clicables que insertan `{{var}}` en el textarea.

- **Hallazgo fyi del reviewer + fix aplicado al cerrar:** el sample de `neighborhood_tag` se había puesto como `#cranfordcourt`, pero el backend lo rellena sin `#` (slug plano, ver `modules/reels/application/content_generator.py:74-76`). Cambiado a `cranfordcourt` en `TenantProvider.jsx:36` para que el preview de la chip refleje exactamente lo que rinde la variable. El usuario que quiera un hashtag escribe `#{{neighborhood_tag}}` en su template.

- **Verificación ejecutada al cierre:**
  - `npm run lint` → verde.
  - `npm run build` → verde.
  - `npm run test:smoke` → 46 passed, 2 skipped (theme preexistentes).
  - `npx playwright test tests/social_templates.spec.js` → 15 passed (feature 8: 2 × 3 viewports + feature 18: 3 × 3 viewports).

- **Documentos:**
  - `progress/impl_18_social_templates_ui_close_gaps.md` (implementer).
  - `progress/review_18_social_templates_ui_close_gaps.md` (reviewer, APPROVED).

## 2026-05-14 — feature 20: social_templates_ui_hashtags_and_title

- **Resultado:** done (reviewer APPROVED).
- **Archivos principales:**
  - `src/features/social/constants.js` — `HASHTAG_PATTERN = /^#[\w-]{1,50}$/` y `MAX_HASHTAGS_PER_PLATFORM = 30`.
  - `src/features/social/api.js` — `saveSocialTemplates` passthrough (acepta string legacy y objeto rico).
  - `src/features/social/hooks.js` — `useSocialTemplates` pivota `data.items[]` a `richTemplates: {platform: {description_template, title_template, hashtags}}`.
  - `src/features/social/SocialConfig.jsx` — input `title_template` + `HashtagsEditor` (chips con Enter/coma/espacio, normalisation, dedup, cap 30).
  - `src/features/social/styles.css` — `.template-title-input`, `.hashtag-editor`, `.hashtag-chip{,-label,-remove}`, `.hashtag-input`, `.hashtag-error`.
  - `tests/support/mock-backend.js` — `handleSocialTemplates` acepta ambos shapes, valida hashtags (regex + cap 30) con 422 `SOCIAL_TEMPLATE_INVALID_HASHTAG`, mantiene 422 `SOCIAL_TEMPLATE_UNKNOWN_VARIABLE` con shape mixto flat/nested; `serializeSocialTemplates` emite `items[]` con los 3 campos y `templates{}` legacy description-only.
  - `tests/social_templates.spec.js` — 5 tests nuevos × 3 viewports.
- **Cambios clave:** el editor `/social` añade input `title_template` (1 línea, opcional) y chip editor de hashtags por red junto al textarea de descripción. El PUT pasa al shape rico `{templates:{platform:{description_template, title_template, hashtags[]}}}` que el back acepta nativamente (feature 20 back ya desplegada); el hook hidrata los 3 campos desde `items[]` y descarta `templates{}` legacy. El mock-backend valida hashtags (regex + cap 30) replicando los 422 reales del back.
- **Tests reportados:**
  - `npm run lint` → verde.
  - `npm run build` → verde (CSS 122.00 kB gzip 29.99 kB).
  - `npm run test:smoke` → 46 passed / 2 skipped (theme preexistentes).
  - `npx playwright test tests/social_templates.spec.js` → 30/30 passed (10 × 3 viewports) en la corrida del reviewer.
- **Documentos:**
  - `progress/impl_20_social_templates_ui_hashtags_and_title.md` (implementer).
  - `progress/review_20_social_templates_ui_hashtags_and_title.md` (reviewer, APPROVED).

## 2026-05-14 — feature 21: per_reel_description_override_ui

- **Resultado:** done (APPROVED por review local en `progress/review_21_per_reel_description_override_ui.md`).
- **Archivos principales:**
  - `src/features/reels/api.js` (nuevo verb `patchReelDescriptions`).
  - `src/features/reels/hooks.js` (`useReelDescriptionsOverride` + `useReel` expone `descriptionsOverride`, `publishDescriptionsSnapshot`, `rawPublishStatus`).
  - `src/features/reels/publishStatus.js` (`EDITABLE_PUBLISH_STATUSES` + `isPublishStatusEditable`).
  - `src/features/reels/editor/DescriptionsPanel.jsx` (reescritura: panel editable por red, contador, Save por red + Save all + Reset, banner read-only, feedback success/warning/danger).
  - `tests/support/mock-backend.js` (handler PATCH `.../descriptions` con 404/409/422 + `enabledPlatformsByAgency`).
  - `tests/reel_descriptions_override.spec.js` (nuevo, 4 casos × 3 viewports = 12).
- **Cambios clave:** pestaña Descriptions del ReelEditor pasa a panel editable por red con hidratación de precedencia override → snapshot → '' (mimetiza el worker del back). PATCH al path tupla `agency_id/site_id/source_property_id` con shape `{descriptions_by_platform: {...}}`. Mitigación del replace TOTAL del back: `buildPayload` parte de los overrides persistidos y solo modifica encima las plataformas tocadas (subset payload). Read-only + banner cuando `publish_status` no está en los 4 estados editables; manejo diferenciado de 409 `REEL_NOT_EDITABLE` (danger) y 422 `PLATFORM_NOT_ENABLED` (warning con nombre de plataforma).
- **Tests reportados:**
  - `npm run lint` → verde.
  - `npm run build` → verde.
  - `npm run test:smoke` → 46 passed / 2 skipped (theme preexistentes).
  - `npx playwright test tests/reel_descriptions_override.spec.js` → 12/12.
  - `npx playwright test tests/reel_approve_schedule.spec.js` → 9/9 (sin regresiones).
- **Documentos:**
  - `progress/impl_21_per_reel_description_override_ui.md` (implementer).
  - `progress/review_21_per_reel_description_override_ui.md` (reviewer, APPROVED).

## 2026-05-14 — feature 22: agency_music_upload (front + cross-repo close)

- **Resultado:** done (APPROVED por review local; cross-repo manual contra back deployado verificado por el leader).
- **Archivos principales:** src/features/music/, tests/support/mock-backend.js, tests/playwright/music_upload.spec.js, tests/playwright/fixtures/, tests/music.spec.js.
- **Cambios clave:** form de alta sustituido por file picker multipart (uploadTrack + useUploadTrack); mock-backend con handler POST /music/upload, GET /music/{id}/file/{filename}, 405 para POST metadata-only. Listado preserva la columna duration_seconds read-only.
- **Verificación cross-repo:** back feature 22 deployada en :8001 (PID 2295779 API, 2295780 worker). curl multipart con tiny.mp3 (4.4 KiB) → 201 con shape idéntico al mock; metadata-only POST → 405; GET stream con filename correcto → 200 audio/mpeg; filename incorrecto → 404 MUSIC_TRACK_FILE_NOT_FOUND; cross-agency → 404 MUSIC_TRACK_NOT_FOUND.
- **Tests reportados:** init.sh ✅, test:smoke 46/2 skipped, music_upload.spec.js 3/3, music.spec.js 3/3, test:e2e 127 passed / 2 skipped.
- **Follow-ups:** #S1 (alinear `agency_id` en mock con back) INVALIDADO — el back sí incluye `agency_id` dentro de `music_track`. #F2 (flake `templates.spec.js`) observacional, no reproducible. #F1 cerrado en el delta de la 2ª pasada.
- **Documentos:** progress/impl_22_agency_music_upload.md (con anexo 2ª pasada), progress/review_22_agency_music_upload.md (con anexo 2ª pasada).

## 2026-05-14 — feature 23: wire_render_to_agency_music_tracks_noop_front

- **Resultado:** done (noop frontend; verificación manual cross-repo OK).
- **Archivos principales:** ninguno (feature no-op).
- **Cambios clave:** el backend feature 23 reorienta `resolve_background_audio_paths` a leer `agency_music_tracks` y seedea 4 NCS por agencia (existentes vía Alembic migration 20260514_0005; nuevas vía hook en RegisterAgencyUseCase). El frontend ya consumía el contrato actual de `/music`, no requiere cambios de código.
- **Verificación cross-repo:** POST `/v1/admin/agencies` (Music Seed Smoke) → GET `/v1/admin/agencies/{id}/music` devuelve count:4, todos `is_default:true`, `object_key` bajo `agencies/{id}/music/_seed_ncs_*.mp3`, `display_name` limpio (Apart, NCS Default, Silence, Underrated), `duration_seconds` derivado por ffprobe (142, 187, 207, 222s).
- **Documentos:** `/opt/projects/4Reels-Backend/progress/impl_23_wire_render_to_agency_music_tracks.md`, `/opt/projects/4Reels-Backend/progress/review_23_wire_render_to_agency_music_tracks.md`.

## 2026-05-14 — feature 24: agency_music_selection_rules (front + cross-repo close)

- **Resultado:** done (APPROVED por review local; back deployado en :8001).
- **Archivos principales:** src/features/music/MusicRules.jsx, src/features/defaults/* (hidratación), tests/support/mock-backend.js (handler /defaults extendido), tests/playwright/music_rules.spec.js (nuevo).
- **Cambios clave:** Toggle "Fall back to full library" conectado; lee/persiste settings.music.selection_rules.fallback_to_full_library; deep-merge defensivo preserva hermanas en settings.music.*; mock-backend rechaza claves desconocidas con 422 extra_forbidden para paridad con el back.
- **Tests reportados:** lint/build verdes, test:smoke 46/2 skipped, music_rules.spec.js 3/3 viewports, payload_contract 6/6, no regresiones en music/automation/upload.
- **Documentos:** progress/impl_24_agency_music_selection_rules.md, progress/review_24_agency_music_selection_rules.md.

## 2026-05-14 — feature 25: per_reel_music_override (front + cross-repo close)

- **Resultado:** done (APPROVED por review local; back deployado en :8001).
- **Archivos principales:** src/features/reels/api.js (patchReelMusic), src/features/reels/hooks.js (useReelMusicOverride, surface musicId+music denorm, eliminado music:'' muerto), src/features/reels/editor/MusicOverridePanel.jsx (nuevo), src/features/reels/editor/ReelEditor.jsx (monta el panel), editor.css, tests/support/mock-backend.js (handler PATCH /music), tests/reel_music_override.spec.js (nuevo).
- **Cambios clave:** dropdown "Agency default pool + tracks" en el editor; PATCH al cambiar; disabled si publish_status no editable; rollback en error; mock-backend espeja contrato 200/404/404/409/422; denorm music{music_id, display_name} via useTracks.
- **Tests reportados:** lint/build verdes, test:smoke 46/2 skipped, spec dedicada 9/9 viewports.
- **Documentos:** progress/impl_25_per_reel_music_override.md, progress/review_25_per_reel_music_override.md.
- **Cadena música completa:** features 22 (upload), 23 (renderer lee agency_music_tracks + seed), 24 (selection_rules toggle) y 25 (override per-reel) cerradas cross-repo.

## 2026-05-14 — feature 28: brand_dynamic_fonts_and_reset_defaults (front + cross-repo close)

- **Resultado:** done (APPROVED por review local; back deployado en :8001).
- **Archivos principales:** src/features/brand/{fontsApi.js (nuevo), hooks.js (useAvailableFonts), BrandConfig.jsx (dropdown dinámico + botón Reset + hint), brand.css}, tests/support/mock-backend.js (handler GET /fonts + PUT /brand persistencia per-agency + 422 enum), tests/brand_dynamic_fonts.spec.js (nuevo), specs adyacentes actualizadas al contrato str|None.
- **Cambios clave:** dropdown de fuentes ya no hardcoded — pobla desde GET /v1/admin/fonts (6 fuentes OFL del catálogo del back). Botón Reset en primary/secondary/font setea state a null (PUT preserva la key con valor null para que el back caiga al fallback webhook/Inter). Mock-backend rechaza font_family fuera del catálogo con 422 mirror del back.
- **Tests reportados:** lint/build verdes, test:smoke 46/2 skipped, spec dedicada 12 passed (4 × 3 viewports), payload_contract + brand_logo_upload verdes.
- **Documentos:** progress/impl_28_brand_dynamic_fonts_and_reset_defaults.md, progress/review_28_brand_dynamic_fonts_and_reset_defaults.md.
- **Cadena brand customisation:** feature 28 cross-repo cerrada (catálogo + UI + reset). Feature 29 (secondary_color en side_banner) sigue pending en back.

## 2026-05-15 — feature 30: social_per_platform_publish_toggle (front, back no-op)

- **Resultado:** done (APPROVED por review local).
- **Archivos principales:** src/features/social/SocialConfig.jsx (PublishingStrip + togglePublish + subtab atenuada), src/features/social/styles.css, tests/support/mock-backend.js (socialAccountsByAgency + defaultsByAgency seed options), tests/social_publish_toggles.spec.js (nuevo).
- **Cambios clave:** /social ahora controla `agency_reel_defaults.platforms` con un toggle por red. PUT a /defaults con body preservando los demás campos del slice. Optimistic update + rollback. Redes sin conexión GHL → disabled+tooltip. Subtabs de plantillas atenuadas pero clickables cuando la red no publica.
- **Tests reportados:** lint/build verdes, test:smoke 46/2 skipped, spec dedicada 15/15 (5 escenarios × 3 viewports), social_templates sin regresión.
- **Documentos:** progress/impl_30_social_per_platform_publish_toggle.md, progress/review_30_social_per_platform_publish_toggle.md.
- **Back no-op:** reusa endpoint /defaults y campo platforms existente desde feature 6/19. Cero cambios de schema o código back.

## 2026-05-15 — feature 31: subtitles_tab_cleanup_and_autocaptions_switch (front + cross-repo close)

- **Resultado:** done (APPROVED por review local; back deployado en :8001).
- **Archivos principales:** src/features/defaults/ReelDefaultsConfig.jsx (sin LivePreview), src/features/defaults/LivePreview.jsx (BORRADO), src/features/defaults/tabs/SubtitlesTab.jsx (toggle auto-captions + sin Karaoke), src/features/defaults/initialState.js (sin subHighlight*), src/features/defaults/defaults.css (cleanup), tests/subtitles_autocaptions.spec.js (nuevo).
- **Cambios clave:** Cleanup UI: quitada la card Karaoke ("Word highlight") y la columna LivePreview. Añadido switch "Auto-generate AI subtitles" al inicio de SubtitlesTab; cuando off, las cards Typography y Background&position se atenúan con opacity 0.55 pero siguen editables.
- **Tests reportados:** lint/build verdes, test:smoke 46/2 skipped, spec dedicada 9/9 viewports, payload_contract 6/6 sin regresión.
- **Documentos:** progress/impl_31_subtitles_tab_cleanup_and_autocaptions_switch.md, progress/review_31_subtitles_tab_cleanup_and_autocaptions_switch.md.
- **Cadena subtitle settings completa:** back wires + front cleanup. autoCaptions=false → reel renderizado sin subtítulos en ffmpeg drawtext.

## 2026-05-15 — feature 26: review_emails_chip_editor (front, back #26 en review / #27 pending)

- **Resultado:** done (APPROVED por review local; cierre front autónomo — el smoke manual contra :8001 queda diferido al cierre del back #27).
- **Archivos principales:** src/lib/utils/email.js (nuevo, EMAIL_PATTERN+normaliseEmail+isValidEmail), src/features/automation/EmailListInput.jsx (nuevo, chip editor controlado), src/features/automation/ReviewModeDetails.jsx (sustituye input plano CSV por EmailListInput), src/features/automation/AutomationConfig.jsx (state list[str] + helper parseReviewEmails retrocompat), src/features/automation/useAutomationSave.js (PUT envía array directo, sin join), src/features/automation/automation.css (bloque email-list-input/email-chip), src/features/defaults/initialState.js (reviewEmails default []), tests/support/mock-backend.js (validateReviewEmails + INVALID_EMAIL_LIST 422), tests/review_emails.spec.js (nuevo, 9 passed = 3 escenarios × 3 viewports).
- **Cambios clave:** /automation review-first mode ya no usa <input> plano CSV — chips con commit on Enter/coma/espacio/blur, Backspace borra último chip si input vacío, normalización trim+lowercase, dedup case-insensitive silenciosa, validación con EMAIL_PATTERN, error inline autodismiss 2.5 s. State pasa de string CSV a list[str]. Hidratación retrocompat: si llega CSV legacy se splittea+normaliza; si llega array se usa directo. PUT siempre envía list[str] canónico. Mock-backend extiende validación con 422 INVALID_EMAIL_LIST (shape Pydantic-like) cuando llega un tipo/email inválido — mirror del back #27.
- **Tests reportados:** lint/build verdes (CSS 126.39 kB, JS 399.17 kB), test:smoke 46/2 skipped, spec dedicada 9/9 viewports, payload_contract 6/6 sin regresión.
- **Documentos:** progress/impl_26_review_emails_chip_editor.md, progress/review_26_review_emails_chip_editor.md.
- **Cross-repo pendiente:** back #26 (infra SMTP) en review y back #27 (review_requested subscriber) pending. El front es retrocompat por hidratación, así que puede convivir con cualquier deploy del back. El smoke manual contra :8001 ("configurar 2 reviewEmails, ingestar property, verificar correos") queda diferido para el cierre cross-repo cuando back #27 termine.
