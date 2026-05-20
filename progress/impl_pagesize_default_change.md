# impl — Reels Dashboard default page size 25 → 10

## Edits applied

### `src/features/reels/Dashboard.jsx`
- Line 16 (JSDoc example URL):
  - Before: `*   ?page=2&page_size=25&workflow_state=needs_approval,approved`
  - After:  `*   ?page=2&page_size=10&workflow_state=needs_approval,approved`
- Line 26 (runtime default):
  - Before: `const DEFAULT_PAGE_SIZE = 25;`
  - After:  `const DEFAULT_PAGE_SIZE = 10;`

`PAGE_SIZE_OPTIONS = [10, 25, 50]` untouched. 25 remains user-selectable.

## Spec adjustments — `tests/reels_list_pagination.spec.js`

Three assertions hardcoded the old default of 25 and were updated to
reflect 10 as the default. The `?page_size=10` reload test (line 185)
was left untouched — its assertions already use 10.

- Test "renders pagination, filters and table without console errors":
  - `Showing 1–25 of 30` → `Showing 1–10 of 30`
  - `size` value `'25'` → `'10'`
  - Comment "default page_size=25" → "default page_size=10"
- Test "navigates page 1 → 2 and updates the table":
  - Property 26 (page-2 sentinel under size 25) → Property 11 (page-2 sentinel under size 10)
  - Summary `Showing 26–30 of 30` → `Showing 11–20 of 30`
  - `page_size` query expected `'25'` → `'10'`
- Test "workflow_state filter filters server-side and resets to page 1":
  - Initial summary on `?page=2` `Showing 26–30 of 30` → `Showing 11–20 of 30`
  - Comment "default page size 25" → "default page size 10"

`tests/support/mock-backend.js` fallback of 25 (line 182) was NOT
touched — the Dashboard always sends an explicit `page_size` in API
calls (via `buildListQuery` in `src/features/reels/api.js`), so the
mock fallback is never exercised by the dashboard path.

## Verification

- `./init.sh` — lint verde, build verde.
- `npm run test:smoke` — 46 passed, 17 skipped (smoke baseline green).
- `npx playwright test tests/reels_list_pagination.spec.js` — 18 passed
  (all 3 viewports × 6 tests).
- `npm run build` — built in 2.46s.

## Dist bundle

- `dist/assets/index-DZfcZMu4.js` (432.98 kB, gzip 124.32 kB)
- `dist/assets/index-CoOSPtmM.css` (131.15 kB, gzip 31.36 kB)
