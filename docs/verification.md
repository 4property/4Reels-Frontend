# Verification — How to prove the work works (`4reels front/`)

> Golden rule: **the agent does not say "it works", it proves it**.
> Every feature ends with executable evidence, not assertions.

## Verification levels

### Level 1 — Lint + build (mandatory, always)

```bash
npm run lint
npm run build
```

Both exit code 0. `init.sh` already runs them. If they break, **stop**.

### Level 2 — Smoke E2E (mandatory if the feature touches UI)

```bash
npm run test:smoke
```

Covers the critical flows. If you added a new tab or editor, add a
smoke test that:

1. Navigates to the new route.
2. Performs the main action (create, edit, publish, …).
3. Verifies the result on screen and in the mock store.

### Level 3 — Full E2E (mandatory before closing large features)

```bash
npm run test:e2e
```

Permutations, edge cases, form validations, simulated network errors.

### Level 4 — Visual (mandatory if the feature touches the "look")

```bash
npm run test:visual            # runs and compares against snapshots
npm run test:visual:update     # accepts the new baselines
```

When you accept a new baseline, document it in
`progress/current.md` with one bullet per capture.

### Level 5 — Manual smoke with dev server (recommended)

```bash
npm run dev
# open http://localhost:5173 (or whatever port Vite uses)
# try the feature in a real browser
```

Especially useful when the feature involves:

- Drag & drop, resizable panels, virtualization.
- Animations, transitions, scroll behavior.
- Integration with `localStorage` or `sessionStorage`.
- Keyboard shortcuts.

If you only see `npm run test:smoke` green but you have not touched a
browser, **say so in the report** ("no manual smoke") — do not assert
"works in the browser" without having opened it.

## Anti-patterns (do not do)

- ❌ "I added the component, it should work." → missing executable
  test.
- ❌ A test that only mounts the component and checks it does not
  throw. → it must check the result (text on screen, call to the
  mock store, event fired).
- ❌ Skipping an E2E test because "the component is trivial". If
  it is on screen, there is a flow to verify.
- ❌ Leaving `test.only(...)` or `test.skip(...)` in the code.
- ❌ Modifying visual snapshots without opening the browser and
  confirming visually.
- ❌ Marking the feature as `done` without passing `./init.sh`.
- ❌ Covering the feature with a mock that returns something the
  real backend will not be able to return. The mock = spec.

## Final verification before closing

```bash
./init.sh                     # lint + build green
npm run test:smoke            # smoke green
# if it touched new UI with permutations:
npm run test:e2e
# if it touched visuals:
npm run test:visual
```

If anything is red, **do not** mark anything as `done`. Note the block
in `progress/current.md` with status `blocked` in `feature_list.json`.
