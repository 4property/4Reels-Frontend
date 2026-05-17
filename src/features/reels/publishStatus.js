/**
 * Maps the backend publish state to the badge status the UI renders.
 *
 * Backend axes:
 *   - `publish_status` — outcome/stage of the publish step. Values actually
 *     emitted by `/opt/projects/4Reels-Backend` today (confirmed by grep):
 *       - `pending`         — initial, before the pipeline processes it
 *                             (_ingest_property_assets.py:192).
 *       - `pending_review`  — waiting for human approval
 *                             (publish_reel.py:225). This is the actual value
 *                             the user sees today; `awaiting_review` is
 *                             preserved in the mapping as a **legacy alias**
 *                             for backcompat with old data.
 *       - `pending_publish` — after approve, before the worker publishes
 *                             to the networks (admin_reels_router.py:169).
 *       - `skipped`         — the pipeline decided not to publish
 *                             (publish_reel.py:188,324).
 *       - `failed`          — the publish job failed
 *                             (publish_reel.py:311).
 *       - `rejected`        — the user rejected manually
 *                             (reject_reel.py).
 *       - `published`       — publication completed.
 *       - `partial`         — published on some networks but not all.
 *   - `workflow_state` — pipeline stage, used as fallback when
 *     `publish_status` is empty (very early in the pipeline).
 *
 * UI badges (see `src/shared/StatusBadge.jsx`):
 *   - `published`      — green. Includes `partial` and `approved` (published
 *                        on some networks but not all; still a real
 *                        publication, not something to approve).
 *   - `rejected`       — red. The user rejected manually.
 *   - `failed`         — red. The publish job failed (distinct from rejected).
 *   - `needs-approval` — yellow. Waiting on a human decision. Covers both
 *                        `pending_review` (current value) and `awaiting_review`
 *                        (legacy alias).
 *   - `publishing`     — blue. Between approve and the real publication
 *                        (`pending_publish`).
 *   - `skipped`        — neutral. The pipeline decided to skip publication.
 *   - anything else → unmapped string (falls through to the generic label).
 */
/**
 * Feature 21: states where the backend's
 * `PATCH .../reels/.../descriptions` endpoint accepts edits. Anything outside
 * this set returns 409 `REEL_NOT_EDITABLE` (see
 * `progress/review_21_per_reel_description_override_endpoint.md` in the
 * back repo, decision §5). Empty string matches the very first row right
 * after `build_empty_reel_state` — before the pipeline ever ran.
 */
export const EDITABLE_PUBLISH_STATUSES = new Set([
  '',
  'pending',
  'pending_review',
  'needs-approval',
]);

export function isPublishStatusEditable(rawPublishStatus) {
  return EDITABLE_PUBLISH_STATUSES.has(String(rawPublishStatus || ''));
}

export function mapPublishStatus(publishStatus, workflowState) {
  const status = String(publishStatus || workflowState || '').toLowerCase();
  if (status === 'published' || status === 'approved' || status === 'partial') return 'published';
  if (status === 'rejected') return 'rejected';
  if (status === 'failed') return 'failed';
  if (status === 'awaiting_review' || status === 'pending_review') return 'needs-approval';
  if (status === 'pending_publish') return 'publishing';
  if (status === 'skipped') return 'skipped';
  return status || 'pending';
}
