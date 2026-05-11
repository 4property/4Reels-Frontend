# Spike — Feature 5 (front): `frontend_admin_auth_lockstep`

Read-only mapeo del estado del cliente API y la sesión, y plan front-side para
adjuntar `Authorization` en `/v1/admin/*` sin embeber secretos en el bundle.

Dependencia: spike back paralelo en `4reels-back/progress/explore_feature_5_back_auth.md`
(define el shape exacto del token devuelto por `/v1/sessions/gohighlevel/session`
y la política admin-direct).

---

## 1. Estado actual del front

### 1.1 `src/lib/api/client.js`
- Construye headers en `client.js:54-59`: `Content-Type`, `Accept`,
  `...getAuthHeaders()`, luego overrides del caller. `credentials: 'omit'`.
- `getAuthHeaders()` en `client.js:105-107` es **stub vacío** (`return {}`).
  Comentario `client.js:101-104` ya anticipa el hook para Authorization +
  X-Tenant-Id. **No lee ningún token** de localStorage / sessionStorage / env.
- `BASE_URL` y `MVP_API_URL` exportadas (`client.js:15-16`); base de la URL
  es `VITE_MVP_API_URL` con fallback a `VITE_API_URL`.
- El redactor de logs (`client.js:187-189`) ya sabe censurar `token|secret|
  password|authorization|api_key`, así que loguear el header viajando es
  seguro respecto a trazas.

### 1.2 `src/features/session/`
Archivos: `api.js`, `SessionProvider.jsx`, `ghlMvpContext.js`, `permissions.js`,
`useCan.js`, `Can.jsx`, `RequirePermission.jsx`, `index.js`, `session.css`.

Hooks expuestos (`index.js:1-13`): `SessionProvider`, `useCurrentUser`,
`usePermissions`, `useGhlMvp`, `useCurrentAgency`, `useCurrentAgencyId`,
`useCan`, `Can`, `RequirePermission`, `can`.

Tras feature 3 el `SessionProvider` raíz ya no decide entre `ApiSessionProvider`
y `GhlMvpSessionProvider`: renderiza siempre `GhlMvpSessionProvider` envuelto
en `ActiveAgencyProvider` (`SessionProvider.jsx:40-46`). El estado se resuelve
en el `useEffect` de `GhlMvpSessionProvider` (`SessionProvider.jsx:78-99`):
- Si `shouldUseMvpAdminMode()` ⇒ `buildMvpAdminUser()` y `status='ready'` sin
  llamar al backend (`SessionProvider.jsx:80-86`).
- Si hay contexto GHL completo ⇒ `connect()` que llama
  `sessionApi.createGhlMvpSession({locationId,userId})`
  (`SessionProvider.jsx:54-76`).
- Si falta contexto ⇒ `status='needs-context'` y se muestra
  `GhlMvpConnectScreen` (`SessionProvider.jsx:117-130`, `188-282`).

### 1.3 Sesión GHL hoy
- Endpoint: `POST /v1/sessions/gohighlevel/session`
  con body `{location_id, user_id}` (`api.js:4-10`).
- También existe `POST /v1/sessions/gohighlevel/test`
  (`api.js:11-16`) para probar la conexión.
- También `POST /v1/sessions/gohighlevel/context` para descifrar
  el payload SSO del iframe (`ghlMvpContext.js:271-275`).
- La respuesta se guarda en `user.ghlMvp.session` y se consume
  `agency_id`, `connected`, `has_token` (`ghlMvpContext.js:106, 121-127`).
  **El front ignora hoy cualquier campo `access_token` / `bearer_token` /
  `session_token` que el back llegue a devolver.**
- Persistencia: solo se persiste el contexto (location/user) en
  `localStorage` con clave `4reels.ghlMvpContext` (`ghlMvpContext.js:3, 71-80`).
  La respuesta `session` vive en memoria del provider; al recargar se vuelve
  a llamar `createGhlMvpSession`.

### 1.4 Variables de entorno relevantes (`.env.example:1-39`)
- `VITE_API_URL=/api` — fallback de URL.
- `VITE_MVP_API_URL=https://test.sydney2000.club` — base real.
- `VITE_USE_MOCK=true` — heredado, hoy `apiRequest` no lo consulta.
- `VITE_API_TRACE=true`.
- `VITE_GHL_MVP_ENABLED`, `VITE_GHL_CONTEXT_TIMEOUT_MS`,
  `VITE_GHL_FALLBACK_USER_ID`.
- `VITE_MVP_ADMIN_ENABLED`, `VITE_MVP_ADMIN_USER_ID`,
  `VITE_MVP_ADMIN_NAME`, `VITE_MVP_ADMIN_EMAIL` — admin-direct local.
- **No existe `VITE_ADMIN_API_TOKEN`** en `.env.example` ni en `src/`
  (verificado con grep). No hay nada que deprecar; sí hay que prevenir
  que aparezca por descuido.

### 1.5 `tests/support/mock-backend.js`
- **No valida `Authorization`** en ninguna ruta.
- `POST /v1/sessions/gohighlevel/session` devuelve
  `{ok, location_id, user_id, connected, has_token, agency_id}`
  (`mock-backend.js:60-69, 223-230, 285-294`). **No incluye `access_token`
  ni equivalente.** El campo `has_token` se refiere al token GHL
  agency-side, no a un bearer para `/v1/admin/*`.

---

## 2. Plan propuesto front-side

### 2.1 Lectura del token desde `apiRequest`
Crear `src/lib/api/authToken.js` (módulo plano, sin React):
```js
let current = null;
export function setAuthToken(token) { current = token || null; }
export function getAuthToken()      { return current; }
export function clearAuthToken()    { current = null; }
```
`getAuthHeaders()` en `client.js:105` pasa a:
```js
const t = getAuthToken();
return t ? { Authorization: `Bearer ${t}` } : {};
```
**Why:** desacopla el client de React (regla de capas: `lib/` no importa
de `features/` ni `app/`). El SessionProvider llama `setAuthToken` cuando
recibe sesión y `clearAuthToken` en logout/reset.

### 2.2 Persistencia agency-scoped — decisión: `sessionStorage`
Opciones:
- (A) **`sessionStorage`** (clave `4reels.adminBearer`). Pros: sobrevive
  recargas dentro de la pestaña; blast radius limitado (no cross-tab,
  caduca al cerrar la pestaña). Contras: si el iframe GHL se carga en
  partitioned storage, el SDK de GHL aún devuelve el contexto y
  `createGhlMvpSession` se relanza en el efecto inicial — aceptable.
- (B) **In-memory + refresh on reload** vía `createGhlMvpSession`.
  Pros: nada en disco. Contras: cada reload golpea backend; en iframe
  con cookies de tercera parte bloqueadas funciona igual porque ya
  reusamos el contexto local (`ghlMvpContext.js:71-80`).

**Decisión: (A) `sessionStorage`** — el provider ya re-llama la sesión
en cada montaje, pero hidratar `authToken` desde `sessionStorage` en el
arranque permite que la primera llamada a `/v1/admin/agencies/{id}` que
hace `ActiveAgencyProvider` (`SessionProvider.jsx:148-164`) no salga sin
`Authorization`. El módulo `authToken.js` lee `sessionStorage` en su
inicialización y `setAuthToken` lo persiste.

**Why:** evita una race entre `createGhlMvpSession` y `apiRequest('/v1/admin/agencies/{id}')`
sin tener que reordenar el provider. Y `sessionStorage` queda atado a
la pestaña, no a la máquina.

### 2.3 Limpieza
- `reset()` en `SessionProvider.jsx:101-107` añade `clearAuthToken()`.
- `clearGhlMvpContext()` en `ghlMvpContext.js:78-80` (mismo módulo) puede
  llamarse también desde `setAuthToken(null)` para mantenerlos coherentes,
  pero **no acoplar**: dos cleaners independientes con un solo "logout"
  en el provider que llama a ambos.

### 2.4 Modo super-admin local
Reemplazar la idea de `VITE_ADMIN_API_TOKEN` por una pantalla local:
- En `GhlMvpConnectScreen` el botón "Continue as admin"
  (`SessionProvider.jsx:271-275`) abre un input de bearer (oculto detrás
  de `MVP_ADMIN_ENABLED`). Token nunca se persiste fuera de
  `sessionStorage`.
- Al pulsar Connect: `setAuthToken(token)`, `buildMvpAdminUser()`,
  `status='ready'`.
- Texto explícito: "Local super-admin only — NEVER paste a production
  bearer here on a shared machine."

**Why:** un input runtime no acaba en `dist/` ni en git. `import.meta.env.*`
sí entra al bundle (Vite static replacement) y un secreto allí es un
secreto público.

### 2.5 Qué hacer con `VITE_ADMIN_API_TOKEN`
**Decisión: NO introducirla. Prohibirla en `.env.example` y dejar nota
explícita en `DOCS.md` y en el comentario sobre `getAuthHeaders`.**
**Why:** Vite expone toda variable `VITE_*` al cliente; un token de
producción ahí queda en JS público al primer build. Hoy no existe la
variable (verificado con grep), así que la decisión es preventiva, no
correctiva.

---

## 3. Cambios concretos

### 3.1 Código
- **`src/lib/api/client.js:105-107`** — `getAuthHeaders()` lee
  `getAuthToken()` y devuelve `{Authorization: 'Bearer ...'}` cuando
  existe.
- **`src/lib/api/authToken.js`** (nuevo) — módulo `set/get/clear` con
  hidratación lazy desde `sessionStorage` en su top-level.
- **`src/features/session/SessionProvider.jsx`**:
  - `connect()` (líneas 54-76): tras `createGhlMvpSession`,
    `setAuthToken(session.access_token)` (campo nuevo a coordinar
    con back) **antes** de `setStatus('ready')`.
  - `reset()` (101-107): `clearAuthToken()`.
  - admin-direct branch (80-86 y 124-126): tras pasar el input local,
    `setAuthToken(localBearer)`.
- **`src/features/session/ghlMvpContext.js:92-129`** —
  `buildMvpUser` no toca el token; sigue siendo concern del provider.
- **`src/features/admin/`** — la UI de "Continue as admin" extendida con
  el input de token vive en `SessionProvider.jsx`'s `GhlMvpConnectScreen`,
  no en el tab admin (que requiere ya estar autenticado). **Why:** la
  pantalla de gate es el único punto pre-sesión.

### 3.2 Tests / mocks
- **`tests/support/mock-backend.js`**:
  - `agencyConnectedSession()` (285-294) y `DEFAULT_RESPONSES` (60-69):
    añadir `access_token: 'test-bearer-...'` al payload de
    `/v1/sessions/gohighlevel/session` para verificar que el provider
    lo guarda.
  - **No** validar `Authorization` en cada `/v1/admin/*` por defecto —
    metería ruido en smoke. En su lugar, **un test dedicado nuevo**
    `tests/playwright/admin_auth.spec.js` que: (a) interceptar
    `/v1/admin/agencies` y assert `request.headers().authorization`
    empieza con `Bearer `; (b) caso negativo: si la sesión no devuelve
    token, no se manda header.
- **`tests/playwright/`** — modificar tests existentes solo si rompen
  con el nuevo header (no deberían, los stubs no validan Authorization).

### 3.3 Docs / env
- **`.env.example`** — comentario explícito:
  `# DO NOT add a VITE_ADMIN_API_TOKEN here — VITE_* values are inlined
  into the JS bundle (public).`
- **`DOCS.md`** — sección nueva "Auth" bajo "Backend contract":
  describe el flujo (sesión GHL devuelve bearer agency-scoped;
  super-admin local pega bearer en pantalla local; `apiRequest` lo
  adjunta como `Authorization: Bearer <token>` para todo `/v1/*`).

---

## 4. Riesgos y decisiones abiertas

### 4.1 Iframe GHL embed y storage
- En el embed real, el iframe carga 4reels en cross-site context. Chrome
  con third-party cookies bloqueadas también particiona Storage Access.
  `localStorage`/`sessionStorage` siguen disponibles, pero el espacio
  está particionado por top-frame; en general OK para nuestro flujo
  (no compartimos con la página padre).
- Riesgo: Safari ITP puede limpiar `sessionStorage` de iframes después
  de 7 días sin interacción top-level. Aceptable: en la siguiente
  carga el provider re-llama `createGhlMvpSession` y rehidrata el
  bearer.

### 4.2 Manejo de 401 en `/v1/admin/*`
Propuesta: `apiRequest` (`client.js:81-95`) detecta `res.status===401`
y lanza un `ApiError` como hoy. Una capa nueva en
`SessionProvider.jsx` instala un listener (event bus mínimo en
`authToken.js` — `subscribe('unauthorized', cb)`) que el client
dispara en 401. Acción: `clearAuthToken()` + `setStatus('needs-context')`
para volver a la pantalla de connect/GHL. No reintentar — feature 5
del back no define refresh todavía.

**Why:** evita renderizar tabs sobre estado caducado; el siguiente turno
del usuario es reconectar.

### 4.3 Dependencias del back
El front asume del spike `progress/explore_feature_5_back_auth.md`:
- `POST /v1/sessions/gohighlevel/session` devuelve un campo bearer
  (nombre exacto a confirmar: `access_token` vs `session_token` vs
  `bearer`). Acordar el nombre antes de implementar.
- TTL/expiración del bearer (¿hace falta `expires_at`?). Si sí, el front
  puede pre-emptar 401 limpiando el token cerca de la expiración.
- Política para super-admin: ¿el backend acepta cualquier bearer
  super-admin con un claim distinto, o expone un endpoint
  `/v1/sessions/admin/login` aparte? Si es lo segundo, el front necesita
  un segundo path en `sessionApi`.
- Comportamiento con `ADMIN_API_DISABLE_AUTH_FOR_TESTING=true`:
  irrelevante para front (siempre manda header si lo tiene).
