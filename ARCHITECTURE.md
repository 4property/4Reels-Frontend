# Architecture

**Stack:** React 18 + Vite. Vanilla CSS. No TypeScript, no React Query, no MSW.

## Layout

```
src/
├── main.jsx, App.jsx     Entry + providers
├── app/                  Shell, topbar, tab router, providers
├── lib/                  API client + mock backend + generic hooks
├── shared/               UI primitives (Icon, Cover, Toggle…)
├── features/             One folder per domain (reels, music, social, brand,
│                         defaults, automation, admin, notifications)
└── styles/               Vanilla CSS, one file per responsibility
```

Each feature is self-contained: `api.js`, `hooks.js`, components, `index.js`.

## Data flow

```
Component → feature hook → feature api → lib/api/client.js
                                              │
                                  VITE_USE_MOCK=true  → in-memory mock
                                  VITE_USE_MOCK=false → fetch(VITE_API_URL)
```

Components never call `fetch` directly. Always go through a feature hook.

## Layer rules

- `shared/` — pure presentation, no data deps.
- `features/<x>/` — may import from `shared/`, `lib/`, `app/providers/`.
- `app/` — providers + shell, no domain logic.
- `lib/` — base layer, imports nothing from above.

## State

- **Server state**: `useApi` / `useMutation` from `lib/hooks/`.
- **Global UI**: `ThemeProvider`, `TenantProvider` in `app/providers/`.
- **Local UI**: `useState`.
- **Persistence**: `useLocalStorage` (theme, current tab).

## Connecting a real backend

1. `.env.local`: `VITE_USE_MOCK=false`, `VITE_API_URL=https://…`
2. Adjust auth headers in [src/lib/api/client.js](src/lib/api/client.js) if needed.

The mock in `src/lib/api/mock/` is the spec the backend must implement: same paths, same shapes.

## Adding a feature

1. Create `src/features/<name>/` with `api.js`, `hooks.js`, components, `index.js`.
2. Add a mock handler in `src/lib/api/mock/handlers/<name>.js` and register it.
3. Add the tab in [src/app/pages.js](src/app/pages.js) and wire it in [src/app/Shell.jsx](src/app/Shell.jsx).
