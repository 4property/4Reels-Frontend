# Architecture — What "doing a good job" means (`4reels front/`)

> This document is an **operational summary** for the agent. The source
> of truth is [`ARCHITECTURE.md`](../ARCHITECTURE.md) and
> [`DOCS.md`](../DOCS.md) at the project root. If there is a conflict,
> those win.

## Stack

- **React 18 + Vite.**
- **Vanilla JS/JSX** — no TypeScript.
- **Vanilla CSS** — no styled-components, no Tailwind, no CSS-in-JS.
- **No React Query.** Server state via `useApi` / `useMutation` from
  `lib/hooks/`.
- **No MSW.** Mock implemented by hand in `src/lib/api/mock/`. For
  E2E tests, mock via `tests/support/mock-backend.js`.
- **Routing**: `react-router-dom` v6 (yes, allowed).
- **Tests**: Playwright (smoke / e2e / visual).
- **Lint**: ESLint flat config (`eslint.config.js`).

## Layout

```
src/
├── main.jsx, App.jsx        Entry + providers
├── app/                     Shell, topbar, tab router, providers
│   ├── Shell.jsx
│   ├── pages.js
│   └── providers/           ThemeProvider, TenantProvider
├── lib/                     Base layer
│   ├── api/
│   │   ├── client.js        Single point that does real fetch or calls the mock
│   │   └── mock/            Mock backend (handlers + store)
│   │       ├── store.js     In-memory data
│   │       └── handlers/    One file per domain
│   └── hooks/               useApi, useMutation, useLocalStorage
├── shared/                  UI primitives (Icon, Cover, Toggle, …)
├── features/                One folder per domain
│   ├── reels/               api.js, hooks.js, components, index.js
│   ├── music/
│   ├── social/
│   ├── brand/
│   ├── defaults/
│   ├── automation/
│   ├── admin/
│   └── notifications/
└── styles/                  Vanilla CSS, one file per responsibility
```

## Data flow

```
Component → feature hook → feature api → lib/api/client.js
                                              │
                                  VITE_USE_MOCK=true  → in-memory mock
                                  VITE_USE_MOCK=false → fetch(VITE_API_URL)
```

**Components never call `fetch` directly.** Always via a feature hook.

## Layer rules

- `shared/` — pure presentation, no data deps. Does not import from
  `features/`, `lib/api/` or `app/providers/`.
- `features/<x>/` — may import from `shared/`, `lib/`,
  `app/providers/`.
- `app/` — providers + shell. Contains no domain logic.
- `lib/` — base. Imports nothing from above (`features/`, `app/`,
  `shared/`).

## State

- **Server state**: `useApi` (read) / `useMutation` (write) from
  `lib/hooks/`.
- **Global UI**: `ThemeProvider`, `TenantProvider` in `app/providers/`.
  Only genuine cross-cutting concerns — don't put feature state here.
- **Local UI**: `useState`. By default.
- **Persistence**: `useLocalStorage` (theme, current tab).

## Mock = Spec

`src/lib/api/mock/` is the **specification** of the real backend. When
you add an endpoint:

1. Define the exact shape in the mock handler.
2. Document the contract in `DOCS.md` § "Backend contract" if it is new.
3. The backend (4reels back) implements it with the same path and the
   same shape. If you find a mismatch, **change the mock** and tell the
   leader; do not make the frontend "adapt" to the backend.

## How to add a feature

(Echo of `ARCHITECTURE.md` § "Adding a feature".)

1. Create `src/features/<name>/` with `api.js`, `hooks.js`, components,
   `index.js`.
2. Add a handler in `src/lib/api/mock/handlers/<name>.js` and
   register it in the mock index.
3. If the feature is navigable: add the tab in `src/app/pages.js`
   and wire it up in `src/app/Shell.jsx`.
4. Create `src/styles/<name>.css` and link it from the feature's root
   component.
5. Add a smoke test in `tests/` covering the main flow.

## What NOT to do

- ❌ Import `fetch` or `XMLHttpRequest` from a component.
- ❌ Add TypeScript, React Query, MSW, styled-components, Tailwind,
  Redux, Zustand, Recoil, Jotai, … without going through the leader.
- ❌ Letting `shared/` import from `features/` or `lib/api/`.
- ❌ Letting `lib/` import from `features/`, `app/` or `shared/`.
- ❌ Inline CSS or inline `<style>` tags (except trivial demos in
  Storybook if it ever arrives). Vanilla CSS per file, imported by
  the feature.
- ❌ Moving feature logic to `app/` "to keep it global".
- ❌ Creating generic hooks that live inside a feature; generic ones
  live in `lib/hooks/`.
