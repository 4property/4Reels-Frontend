# AGENTS.md — Navigation map for AI agents (`/opt/projects/4Reels-Frontend`)

> This file is the **entry point** for any agent working on the 4Reels
> frontend. It is NOT a bible of rules: it is a **map**. Read only what
> you need when you need it (progressive disclosure).
>
> **Repos on disk:**
> - Frontend (this one): `/opt/projects/4Reels-Frontend`
> - Backend: `/opt/projects/4Reels-Backend` (runs on :8001 as test;
>   legacy production is another repo on :8000 — see §7).

---

## 1. Before you start (mandatory)

1. Run `./init.sh` and verify it finishes without errors. If it
   fails, **stop** and fix the environment before touching code.
2. Read `progress/current.md` to understand the state the last
   session was left in.
3. Read `feature_list.json` and pick **one** task with status `pending`.

## 2. Repository map

### Harness (this set of files)

| File / folder                | What it contains                                          | When to read it |
|------------------------------|-----------------------------------------------------------|---------------|
| `feature_list.json`          | List of tasks with their status                           | Always, on start |
| `progress/current.md`        | State of the current session                              | Always, on start |
| `progress/history.md`        | Append-only log                                           | If you need historical context |
| `docs/architecture.md`       | Frontend architecture standard                            | Before implementing |
| `docs/conventions.md`        | JS/JSX style, naming, hooks, CSS                          | Before writing code |
| `docs/verification.md`       | Lint, build, Playwright, smoke                            | Before declaring `done` |
| `CHECKPOINTS.md`             | Objective criteria for a "correct final state"            | For self-assessment |
| `.claude/agents/`            | Subagent definitions (leader, implementer, reviewer)      | If you are orchestrating work |

### Project documentation (authoritative, predates the harness)

| File                         | What it contains                                          |
|------------------------------|-----------------------------------------------------------|
| `ARCHITECTURE.md`            | Layers, layer rules, data flow, how to add a feature.     |
| `DOCS.md`                    | Product, pages, mock data model, backend contract.        |
| `README.md` (if present)     | Local setup.                                              |
| `.env.example`               | Environment variables (`VITE_USE_MOCK`, `VITE_API_URL`).  |

If `docs/architecture.md` (harness) and `ARCHITECTURE.md` or `DOCS.md`
(project) conflict, **the project document wins**: the harness is an
operational summary, the project documents are the source of truth.

### Code

| Folder                       | What it contains                                              |
|------------------------------|---------------------------------------------------------------|
| `src/main.jsx`, `src/App.jsx` | Entry + providers.                                           |
| `src/app/`                   | Shell, topbar, tab router, providers (`ThemeProvider`, `TenantProvider`). |
| `src/lib/api/client.js`      | Single client: does `fetch(VITE_API_URL)` or calls the mock.  |
| `src/lib/api/mock/`          | Mock backend (handlers + store). It is the **spec** of the real backend. |
| `src/lib/hooks/`             | Generic hooks: `useApi`, `useMutation`, `useLocalStorage`.    |
| `src/shared/`                | UI primitives with no data dependencies (Icon, Cover, Toggle, …). |
| `src/features/<x>/`          | One folder per domain (reels, music, social, brand, defaults, automation, admin, notifications). Each with `api.js`, `hooks.js`, components, `index.js`. |
| `src/styles/`                | Vanilla CSS, one file per responsibility.                     |
| `tests/`                     | Playwright tests (E2E + smoke + visual).                      |
| `tests/support/mock-backend.js` | Mock for E2E tests.                                        |
| `playwright.config.js`       | Playwright config.                                            |
| `vite.config.js`             | Vite config.                                                  |
| `eslint.config.js`           | ESLint rules.                                                 |

## 3. Hard rules (non-negotiable)

They come from the project's `ARCHITECTURE.md`:

- **No TypeScript.** Vanilla JS/JSX. If a feature requires it, stop
  and discuss (status `blocked`).
- **No React Query, no MSW.** Server state via `useApi` /
  `useMutation` from `lib/hooks/`; mock via `lib/api/mock/` (no MSW).
- **Vanilla CSS.** No styled-components, Tailwind, CSS-in-JS, etc.
  One sheet per responsibility in `src/styles/`.
- **Components never call `fetch` directly.** Always via feature
  hook → feature api → `lib/api/client.js`.
- **Layer rules:**
  - `shared/` — pure presentation, no data deps.
  - `features/<x>/` — may import from `shared/`, `lib/`,
    `app/providers/`.
  - `app/` — providers + shell, no domain logic.
  - `lib/` — base, imports nothing from above.
- **Mock = spec.** If a feature asks for a new endpoint, first add
  the handler in `lib/api/mock/handlers/` with the exact shape that
  the backend will have to implement.
- **One feature at a time.**
- **Do not declare a task `done` without lint + build + tests green.**
- **Document what you do** in `progress/current.md` while you work,
  not at the end.
- **Leave the repo clean** before closing (see §5).

## 4. How to pick a task

```
1. Open feature_list.json
2. Filter by status == "pending"
3. Pick the one with the lowest "id" (or the one marked as priority)
4. Change its status to "in_progress" and save
5. Note in progress/current.md: feature, time, plan
```

## 5. Session close (lifecycle)

Before finishing:

1. Run `./init.sh` — everything green.
2. If the task is finished and approved by the `reviewer`: mark
   `status: "done"` in `feature_list.json`.
3. Move the summary from `progress/current.md` to the end of
   `progress/history.md`.
4. Empty `progress/current.md` leaving only the template.
5. Clean up: no debug `console.log`, no `*.tmp_*`, no manually
   modified `dist/`, no unused dependencies in `package.json`.
6. If you added a new endpoint: confirm it has its mock handler and
   that it is documented in `DOCS.md` § "Backend contract" as a
   responsibility of the real backend.

## 6. If you get stuck

- Re-read the relevant section of `ARCHITECTURE.md`, `DOCS.md` or `docs/`.
- If a tool does not behave as expected (Vite does not reload, Playwright
  cannot find the selector, ESLint throws an error you do not understand),
  **do not invent a workaround**: document the block in
  `progress/current.md` with status `blocked` in `feature_list.json` and
  stop the session.

## 7. Backend the frontend points to

The dev frontend consumes the backend at `VITE_MVP_API_URL`. By default
on this host:

| Environment      | URL                                              | Backend service             | Backend repo                       |
|------------------|--------------------------------------------------|-----------------------------|------------------------------------|
| Local dev / test | `http://localhost:8001` or `https://4reelsback-test.4property.com` | `reels-test.service` (:8001) | `/opt/projects/4Reels-Backend`    |
| Production       | `https://<prod-domain>` → `:8000`                | `reels.service` (:8000)     | `/opt/reels` (another repo, **legacy**) |

**HEADS-UP:** production and test run **two different source codebases** —
the `/opt/reels` repo (branch `ghl` of `4property/4robert`) and the
refactored repo `/opt/projects/4Reels-Backend` are not the same. If you
validate a front change against :8001 and then want to take it to
production, the backend side of the change (if any) has to be ported
manually.

To restart the backend services, see `/opt/projects/4Reels-Backend/AGENTS.md` §7.
**Claude must not restart production (`reels.service`) without explicit
user confirmation in the same turn.**
