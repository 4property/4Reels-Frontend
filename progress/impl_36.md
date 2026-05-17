# Feature 36 — per_reel_subtitles_override_ui (implementer report)

Estado en `feature_list.json`: `in_progress` (no se marca `done` por contrato del implementer).

## 1. Refactor: `lockedReelHelpers.jsx`

Extracted from `PhotosPanel.jsx` (feature 35) into shared module
`src/features/reels/editor/lockedReelHelpers.jsx`:

- `LOCKED_COPY` (`'Cannot edit a reel that has already been approved'`).
- `LOCKED_WORKFLOW_STATES` (`new Set(['approved', 'published'])`).
- `isReelClientLocked(reel)` — boolean helper for the client gate.
- `<LockedReelBanner testId copy? className? />` — persistent red banner.
- `<RerenderBadge testId label? className? />` — small "Re-rendering…"
  badge with `<Spinner />`.

**Props signature** (kept minimal for reuse with feature 37 slides next):

```jsx
<LockedReelBanner testId="photos-locked-banner" />
<LockedReelBanner testId="subtitles-locked-banner" />
<RerenderBadge testId="photos-rerender-badge" />
<RerenderBadge testId="subtitles-rerender-badge" />
```

`testId` is per-panel so existing E2E selectors (feature 35) keep
working unchanged. `copy` and `label` default to the shared copy but
each panel can override (e.g. feature 37 may want "Re-rendering with
new scenes…"). The shared CSS classes are `.reel-locked-banner` and
`.reel-rerender-badge` — feature 35's old `.photos-locked-banner` /
`.photos-rerender-badge` CSS rules were renamed to the shared classes
(no DOM class collisions because the panels emit the shared classes).
`.photos-feedback*` and the new `.subtitles-feedback*` are kept
per-panel because the feedback text differs (different copy, different
saving lifecycle).

`PhotosPanel.jsx` now consumes the helpers — the locked banner and
the badge are rendered through the shared components, and the
client-gate check uses `isReelClientLocked(reel) || serverLocked`.
The feature 35 tests (`tests/per_reel_photos_override.spec.js`) pass
unchanged because the `data-testid` selectors and the visible copy are
identical.

## 2. Files touched

| File | Type | Change |
|---|---|---|
| `src/features/reels/editor/lockedReelHelpers.jsx` | shared module (new) | Extracted banner + badge primitives + client-gate helper. |
| `src/features/reels/editor/PhotosPanel.jsx` | component (refactor) | Replaced inline banner + badge JSX with `<LockedReelBanner />` / `<RerenderBadge />`; replaced `LOCKED_WORKFLOW_STATES` literal with `isReelClientLocked(reel)`. |
| `src/features/reels/editor/SubtitlesPanel.jsx` | component (rewrite) | Was state-local stub; now connected: debounced 1 s auto-save, strict client validation, optimistic + rollback, locked banner, rerender badge, polling. |
| `src/features/reels/editor/ReelEditor.jsx` | component | Hydrate `subtitles` from `reel.subtitlesOverride` → `reel.publishSubtitlesSnapshot` → seed; pass `agencyId`/`reel`/`refetchReel` to panel; removed `feature-stub` wrapper. |
| `src/features/reels/editor/defaults.js` | seed | `CRANFORD_SUBTITLES` migrated from `start/end` strings to numeric `inSeconds`/`outSeconds`. |
| `src/features/reels/editor/editor.css` | CSS | Renamed `.photos-locked-banner` / `.photos-rerender-badge` → `.reel-locked-banner` / `.reel-rerender-badge`; added `.subtitles-tab`, `.subtitle-row-invalid`, `.subtitle-row-error`, `.subtitle-row-locked`, `.subtitles-feedback{,-success,-danger}`. |
| `src/features/reels/api.js` | api | Added `patchReelSubtitles(agencyId, siteId, sourcePropertyId, cues)`. |
| `src/features/reels/hooks.js` | hook | Added `useReelSubtitlesOverride`; `useReel` adapter exposes `subtitlesOverride` + `publishSubtitlesSnapshot`. |
| `tests/support/mock-backend.js` | mock | Added PATCH `/subtitles` handler (extra='forbid', strict per-item validation, 409 locked, render_status flip pending→done); surfaced `subtitles_override: null` default in reel GET; registered the new path in `isKnownAdminStub`. |
| `tests/per_reel_subtitles_override.spec.js` | E2E (new) | 9 specs × 3 viewports. |
| `DOCS.md` | docs | Added "Per-reel subtitles override (feature 36)" block in § Backend contract. |
| `feature_list.json` | state | Status of feature 36 → `in_progress`; description tightened to reflect strict-error (not warning) validation. |

## 3. Mock handler changes

**New route:** `PATCH /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/subtitles`.

- Validates `extra='forbid'` on the wrapper (only `cues` is allowed).
- Validates each item shape: `{index:int, text:str, in_seconds:float,
  out_seconds:float}`.
- Validates the same strict rules the back will (in≥0, out>in, no
  overlap, 1≤len(text)≤200, indices strictly increasing). Emits the
  Pydantic-style `{detail: [{loc, msg, type}]}` shape on 422.
- Returns `{subtitles_override, render_status: 'pending'}` on 200;
  flips render_status back to `'done'` after ~200 ms (same trick as
  photos so the `Re-rendering…` badge appears briefly in E2E).
- Returns 409 `SUBTITLES_OVERRIDE_LOCKED` when
  `workflow_state ∈ {approved, published}` (uses the existing
  `LOCKED_WORKFLOW_STATES` set hoisted by feature 35).
- Returns 404 `ADMIN_REEL_NOT_FOUND` when the tuple is unknown.

The reel GET handler was extended to surface `subtitles_override: null`
as a default (overridden by whatever the test seeds on the reel
record). `isKnownAdminStub` now matches `…/reels/{site}/{prop}/subtitles`.

## 4. DOCS.md update

Added a new bullet "Per-reel subtitles override (feature 36)" in
`DOCS.md` § Backend contract, directly under the photos block.
Mirrors the photos contract:
endpoint, body shape, strict validation rules, response, 422/404,
409 banner copy, GET reel-inspector behaviour, save mode (1 s
debounce, no Save button).

## 5. Tests added + photos regression check

**New:** `tests/per_reel_subtitles_override.spec.js` — 9 specs:

1. Edit cue text → ONE debounced PATCH with the new text.
2. Edit in/out timing → ONE PATCH with the new times.
3. Add cue → PATCH includes the new cue.
4. Delete cue → PATCH excludes the deleted cue.
5. Validation: `in >= out` → inline error + no PATCH fired.
6. Validation: overlap → inline error + no PATCH.
7. Approved reel → locked banner + inputs disabled + no PATCH.
8. PATCH fail (500) → rollback to pre-edit text + feedback shown.
9. Server-side 409 `SUBTITLES_OVERRIDE_LOCKED` → locked banner.

Each runs across the 3 viewports (desktop / tablet / mobile) =
**27 specs**.

**Regression:** `tests/per_reel_photos_override.spec.js`
re-ran in the same session: 18/18 pass after the lockedReelHelpers
refactor. The DOM selectors and visible copy are identical to before;
the only change is that the banner/badge JSX is sourced from a shared
component.

## 6. Verification output

| Step | Result |
|---|---|
| `./init.sh` | exit 0 (lint + build green; 31 features detected; no TypeScript leaks) |
| `npm run lint` | green (no warnings) |
| `npm run build` | green — `dist/assets/index-DCrk8-l0.css 129.99 kB`, `dist/assets/index-B8y-x-6Y.js 421.08 kB` |
| `npm run test:smoke` | **46 passed / 2 skipped** (the 2 pre-existing `theme` skips). |
| `npx playwright test tests/per_reel_subtitles_override.spec.js tests/per_reel_photos_override.spec.js` | **45 passed** (27 subtitles + 18 photos) |
| `npm run test:e2e` (full suite, 306 specs) | **303 passed / 2 skipped / 1 fail**: `tests/social_templates.spec.js:19 [desktop]`. Re-ran the file in isolation → **10/10 passed**. This is the well-known parallel-load flake already documented in `progress/current.md` (review_35 noted the same spec flaking on the second run). Not introduced by feature 36 (the failing assertion is on the social-templates PUT — unrelated to subtitles). |

## 7. Open items for reviewer / coordination with feature 37 (slides)

- `lockedReelHelpers.jsx` is intentionally minimal so feature 37 can
  reuse it as-is. Suggested testId conventions for slides:
  `slides-locked-banner` / `slides-rerender-badge`. The `copy` and
  `label` props are already wired if slides wants different language.
- If feature 37 ends up sharing the auto-save debounce + optimistic +
  rollback loop, factoring those into a `useReelDebouncedOverride`
  hook is the obvious next refactor — but per leader guidance on
  feature 35 ("DON'T pre-factor; reuse only after the 2nd call-site
  exists"), we stuck to extracting only the locked banner + badge
  primitives this round. Once feature 37 lands a 3rd call-site, that
  hook becomes the natural extraction.
- The Subtitles panel currently does not expose a "reorder" affordance
  — the back's monotonic index rule + a flat numeric edit makes
  re-ordering implicit (you simply change the times). If feature 37
  adds an explicit reorder UI for slides, we may want to extend
  SubtitlesPanel symmetrically; left as a separate UX call.
- The `feature-stub` wrapper was removed from the Subtitles tab in
  `ReelEditor.jsx`. The badge `preview` next to the tab label is gone
  too — Subtitles is now a "live" tab. Slides + Voiceover keep their
  preview badges since they remain stubs until features 37 / 38.

## 8. Manual QA checklist for `:8001`

(Back feature 36 must be deployed; see `feature_list.json` id=36
`depends_on`.)

1. Open `https://4reelsback-test.4property.com/reels/{site}/{prop}`
   for a reel whose `workflow_state ∈ {pending, awaiting_review}`.
2. Switch to the **Subtitles** tab. Confirm rows hydrate from
   `subtitles_override` (or `publish_target_snapshot.subtitles` if no
   override is set). If neither is present, the in-app seed shows up.
3. Edit a cue's text. Wait ~1 s. Confirm in DevTools network panel
   that **one** `PATCH …/subtitles` fires with the new `cues` array.
4. Edit a cue's `in` / `out`. Same: one PATCH with the new times.
5. Click **Add line** → confirm a new cue with `text: "New subtitle"`
   appears at the bottom with `in_seconds = previous_out`,
   `out_seconds = previous_out + 2`. A PATCH should fire 1 s later.
6. Click the trash icon on a cue → cue removed, PATCH fires.
7. Set `out_seconds` of cue #1 below its `in_seconds` → inline red
   error appears on that row and NO PATCH fires until the value is
   fixed.
8. Set cue #2's `in_seconds` lower than cue #1's `out_seconds` → red
   overlap error on cue #2, NO PATCH fires.
9. After a successful PATCH, the small "Re-rendering…" badge appears
   at the top of the panel. It clears once the worker reports
   `render_status: 'done'` (the panel polls every 1.5 s).
10. Approve / publish the reel (or use a reel already in those states)
    → the locked banner appears, every input is disabled, and trying
    to edit any field does nothing (no PATCH attempted).
11. (Edge) If the back returns 409 mid-edit (e.g. another user just
    approved), the locked banner appears as soon as the PATCH lands
    and further edits are blocked client-side.
