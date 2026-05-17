# Auditoría: Flujo de Despliegue del Frontend 4Reels

**Fecha**: 2026-05-16  
**Repositorio**: `/opt/projects/4Reels-Frontend`  
**Rama actual**: `main` (HEAD: `f8b2ac0`)  
**Estado**: 52 archivos modificados, 73 sin trackear (cambios sin commitear)

---

## 1. INVENTARIO DE CONFIGURACIÓN

### 1.1 `package.json` Scripts

```json
{
  "name": "4reels",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",                                    // Dev server en puerto 5173, abre navegador
    "build": "vite build",                            // Build producción → dist/
    "preview": "vite preview",                        // Previsualiza build producción (puerto 4173)
    "lint": "eslint .",                               // Lint con ESLint 9+ (flat config)
    "test:e2e": "playwright test",                    // Tests E2E contra `vite preview` (dist/) o dev con PW_DEV=1
    "test:smoke": "playwright test smoke flows",     // Subset de tests E2E (rutas críticas)
    "test:visual": "playwright test visual",         // Visual regression tests
    "test:visual:update": "playwright test visual --update-snapshots",  // Actualiza baselines visuales
    "test:report": "playwright show-report",         // Abre reporte HTML de último test
    "predeploy": "npm run lint && npm run build && npm run test:e2e"  // Hook previo a deploy
  }
}
```

**Notas críticas**:
- Versión: `0.0.0` (sin versionado semántico)
- Sin `version` en el build ni referencia a git tags
- `predeploy` fuerza lint + build + E2E completos antes de desplegar

### 1.2 `vite.config.js`

```javascript
{
  plugins: [react()],
  server: {
    port: 5173,
    open: true,                    // Abre navegador al arrancar dev
  },
  preview: {
    allowedHosts: ['frontendtest.sydney2000.club'],  // Whitelist para preview
  },
}
```

**Observaciones**:
- No hay base path ni alias configurado (rutas relativas).
- No hay proxy definido en dev (solicitudes de API van directamente a `VITE_MVP_API_URL`).
- `preview` permite solo un host específico (posible inconsistencia en local vs preview en server).

### 1.3 `init.sh` — Verificación de Entorno (Completo)

Script ejecutado al comenzar sesión o antes de marcar tarea como `done`. Valida:

1. **Node >= 18** y npm
2. **node_modules/** existe
3. **Archivos base presentes**: `AGENTS.md`, `CLAUDE.md`, `feature_list.json`, `progress/current.md`, `docs/architecture.md`, `docs/conventions.md`, `docs/verification.md`, `CHECKPOINTS.md`
4. **feature_list.json válido**: max 1 feature en `in_progress`, estados válidos
5. **No TypeScript en src/** (prohibido)
6. **Librerías prohibidas**: TypeScript, React Query, MSW, styled-components, @emotion/*, Tailwind
7. **`npm run lint`** pasa
8. **`npm run build`** pasa (log en `/tmp/harness_build.log`)

Nota: Tests E2E NO se ejecutan en init.sh por coste; se lanzan explícitamente por feature.

### 1.4 `playwright.config.js`

```javascript
{
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html']] : 'list',
  
  use: {
    baseURL: 'http://localhost:4173',  // Tests apuntan a vite preview
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  
  projects: [
    { name: 'desktop', viewport: { width: 1280, height: 800 } },
    { name: 'tablet', viewport: { width: 768, height: 1024 } },
    { name: 'mobile', viewport: { width: 375, height: 667 } },
  ],
  
  webServer: {
    // Si PW_DEV=1: npm run dev -- --port 4173
    // Si no: npm run build && npm run preview -- --port 4173
    command: useDev ? 'npm run dev -- --port 4173' : 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
}
```

**Crítico**:
- **Modo por defecto**: tests contra `dist/` (build preexistente o rebuild).
- **PW_DEV=1**: tests contra servidor dev con HMR.
- **No asume backend levantado**. Los tests usan `tests/support/mock-backend.js` para stubear red.
- **3 viewports Chromium**: no está WebKit/Firefox.
- **Baseline visual** en `tests/**/*-snapshots/` (committed a git).

### 1.5 `eslint.config.js` — Configuración Flat (ESLint 9+)

```javascript
{
  ignores: ['dist', 'node_modules', 'scripts'],
  
  // Base rules (js.configs.recommended)
  // + React 18 + jsx-runtime (no React import needed)
  // + react-hooks (rules-of-hooks error, exhaustive-deps warn)
  
  rules: {
    'react/prop-types': 'off',                        // No PropTypes
    'react/no-unescaped-entities': 'off',             // Permite apóstrofes sin escape
    'react/no-unknown-property': ['error', { ignore: ['data-screen-label'] }],
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-undef': 'error',
    'no-console': 'off',                              // Logs permitidos
  },
  
  // Config files (*.config.js) en contexto Node
  // Playwright specs (tests/**/*.js) con globals Node + Browser
}
```

**Restricciones de arquitectura**:
- No TypeScript (se revisa en init.sh)
- JSDoc para tipos cuando sea necesario
- Componentes no pueden usar `target.value` sin validación React

### 1.6 `.gitignore` — Archivos Ignorados

```
dist/               # Build producción — NO committed
dist-ssr/
build/
node_modules/
.vite/
.env                # Secretos — solo .env.example committed
.env.local
.env.*.local
test-results/       # Playwright run output
playwright-report/
blob-report/
!tests/**/*-snapshots/  # Baselines visuales — SÍ committed
```

**Critical**: `dist/` está en `.gitignore` → **no pre-generado en git**. Se rebuild en cada deploy.

### 1.7 Estructura de `dist/`

Ejecuté después de build reciente:

```
dist/
  index.html                # Bundle HTML con <script> type=module
  assets/
    main-*.js               # Main app JS (minified)
    react-*.js              # React + vendor split
  uploads/                  # Directorio para assets server-side (si aplica)
```

**Nota**: Vite 5.4.11 con React plugin genera ES modules, no legacy bundles.

---

## 2. VARIABLES DE ENTORNO (`import.meta.env.VITE_*` y `process.env`)

### Inventario de `VITE_*`

Todas son **públicas** (inlineadas en bundle). No usar para secrets.

| Variable | Tipo | Ubicación en código | Propósito |
|----------|------|-----|---------|
| `VITE_MVP_API_URL` | String (URL) | `src/lib/api/client.js:17` | Base URL canónica para todas las llamadas API |
| `VITE_API_URL` | String (URL/path) | `src/lib/api/client.js:16` | Fallback legacy (muy poco usado) |
| `VITE_USE_MOCK` | Bool (`'true'`/`'false'`) | `.env.example` (legacy) | Deshabilitado en producción; sin consumo directo en code |
| `VITE_API_TRACE` | Bool (default `'true'`) | `src/lib/api/client.js:18` | Log de detalles de errores en consola navegador |
| `VITE_ERROR_ENDPOINT` | String (URL) | `src/lib/errors/reportError.js` | Endpoint para POST de errores sin manejo (opcional) |
| `VITE_GHL_MVP_ENABLED` | Bool (`'true'`) | `src/features/session/ghlMvpContext.js:25` | Activa integración GoHighLevel (GHL) |
| `VITE_GHL_CONTEXT_TIMEOUT_MS` | Number | `src/features/session/ghlMvpContext.js:line ~95` | Timeout (ms) para await GHL context (default 2500) |
| `VITE_GHL_FALLBACK_USER_ID` | String | `src/features/session/ghlMvpContext.js` | User ID fallback si GHL no retorna `user_id` |
| `VITE_MVP_ADMIN_ENABLED` | Bool (`'true'`) | `src/features/session/ghlMvpContext.js:26` | Activa modo super-admin local (`?admin=1` o `/v1/admin`) |
| `VITE_MVP_ADMIN_USER_ID` | String | `src/features/session/ghlMvpContext.js` | Super-admin ID local (default `'admin-local'`) |
| `VITE_MVP_ADMIN_NAME` | String | `src/features/session/ghlMvpContext.js` | Super-admin nombre |
| `VITE_MVP_ADMIN_EMAIL` | String | `src/features/session/ghlMvpContext.js` | Super-admin email |
| `VITE_GHL_LOCATION_ID` | String (optional) | `src/features/session/ghlMvpContext.js` | GHL location ID (dev override) |
| `VITE_GHL_USER_ID` | String (optional) | `src/features/session/ghlMvpContext.js` | GHL user ID (dev override) |
| `VITE_GHL_USER_NAME` | String (optional) | `src/features/session/ghlMvpContext.js` | GHL user name (dev override) |
| `VITE_GHL_USER_EMAIL` | String (optional) | `src/features/session/ghlMvpContext.js` | GHL user email (dev override) |

### Archivos de Configuración

- **`.env.example`**: Template de variables (OBLIGATORIO commitar).
- **`.env.local`**: Valores reales para dev local (gitignore).
- **`.env.production`**: NO EXISTE. Valores hardcodeados en deploy CI/CD o en el server.
- No hay `.env.staging` ni `.env.test`.

### Valores en Entornos

**Dev local (`.env.local`)**:
```
VITE_MVP_API_URL=https://4reelsback-test.4property.com
VITE_API_URL=https://4reelsback-test.4property.com
VITE_USE_MOCK=false
VITE_API_TRACE=true
VITE_GHL_MVP_ENABLED=true
VITE_MVP_ADMIN_ENABLED=true
```

**Template de ejemplo (`.env.example`)**:
```
VITE_MVP_API_URL=https://test.sydney2000.club
VITE_API_URL=/api                           # Fallback legacy
VITE_USE_MOCK=true                          # Legacy; ignorado
VITE_API_TRACE=true
VITE_GHL_MVP_ENABLED=true
VITE_MVP_ADMIN_ENABLED=true
```

**En producción**: ningún archivo `.env`. Las variables DEBEN ser inyectadas en tiempo de build (CI/CD) o en el server donde se sirve.

---

## 3. CÓMO SE SIRVE EN PRODUCCIÓN

### 3.1 Despliegue: `.github/workflows/deploy.yml`

```yaml
name: Deploy to Rocky Linux
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Setup SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.SSH_PRIVATE_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H ${{ secrets.SSH_HOST }} >> ~/.ssh/known_hosts

      - name: Deploy on server
        run: |
          ssh -i ~/.ssh/id_ed25519 -p ${{ secrets.SSH_PORT || 22 }} \
            ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} \
            "cd ${{ secrets.DEPLOY_PATH }} && \
             git fetch --all && \
             git reset --hard origin/main && \
             npm ci && \
             npm run build"
```

**Flujo**:
1. **Trigger**: push a `main` o manual (`workflow_dispatch`)
2. **SSH** en Rocky Linux server (credenciales en GitHub secrets)
3. **git fetch + reset** a `origin/main`
4. **npm ci** (clean install, determinístico)
5. **npm run build** (Vite build → `dist/`)
6. **NO THERE**: No reinicia app ni ejecuta tests post-deploy

**Problemas detectados**:
- ❌ No verifica lint ni build ANTES de pushear al server
- ❌ No corre tests E2E post-build (aunque `predeploy` hook no se invoca en CI)
- ❌ No gestiona archivos `.env` o `VITE_*` en el servidor
- ⚠️ No hay rollback automático si build falla

### 3.2 Cómo se Sirven los Assets

**Opción A: Server-side (esperado)**
- El servidor Rocky Linux ejecuta `npm run build` en el paso final
- `dist/` se genera **en el servidor**
- Un reverse proxy (Nginx) sirve `dist/` como raíz estática
- No hay contenedor Docker ni CDN explícito

**Opción B: Artefacto estático**
- Posible: commit `dist/` a git (no ocurre hoy, está en .gitignore)
- Posible: carga a CDN/S3 en paso de deploy (no hay evidencia)

**Confirmación en `.gitignore`**:
```
# ── Build output ────────────────────────────────────────────────────
dist
dist-ssr
build
```

➜ **Conclusión**: Assets se generan en el server Rocky Linux. No hay pre-build en CI ni CDN.

### 3.3 Gestión de Variables de Entorno en Producción

**GAP CRÍTICO**: No hay `.env.production` ni inyección de `VITE_*` en el servidor.

**Posibles rutas** (no documentadas):
1. Manual: admin loguea en servidor, crea `.env` antes de `npm ci`
2. CI/CD: GitHub Secrets se exportan a env antes de SSH (actual workflow NO lo hace)
3. Server-side: Nginx envsubst sobre `dist/index.html` (no hay evidencia)

**Recomendación**: Implementar step en workflow que exporte `VITE_MVP_API_URL` → `.env` en servidor.

### 3.4 Arquitectura de Deployment (Backend Context)

Backend en Rocky Linux:
- `/opt/cpihed` — app backend (Python + FastAPI)
- `compose.yml` en backend: postgres + api (puerto 8000) + worker
- Nginx reverse proxy (port 80/443) → api:8000

Frontend en Rocky Linux:
- Probablemente `/opt/4reels-frontend` o similar (no explícito)
- `dist/` → nginx como raíz estática o subruta

**No hay Dockerfile para frontend**, ni docker-compose.yml de frontend. Está todo manual en el server.

---

## 4. CONEXIÓN AL BACKEND

### Base URL para API

**Ruta**: `src/lib/api/client.js:16-17`

```javascript
export const BASE_URL = import.meta.env.VITE_API_URL || '';
export const MVP_API_URL = import.meta.env.VITE_MVP_API_URL || BASE_URL;
```

**Orden de resolución**:
1. Si `VITE_MVP_API_URL` está set → úsalo
2. Si no → usa `VITE_API_URL` (fallback legacy)
3. Si tampoco → string vacío (las llamadas irían al mismo origin, inútil)

**En `.env.local` (dev)**:
```
VITE_MVP_API_URL=https://4reelsback-test.4property.com
VITE_API_URL=https://4reelsback-test.4property.com
```

➜ Ambas apuntan a **test backend remoto en Cloudflare Tunnel**.

**En producción**:
- Desconocido. Debería ser `https://4reelsback.4property.com` (o similar live).
- **NO documentado en repo**. Solo en `.env.example`:
  ```
  VITE_MVP_API_URL=https://test.sydney2000.club
  ```

### Cómo Hace Requests el Frontend

`src/lib/api/client.js` — único punto de entrada:

```javascript
export async function apiRequest(path, options = {}) {
  const baseUrl = MVP_API_URL || BASE_URL;  // MVP_API_URL prioritario
  const url = new URL(`${trimTrailingSlash(baseUrl)}${path}`, window.location.origin);
  
  // Ejemplo: path='/v1/admin/agencies' + MVP_API_URL='https://test.sydney2000.club'
  // → fetch('https://test.sydney2000.club/v1/admin/agencies', ...)
  
  const requestHeaders = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...getAuthHeaders(),  // Bearer token si session activa
  };
  
  const res = await fetch(url.toString(), { ... });
}
```

**CORS**: Frontend asume backend responde con `Access-Control-Allow-Origin: *` (o el origin del navegador).

**Auth**: Bearer token obtenido de:
1. GHL session POST `/v1/sessions/gohighlevel/session` → `agency_token`
2. O super-admin pega token en pantalla local detrás de `VITE_MVP_ADMIN_ENABLED=true`

---

## 5. TESTS E2E (PLAYWRIGHT)

### Cómo Corren

```bash
npm run test:e2e           # Full suite contra dist/ (o dev si PW_DEV=1)
npm run test:smoke         # Subset crítico (rutas en ROUTES)
npm run test:visual        # Visual diffs
```

### Levantamiento Automático

**`playwright.config.js:49-56`**:

```javascript
webServer: {
  command: useDev ? 'npm run dev -- --port 4173' : 'npm run build && npm run preview -- --port 4173',
  url: 'http://localhost:4173',
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
}
```

➜ **Sí, levanta la app automáticamente**:
- Modo por defecto: `npm run build` (si no hay `dist/` o está stale) + `npm run preview`
- Modo dev (`PW_DEV=1`): `npm run dev`
- En CI: NUNCA reutiliza servidor anterior (siempre rebuild)

### Backend Requerido

**NO requiere backend levantado en `:8000`**. Los tests stubbean toda la red vía `tests/support/mock-backend.js`.

```javascript
// tests/support/mock-backend.js
export async function installMockBackend(page, { agencies } = {}) {
  // page.route() intercepta solicitudes a VITE_MVP_API_URL
  // y retorna respuestas mock predefinidas
}
```

**Ejemplo uso** (`tests/flows.spec.js`):
```javascript
await installMockBackend(page, { agencies: [SAMPLE_AGENCY] });
```

### Fixtures y Setup

No hay fixtures Playwright complejas. Setup simple:
- `tests/routes.js` — catálogo de rutas (sync con `src/app/pages.js`)
- `tests/support/mock-backend.js` — stubea red
- Per-spec: setup manual de GHL context, admin session, etc.

---

## 6. VERSIONADO

### En `package.json`

```json
{
  "version": "0.0.0",
  "name": "4reels"
}
```

**Problemas**:
- ❌ Versión nunca cambia (stuck en `0.0.0`)
- ❌ No hay git tags versionados (p. ej. `v1.2.3`)
- ❌ No hay referencia a commit SHA en bundle
- ❌ No hay form de rastrear qué código está en producción

**Recomendación**: Implementar `npm version patch` en CI/CD o al menos inyectar `BUILD_ID` en bundle.

---

## 7. ESTADO ACTUAL DE LA RAMA

```
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:  (52 modified, 73 untracked)
  src/app/Shell.jsx
  src/features/admin/AdminView.jsx
  src/features/reels/Dashboard.jsx
  ... (44 archivos más)

Untracked files:  (progress reports + nuevos componentes)
  progress/explore_*.md
  progress/impl_*.md
  progress/review_*.md
  src/features/admin/DefaultDescriptionsPanel.jsx
  src/features/brand/LogoUploader.jsx
  src/features/templates/
  tests/agency_intro_upload.spec.js
  ... (59 archivos más)
```

**HEAD**: `f8b2ac0` (message: "test")

**Divergencia**: Rama `main` está **UP TO DATE** con `origin/main`, pero hay cambios locales sin commit.

---

## 8. REFERENCIAS CRUZADAS ENTRE REPOS

### Paths Hardcodeados

Única referencia al backend en el frontend:

- **`CLAUDE.md:4`**: `> Repo hermano (backend): `/opt/projects/4Reels-Backend`.`
- **Varios `feature_list.json` entries**: Dependencias en features backend desplegadas en `:8001`

Ejemplo:
```json
"depends_on": "4Reels-Backend feature 13 desplegada en :8001"
```

**⚠️ Puerto `:8001` es sospechoso**: Backend `compose.yml` lista puerto `8000`, no `8001`. Posible:
- `8000`: API backend
- `8001`: Backend secundario (worker? api test?)
- O simplemente documentación desactualizada

**Recomendación**: Verificar qué corre en `:8001` en el server production.

---

## RESUMEN: TOP-3 GAPS CRÍTICOS

### 🔴 GAP 1: Gestión de Variables de Entorno en Producción

- **Problema**: No hay mecanismo documentado para inyectar `VITE_MVP_API_URL` en el server Rocky Linux.
- **Impacto**: Build puede fallar o apuntar a API fallida si `.env` no existe.
- **Solución**: Añadir step en `deploy.yml` que exporte secrets GitHub como `.env` antes de `npm ci`.

### 🔴 GAP 2: Sin Tests E2E ni Lint Post-Build en CI/CD

- **Problema**: GitHub Actions solo hace `npm run build`, sin validar que lint y tests pasen.
- **Impacto**: Código roto (lint, tests) puede desplegar a producción.
- **Solución**: Implementar `npm run lint && npm run test:e2e --ui=no` en workflow antes de SSH deploy.

### 🔴 GAP 3: Falta de Versionado y Rollback

- **Problema**: Versión stuck en `0.0.0`, sin git tags, sin forma de saber qué versión corre en prod.
- **Impacto**: Imposible diagnosticar bugs en prod o hacer rollback rápido a versión anterior.
- **Solución**: Implementar `npm version patch` en CI/CD y guardar BUILD_ID en bundle o `window.APP_VERSION`.

---

## REFERENCIAS DE CONFIGURACIÓN

| Archivo | Línea | Propósito |
|---------|-------|----------|
| `package.json` | 7-17 | Scripts NPM |
| `vite.config.js` | 1-13 | Config Vite |
| `playwright.config.js` | 1-57 | Config tests E2E |
| `eslint.config.js` | 1-96 | Rules linting |
| `.env.example` | 1-51 | Template variables |
| `.env.local` | 1-17 | Dev local (gitignore) |
| `src/lib/api/client.js` | 16-18 | Resolución de base URL |
| `src/features/session/ghlMvpContext.js` | 25-26 | Flags GHL/admin |
| `.github/workflows/deploy.yml` | 1-28 | CI/CD deployment |
| `init.sh` | 1-146 | Verificación entorno |
| `.gitignore` | 4-8 | `dist/`, `.env` ignorados |

---

**Fin del informe.**
