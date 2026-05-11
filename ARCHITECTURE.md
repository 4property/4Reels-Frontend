# Architecture

**Stack:** React 18 + Vite. Vanilla CSS. No TypeScript, no React Query, no MSW.

## Layout

```
src/
  main.jsx, App.jsx     Entry + providers
  app/                  Shell, topbar, tab router, providers
  lib/                  API client + generic hooks
  shared/               UI primitives
  features/             One folder per domain
  styles/               Vanilla CSS
```

Each feature is self-contained: `api.js`, `hooks.js`, components, `index.js`.

## Data flow

```
Component -> feature hook -> feature api -> lib/api/client.js -> fetch(VITE_MVP_API_URL)
```

Components never call `fetch` directly. Always go through a feature hook.

## Layer rules

- `shared/` is pure presentation, no data dependencies.
- `features/<x>/` may import from `shared/`, `lib/`, and `app/providers/`.
- `app/` contains providers and shell routing, not domain logic.
- `lib/` is the base layer and imports nothing from above.

## State

- Server state: `useApi` / `useMutation` from `lib/hooks/`.
- Global UI: `ThemeProvider`, `TenantProvider` in `app/providers/`.
- Local UI: `useState`.
- Persistence: `useLocalStorage`.

## Backend

Set `VITE_MVP_API_URL` in `.env.local`. Playwright tests stub the live backend
at the network boundary in `tests/support/mock-backend.js`.

## Adding A Feature

1. Create `src/features/<name>/` with `api.js`, `hooks.js`, components, and `index.js`.
2. Add or update the relevant feature API module.
3. Add the tab in `src/app/pages.js` and wire it in `src/app/Shell.jsx`.
