# Review — feature 35 (`per_reel_photos_override_ui`)

**Verdict:** APPROVED

## 1. Per-decision audit

| Leader decision | Where it lives | Verdict |
|-----------------|----------------|---------|
| `reelsApi.patchReelPhotos(agencyId, siteId, sourcePropertyId, photos)` — body `{ photos }`, accepts array / `null` / `[]` | `src/features/reels/api.js:135-139` (`body: { photos: photos == null ? null : photos }`) | OK. `[]` passes through verbatim and the mock collapses it to `null` (per the back's "list is empty ≡ clear"). Pydantic `extra='forbid'` documented in the JSDoc (`api.js:125-127`). |
| `useReelPhotosOverride` hook in `src/features/reels/hooks.js` | `src/features/reels/hooks.js:213-222` | OK. Pattern mirrors `useReelMusicOverride` (`hooks.js:191-200`). Exposes `loading`/`error` via `useMutation`. |
| Debounce 500 ms — multiple changes collapse to ONE PATCH with the latest snapshot | `src/features/reels/editor/PhotosPanel.jsx:38` (`DEBOUNCE_MS = 500`), `:134-146` (`schedule()` resets a single `setTimeout`), `:93-99` (`flush()` reads `latestRef.current`). Verified by spec `tests/per_reel_photos_override.spec.js:174-202` (three clicks → `patches.length === 1`). | OK. |
| Optimistic UI + rollback to pre-edit snapshot, toast with server error | `PhotosPanel.jsx:165-184` (functional `setPhotos`), `:136-140` (`snapshotRef` captured on first edit of debounce cycle), `:114-131` (rollback + `setFeedback` on failure). Verified by spec `tests/per_reel_photos_override.spec.js:227-271` (500 path). | OK. The snapshot is captured BEFORE the first edit of each debounce cycle and cleared on flush completion — clean. |
| `Re-rendering…` badge while `render_status == 'pending'`, removed when `done`, 1.5 s poll that stops on unmount / when state leaves pending | `PhotosPanel.jsx:39` (`RERENDER_POLL_MS = 1500`), `:156-163` (effect installs `setInterval` only when `renderStatus === 'pending'` and `refetchReel` is a function; cleanup returns `clearInterval`). | OK. The mock flips `render_status` back to `'done'` after ~200 ms (`tests/support/mock-backend.js:623-628`); spec `:127-134` asserts the badge appears and then hides. |
| 409 banner — persistent, copy `"Cannot edit a reel that has already been approved"` (same pattern as feature 25) | `PhotosPanel.jsx:42` (`LOCKED_COPY`), `:72-74` (`clientLocked` derived from `rawWorkflowState ∈ {approved, published}` OR `serverLocked`), `:122-126` (sets `serverLocked` on 409 `PHOTOS_OVERRIDE_LOCKED`), `:199-206` (banner). Feature 25 compared at `MusicOverridePanel.jsx:50-72` — feature 35 escalates to a persistent banner (correct, since feature 25 only displays inline feedback; the spec explicitly mandated "banner persistente"). | OK. Both client-gated and server-gated flows render the same banner; spec `:204-225` and `:273-314` exercise both. |
| Mock backend — PATCH `/photos` stores override; flips `render_status: pending → done` after ~200 ms; 409 stub for approved/published; GET reel surfaces `photos_override` | `tests/support/mock-backend.js:498-637` (PATCH route with `extra='forbid'` validation, per-item Pydantic-shape validation, 404 / 409 / 422 / 200 paths), `:623-628` (setTimeout flips `pending → done`), `:653-687` (GET reel embeds `photos_override`, GET `/images` reads `reel.images`), `:1514` (registered in `isKnownAdminStub`) | OK. |
| `DOCS.md` § Backend contract has the symmetric photos block | `DOCS.md:267-285` (Per-reel photos override block — endpoint, body, 200/422/404/409, badge / banner UX) | OK. |

## 2. `useReelImages` memo fix — evaluation

The fix is at `src/features/reels/hooks.js:247-257`:

```js
const images = useMemo(() => {
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((item) => ({
    position: item.position,
    url:
      (item.has_local_file &&
        reelsApi.imageFileUrl(agencyId, siteId, sourcePropertyId, item.position)) ||
      item.image_url ||
      '',
  }));
}, [data, agencyId, siteId, sourcePropertyId]);
```

**Accepted as a real bug fix.** Reasoning:

1. The `images` array is consumed downstream by
   `ReelEditor.jsx:124` (`livePhotos = useMemo(() => images.map(...), [images, overrideByPosition])`)
   and by `:139-141` (`useEffect(() => setPhotos(livePhotos), [livePhotos])`).
   Without memoisation, `useReelImages` returned a freshly-allocated array on
   every render of the editor. That made `livePhotos`'s `useMemo` recompute,
   `livePhotos` get a new ref, and the `setPhotos(livePhotos)` effect fire,
   wiping the optimistic toggle/reorder state. Feature 35 surfaced the
   problem because it's the first feature that mutates `photos` between
   renders; pre-feature-35 `PhotosPanel` only mutated local state once at
   mount and never had a test that detected the reset.
2. The dependency array `[data, agencyId, siteId, sourcePropertyId]` is
   sufficient and complete: every value referenced inside the lambda
   (`data.items`, `agencyId`, `siteId`, `sourcePropertyId` and the static
   `reelsApi.imageFileUrl` function) is either in the deps or a module-level
   constant. `useApi`'s `data` only swaps reference when `setData(res)` runs
   (`src/lib/hooks/useApi.js:32-35`), so the memo correctly invalidates on
   real refetches and is stable otherwise.
3. Consumer survey: `grep -rn useReelImages src/ tests/` returns one
   non-definition consumer — `ReelEditor.jsx:29,93`. The new memo cannot
   break anyone else.
4. The post-PATCH flow remains sound: a successful PATCH calls
   `refetchReel()` (not `refetchImages()`), so `images` ref is unchanged;
   the reel-driven `overrideByPosition` updates, `livePhotos` recomputes
   with the new selected flags, the effect re-syncs `photos`. That is the
   desired behaviour: optimistic state was correct, server state now
   confirms it.
5. The feature-35 E2E spec (`tests/per_reel_photos_override.spec.js`)
   would have failed before the fix: the `multiple changes within 500 ms`
   case (`:174-202`) and the `drag-to-reorder` case (`:137-172`) both rely
   on the local `photos` state surviving across React renders between user
   actions. Today all 18 specs pass (see §5).

## 3. Acceptance checklist (feature 35)

- [x] `src/features/reels/api.js`: `patchReelPhotos` consumes
      `{ photos: [{ position, selected }, …] | null }`. — `api.js:135-139`.
- [x] PhotosPanel: reorder fires PATCH with 500 ms debounce; toggle fires
      PATCH with 500 ms debounce; multiple changes <500 ms collapse to one
      request. — `PhotosPanel.jsx:38,134-146`; spec `:174-202`.
- [x] Optimistic UI with rollback on failure; toast carries the back's
      message. — `PhotosPanel.jsx:114-131`; spec `:227-271`.
- [x] After successful PATCH the UI reads `render_status` and shows the
      `Re-rendering…` badge until `done`. — `PhotosPanel.jsx:156-163,
      195,208-212`; spec `:127-134`.
- [x] 409 renders the persistent banner with the exact copy. —
      `PhotosPanel.jsx:42,199-206`; spec `:204-225` (client-gated) and
      `:273-314` (server-gated).
- [x] Playwright tests for reorder, toggle, 409. — covered + extra cases
      (debounce collapse, 500 rollback, server-side 409).
- [x] `npm run lint`, `npm run build`, `npm run test:smoke` green. — see §5.

## 4. Architecture & hard rules

- **Layer rules.** Components reach the backend through `hooks.js → api.js →
  lib/api/client.js`. No `fetch(` in `PhotosPanel.jsx` or `ReelEditor.jsx`.
  `grep -n "fetch(" src/features/reels/editor/PhotosPanel.jsx
  src/features/reels/editor/ReelEditor.jsx` → 0 hits.
- **Stack.** All new files are `.js`/`.jsx`. No TypeScript, no React Query,
  no MSW, no styled-components, no Tailwind, no CSS-in-JS. `git diff
  package.json package-lock.json` shows only a `"license"` field added to
  `package.json`; no dependency change.
- **VITE_\* secrets.** None introduced.
- **`console.log` / `debugger`.** `grep` over the 6 touched source files →
  0 hits.
- **Conventions.** PascalCase component, kebab-case CSS classes (`photos-tab`,
  `photos-locked-banner`, `photos-rerender-badge`, `photos-feedback`,
  `photo-tile-locked`), `useX` hook name. All consistent with
  `docs/conventions.md`.
- **Mock = spec.** PATCH `/photos` handler shape mirrors the documented
  contract (200 → `{ photos_override, render_status: 'pending' }`, 409
  `PHOTOS_OVERRIDE_LOCKED`, 404 `ADMIN_REEL_NOT_FOUND`, 422 detail). Path
  registered in `isKnownAdminStub` (`tests/support/mock-backend.js:1514`).
- **CHECKPOINTS C1-C6.** All green (lint/build/smoke/e2e green except
  pre-existing flakes documented below; no console/debugger; no untracked
  garbage; feature stays `in_progress` until the leader closes it).

## 5. Verification re-run

| Step | Result |
|------|--------|
| `./init.sh` | exit 0 — node v24.14.1, lint green, build green. |
| `npm run test:smoke` | 46 passed / 2 skipped (the 2 `theme` skips are pre-existing). |
| `npx playwright test tests/per_reel_photos_override.spec.js` | **18 passed** (6 specs × 3 viewports). |
| `npm run test:e2e` (full) | 275 passed / 2 skipped / **2 failures**: `tests/social_templates.spec.js:19 [tablet]` and `tests/templates.spec.js:17 [mobile]`. Both recover when re-run in isolation (`npx playwright test tests/social_templates.spec.js tests/templates.spec.js` → **33 passed**). Same pre-existing parallel-load flake documented in `progress/review_32.md` / `review_33.md`; neither file is touched by feature 35. |

## 6. Issues found

- **Blocking:** none.
- **Non-blocking:** none.
- **Nits:**
  - `PhotosPanel.jsx:267` recomputes `photos.filter((x) => x.selected).indexOf(p) + 1`
    per tile per render. With 8-20 photos this is fine; if the panel grows
    to hundreds of tiles, precompute the index once before the `.map(...)`.
  - The `Re-rendering…` badge is hard-coded English (`PhotosPanel.jsx:210`).
    The implementer flagged it as a follow-up; the repo has no i18n catalog
    yet, so this is consistent with the rest of the editor.
  - `flush()` in `PhotosPanel.jsx:93-132` is missing a deps entry for
    `setPhotos` (used inside the catch). The current behaviour is correct
    because `setPhotos` is the React-provided stable setter, but adding it
    to the deps array would silence a future ESLint exhaustive-deps lint
    if someone tightens the rule. (Not blocking; status quo passes lint.)

## 7. Open items

- **Manual QA against :8001 (back feature 35 deployed).** Not performed by
  this reviewer — recommended by the implementer at `progress/impl_35.md`
  §7. Worth a 5-minute pass through the listed 8 steps before relying on
  the override in production traffic, especially step 7 (banner appears on
  a freshly-approved reel) and step 8 (single PATCH inside the 500 ms
  window) since they exercise integration points the mock can't fully
  replicate.
- **Carry-over for features 36 (subtitles) and 37 (slides):** both will
  share the `Re-rendering…` badge + 409 banner pattern. Suggested re-use
  surface (do **NOT** pre-factor as part of feature 35):
  - The pair `(LOCKED_COPY, photos-locked-banner, photos-rerender-badge)`
    in `PhotosPanel.jsx:42` + `editor.css:619-642`. If feature 36/37 needs
    the same shape, factor a small `<EditorReRenderBadge>` /
    `<EditorLockedBanner>` primitive under
    `src/features/reels/editor/` then. Premature factoring now would
    require deciding the copy customisation hooks before there are two
    real call-sites.
  - The debounce + rollback pattern (`PhotosPanel.jsx:38,93-146`). It's
    short enough to copy-paste once for feature 36 and abstract on the
    second repeat (feature 37). The leader's note "don't pre-factor" is
    correct.
- **Polling cleanup contract.** The poll's `useEffect` returns
  `clearInterval` and depends on `renderStatus`, so unmounting the editor
  or leaving the pending bucket both stop it. No leaked interval observed
  in the 18 e2e specs (no warning in the console-error guard).
