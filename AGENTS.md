# AGENTS.md — Mapa de navegación para agentes de IA (`4reels front/`)

> Este archivo es el **punto de entrada** para cualquier agente que
> trabaje en el frontend de 4reels. NO es una biblia de reglas: es un
> **mapa**. Lee solo lo que necesites cuando lo necesites (divulgación
> progresiva).

---

## 1. Antes de empezar (obligatorio)

1. Ejecuta `./init.sh` y verifica que termina sin errores. Si falla,
   **para** y resuelve el entorno antes de tocar código.
2. Lee `progress/current.md` para entender en qué estado quedó la
   última sesión.
3. Lee `feature_list.json` y elige **una** tarea con estado `pending`.

## 2. Mapa del repositorio

### Arnés (este conjunto de archivos)

| Archivo / carpeta            | Qué contiene                                              | Cuándo leerlo |
|------------------------------|-----------------------------------------------------------|---------------|
| `feature_list.json`          | Lista de tareas con estado                                | Siempre, al empezar |
| `progress/current.md`        | Estado de la sesión actual                                | Siempre, al empezar |
| `progress/history.md`        | Bitácora append-only                                      | Si necesitas contexto histórico |
| `docs/architecture.md`       | Estándar de arquitectura del front                        | Antes de implementar |
| `docs/conventions.md`        | Estilo JS/JSX, naming, hooks, CSS                         | Antes de escribir código |
| `docs/verification.md`       | Lint, build, Playwright, smoke                            | Antes de declarar `done` |
| `CHECKPOINTS.md`             | Criterios objetivos de "estado final correcto"            | Para auto-evaluarte |
| `.claude/agents/`            | Definiciones de subagentes (leader, implementer, reviewer) | Si orquestas trabajo |

### Documentación del proyecto (autoritativa, anterior al arnés)

| Archivo                      | Qué contiene                                              |
|------------------------------|-----------------------------------------------------------|
| `ARCHITECTURE.md`            | Capas, layer rules, data flow, cómo añadir una feature.   |
| `DOCS.md`                    | Producto, páginas, modelo de datos mock, contrato backend. |
| `README.md` (si existe)      | Setup local.                                              |
| `.env.example`               | Variables de entorno (`VITE_USE_MOCK`, `VITE_API_URL`).   |

Si `docs/architecture.md` (arnés) y `ARCHITECTURE.md` o `DOCS.md`
(proyecto) entran en conflicto, **gana el documento del proyecto**: el
arnés es un resumen operativo, los documentos del proyecto son la
fuente de verdad.

### Código

| Carpeta                      | Qué contiene                                                   |
|------------------------------|----------------------------------------------------------------|
| `src/main.jsx`, `src/App.jsx` | Entry + providers.                                            |
| `src/app/`                   | Shell, topbar, tab router, providers (`ThemeProvider`, `TenantProvider`). |
| `src/lib/api/client.js`      | Cliente único: hace `fetch(VITE_API_URL)` o llama al mock.     |
| `src/lib/api/mock/`          | Mock backend (handlers + store). Es la **spec** del backend real. |
| `src/lib/hooks/`             | Hooks genéricos: `useApi`, `useMutation`, `useLocalStorage`.   |
| `src/shared/`                | UI primitives sin dependencias de datos (Icon, Cover, Toggle, …). |
| `src/features/<x>/`          | Una carpeta por dominio (reels, music, social, brand, defaults, automation, admin, notifications). Cada una con `api.js`, `hooks.js`, componentes, `index.js`. |
| `src/styles/`                | Vanilla CSS, un archivo por responsabilidad.                   |
| `tests/`                     | Tests Playwright (E2E + smoke + visual).                       |
| `tests/support/mock-backend.js` | Mock para tests E2E.                                        |
| `playwright.config.js`       | Config de Playwright.                                          |
| `vite.config.js`             | Config de Vite.                                                |
| `eslint.config.js`           | Reglas ESLint.                                                 |

## 3. Reglas duras (no negociables)

Vienen de `ARCHITECTURE.md` del proyecto:

- **Sin TypeScript.** Vanilla JS/JSX. Si una feature lo requiere, se
  para y se discute (estado `blocked`).
- **Sin React Query, sin MSW.** Server state vía `useApi` /
  `useMutation` de `lib/hooks/`; mock vía `lib/api/mock/` (no MSW).
- **Vanilla CSS.** Nada de styled-components, Tailwind, CSS-in-JS, etc.
  Una hoja por responsabilidad en `src/styles/`.
- **Componentes nunca llaman `fetch` directamente.** Siempre vía hook
  de feature → api de feature → `lib/api/client.js`.
- **Layer rules:**
  - `shared/` — pura presentación, sin deps de datos.
  - `features/<x>/` — puede importar de `shared/`, `lib/`,
    `app/providers/`.
  - `app/` — providers + shell, sin lógica de dominio.
  - `lib/` — base, no importa nada de arriba.
- **Mock = spec.** Si una feature pide un nuevo endpoint, primero se
  añade el handler en `lib/api/mock/handlers/` con el shape exacto
  que el backend tendrá que implementar.
- **Una sola feature a la vez.**
- **No declares una tarea `done` sin lint + build + tests verdes.**
- **Documenta lo que haces** en `progress/current.md` mientras
  trabajas, no al final.
- **Deja el repo limpio** antes de cerrar (ver §5).

## 4. Cómo elegir una tarea

```
1. Abre feature_list.json
2. Filtra por status == "pending"
3. Coge la de menor "id" (o la marcada como prioritaria)
4. Cambia su status a "in_progress" y guarda
5. Anota en progress/current.md: feature, hora, plan
```

## 5. Cierre de sesión (lifecycle)

Antes de terminar:

1. Ejecuta `./init.sh` — todo verde.
2. Si la tarea está acabada y aprobada por el `reviewer`: marca
   `status: "done"` en `feature_list.json`.
3. Mueve el resumen de `progress/current.md` al final de
   `progress/history.md`.
4. Vacía `progress/current.md` dejando solo la plantilla.
5. Limpia: nada de `console.log` de debug, `*.tmp_*`, `dist/` modificado
   manualmente, dependencias en `package.json` que no se usen.
6. Si añadiste un endpoint nuevo: confirma que tiene su handler mock y
   que está documentado en `DOCS.md` § "Backend contract" como
   responsabilidad del backend real.

## 6. Si te bloqueas

- Relee la sección relevante de `ARCHITECTURE.md`, `DOCS.md` o `docs/`.
- Si la herramienta no hace lo que esperas (Vite no recarga, Playwright
  no encuentra el selector, ESLint da un error que no entiendes), **no
  inventes un workaround**: documenta el bloqueo en
  `progress/current.md` con estado `blocked` en `feature_list.json` y
  para la sesión.
