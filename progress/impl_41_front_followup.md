# Feature 41 — front follow-up (auto-subtitles snapshot mapper)

Backend feature 41 moved the auto-generated subtitle cues from the
nested `publish_target_snapshot.subtitles` (which was never populated)
to a dedicated top-level field `publish_subtitles_snapshot` on
`AgencyReelItemPayload`, persisted in the `reels.auto_subtitles_snapshot`
column. Pre-fix, the front mapper kept reading the old nested path and
the Subtitles tab therefore showed empty cues until the editor fell back
to its in-app `CRANFORD_SUBTITLES` seed. This change rewires the front
mapper to consume the new top-level field, updates the mock backend so
the local Playwright contract matches the real backend, and refreshes
the contract section of DOCS.md.

## Files touched

- `src/features/reels/hooks.js` — `useReel`'s adapter for the per-reel
  GET. The `publishSubtitlesSnapshot` branch now reads
  `raw.publish_subtitles_snapshot` (top-level array) instead of
  `raw.publish_target_snapshot?.subtitles`. The JSDoc above the
  `subtitlesOverride` block was rephrased to call out feature 41 and
  the `reels.auto_subtitles_snapshot` column. No cue-shape transform —
  the editor's `hydrateSubtitles` already normalises snake_case to
  camelCase (`in_seconds` → `inSeconds`, `out_seconds` → `outSeconds`),
  so passing the array through verbatim is exactly what the consumer
  expects (and the mock seeds the same snake_case shape).

- `tests/support/mock-backend.js` — the per-reel GET stub now spreads
  `publish_subtitles_snapshot: null` (with a comment pointing back at
  feature 41) alongside the existing nullable defaults. Tests that need
  to exercise the auto-snapshot path can seed the field on the reel
  record; existing tests that didn't set it continue to see `null`,
  which preserves the pre-41 fallback behaviour into
  `CRANFORD_SUBTITLES`.

- `DOCS.md` § Backend contract — the "Per-reel subtitles override"
  bullet now points at `publish_subtitles_snapshot` instead of the old
  `publish_target_snapshot.subtitles` path; a new "Auto-subtitles
  snapshot (feature 41)" bullet documents the top-level field, its
  shape, and the editor's seeding semantics.

## Mock backend update

Only the per-reel GET response shape changed: it now includes
`publish_subtitles_snapshot: null` as one of the spread defaults
(diff is exactly one new key + the surrounding comment). No mock
endpoint was added or removed; no test fixture needed updating
because the existing `per_reel_subtitles_override.spec.js` cases seed
`subtitles_override` (not the auto snapshot) and therefore exercise
the override branch of `hydrateSubtitles`, which has not changed.

## Verification

- `./init.sh` → green (lint + build).
- `npm run test:smoke` → 46 passed, 17 skipped (the 17 skipped are the
  documented `integration_smoke_e2e` cases that need a live backend on
  the loopback adapter, unchanged by this PR).
- `npx playwright test tests/per_reel_subtitles_override.spec.js
  --project=desktop` → 9 passed (all feature 36 cases still hold).
- `npm run test:e2e` → 343 passed, 20 skipped (same integration smoke
  cases skipped under all three viewports). No new flakes.
- `npm run build` → green; new bundle hashes:
  - `dist/assets/index-D7eexeWv.js` (432.98 kB / gzip 124.32 kB)
  - `dist/assets/index-CoOSPtmM.css` (131.15 kB / gzip 31.36 kB)
- `package.json` / `package-lock.json` untouched (no new dep added).

## Manual QA checklist for the user

1. Open the editor on any reel that has been **rendered after the
   backend feature-41 restart** and that does NOT yet have a
   `subtitles_override` set (i.e. only the auto-captions snapshot
   exists). URL: `/reels/{site_id}/{source_property_id}`.
2. Confirm the Subtitles tab is selected by default and the cue list
   renders with **real text** (the Gemini-generated cues), not the
   CRANFORD design seed and not an empty list.
3. Edit any cue's text — confirm a single PATCH to
   `/reels/{site_id}/{source_property_id}/subtitles` fires after the
   1 s debounce, body wraps a `cues:[…]` array that includes the new
   text plus the seeded timings copied verbatim from the snapshot.
   This is the moment the snapshot is "promoted" into a real
   `subtitles_override`.
4. Refresh the editor — cues now come from `subtitles_override` (the
   override has higher precedence) and match what you typed.
5. On a brand-new reel where the worker hasn't run yet (snapshot still
   null), the panel keeps showing the in-app `CRANFORD_SUBTITLES` seed
   exactly like pre-41.

## Decisions

- Kept `descriptionsBySnapshot` reading from
  `publish_target_snapshot.descriptions_by_platform` — that wire path
  is still valid for feature 21; only the subtitles half of the
  snapshot moved out in feature 41.
- Did not introduce camelCase translation in the mapper. The editor's
  `hydrateSubtitles` already does that mapping (`cue.in_seconds`,
  `cue.out_seconds`) and changing it here would risk breaking the
  symmetric `subtitlesOverride` branch which feeds the same helper.
