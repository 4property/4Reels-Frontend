# Convenciones de código (`4reels front/`)

> Homogeneidad extrema. La IA predice mejor cuando el repositorio se
> parece a sí mismo en todas partes.

## Estilo JS / JSX

- **JS/JSX vanilla** — nunca TypeScript.
- **ESM**. Imports `import x from "./y.js"` (con extensión cuando ESM
  lo requiera), `export default` o `export const`. Nada de `require`.
- **Comillas dobles** `"..."` por defecto. Comillas simples solo para
  escapar dobles dentro.
- **Punto y coma** al final de cada statement (consistencia con el
  código existente; ESLint lo aplica).
- **Líneas máximo 100 caracteres.**
- **Arrow functions** para componentes funcionales y handlers.
- **Hooks**: respetan las reglas de React (`react-hooks/rules-of-hooks`)
  — siempre top-level, nunca condicionales.

## Nombres

| Tipo                          | Convención        | Ejemplo                  |
|-------------------------------|-------------------|--------------------------|
| Componentes (archivo + export) | `PascalCase.jsx` | `ReelCard.jsx`           |
| Hooks                         | `useCamelCase.js` | `useReels.js`           |
| Otros módulos                 | `camelCase.js`    | `formatDuration.js`      |
| CSS                           | `kebab-case.css`  | `reel-card.css`          |
| Carpetas de feature           | `kebab-case/`     | `features/reels/`        |
| Constantes top-level          | `UPPER_SNAKE`     | `DEFAULT_PAGE_SIZE`      |
| Estado de useState            | `camelCase` + setter `setX` | `[isOpen, setIsOpen]` |

## Estructura de un feature folder

```
src/features/<name>/
├── api.js              Funciones que llaman a lib/api/client.js
├── hooks.js            Hooks que envuelven api.js con useApi/useMutation
├── <Component>.jsx     Componentes específicos de la feature
├── ...
└── index.js            Barrel: re-exporta lo público de la feature
```

Ejemplo de `api.js`:

```js
import { apiRequest } from "../../lib/api/client.js";

export const fetchReels = (filters) =>
  apiRequest("/v1/reels", { method: "GET", query: filters });

export const updateReel = (id, patch) =>
  apiRequest(`/v1/reels/${id}`, { method: "PATCH", body: patch });
```

Ejemplo de `hooks.js`:

```js
import { useApi, useMutation } from "../../lib/hooks";
import { fetchReels, updateReel } from "./api.js";

export const useReels = (filters) => useApi(["reels", filters], () => fetchReels(filters));

export const useUpdateReel = () => useMutation(updateReel);
```

## Componentes

```jsx
import "../../styles/reel-card.css";

export const ReelCard = ({ reel, onPublish }) => {
  // local UI state via useState
  // server state vía hooks de la feature, NUNCA fetch directo
  return (
    <article className="reel-card">
      {/* … */}
    </article>
  );
};
```

- Un componente por archivo (con sus subcomponentes triviales como
  helpers internos).
- Props desestructuradas en la firma.
- `className` en kebab-case que matchea el archivo CSS.
- Nada de `style={{ ... }}` salvo cuando un valor es genuinamente
  dinámico (anchura de progress bar, color custom de tenant).

## CSS

- Un archivo por feature o por primitive bajo `src/styles/`.
- BEM ligero: `.reel-card`, `.reel-card__title`, `.reel-card--published`.
- Variables en `:root` (color tokens, spacing) — no las redefinas
  dentro de una feature.
- Mobile-first. Media queries al final del archivo.

## Mock backend

```js
// src/lib/api/mock/handlers/reels.js
export const reelsHandlers = {
  "GET /v1/reels": ({ query }) => store.reels.filter(matches(query)),
  "PATCH /v1/reels/:id": ({ params, body }) => updateInStore(store.reels, params.id, body),
};
```

- Path-pattern → función. La función accede al `store` mutable.
- El shape de la respuesta es **exactamente** el que tendrá el backend
  real.
- Si el handler devuelve algo que el backend real no podrá devolver,
  márcalo con `// TODO mock-only:` y abre nota en `progress/current.md`.

## Tests Playwright

- Smoke: un test por flujo crítico (login + 3 acciones), rápido.
- E2E: cubre permutaciones (filters, edge cases).
- Visual: snapshots de pantallas estables. Aceptación manual con
  `npm run test:visual:update`.
- Selectores: prefiere `getByRole`, `getByLabel`, `getByTestId`. Nada
  de selectores frágiles tipo XPath o CSS profundo.
- Cada test usa el mock backend de `tests/support/mock-backend.js`.

## Manejo de errores

- En el cliente: `apiRequest` lanza `ApiError(status, code, message)`.
  Los hooks lo capturan y exponen `{ data, error, isLoading }`.
- En componentes: muestra fallback (toast / banner / vacío con
  mensaje), nunca dejes la UI rota silenciosa.
- Nada de `console.error` para errores esperados — usa el sistema de
  notificaciones (`src/features/notifications/`).

## Comentarios

Por defecto **no** se escriben. Solo cuando explican un *por qué* no
obvio (workaround de Vite, hack de React 18 strict mode, restricción
de un browser). Los nombres deben hacer el resto. **Prohibido**:
comentarios que describen *qué* hace una función, referencias a
tickets ("added for issue #123"), TODOs sin fecha + autor.
