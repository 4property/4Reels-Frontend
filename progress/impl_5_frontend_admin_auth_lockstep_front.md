# Impl — Feature 5 (frontend_admin_auth_lockstep) · lado FRONT

> Mirror del lado back (cerrado por el implementer del back). Esta entrada
> cubre exclusivamente el frontend `4reels front/`.

## Resumen

El frontend ya consumía rutas `/v1/admin/*` reales pero `getAuthHeaders()`
era un stub vacío, así que cualquier despliegue contra un backend con
`ADMIN_API_DISABLE_AUTH_FOR_TESTING=false` rebotaba con 401. Esta feature
introduce un store plano (`src/lib/api/authToken.js`) que `apiRequest` lee
para adjuntar `Authorization: Bearer <token>` en cada llamada. El token se
hidrata desde `sessionStorage` (clave `4reels.adminBearer`) en el
arranque, se siembra en `SessionProvider` cuando la respuesta de
`POST /v1/sessions/gohighlevel/session` trae `agency_token`, y se limpia
en `reset()` y al recibir 401 en cualquier ruta `/v1/admin/*`. Para
super-admins locales se añade un `<details>` colapsable bajo
`MVP_ADMIN_ENABLED` en `GhlMvpConnectScreen` para pegar el bearer; nunca
se persiste fuera de `sessionStorage` y nunca se introduce
`VITE_ADMIN_API_TOKEN` (Vite inlinea VITE_* al bundle). El 503
`AGENCY_AUTH_NOT_CONFIGURED` se trata como configuración del back rota y
muestra un mensaje específico encima del flujo GHL.

## Archivos creados / modificados

- **`src/lib/api/authToken.js`** (nuevo, módulo plano sin React) —
  `get/set/clear` con hidratación desde `sessionStorage` y
  `subscribe/notify` para el evento `unauthorized` que dispara `apiRequest`
  ante 401 en `/v1/admin/*`. Vive en `lib/api/` para mantener la regla de
  capas (no importa de `features/` ni de `app/`).
- **`src/lib/api/client.js`** —
  - Importa `getAuthToken` y `notifyUnauthorized`.
  - `getAuthHeaders()` (línea ~111-115) ahora devuelve
    `{ Authorization: 'Bearer <token>' }` cuando hay token. Comentario
    actualizado para reflejar el patrón nuevo (sin mención a
    `X-Tenant-Id`).
  - `apiRequest`: si `res.status === 401` y la ruta empieza por
    `/v1/admin/`, llama a `notifyUnauthorized()` antes de lanzar el
    `ApiError`. Helper local `isAdminPath`.
- **`src/features/session/SessionProvider.jsx`** —
  - Importa `setAuthToken`, `clearAuthToken`, `subscribeUnauthorized`.
  - `connect()`: tras recibir `session`, si trae `agency_token` llama
    `setAuthToken` ANTES de `setStatus('ready')` para evitar la race con
    el primer GET `/v1/admin/agencies/{id}` de `ActiveAgencyProvider`. Si
    la llamada lanza 503 con `code === 'AGENCY_AUTH_NOT_CONFIGURED'`,
    setea `error: { code: 'AGENCY_AUTH_NOT_CONFIGURED', ... }` y vuelve a
    `needs-context` en lugar de ir a `error`.
  - `reset()`: ahora también `clearAuthToken()`.
  - Nuevo `useEffect` que se suscribe una vez a `subscribeUnauthorized` y
    limpia el token + vuelve a `needs-context` ante 401.
  - `onAdmin` en el render de `GhlMvpConnectScreen` acepta un
    `localBearer` opcional y lo guarda con `setAuthToken` antes de pasar a
    `ready`.
  - `GhlMvpConnectScreen`: banner específico cuando
    `error?.code === 'AGENCY_AUTH_NOT_CONFIGURED'`; nuevo `<details>`
    "Local super-admin (developers only)" con input password, copy de
    aviso y botón "Connect as super-admin" (oculto detrás de
    `MVP_ADMIN_ENABLED`).
- **`tests/support/mock-backend.js`** — `agencyConnectedSession()` ahora
  añade `agency_token: 'test-bearer-<agency_id>'` y
  `agency_token_expires_at: '2026-05-07T13:00:00Z'`. El mock no valida
  `Authorization` en las rutas admin — la cobertura específica vive en el
  spec dedicado.
- **`tests/admin_auth.spec.js`** (nuevo) — 3 casos × 3 viewports = 9
  tests. (1) Sesión GHL con `agency_token` ⇒ todas las llamadas a
  `/v1/admin/agencies/{id}` llevan el bearer correcto. (2) Sin token ⇒
  pantalla `Connect GoHighLevel` y ningún header inventado. (3) Bearer
  pegado en el form local super-admin se reenvía a `/v1/admin/agencies`.
- **`.env.example`** — bloque de aviso al inicio prohibiendo
  `VITE_ADMIN_API_TOKEN`.
- **`DOCS.md`** — sub-sección **Auth** dentro de "Backend contract"
  documentando: `agency_token` agency-scoped, super-admin local con
  `sessionStorage`, comportamiento ante 401, semántica del 503
  `AGENCY_AUTH_NOT_CONFIGURED`, y la prohibición de `VITE_ADMIN_API_TOKEN`.
- **`feature_list.json`** — feature 5 pasada de `pending` a `in_progress`
  (queda esperando review cross-repo, no marca `done`).
- **`progress/current.md`** — bitácora actualizada.

## Comandos de verificación

- `npm run lint` → sin errores.
- `npm run build` → `built in 2.71s` (gzip 103.53 kB).
- `npm run test:smoke` → **40 passed, 2 skipped** (49.8s).
- `npx playwright test tests/admin_auth.spec.js` → **9 passed** (8.5s).

## Tests añadidos

- `tests/admin_auth.spec.js`: bearer GHL forwarded, sin token ⇒ gate, y
  bearer super-admin local pegado ⇒ forwarded.

## Desviaciones del spike

- Ninguna sustantiva.
- Detalle: el spike sugería `tests/playwright/admin_auth.spec.js` pero el
  repo aplana los specs en `tests/` (no hay subcarpeta `playwright/`).
  Spec colocado en `tests/admin_auth.spec.js`. **Why:** mantiene la
  convención existente (`flows.spec.js`, `music.spec.js`,
  `smoke.spec.js`) y el comando `npm run test:smoke` filtra por nombre
  ("smoke flows"), así que el nuevo spec no se mete por accidente en el
  smoke pre-deploy.
- El spike pedía añadir la nota anti-`VITE_ADMIN_API_TOKEN` en el
  comentario sobre `getAuthHeaders` en `client.js:101-104`. La nota está
  centralizada en `.env.example` y `DOCS.md` (1-stop docs); el comentario
  de `client.js` quedó conciso describiendo la fuente real del token.

## Estado

`in_progress` — pendiente de review cross-repo. **No se marca `done`.**
