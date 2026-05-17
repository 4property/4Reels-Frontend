# ReelCard — stack address + price under title

## Scope

Reorder `reel-card-head` in the grid view so the vertical order is:

1. Title (`reel-card-title`)
2. Address (`reel-card-address`)
3. Price (`reel-card-price`)

Previously the price floated to the right of the title via flex
`justify-content: space-between`. Now it sits in the same single
column as title + address.

## Files touched

- `src/features/reels/ReelCard.jsx` — moved `.reel-card-price` inside
  the `.min-w-0.grow` column (under the address). Guarded with a
  conditional so an empty price string doesn't render an empty node
  with top margin.
- `src/features/reels/reels.css` — added `margin-top: var(--space-2)`
  to `.reel-card-price` so it doesn't crowd against the multi-line
  address.

`.reel-card-head` itself was left as-is (still `display: flex` with
`justify-content: space-between`). With only one child column now, it
behaves like a normal block, but the existing rules don't hurt and
keep the door open for re-adding a right-aligned slot later (status
chip, etc.) without restructuring. `ReelsTable.jsx` does not use any
of these classes, so the list view is untouched.

## Price formatting decision

**No reformatting.** `reel.price` is wired through
`src/features/reels/hooks.js` (`adaptReelSummary`) as
`item.price || ''` — the value comes pre-formatted from the backend's
`AgencyReelSummary` payload (tests confirm strings like `'€385,000'`
in `tests/flows.spec.js` and `tests/reel_approve_schedule.spec.js`).

The task brief explicitly said: "Si ya viene formateado como string
desde el mock backend / hooks, NO lo reformatees." So the JSX just
renders `{reel.price}` verbatim. Added a `reel.price ? ... : null`
guard so empty-string prices don't render an empty styled node (with
the new top margin it would have been visible as extra whitespace).

## Commands

- `npm run lint` -> clean (no output, exit 0).
- `npm run build` -> ok, `built in 2.32s`, css `118.23 kB` / js
  `372.70 kB`.

Smoke tests not run (per task scope: lint + build only, plus visual
inspection of CSS).
