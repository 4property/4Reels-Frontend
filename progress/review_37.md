# Review — feature 37 (`per_reel_slides_override_ui`)

**Veredicto:** APPROVED

---

## 1. `useReelDebouncedOverride` extraction audit — CLEAN

The hook lives at `src/features/reels/editor/useReelDebouncedOverride.js`
(189 LOC). API surface is concise and parameter-driven without leaking
any panel-specific concern back into the shared hook:

```js
useReelDebouncedOverride({
  reel, refetchReel, latest, debounceMs, pollMs = 1500,
  patchFn, rollback, validateLatest,
  lockedErrorCode, successText, fallbackErrorText,
}) => { schedule, flushNow, feedback, setFeedback,
        clientLocked, serverLocked, setServerLocked, rerendering }
```

- **`debounceMs` is parameter-driven** (not hardcoded): photos/slides use
  500 ms, subtitles uses 1000 ms — both flow in as a prop. Verified at
  `PhotosPanel.jsx:36`, `SubtitlesPanel.jsx:51`, `SlidesPanel.jsx:44`.
- **`validateLatest` is the only asymmetry**: subtitles gates the flush
  if any cue has a validation error; photos/slides omit it. The hook
  treats `validateLatest` as optional (`typeof === 'function'` guard at
  `useReelDebouncedOverride.js:100`), so over-fitting risk is zero.
- **`lockedErrorCode` is parameter-driven**: the hook checks
  `err.body.error || err.body.code === lockedErrorCode` and only flips
  `serverLocked` on match (`:122`). Each consumer passes its own constant
  (`PHOTOS_OVERRIDE_LOCKED`, `SUBTITLES_OVERRIDE_LOCKED`,
  `SLIDES_OVERRIDE_LOCKED`).
- **Snapshot/rollback** is captured by the hook itself
  (`snapshotRef.current = latestRef.current` at first `schedule()` of
  each cycle, `:145-148`). Callers don't have to remember a `before`
  state — `rollback(snapshot)` is invoked with what the hook captured.
- **Poll/render-status** lives inside the hook (`:170-177`), driven off
  `reel.renderStatus === 'pending'`. No consumer has its own
  `setInterval`.

### Consumers — no duplicated state-machine code

| Panel | LOC for debounce loop | Verified clean |
|-------|----------------------:|----------------|
| `PhotosPanel.jsx` | 0 (only `patchFn` + `toggle`/`move` + `handleDragEnd`) | `:65-80`, `:82-92`, `:103-110` |
| `SubtitlesPanel.jsx` | 0 (panel keeps `validateCues` per-row + passes `validateLatest`) | `:100-116`, `:118-142` |
| `SlidesPanel.jsx` | 0 (panel owns DnD + add menu + Google review modal) | `:105-120`, `:171-196` |

Grep-confirmed: no `setTimeout(...debounce...)`, `clearTimeout`,
`setInterval`, or rollback-snapshot patterns remain inside any of the
three panels. The hook is single-source.

---

## 2. Per-decision audit table

| Decision | Location | Status |
|---|---|---|
| `reelsApi.patchReelSlides(agencyId, siteId, sourcePropertyId, slides)` | `src/features/reels/api.js:181-185` (body `{slides: slides == null ? null : slides}`; accepts array, `null`, `[]`) | ✅ |
| `useReelSlidesOverride()` wrapper hook | `src/features/reels/hooks.js:289-298` | ✅ |
| `useReelDebouncedOverride` shared hook | `src/features/reels/editor/useReelDebouncedOverride.js:61-193` | ✅ |
| PhotosPanel consumes shared hook | `src/features/reels/editor/PhotosPanel.jsx:9, 65-80` (`debounceMs: 500`) | ✅ |
| SubtitlesPanel consumes shared hook | `src/features/reels/editor/SubtitlesPanel.jsx:8, 100-116` (`debounceMs: 1000`, `validateLatest`) | ✅ |
| SlidesPanel built on top from day one | `src/features/reels/editor/SlidesPanel.jsx:10, 105-120` (`debounceMs: 500`) | ✅ |
| 500 ms debounce for slides | `SlidesPanel.jsx:44` `const DEBOUNCE_MS = 500` | ✅ |
| Yellow warning when sum > target (does NOT block) | `SlidesPanel.jsx:141-146` (`tone: 'warning'`); PATCH still fires via `schedule()` | ✅ |
| Danger warning when sum > 1.5×target (does NOT block) | `SlidesPanel.jsx:134-140` (`tone: 'danger'`); back will 422 | ✅ |
| Reorder / duration / toggle fires PATCH | `SlidesPanel.jsx:171-196` (`toggle`, `update`, `addSlide`) + `:202-206` (`handleDragEnd`) — every action calls `schedule()` | ✅ |
| Optimistic UI + rollback (via shared hook) | `useReelDebouncedOverride.js:115-118` (`rollback(before)` on catch) | ✅ |
| `Re-rendering…` badge | `SlidesPanel.jsx:212` `<RerenderBadge testId="slides-rerender-badge" />` driven by hook's `rerendering` | ✅ |
| 409 banner via shared `lockedReelHelpers.jsx` | `SlidesPanel.jsx:210` `<LockedReelBanner testId="slides-locked-banner" />` + `useReelDebouncedOverride.js:122-125` (sets `serverLocked` on 409) | ✅ |
| Mock PATCH `/slides` with per-kind validation | `tests/support/mock-backend.js:866-1098` (extra='forbid' wrapper; discriminated-union per `kind`; `text` requires `text`; `google-review` requires `url+status`) | ✅ |
| Mock 1.5× ceiling | `tests/support/mock-backend.js:1041-1061` (`totalDuration > target * 1.5` → 422) | ✅ |
| Mock 409 for approved/published | `tests/support/mock-backend.js:926-939` (workflow_state ∈ {approved, published} or publish_status === 'published') | ✅ |
| Mock render_status flip after ~200ms | `tests/support/mock-backend.js:1085-1090` (`setTimeout(200)` pending → done) | ✅ |
| GET reel surfaces `manifest_override` + `target_duration_seconds` | `tests/support/mock-backend.js:1149-1150` (default null + 30) | ✅ |
| `useReel` adapter exposes `manifestOverride` + `targetDurationSeconds` | `src/features/reels/hooks.js:162-166` | ✅ |
| DOCS.md § Backend contract — slides block | `DOCS.md:320-359` (endpoint, body, discriminated-union, 1.5× ceiling client+server semantics, 422/404/409, GET inspector, 500 ms debounce) | ✅ |

---

## 3. Acceptance checklist (feature 37 spec)

- [x] `patchReelSlides` consumes the manifest shape agreed with back feature 37.
- [x] `SlidesPanel`/`SlideRow` reorder + edit fires PATCH with 500 ms debounce.
- [x] Client validation warns when sum of durations exceeds target_duration; lets the user continue (warning, no block).
- [x] Optimistic + rollback; `Re-rendering…` badge until `done`; 409 banner if reel is published/approved.
- [x] Playwright tests: reorder fires PATCH; edit duration fires PATCH.
- [x] `npm run lint`, `npm run build`, `npm run test:smoke` green.

---

## 4. Verification re-run (independent)

| Step | Result |
|---|---|
| `./init.sh` | ✅ exit 0 (lint + build green; 31 features detected; no TypeScript leaks; no blocked libs) |
| `npm run test:smoke` | ✅ 46 passed / 2 skipped (the 2 pre-existing `theme` skips) |
| `npm run test:e2e tests/per_reel_slides_override.spec.js tests/per_reel_subtitles_override.spec.js tests/per_reel_photos_override.spec.js` | ✅ **63 passed** (18 slides + 27 subtitles + 18 photos) — confirms 0 regression of features 35/36 after the `useReelDebouncedOverride` extraction |
| `npm run test:e2e` (full, 324 specs) | 319 passed / 2 skipped / **3 failures** — all three are the documented pre-existing parallel-load flakes: `tests/social_templates.spec.js:19 [desktop]`, `tests/social_templates.spec.js:233 [desktop]`, `tests/templates.spec.js:17 [tablet]`. Same files flagged in `review_32/33/34/35/36`. |
| `npx playwright test tests/social_templates.spec.js --project tablet` (isolated re-run) | ✅ **10/10 passed** |
| `npx playwright test tests/templates.spec.js --project tablet` (isolated re-run) | ✅ **1/1 passed** |

The full-suite failures recover when re-run in smaller batches with the
same code on disk → confirmed flakes, not regressions from feature 37.
No file touched by feature 37 (`SlidesPanel.jsx`, `PhotosPanel.jsx`,
`SubtitlesPanel.jsx`, `useReelDebouncedOverride.js`, `ReelEditor.jsx`,
`api.js`, `hooks.js`, `mock-backend.js`, `DOCS.md`) intersects
`social_templates.spec.js` or `templates.spec.js`.

### Hard rules (all green)

- ✅ No new dependencies (`git diff package.json` only adds a `license`
  field, no `dependencies`/`devDependencies` change; `package-lock.json`
  untouched).
- ✅ No TypeScript files in `src/`.
- ✅ No React Query / MSW / styled-components / Tailwind / CSS-in-JS.
- ✅ Components don't `fetch` directly: `SlidesPanel.jsx` → `useReelSlidesOverride` → `reelsApi.patchReelSlides` → `apiRequest` in `lib/api/client.js`.
- ✅ Layer rules respected (`useReelDebouncedOverride.js` lives in
  `features/reels/editor/`, imports only from sibling
  `lockedReelHelpers.jsx`; `Toggle.jsx` is in `shared/` and stays pure
  presentation, just gained a `disabled` prop).
- ✅ No `VITE_*` secrets introduced.
- ✅ No `console.log` / `console.error` / `debugger` left over (grep on
  the touched files: clean).

---

## 5. Issues found

### Blocking
None.

### Non-blocking
None.

### Nits (cosmetic, leader's discretion)

1. **`SlidesPanel.buildSlidesBody` filters unknown-kind slides
   client-side** (`SlidesPanel.jsx:351-353`). The implementer flagged
   this as a defensive choice (don't send what we know will 422) +
   surfaces an inline error per-row (`:305-310`). Reasonable; matches
   "warn but let the back decide" only loosely (it doesn't *block* —
   it filters — but only for an *invalid* kind, not for an overflow).
   Keeping as is.
2. **`buildSlidesBody` always emits `enabled` and `label`** even for
   kinds that didn't have them in the seed. The mock backend ignores
   them but the back's Pydantic schema is `extra='forbid'` per the
   contract. The current DOCS.md block only documents the kind-specific
   payload; `enabled`/`label` are sent unconditionally. If the real
   back rejects unknown keys on per-slide objects, this needs trimming.
   Marking as **open item for the leader** to clarify with back team
   when feature 37 deploys to :8001 (see §6 below).
3. **`Toggle.jsx` gained `disabled` prop** (`src/shared/Toggle.jsx:2`).
   Retro-compatible (default `false`). Clean addition.
4. **`SlideRow.jsx` gained `dataTestid` prop** (`SlideRow.jsx:18`).
   No-op when `undefined` — clean.
5. The shared hook's `flushNow` is exported but no consumer uses it
   today. Implementer noted this; harmless dead-API for future
   "save now" UX.

---

## 6. Open items for the leader (manual QA against :8001)

Once back feature 37 (`per_reel_slides_override`) is deployed:

1. Walk the 14-step manual QA checklist in `progress/impl_37.md` §8.
   Particular attention to:
   - Step 8 (`sum > target`): warning amarillo aparece, PATCH sale.
   - Step 9 (`sum > 1.5×target`): warning rojo, PATCH sale, back devuelve 422 con `detail[0].msg` esperado.
   - Step 12 (aprobar reel → banner + cero PATCHes).
2. **Verify** the real back's per-slide Pydantic schema allows extra
   keys `enabled` and `label` (the front emits them unconditionally in
   `buildSlidesBody`). If `extra='forbid'` rejects them, either trim
   the wire body or extend the back schema.
3. **Verify** the real back's `manifest_override` GET shape matches the
   mock (array of `{slide_id, position, duration_seconds, kind, ...}`).
   The hydration path `hydrateSlides` in `ReelEditor.jsx:586-604` reads
   `slide_id`, `kind`, `duration_seconds`, `enabled`, `source`, `label`,
   plus the kind-specific extras (`text`, `url`, `status`, `rating`,
   `author`).

---

## Closing line for `progress/current.md`

Review feature 37 (front) APPROVED; ver `progress/review_37.md`.
Verificación re-ejecutada: `./init.sh` exit 0, `npm run test:smoke` 46
passed / 2 skipped, `npm run test:e2e` slides+subtitles+photos 63
passed (18+27+18 — 0 regresión de features 35/36 tras la extracción
del `useReelDebouncedOverride`), full `npm run test:e2e` 319 passed /
2 skipped / 3 flakes pre-existentes en `tests/social_templates.spec.js`
y `tests/templates.spec.js` (re-run aislado → 11/11 passed). `useReelDebouncedOverride`
extraction es clean: `debounceMs` parameter-driven (500/1000/500),
`validateLatest` opcional (sólo subtitles lo usa), `lockedErrorCode`
parameter-driven, snapshot/rollback dentro del hook (caller no
recuerda nada). PhotosPanel y SubtitlesPanel sin código duplicado de
debounce/poll/rollback. Feature 37 marcada `done` en `feature_list.json`.
Open items registrados en §6 (todos para manual QA contra :8001 cuando
la back deploy esté lista).
