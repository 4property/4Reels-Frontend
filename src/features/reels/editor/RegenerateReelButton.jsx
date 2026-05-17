/**
 * Feature 40 — manual reel re-render button.
 *
 * Header affordance that fires `POST /reels/.../regenerate` after a confirm
 * modal. Visible only when the reel is in a state where re-rendering makes
 * sense — i.e. `render_status` is `'completed'` (the back's terminal-success
 * bucket) or `'done'` (the mock backend's equivalent). Hidden when the reel
 * is in `'failed'` (different UX flow — see leader notes). Visible but
 * disabled (with a tooltip) when the reel is published, so the affordance
 * stays discoverable but the user can't accidentally re-render a live reel.
 *
 * Re-rendering feedback: while the worker is busy, the button neighbours a
 * `<RerenderBadge />` (reused from `lockedReelHelpers`) so the user has the
 * same visual cue as the per-panel override flows (photos/subtitles/slides).
 */
import { useState } from 'react';
import { toast } from '../../../lib/hooks/useToast.js';
import { Icon } from '../../../shared/Icon.jsx';
import { Spinner } from '../../../shared/Spinner.jsx';
import { useRegenerateReel } from '../hooks.js';
import { RerenderBadge } from './lockedReelHelpers.jsx';

const PUBLISHED_TOOLTIP = 'Re-rendering is disabled for published reels.';
const COMPLETED_RENDER_STATUSES = new Set(['completed', 'done']);

export function RegenerateReelButton({ reel, agencyId, refetchReel, onMutate }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { triggerRegenerate, isRegenerating, rerendering } = useRegenerateReel({
    reel,
    agencyId,
    refetchReel,
  });

  const renderStatus = String(reel?.renderStatus || '');
  const isPublished = String(reel?.rawPublishStatus || '') === 'published';
  // Hide entirely when render_status is `'failed'` — a different UX flow is
  // planned for that bucket and we don't want to muddle the affordance here.
  if (renderStatus === 'failed') return null;
  // Only surface the button once the reel has completed at least one render.
  // While the worker is busy (`'pending'`) the badge alone tells the story;
  // a "Render again" button there would be a near-duplicate of the existing
  // per-panel debounce-driven re-renders.
  if (!COMPLETED_RENDER_STATUSES.has(renderStatus) && !rerendering) return null;

  const handleConfirm = async () => {
    setConfirmOpen(false);
    try {
      await triggerRegenerate();
      if (typeof onMutate === 'function') {
        try {
          onMutate();
        } catch {
          // Defensive: a notification side-effect must never break the flow.
        }
      }
      toast.success('Re-rendering the reel…');
    } catch (err) {
      const status = err?.status;
      const code = err?.body?.error || err?.body?.code || '';
      if (status === 409 && code === 'REGENERATE_PUBLISHED_FORBIDDEN') {
        toast.error('Cannot re-render a published reel');
        return;
      }
      if (status === 409 && code === 'REGENERATE_ALREADY_IN_FLIGHT') {
        toast.error('A render is already in progress for this reel');
        return;
      }
      const fallback =
        err?.body?.message || err?.message || 'Failed to re-render the reel.';
      toast.error(fallback);
    }
  };

  return (
    <>
      {rerendering && (
        <RerenderBadge testId="regenerate-rerender-badge" />
      )}
      <button
        className="btn"
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={isPublished || isRegenerating || rerendering}
        title={isPublished ? PUBLISHED_TOOLTIP : undefined}
        data-testid="regenerate-reel-button"
      >
        {isRegenerating ? <Spinner /> : <Icon name="refresh" size={14} />}{' '}
        Render again
      </button>
      {confirmOpen && (
        <RegenerateConfirmModal
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleConfirm}
          isSubmitting={isRegenerating}
        />
      )}
    </>
  );
}

function RegenerateConfirmModal({ onCancel, onConfirm, isSubmitting }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal-panel"
        style={{ maxWidth: 460 }}
        onClick={(event) => event.stopPropagation()}
        data-testid="regenerate-confirm-modal"
      >
        <div className="modal-header">
          <div>
            <div className="modal-title">Re-render this reel?</div>
            <div className="modal-sub">
              This will re-render the reel using the current photos, subtitles
              and slides settings. Continue?
            </div>
          </div>
          <button className="icon-btn" onClick={onCancel} type="button">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-footer">
          <button
            className="btn"
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            data-testid="regenerate-cancel"
          >
            Cancel
          </button>
          <button
            className="btn primary"
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            data-testid="regenerate-confirm"
          >
            {isSubmitting ? <Spinner /> : <Icon name="refresh" size={13} />}{' '}
            Render again
          </button>
        </div>
      </div>
    </div>
  );
}
