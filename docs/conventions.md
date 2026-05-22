# Code conventions (`4reels front/`)

> Extreme homogeneity. The AI predicts better when the repository
> looks like itself everywhere.

## JS / JSX style

- **Vanilla JS/JSX** — never TypeScript.
- **ESM**. Imports `import x from "./y.js"` (with the extension when
  ESM requires it), `export default` or `export const`. No `require`.
- **Double quotes** `"..."` by default. Single quotes only to escape
  doubles inside.
- **Semicolons** at the end of every statement (consistency with the
  existing code; ESLint enforces it).
- **Lines max 100 characters.**
- **Arrow functions** for functional components and handlers.
- **Hooks**: respect the React rules (`react-hooks/rules-of-hooks`)
  — always top-level, never conditional.

## Names

| Type                          | Convention        | Example                  |
|-------------------------------|-------------------|--------------------------|
| Components (file + export)    | `PascalCase.jsx`  | `ReelCard.jsx`           |
| Hooks                         | `useCamelCase.js` | `useReels.js`            |
| Other modules                 | `camelCase.js`    | `formatDuration.js`      |
| CSS                           | `kebab-case.css`  | `reel-card.css`          |
| Feature folders               | `kebab-case/`     | `features/reels/`        |
| Top-level constants           | `UPPER_SNAKE`     | `DEFAULT_PAGE_SIZE`      |
| useState state                | `camelCase` + setter `setX` | `[isOpen, setIsOpen]` |

## Feature folder structure

```
src/features/<name>/
├── api.js              Functions that call lib/api/client.js
├── hooks.js            Hooks that wrap api.js with useApi/useMutation
├── <Component>.jsx     Feature-specific components
├── ...
└── index.js            Barrel: re-exports the feature's public surface
```

Example `api.js`:

```js
import { apiRequest } from "../../lib/api/client.js";

export const fetchReels = (filters) =>
  apiRequest("/v1/reels", { method: "GET", query: filters });

export const updateReel = (id, patch) =>
  apiRequest(`/v1/reels/${id}`, { method: "PATCH", body: patch });
```

Example `hooks.js`:

```js
import { useApi, useMutation } from "../../lib/hooks";
import { fetchReels, updateReel } from "./api.js";

export const useReels = (filters) => useApi(["reels", filters], () => fetchReels(filters));

export const useUpdateReel = () => useMutation(updateReel);
```

## Components

```jsx
import "../../styles/reel-card.css";

export const ReelCard = ({ reel, onPublish }) => {
  // local UI state via useState
  // server state via feature hooks, NEVER direct fetch
  return (
    <article className="reel-card">
      {/* … */}
    </article>
  );
};
```

- One component per file (with its trivial subcomponents as internal
  helpers).
- Destructured props in the signature.
- `className` in kebab-case matching the CSS file.
- No `style={{ ... }}` unless a value is genuinely dynamic (progress
  bar width, custom tenant color).

## CSS

- One file per feature or per primitive under `src/styles/`.
- Light BEM: `.reel-card`, `.reel-card__title`, `.reel-card--published`.
- Variables in `:root` (color tokens, spacing) — do not redefine
  them inside a feature.
- Mobile-first. Media queries at the end of the file.

## Mock backend

```js
// src/lib/api/mock/handlers/reels.js
export const reelsHandlers = {
  "GET /v1/reels": ({ query }) => store.reels.filter(matches(query)),
  "PATCH /v1/reels/:id": ({ params, body }) => updateInStore(store.reels, params.id, body),
};
```

- Path-pattern → function. The function accesses the mutable `store`.
- The response shape is **exactly** what the real backend will have.
- If the handler returns something the real backend will not be able
  to return, mark it with `// TODO mock-only:` and open a note in
  `progress/current.md`.

## Playwright tests

- Smoke: one test per critical flow (login + 3 actions), fast.
- E2E: cover permutations (filters, edge cases).
- Visual: snapshots of stable screens. Manual acceptance with
  `npm run test:visual:update`.
- Selectors: prefer `getByRole`, `getByLabel`, `getByTestId`. No
  fragile selectors like XPath or deep CSS.
- Every test uses the mock backend from `tests/support/mock-backend.js`.

## Error handling

- On the client: `apiRequest` throws `ApiError(status, code, message)`.
  Hooks catch it and expose `{ data, error, isLoading }`.
- In components: show a fallback (toast / banner / empty state with
  message), never leave the UI silently broken.
- No `console.error` for expected errors — use the notifications
  system (`src/features/notifications/`).

## Comments

By default **no** comments. Only when they explain a non-obvious
*why* (Vite workaround, React 18 strict-mode hack, browser
restriction). Names must do the rest. **Forbidden**:
comments that describe *what* a function does, ticket references
("added for issue #123"), TODOs without date + author.
