import { Icon } from '../../../shared/Icon.jsx';
import { Spinner } from '../../../shared/Spinner.jsx';

/**
 * Shared primitives for per-reel editor panels that talk to the
 * `/reels/{site}/{prop}/<resource>` PATCH endpoints (feature 35 photos,
 * feature 36 subtitles, future feature 37 slides).
 *
 * The backend gates writes when the reel is approved/published and returns
 * 409 `<RESOURCE>_OVERRIDE_LOCKED`. Every panel mirrors the same gate on the
 * client (so the banner appears before the first edit) and surfaces the same
 * "Re-rendering…" badge while the worker is busy re-rendering the reel.
 *
 * Reusable as standalone components — the per-panel `data-testid` keeps the
 * existing E2E selectors stable (`photos-locked-banner`,
 * `subtitles-locked-banner`, etc.).
 */

export const LOCKED_COPY = 'Cannot edit a reel that has already been approved';

export const LOCKED_WORKFLOW_STATES = new Set(['approved', 'published']);

/**
 * Returns `true` when the reel's workflow_state is in the back's gated set
 * (the client mirrors the back's 409 contract so the banner appears
 * up-front, no round-trip needed).
 */
export function isReelClientLocked(reel) {
  return LOCKED_WORKFLOW_STATES.has(String(reel?.rawWorkflowState || ''));
}

/**
 * Persistent banner shown above any per-reel override panel when the reel
 * can no longer be edited. `testId` lets each panel keep its own selector
 * (`photos-locked-banner`, `subtitles-locked-banner`, …) so E2E tests are
 * specific to the panel under test.
 */
export function LockedReelBanner({ testId, copy = LOCKED_COPY, className = '' }) {
  return (
    <div
      className={`reel-locked-banner ${className}`}
      data-testid={testId}
    >
      <Icon name="alert" size={13} /> {copy}
    </div>
  );
}

/**
 * Small inline badge shown while the back's worker is re-rendering the reel.
 * The owning panel decides when to show it based on the reel's
 * `render_status` field and refetches periodically until it leaves the
 * `'pending'` bucket.
 */
export function RerenderBadge({ testId, label = 'Re-rendering…', className = '' }) {
  return (
    <div
      className={`reel-rerender-badge ${className}`}
      data-testid={testId}
    >
      <Spinner /> {label}
    </div>
  );
}
