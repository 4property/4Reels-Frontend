# CHECKPOINTS — Final-state evaluation (`4reels front/`)

> In multi-agent systems we don't evaluate the path, we evaluate the
> destination. These are the objective checkpoints a judge (human or AI)
> can use to decide whether the frontend is healthy after a session.

## C1 — The harness is complete

- [ ] The base files exist: `AGENTS.md`, `CLAUDE.md`, `init.sh`,
      `feature_list.json`, `progress/current.md`.
- [ ] The 3 docs exist: `docs/architecture.md`, `docs/conventions.md`,
      `docs/verification.md`.
- [ ] `./init.sh` ends with exit code 0.

## C2 — State is coherent

- [ ] At most one feature in `in_progress` in `feature_list.json`.
- [ ] Every `done` feature has associated E2E or smoke tests that
      pass.
- [ ] `progress/current.md` is empty or describes the active session.
- [ ] `progress/history.md` has an entry for the last closed
      session.

## C3 — The code respects the architecture

- [ ] **No TypeScript** (`*.ts`, `*.tsx`) in `src/`.
- [ ] **No React Query, no MSW**, no new state libs.
- [ ] **Vanilla CSS** — no styled-components, no Tailwind, no CSS-in-JS.
- [ ] No component under `src/features/` or `src/shared/` calls
      `fetch(...)` directly. Everything goes through
      `lib/api/client.js` via a feature hook.
- [ ] `src/shared/` does not import from `src/features/` or `src/lib/api/`.
- [ ] `src/lib/` does not import from `src/features/`, `src/app/`, `src/shared/`.
- [ ] `src/app/` contains no domain logic (only providers + shell).

## C4 — Verification is real

- [ ] `npm run lint` finishes green.
- [ ] `npm run build` finishes green.
- [ ] If the feature touches UI: there is a Playwright test (smoke or e2e)
      covering the main flow.
- [ ] `npm run test:smoke` finishes green over the touched flows.
- [ ] If the feature touches the "look": there is an updated and
      accepted visual snapshot (`test:visual`).

## C5 — The mock-backend contract is alive

- [ ] If the feature adds a new endpoint: its handler exists in
      `src/lib/api/mock/handlers/<feature>.js` and is registered.
- [ ] The mock shape matches the expected shape of the real backend
      (see `DOCS.md` § "Backend contract"); any difference is
      documented as a TODO in the handler.
- [ ] `tests/support/mock-backend.js` covers the new endpoints
      when the E2E tests need them.

## C6 — The session was closed properly

- [ ] No suspicious untracked files (`.tmp_vite_*.log`,
      `dist/` modified by hand, patched `node_modules/`).
- [ ] No `console.log` or `debugger` in `src/` code.
- [ ] The last feature worked on is reflected in its correct status
      in `feature_list.json`.
- [ ] No dependencies have been added to `package.json` without
      justification in the implementer's report.

---

**How to use this file:** a reviewer agent (`.claude/agents/reviewer.md`)
walks through each checkbox, marks `[x]` or `[ ]`, and rejects the
session closure if any boxes remain empty in C1-C6.
