# Feature 40 — manual_reel_regenerate_button (implementer report)

> Feature 40 in `feature_list.json`. Status: `in_progress` (the implementer
> does not mark `done`; the reviewer does).

## 1. API method + hook signature

**API** (`src/features/reels/api.js`):

```js
reelsApi.regenerateReel(agencyId, siteId, sourcePropertyId, reason);
// → POST /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/regenerate
// Body: {}            when reason === undefined
//        { reason }   when reason is a string
// 200:  { render_status: 'pending', job_id: string, queued_at: ISO8601 }
// 409:  REGENERATE_PUBLISHED_FORBIDDEN | REGENERATE_ALREADY_IN_FLIGHT
// 404:  ADMIN_REEL_NOT_FOUND
```

Method follows the same shape as `patchReelPhotos`/`patchReelSubtitles`/
`patchReelSlides` (also under `reelsApi`), but POST without a wrapper key.
Pydantic-style `extra='forbid'` documented in the JSDoc.

**Hook** (`src/features/reels/hooks.js`):

```js
useRegenerateReel({ reel, agencyId, refetchReel })
  → { triggerRegenerate, isRegenerating, errorCode, rerendering }
```

Behaviour:

- `triggerRegenerate(reason?)`: fires the POST; on success awaits
  `refetchReel()` so the reel record (and its `renderStatus`) refreshes.
- On 409 (`REGENERATE_PUBLISHED_FORBIDDEN` / `REGENERATE_ALREADY_IN_FLIGHT`)
  sets `errorCode` and re-throws so the caller can surface its own toast.
- `rerendering` is derived from `reel.renderStatus === 'pending'`. The hook
  owns the 1.5 s poll loop (`setInterval` + cleanup) for as long as
  `rerendering` is true, calling `refetchReel` on each tick until upstream
  flips out of `'pending'`.

## 2. Button placement

`src/features/reels/editor/ReelEditor.jsx` line ~431 (in the `EditorHeader`
helper component, on the right-hand side, immediately after
`<div className="editor-header-sep" />` and BEFORE the existing
`Regenerate with AI` stub button).

`EditorHeader` was extended with three new props (`agencyId`,
`refetchReel`, `onMutate`) so `<RegenerateReelButton />` can wire into the
existing editor session refetch + Dashboard `markMutated` plumbing.

Visibility rules (encoded inside `RegenerateReelButton.jsx`):

- Hidden entirely when `reel.renderStatus === 'failed'` (different UX flow,
  out of scope).
- Hidden when the reel never finished a render (e.g. `'pending'` initial
  state without `rerendering`).
- Visible when `renderStatus` is in `{'completed', 'done'}` or when the
  reel is currently re-rendering.
- Visible but `disabled` with the `title="Re-rendering is disabled for
  published reels."` tooltip when `reel.rawPublishStatus === 'published'`.

The existing `Regenerate with AI` stub button is left intact (different
label + `coming-soon` className + permanent `disabled`) — keeping it
avoids touching other tests that may rely on the header layout.

## 3. Confirm modal — primitive reused

Modal uses the existing `modal-backdrop / modal-panel / modal-header /
modal-title / modal-sub / modal-footer` CSS primitives in
`src/styles/surfaces.css` (same primitives as `CreateAgencyModal.jsx` and
`NotificationSettings.jsx`). No new CSS was added.

Inline `RegenerateConfirmModal` lives in
`src/features/reels/editor/RegenerateReelButton.jsx` since there is only
one consumer; extracting a generic `<ConfirmModal>` would be premature.

Modal copy: `"This will re-render the reel using the current photos,
subtitles and slides settings. Continue?"` with `Cancel` / `Render again`
buttons. The latter shows a `<Spinner />` while the POST is in flight.

## 4. Mock backend changes

`tests/support/mock-backend.js`:

- New `await page.route(/\/regenerate(\?|$)/, ...)` handler immediately
  after the existing approve/reject handler:
  - `extra='forbid'` on the body wrapper (only `reason` is accepted; any
    other key triggers a 422 via the existing `extraForbiddenError`
    helper).
  - 404 `ADMIN_REEL_NOT_FOUND` when the tuple is unknown.
  - 409 `REGENERATE_PUBLISHED_FORBIDDEN` when
    `reel.publish_status === 'published'`.
  - 409 `REGENERATE_ALREADY_IN_FLIGHT` when the reel record has
    `_rerendering === true` (tests pre-seed this flag to trigger the
    case; the mock also sets it during the in-flight window).
  - Happy path: flips `render_status` to `'pending'` and sets
    `_rerendering = true` on the in-memory reel; ~400 ms later a setTimeout
    flips both back (`render_status: 'done'`, `_rerendering: false`).
    The response is `{ render_status: 'pending', job_id: 'mock-render-job-N',
    queued_at: '<iso>' }`.
- Added the new regex to `isKnownAdminStub` so a missed route surfaces a
  loud failure rather than a silent 404 from the test harness.

## 5. Tests added

`tests/manual_reel_regenerate.spec.js` — 4 specs × 3 viewports = 12 cases:

| Spec | Coverage |
|---|---|
| Happy path | open editor of completed reel → click `Render again` → confirm modal appears → click confirm → mock receives `POST /regenerate` with `{}` body → `<RerenderBadge />` visible → after ~400 ms badge clears. |
| Published reel | reel seeded with `publish_status='published'` → button visible but `disabled` with the documented tooltip; force-click does not fire any POST. |
| In-flight reel | reel seeded with `_rerendering=true` → click → confirm → mock returns 409 `REGENERATE_ALREADY_IN_FLIGHT` → `data-testid="toast-error"` surfaces the documented copy. |
| Cancel modal | click `Render again` → click `Cancel` → modal hides → no POST is sent. |

## 6. Verification output

- `./init.sh` — exit 0 (lint + build green; feature_list.json valid; no TS;
  package.json clean).
- `npx playwright test tests/manual_reel_regenerate.spec.js` — 12 passed
  (4 specs × 3 viewports), 15.1 s.
- `npm run test:smoke` — 46 passed / 2 skipped, 37.5 s.
- Regression on per-reel override tests:
  `npx playwright test tests/per_reel_photos_override.spec.js tests/per_reel_subtitles_override.spec.js tests/per_reel_slides_override.spec.js`
  → 63 passed (features 35-37 untouched).
- Regression on the broader editor suite:
  `npx playwright test tests/reel_descriptions_override.spec.js tests/reel_music_override.spec.js tests/reel_approve_schedule.spec.js tests/reels_dashboard_live_sync.spec.js`
  → 39 passed (features 10, 21, 25, 39 untouched).

## 7. Open items + manual QA checklist for :8001

Open items:

- The button surfaces on `renderStatus === 'completed'` AND
  `renderStatus === 'done'`. The back's feature 40 spec uses `'completed'`;
  the mock used `'done'` historically and the per-reel override panels also
  flip through `'done'`. Accepting both keeps the existing seeded data
  green; if the back is strict about emitting only `'completed'`, the
  `COMPLETED_RENDER_STATUSES` set in `RegenerateReelButton.jsx` is the
  single chokepoint.
- The hook re-throws the 409 errors so the button-level `try/catch` can
  pick the right toast copy. The `errorCode` state is currently surfaced
  to the caller but unused by the button itself (the button uses the
  thrown error). Leaving it exposed lets future consumers (e.g. a banner)
  read the last error code without re-throwing.
- No analytics/audit hook for the `reason` parameter yet — the button
  always sends `{}` because there's no UI today to capture a reason.
  Adding a textarea inside the modal is a trivial follow-up.

Manual QA against :8001 (back feature 40 already deployed):

1. Connect a GHL agency that has at least one reel with
   `render_status='completed'` and `publish_status` ∈ {pending,
   pending_review, needs-approval, ''}.
2. Open `/reels` → click the reel card → wait for the editor overlay.
3. Confirm the `Render again` button is visible in the header (right side,
   before `Regenerate with AI`) and enabled.
4. Click the button → confirm the modal renders the documented copy
   and a Cancel + Render again pair.
5. Click `Cancel` → modal disappears, no network request fired (DevTools).
6. Re-open the modal → click `Render again` → DevTools shows a
   `POST /v1/admin/agencies/{aid}/reels/{site}/{prop}/regenerate` with an
   empty `{}` body and a 200 response `{render_status, job_id, queued_at}`.
7. Confirm the `<RerenderBadge />` (blue pill with spinner) appears next to
   the button and that DevTools shows the editor polling
   `GET /reels/.../{site}/{prop}` every ~1.5 s.
8. Wait ~2 min for the worker; the badge should disappear once the back
   surfaces `render_status: 'completed'` (or whatever the back's terminal
   bucket is — see Open items above).
9. Trigger a second POST while the first is still pending → DevTools
   should show a 409 `REGENERATE_ALREADY_IN_FLIGHT` and a red toast at
   bottom-right with the documented copy.
10. Approve and publish the reel through the existing approve flow →
    re-open the editor → confirm the button is visible but `disabled`
    with the `title="Re-rendering is disabled for published reels."`
    tooltip on hover.
11. Manually craft a POST against a published reel via DevTools → confirm
    a 409 `REGENERATE_PUBLISHED_FORBIDDEN` and the toast copy "Cannot
    re-render a published reel".

## 8. Files touched

- `src/features/reels/api.js` — added `reelsApi.regenerateReel`.
- `src/features/reels/hooks.js` — added `useRegenerateReel` (and imported
  `useCallback`, `useEffect`, `useState`).
- `src/features/reels/editor/ReelEditor.jsx` — imported and mounted
  `<RegenerateReelButton />` inside `EditorHeader` (header right side);
  extended `EditorHeader` signature with `agencyId`, `refetchReel`,
  `onMutate`.
- `src/features/reels/editor/RegenerateReelButton.jsx` — NEW component
  (button + inline confirm modal, reuses `<RerenderBadge />` from
  `lockedReelHelpers.jsx`).
- `tests/support/mock-backend.js` — added POST `/regenerate` route handler;
  registered the path in `isKnownAdminStub`.
- `tests/manual_reel_regenerate.spec.js` — NEW spec (4 cases).
- `feature_list.json` — status `pending → in_progress` for id=40.
- `progress/current.md` — appended the feature 40 session block.
- `progress/impl_40.md` — this report.
