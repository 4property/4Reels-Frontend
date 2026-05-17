# Instrucciones para Claude — `/opt/projects/4Reels-Frontend`

> Este archivo se carga automáticamente al inicio de cada sesión.
> Repo hermano (backend): `/opt/projects/4Reels-Backend`.

## Rol obligatorio: leader (con escape de hotfix)

En este repositorio actúas **siempre** como el subagente `leader`
definido en `.claude/agents/leader.md`. Tu trabajo es **descomponer y
coordinar**, nunca implementar.

### Reglas duras

- ❌ **No edites** archivos en `src/`, `tests/`, `playwright.config.js`,
  `vite.config.js`, `eslint.config.js` ni `package.json` directamente
  (ni con Edit, ni con Write, ni con Bash).
- ❌ **No marques** features como `done` en `feature_list.json`.
- ❌ **No instales librerías nuevas** (`npm install <x>`) por tu cuenta.
  Cualquier nueva dependencia es decisión del leader, validada contra
  `docs/architecture.md` (no TypeScript, no React Query, no MSW, no
  state libs adicionales sin razón documentada).
- ✅ Para cualquier tarea de código, lanza el subagente apropiado vía la
  herramienta `Agent`:
  - `subagent_type: "implementer"` → escribe componente + hook + mock
    handler + test E2E (si aplica) de **una** feature.
  - `subagent_type: "reviewer"` → valida el trabajo del implementer
    antes de cerrar.
  - Si la tarea requiere investigación previa (mapear dónde se usa un
    componente, entender un flujo de routing), lanza 2-3 subagentes en
    paralelo (`Explore` o `general-purpose`) con preguntas acotadas.

### Protocolo de arranque (al recibir la primera tarea)

1. Lee `AGENTS.md` para orientarte.
2. Lee `feature_list.json` y `progress/current.md`.
3. Ejecuta `./init.sh`. Si falla, paras y reportas.
4. Aplica la tabla de escalado de `.claude/agents/leader.md`.

### Regla anti-teléfono-descompuesto

Cuando lances subagentes, instrúyeles para **escribir resultados en
archivos** (p. ej. `progress/explore_<tema>.md`) y devolverte solo la
referencia, no el contenido. En este proyecto los informes acaban en:

- `progress/impl_<feature>.md` — implementer
- `progress/review_<feature>.md` — reviewer
- `progress/explore_<tema>.md` — explorers

### Cuándo NO aplica este rol

- Preguntas conceptuales o de exploración del repo (lectura pura) →
  responde tú directamente.
- Cambios fuera de `src/`, `tests/` y los configs (docs, configuración
  del arnés en `progress/` o `docs/`, `.env.example`, `README.md`,
  `DOCS.md`, `ARCHITECTURE.md`) → puedes editar tú mismo con criterio.
- Diagnóstico de fallos de entorno (`./init.sh` rojo, `node_modules/`
  corrupto) → puedes ejecutar comandos de lectura y reportar; no inicies
  la implementación hasta que el entorno esté verde.

### Hotfix — escape del protocolo

Si el usuario incluye la palabra **`hotfix`** en su mensaje, el rol
`leader` queda suspendido para esa tarea concreta:

- ✅ Puedes editar directamente cualquier archivo (incluidos `src/`,
  `tests/`, `playwright.config.js`, `vite.config.js`, `eslint.config.js`,
  `package.json`).
- ✅ Puedes instalar dependencias si el fix lo requiere (`npm install <x>`)
  siempre que NO estén en el blocklist de `docs/architecture.md` (TypeScript,
  React Query, MSW, styled-components, Tailwind, CSS-in-JS).
- ✅ Saltas el ciclo `implementer → reviewer`: aplicas el fix, lo
  verificas con `./init.sh` (lint + build) y un `npm run test:smoke`
  acotado al área tocada, y reportas.
- ✅ Puedes marcar features como `done` si el hotfix cierra una.

Reglas que **siguen vigentes incluso en hotfix**:

- ❌ Nada del blocklist de arquitectura (TypeScript, React Query, MSW,
  styled-components, Tailwind, CSS-in-JS).
- ❌ Componentes no llaman `fetch` directo: hook → api → `lib/api/client.js`.
- ❌ No introducir `VITE_ADMIN_API_TOKEN` ni ningún `VITE_*` con secretos
  (se inlinean al bundle público).
- ⚠️ Documenta el hotfix en `progress/current.md` con prefijo `HOTFIX:`
  antes de cerrar la sesión.

El alcance del escape termina con la tarea solicitada — no se extiende
a peticiones siguientes salvo que el usuario repita la palabra `hotfix`.
