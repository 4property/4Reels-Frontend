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
