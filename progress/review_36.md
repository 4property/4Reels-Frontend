# Review — feature 36 (per_reel_subtitles_override_ui)

**Veredicto:** APPROVED

## 1. Refactor evaluation — `src/features/reels/editor/lockedReelHelpers.jsx`

**Clean extraction.** Single source of truth for the 4 pieces explicitly required
by the leader:

- `LOCKED_COPY` (`'Cannot edit a reel that has already been approved'`) — string
  constant exported once (`lockedReelHelpers.jsx:19`).
- `LOCKED_WORKFLOW_STATES` (`new Set(['approved', 'published'])`) —
  `lockedReelHelpers.jsx:21`.
- `isReelClientLocked(reel)` — `lockedReelHelpers.jsx:28-30`.
- `LockedReelBanner` (`testId`, optional `copy`, optional `className`) and
  `RerenderBadge` (`testId`, optional `label`, optional `className`) —
  `lockedReelHelpers.jsx:38-47` and `:55-64`.

`PhotosPanel.jsx` only **imports** the helpers (`PhotosPanel.jsx:5-10`); the
literals are gone (no duplicated `LOCKED_COPY`, no inline banner / badge JSX,
no inline `LOCKED_WORKFLOW_STATES` set). The client gate now reads
`isReelClientLocked(reel) || serverLocked` (`PhotosPanel.jsx:74`), the banner
renders via `<LockedReelBanner testId="photos-locked-banner" />`
(`PhotosPanel.jsx:199`) and the badge via `<RerenderBadge
testId="photos-rerender-badge" />` (`PhotosPanel.jsx:201`). No regression of the
existing `data-testid` selectors.

`SubtitlesPanel.jsx` consumes the **same** import set
(`SubtitlesPanel.jsx:4-9`), uses the same testIds prefixed
`subtitles-locked-banner` / `subtitles-rerender-badge`
(`SubtitlesPanel.jsx:207, 209`), and reuses `LOCKED_COPY` for the 409 feedback
text (`SubtitlesPanel.jsx:134`).

The shared CSS classes are also unified: `editor.css:662` (`.reel-locked-banner`)
and `editor.css:674` (`.reel-rerender-badge`). No leftover
`.photos-locked-banner` / `.photos-rerender-badge` rules remain.

**Sized right for feature 37 (slides).** The components take `testId`, `copy`
and `label` props — slides can pass `testId="slides-locked-banner"` plus an
override copy if needed (e.g. "Re-rendering with new scenes…") without
re-extracting anything. The shared `LOCKED_WORKFLOW_STATES` set is exported so a
hypothetical slides client gate can reuse it verbatim.

**No over-extraction.** The auto-save debounce + optimistic + rollback loop is
NOT factored into a shared hook yet. The implementer's report (§7) defers that
to feature 37 (third call-site) — consistent with the leader's "DON'T pre-factor"
rule from feature 35.

## 2. Per-decision audit table

| Leader decision | File:line | Verified |
|---|---|---|
| `reelsApi.patchReelSubtitles(agencyId, siteId, sourcePropertyId, cues)`, body accepts array / `null` / `[]` | `src/features/reels/api.js:156-160` | OK — `body: { cues: cues == null ? null : cues }`. |
| `useReelSubtitlesOverride` hook | `src/features/reels/hooks.js:250-259` | OK — `useMutation` wrapper around `reelsApi.patchReelSubtitles`, same shape as `useReelPhotosOverride`. |
| Debounce 1 s auto-save, no Save button, multiple edits collapse to ONE PATCH | `src/features/reels/editor/SubtitlesPanel.jsx:51` (`DEBOUNCE_MS = 1000`), `:144-156` (`schedule()` clears + re-arms a single timer), `:97-142` (`flush()` reads latest snapshot from `latestRef`) | OK — verified by E2E specs at `tests/per_reel_subtitles_override.spec.js:98, 136, 162, 185` (each captures `expect(requests.length).toBe(1)` after multiple edits). |
| `in_seconds >= 0` | `SubtitlesPanel.jsx:361-364` | OK — inline error "Start must be ≥ 0 seconds." |
| `out_seconds > in_seconds` | `SubtitlesPanel.jsx:365-368` | OK — inline error "End must be greater than start." |
| No overlap between consecutive cues | `SubtitlesPanel.jsx:377-384` | OK — inline error "Overlaps with cue #N (ends at Xs)." |
| `text` length 1..200 | `SubtitlesPanel.jsx:369-376`, `MAX_TEXT_LEN = 200` at `:53`, `maxLength` on the input at `:300` | OK. |
| Indices unique AND monotonically increasing | `SubtitlesPanel.jsx:108-110` — `index` re-emitted as the array position; comment at `:347-351` calls out that the array position IS the wire index | OK — guarantees uniqueness + monotonicity by construction. |
| On violation: inline RED error on offending row, PATCH NOT fired | `SubtitlesPanel.jsx:81-88` (per-row `rowErrors` map + `hasErrors`), `:106-107` (re-validation at flush time; aborts), `:316-323` (red `.subtitle-row-error` rendered on the row), `editor.css:415-431` (red border/background on `.subtitle-row-invalid` + red text on `.subtitle-row-error`) | OK — verified by E2E `:206` and `:231` (`expect(requests.length).toBe(0)`). |
| Optimistic UI + rollback (same pattern as feature 35) | `SubtitlesPanel.jsx:68-69` (`snapshotRef`, `timerRef`), `:146-150` (snapshot on first edit of cycle), `:126-128` (rollback on flush failure) | OK — same shape as `PhotosPanel.jsx:60-61, 138-139, 116-118`. |
| `Re-rendering…` badge + poll, reuses shared primitive | `SubtitlesPanel.jsx:209` (`<RerenderBadge testId="subtitles-rerender-badge" />`), `:163-170` (1.5 s `setInterval` while `renderStatus === 'pending'`) | OK. |
| 409 banner — `SUBTITLES_OVERRIDE_LOCKED` mapped to existing copy | `SubtitlesPanel.jsx:132-136` (status 409 + code branch → `setServerLocked(true)` + feedback with `LOCKED_COPY`); `:207` renders `<LockedReelBanner testId="subtitles-locked-banner" />` | OK. |
| Mock backend: PATCH `/subtitles` with `extra='forbid'`, per-cue validation, 409 stub, render_status flip ~200 ms | `tests/support/mock-backend.js:656-864` (route + validation + 409 + flip), `:1744` (registered in `isKnownAdminStub`) | OK — per-item validation covers shape, `in_seconds < 0`, `out <= in`, overlap, text length, index monotonicity; emits Pydantic-style `{detail: [{loc, msg, type}]}` shape. |
| Numeric `inSeconds`/`outSeconds` migration in `defaults.js` | `src/features/reels/editor/defaults.js:26-35` | OK — no remaining callers using string times (grepped `\.start`/`\.end` under `src/features/reels/`: zero matches). |
| Hydration order: override → snapshot → seed | `src/features/reels/editor/ReelEditor.jsx:538-558` (`hydrateSubtitles`), `:149-157` (memo + state sync) | OK. |
| DOCS.md § Backend contract — symmetric subtitles block | `DOCS.md:285-319` | OK — mirrors photos block: endpoint, body, strict rules, 200 / 422 / 404 / 409, GET reel-inspector, save mode (1 s debounce, no Save button). |

## 3. Hard rules audit

| Rule | Result |
|---|---|
| No TypeScript leaks in `src/` | `./init.sh` step 4: **OK**. |
| No React Query / MSW / styled-components / Tailwind / CSS-in-JS / new deps | `git diff package.json package-lock.json` shows only a `"license"` field added — zero new deps. `./init.sh` step 4: **OK**. |
| Components don't `fetch` directly; hook → api → `lib/api/client.js` | `SubtitlesPanel.jsx` and `lockedReelHelpers.jsx` have **zero** `fetch`/`XMLHttpRequest`; all writes go through `useReelSubtitlesOverride` → `reelsApi.patchReelSubtitles` → `apiRequest`. |
| Layer rules (shared/, lib/, features/) | `lockedReelHelpers.jsx` lives under `features/reels/editor/`; imports only from `shared/` (`Icon`, `Spinner`). No back-references from `shared/` to `features/`. |
| No `VITE_*` secrets introduced | No `.env*` files changed in this feature (verified with `git diff` on `.env.example`). |
| No `console.*` / `debugger` in production code | All 6 touched JS/JSX files report 0 matches. |
| Selectors in E2E use `getByRole` / `data-testid`, not XPath | `tests/per_reel_subtitles_override.spec.js` uses `data-testid` and `getByRole`. |

## 4. Acceptance checklist (from `feature_list.json` id=36)

- [x] `src/features/reels/api.js: patchReelSubtitles` consumes
  `{cues: [{index, text, in_seconds, out_seconds}, ...]}` — `api.js:156-160`.
- [x] `SubtitlesPanel.jsx`: edits fire PATCH (debounce 1 s); strict client
  validation **blocks** `in >= out` AND overlap with an inline red error
  (decision tightened from "warning" to "error" per leader's strict-mirror
  alignment) — `SubtitlesPanel.jsx:51, 81-110, 316-323`.
- [x] Optimistic UI + rollback on fail — `SubtitlesPanel.jsx:68-69, 126-128,
  146-150`; verified by spec `:280`.
- [x] After successful PATCH, `Re-rendering…` badge until `render_status='done'`
  — `SubtitlesPanel.jsx:163-170, 198, 209`; mock flips status after ~200 ms
  (`mock-backend.js:850-855`).
- [x] 409 shown as banner — `SubtitlesPanel.jsx:132-136, 207`; verified by spec
  `:324`.
- [x] Playwright tests: text edit fires PATCH (`spec:98`), in/out edit fires
  PATCH (`:136`), 409 renders (`:255, :324`); add/delete/validation/rollback
  also covered.
- [x] `npm run lint`, `build`, `test:smoke` green — see §5.

## 5. Verification re-run (this review)

| Step | Result |
|---|---|
| `./init.sh` | **exit 0** — lint green, build green, no TypeScript leaks, no blocklisted libs, 31 features detected. |
| `npm run test:smoke` | **46 passed / 2 skipped** (the 2 pre-existing `theme` skips). |
| `npm run test:e2e -- tests/per_reel_subtitles_override.spec.js tests/per_reel_photos_override.spec.js` | **45 passed** (27 subtitles + 18 photos). Confirms the `lockedReelHelpers.jsx` refactor did NOT regress feature 35. |
| `npm run test:e2e` (full, 306 specs) | **303 passed / 2 skipped / 1 failure**: `tests/social_templates.spec.js:19 [tablet]`. Same pre-existing parallel-load flake documented in `review_35.md` §5. Re-ran `npm run test:e2e -- tests/social_templates.spec.js` → **30/30 passed**, so the failure is not introduced by feature 36 and not a regression of the feature 8 contract. |

## 6. Issues found

None blocking. Minor nits (not required for approval, captured for future
cleanup):

- `SubtitlesPanel.jsx:142` — `flush`'s `useCallback` deps list omits
  `setSubtitles`. Same pattern as `PhotosPanel.jsx:132`; functional setter
  semantics make this safe, but ESLint's exhaustive-deps rule disagrees. Not a
  bug; just inconsistent with the rest of the panel.
- `SubtitlesPanel.jsx:347-387` (`validateCues`) re-iterates the full array on
  every change to compute `rowErrors`. Fine for the realistic ceiling (~30
  cues per reel), but if a future feature pushes that to hundreds we'll want
  to memoize per-cue.
- The auto-save loop (snapshot + debounce + flush + rollback) is now duplicated
  between `PhotosPanel.jsx` and `SubtitlesPanel.jsx`. The implementer's report
  §7 already flags this for extraction into `useReelDebouncedOverride` once
  feature 37 (slides) lands the third call-site — keeping the deferral here.

## 7. Open items — coordination with feature 37 (slides)

Nothing in `lockedReelHelpers.jsx` blocks feature 37's reuse:

- `<LockedReelBanner testId="slides-locked-banner" />` will work as-is.
- `<RerenderBadge testId="slides-rerender-badge" label="Re-rendering with new scenes…" />` if slides wants different copy.
- `isReelClientLocked(reel)` is panel-agnostic; the slides client gate can call
  it verbatim.
- `LOCKED_WORKFLOW_STATES` is exported for the mock backend's slides 409 stub
  (mock-backend.js can reuse the same set, mirroring what the photos and
  subtitles handlers already do).

Suggested follow-up after feature 37 lands (third call-site of the optimistic
debounced PATCH loop): extract `useReelDebouncedOverride(reel, patcher, opts)`
into `src/features/reels/editor/` to dedupe the `snapshotRef` / `timerRef` /
`latestRef` / `flush` / `schedule` plumbing across `PhotosPanel`,
`SubtitlesPanel` and `SlidesPanel`. Not a blocker for feature 36.

## 8. Checkpoint pass (from `CHECKPOINTS.md`)

- C1 (lint + build): [x]
- C2 (no TS, no blocklist libs, no `VITE_*` secrets): [x]
- C3 (components don't fetch directly; hook → api → client): [x]
- C4 (mock route documented in DOCS.md and registered): [x] (`DOCS.md:285-319`,
  `mock-backend.js:1744`).
- C5 (E2E test added, robust selectors): [x] (9 specs × 3 viewports = 27
  passing).
- C6 (no `console.*`, no `debugger`): [x].

## Verdict

**APPROVED.** Feature 36 ships the leader's strict-mirror alignment, reuses the
locked-banner / re-render badge primitives via a clean shared module, keeps
feature 35 green (18/18), and full e2e is green modulo the pre-existing parallel
flake on `social_templates.spec.js` already documented in review_35.
