# Review — feature 32 (reels_list_pagination_and_filters_ui)

**Verdict:** APPROVED

## 1. Per-decision audit table

| Decision (leader / implementer) | Status | Verified at |
|---|---|---|
| Mock = spec: `{items, count_total, page, page_size, has_more, count}`; `count` legacy alias = `len(items)` | OK | `tests/support/mock-backend.js:188-197` (response shape) + `:185` (`countTotal = filtered.length`) + `:195` (`count: slice.length` legacy alias) |
| `reelsApi.list({agencyId, page, pageSize, workflowState, publishStatus, q})` only sends defined params | OK | `src/features/reels/api.js:29-39` (`buildListQuery` skips undefined / empty / NaN) + `:57-82` (accepts object OR legacy positional). No `?page=undefined`. |
| `useReels` returns paginated state | Partial (nit on naming) | `src/features/reels/hooks.js:25-76`. Exposes `{ reels, countTotal, page, pageSize, hasMore, loading, error, refetch, agencyId }`. Deviates from spec wording (`items` / `refresh`) — `reels` is the mapped collection (consistent with the rest of the codebase that consumes `r.title`, `r.coverUrl`, etc.); `refetch` comes from `useApi` (same name everywhere else). All in-tree consumers work and tests pass. Non-blocking. |
| Debounce 300ms on search | OK | `src/features/reels/Dashboard.jsx:25` (`SEARCH_DEBOUNCE_MS = 300`) + `:99-109` (setTimeout in effect, cleared on unmount or change). E2E test `tests/reels_list_pagination.spec.js:147-183` verifies that 8 keystrokes in 2 bursts produce ≤3 list requests. |
| URL state lives in search params with snake_case keys | OK | `src/features/reels/Dashboard.jsx:81-82` (read via `useSearchParams`), `:486-500` (`updateSearchParams` writes snake_case via `camelToSnake`), `:497-499` (drops `page=1` / `page_size=25` for clean URLs). |
| `react-router-dom` was already in deps (not newly added) | OK | `package.json:24` already had `"react-router-dom": "^6.28.0"`. `git diff package.json` shows ONLY `"license": "GPL-2.0-only"` added; no dependency change. Confirmed `BrowserRouter` already wired in `src/main.jsx:2`. |
| Reset rule: filter / q / pageSize → page=1; only nav buttons mutate page | OK | `src/features/reels/Dashboard.jsx:152-154` (`setFilter` always sends `page: 1`), `:309-314` (page-size change sends `page: 1`), `:103-106` (q debounce sends `page: 1`), `:156-158` (`goToPage` is the only mutation that preserves filters and changes only `page`). Test `:128-145` verifies the reset. |
| Page-size dropdown: 10/25/50, default 25 | OK | `src/features/reels/Dashboard.jsx:23-24` (`PAGE_SIZE_OPTIONS = [10, 25, 50]`, `DEFAULT_PAGE_SIZE = 25`) + `:475-479` (`clampSize` falls back to 25 if URL value is not in the set). Test `:87-89` verifies. |
| Skeleton only in table body | OK | `src/features/reels/Dashboard.jsx:344-346` returns `<ReelsSkeleton/>` inside the `<ReelsResults/>` region; toolbar (`:232-283`) + metrics (`:205-215`) + tabs (`:217-230`) live outside and never flicker on filter changes. `:374-392` defines a card / row skeleton with `prefers-reduced-motion` respected in `reels.css:393-399`. |
| Empty state when `count_total === 0`, distinct from loading | OK | `src/features/reels/Dashboard.jsx:344-355` — `if (loading) return <ReelsSkeleton/>` is checked BEFORE `if (countTotal === 0) return <empty/>`, and the empty has `data-testid="reels-empty"` while the skeleton has `data-testid="reels-skeleton"`. Test `:203-213` asserts both are mutually exclusive in DOM. |
| **Implementer flag 1**: `useSearchParams` from `react-router-dom@6.28` (no new dep) | OK | Already in `package.json:24` before this feature. Used by `Dashboard.jsx:2`. Verified `git diff package.json` has zero dep changes. |
| **Implementer flag 2**: collapse 4 metric cards into 1 ("Total reels (current view)") | OK | Previous `Dashboard.jsx` derived 4 counts client-side from the full local array (`countBy(ps) = reels.filter(...).length`). With server-side pagination this can no longer be computed without 4 extra requests; the back doesn't return `count_by_publish_status`. Collapse is justified. `DOCS.md` Backend contract for feature 32 does NOT promise a counts breakdown. Implementer left an explicit open item to add it if leader wants — clean. |
| **Implementer flag 3**: shortcut tabs drive `publish_status` (not dead) | OK | `src/features/reels/Dashboard.jsx:217-230` — each tab `onClick={() => setFilter({ publish_status: tab.publishStatus })}` and `setFilter` (`:152-154`) writes the URL param + resets `page: 1`. Active state derived from URL (`:160-165`). Verified the click path lands at the same handler as the dropdown, so feature parity is real. |
| No TypeScript introduced | OK | `find src -name "*.ts" -o -name "*.tsx"` → empty. `./init.sh` block 4 also confirms. |
| No React Query, MSW, styled-components, Tailwind, CSS-in-JS | OK | `git diff package.json` shows no new dep. `./init.sh` block 4 confirms. |
| Components never `fetch` directly | OK | `grep "fetch(" src/features/reels/` only matches `refetch()` calls (the `useApi` exposed function). Dashboard goes Dashboard → `useReels` → `reelsApi.list` → `apiRequest`. |
| No `VITE_ADMIN_API_TOKEN` / `VITE_*` secret introduced | OK | `grep -r "VITE_ADMIN_API_TOKEN" src/` → empty. |
| Layer rules respected | OK | `src/features/reels/Dashboard.jsx` imports only from `shared/`, `app/providers/` (transitively), `lib/` and same-feature siblings. |

## 2. Acceptance checklist (feature_list.json id=32)

- [x] **`reelsApi.list({...})` builds query correctly and only sends defined params** — `src/features/reels/api.js:29-82`. `buildListQuery` skips `undefined` / `NaN` / empty strings.
- [x] **`useReels` accepts filters + pagination and exposes the state** — `src/features/reels/hooks.js:25-76`. Returns `reels` (not `items`) and `refetch` (not `refresh`) but the rest of the shape matches; behaviour matches the spec.
- [x] **Dashboard shows `‹ Showing A–B of N ›` + page_size dropdown (10/25/50) + filter dropdowns + search** — `src/features/reels/Dashboard.jsx:232-283` (toolbar) + `:394-454` (pagination). E2E `:69-96` smoke confirms presence.
- [x] **Changing page → new request; changing filter or pageSize → reset page=1** — `Dashboard.jsx:152-158`, E2E `:98-145`.
- [x] **State persists in URL search params; pasting a link with `?page=2&page_size=10&q=cranford` reproduces the state** — `Dashboard.jsx:457-467` reads URL on every render. E2E `:185-201` verifies a fresh navigation honours all three params.
- [x] **Search input debounced 300ms (no spam per keystroke)** — `Dashboard.jsx:25,99-109`. E2E `:147-183` asserts ≤3 requests for 8 keystrokes in 2 bursts.
- [x] **`count_total = 0` shows empty state distinct from loading** — `Dashboard.jsx:344-355` + `:347-353` distinct copy when filters are active vs not. E2E `:203-213`.
- [x] **Playwright: page nav, workflow_state filter, q search, URL state reload** — `tests/reels_list_pagination.spec.js` 6 specs × 3 viewports = 18 tests, all green.
- [x] **`npm run lint`, `npm run build`, `npm run test:smoke` green** — see §3.

## 3. Verification re-run (this review)

### `./init.sh`
```
── 5. Lint ─────────────────────────────────────────────
[OK]    lint verde
── 6. Build ────────────────────────────────────────────
[OK]    build verde
── 7. Resumen ──────────────────────────────────────────
[OK]    Entorno listo. Puedes empezar a trabajar.
```
Exit 0.

### `npm run test:smoke`
```
2 skipped
46 passed (36.3s)
```
The 2 skipped are the pre-existing `theme` specs on mobile/tablet viewports (not introduced by this feature).

### `npm run test:e2e tests/reels_list_pagination.spec.js`
```
18 passed (14.6s)
```
All 6 specs × 3 viewports green.

### `npm run test:e2e` (full suite)
Run 1: `1 failed` in `tests/social_templates.spec.js:233:3 [mobile] feature 20 — edit title + add 3 hashtags + save`, `213 passed`, `2 skipped`.
Re-isolated re-run: `30 passed (24.2s)`. Different first failure in another iteration (`feature 8 [desktop] Descriptions subtab loads, edits, and saves via PUT`). Conclusion: pre-existing flake in feature 8/20 specs (network race against `expect.poll`), unrelated to feature 32; spec file was untouched in this implementer's diff. Implementer's report itself reported `214 passed` on a clean run.

## 4. Issues found

### Blocking
- None.

### Non-blocking
- **Naming**: hook exposes `reels` (mapped via `adaptReelSummary`) instead of the spec's `items`, and `refetch` instead of `refresh`. The deviation is consistent with the existing codebase (`useReels` was already exposing `reels`; `useApi` already exposes `refetch`). Renaming for the sake of the spec wording would force changes across consumers that the implementer left alone. Leaving as-is — flag as documentation drift in `feature_list.json` rather than a code change.

### Nit
- `Dashboard.jsx:164` — `match ? match.key : urlState.publishStatus ? '' : '';` collapses to `match ? match.key : ''`. Cosmetic.
- `Dashboard.jsx:131-133` — `showingTo` uses `Math.min(countTotal, showingFrom + reels.length - 1)`. Correct, but `showingFrom + reels.length - 1` would be enough since `reels.length ≤ pageSize` and `countTotal ≥ offset + reels.length`. Cosmetic.
- The "open items 4" in `progress/impl_32.md` mentions `<input type="search">` vs `text`. Implementer's choice (`type="search"`) gives a native clear button on most browsers; harmless.

## 5. Open items for the leader

1. **Manual QA against `:8001`** when 4Reels-Backend feature 32 deploys: follow `progress/impl_32.md` §6 (9 steps). Particularly steps 2, 5, 6, 8 (the actual network shape and debounce behaviour).
2. **Per-status counts** (decision to potentially restore the 4 metric cards or counts badges in the shortcut tabs) requires a back-side companion endpoint (`/reels/counts` or `count_by_publish_status` in the existing list response). If you want them, open a follow-up feature; do NOT block 32 on it — the collapse is correct given the current contract.
3. **Hook naming drift** (`items` vs `reels`, `refresh` vs `refetch`): if you care about strict alignment with `feature_list.json` wording, edit `feature_list.json` to say `reels` / `refetch` (matches reality) rather than asking the implementer to rename existing consumers.
4. **`stableTotal` ref-style state** (`Dashboard.jsx:122-126`) — only used for the "Total reels (current view)" chip to avoid flashing 0 mid-fetch. If you ever switch to a strict "loading hides number" pattern, this can be removed; today it's a UX nicety.

## Checkpoints (CHECKPOINTS.md)

- C1: [x] Arnés completo; `./init.sh` verde.
- C2: [x] Feature 32 está `in_progress`, será marcada `done` por este review. Tests E2E nuevos verdes.
- C3: [x] Sin TS, sin React Query, sin MSW, sin Tailwind. Vanilla CSS. Sin `fetch` directo. Layers respetadas.
- C4: [x] Lint + build + test:smoke verdes. E2E `tests/reels_list_pagination.spec.js` verde.
- C5: [x] El endpoint `GET /v1/admin/agencies/{id}/reels` actualizado en `tests/support/mock-backend.js`; shape coincide con `DOCS.md` § Backend contract (Reels list pagination + filters).
- C6: [x] Sin `console.log` ni `debugger` en `src/features/reels/`. No deps nuevas en `package.json`.
