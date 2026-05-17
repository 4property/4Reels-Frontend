import { useCallback, useState } from 'react';
import { toast } from '../../../lib/hooks/useToast.js';
import { Cover } from '../../../shared/Cover.jsx';
import { Icon } from '../../../shared/Icon.jsx';
import { useReelPhotosOverride } from '../hooks.js';
import {
  LockedReelBanner,
  RerenderBadge,
} from './lockedReelHelpers.jsx';
import { useReelDebouncedOverride } from './useReelDebouncedOverride.js';

/**
 * Feature 35 — Photos tab: persisted reorder + selected toggle.
 *
 * Backend contract (back feature 35):
 *   PATCH /v1/admin/agencies/{a}/reels/{s}/{p}/photos
 *   Body: { photos: [{ position: int, selected: bool }, ...] | null }
 *     - `null` (or `[]`) clears the override; the next render falls back to
 *       the ingested order + AI-picked selection.
 *   Response 200: { photos_override, render_status: 'pending' }
 *     - The back re-enqueues a render job. The Photos tab flips a small
 *       "Re-rendering..." badge until a subsequent reel refetch reports
 *       `render_status: 'done'`.
 *   Errors:
 *     - 409 PHOTOS_OVERRIDE_LOCKED → reel approved/published; persistent
 *       banner "Cannot edit a reel that has already been approved" and no
 *       further PATCHes are fired. The client gates the same workflow
 *       states up-front so the banner appears even before the first edit.
 *     - 422 → invalid body shape (surfaced verbatim in a toast).
 *     - other → toast with the back's error message.
 *
 * The optimistic + debounce + rollback loop lives in
 * `useReelDebouncedOverride`; this panel only owns the photo-specific UI and
 * builds the PATCH body from `photos`.
 */

const DEBOUNCE_MS = 500;

export function PhotosPanel({
  photos,
  setPhotos,
  agencyId,
  reel,
  refetchReel,
  onMutate,
}) {
  const [dragIdx, setDragIdx] = useState(null);
  const [patch, { loading: saving }] = useReelPhotosOverride();

  // Build the PATCH body from the latest `photos` snapshot — the order is
  // the array index (back persists `position` verbatim) and `selected`
  // mirrors the per-tile toggle state.
  const patchFn = useCallback(
    (desired) =>
      patch({
        agencyId,
        siteId: reel?.siteId,
        sourcePropertyId: reel?.sourcePropertyId,
        photos: desired.map((item, index) => ({
          position: index,
          selected: Boolean(item.selected),
        })),
      }),
    [patch, agencyId, reel?.siteId, reel?.sourcePropertyId],
  );

  const {
    schedule,
    feedback,
    clientLocked,
    rerendering,
  } = useReelDebouncedOverride({
    reel,
    refetchReel,
    latest: photos,
    debounceMs: DEBOUNCE_MS,
    patchFn,
    rollback: setPhotos,
    lockedErrorCode: 'PHOTOS_OVERRIDE_LOCKED',
    successText: 'Re-rendering with new photo order…',
    fallbackErrorText: 'Failed to save photo changes.',
    onMutated: () => {
      toast.success('Photos saved (re-rendering)', { id: 'reel-photos' });
      onMutate?.();
    },
    onError: (_err, text) => {
      toast.error(text || 'Failed to save photo changes.', { id: 'reel-photos' });
    },
  });

  const toggle = (id) => {
    if (clientLocked) return;
    // Functional setter: rapid clicks (or clicks during a pending React
    // commit) must stack on the freshest state, not re-base on the closure
    // value captured at render time. The hook's `latestRef` similarly keeps
    // the deferred flush working off the freshest snapshot.
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)),
    );
    schedule();
  };

  const move = (from, to) => {
    setPhotos((prev) => {
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    if (clientLocked) return;
    // Schedule a flush whenever a drag ends — even if `move()` did not
    // mutate the array (no-op drop on the source tile), `schedule()` will
    // simply collapse with any pending toggles and re-send the latest body.
    schedule();
  };

  return (
    <div className="photos-tab" data-testid="photos-tab">
      {clientLocked && <LockedReelBanner testId="photos-locked-banner" />}

      {rerendering && <RerenderBadge testId="photos-rerender-badge" />}

      {feedback && (
        <div
          className={`photos-feedback photos-feedback-${feedback.tone}`}
          data-testid="photos-feedback"
        >
          <Icon
            name={feedback.tone === 'success' ? 'check' : 'alert'}
            size={12}
          />{' '}
          {feedback.text}
        </div>
      )}

      <div
        className="photos-grid"
        aria-busy={saving ? 'true' : undefined}
        data-testid="photos-grid"
      >
        {photos.map((p, i) => (
          <div
            key={p.id}
            className={`photo-tile ${p.selected ? 'selected' : 'unselected'} ${
              clientLocked ? 'photo-tile-locked' : ''
            }`}
            data-testid={`photo-tile-${i}`}
            draggable={!clientLocked}
            onDragStart={() => {
              if (clientLocked) return;
              setDragIdx(i);
            }}
            onDragOver={(e) => {
              if (clientLocked) return;
              e.preventDefault();
              if (dragIdx !== null && dragIdx !== i) {
                move(dragIdx, i);
                setDragIdx(i);
              }
            }}
            onDragEnd={handleDragEnd}
            onClick={() => toggle(p.id)}
            aria-disabled={clientLocked ? 'true' : undefined}
          >
            {p.url ? (
              <img
                src={p.url}
                alt={p.label || ''}
                loading="lazy"
                className="photo-tile-img"
              />
            ) : (
              <Cover kind={p.kind} ratio="3/4" label={p.label} />
            )}
            <div className={`photo-badge-index ${p.selected ? 'on' : 'off'}`}>
              {p.selected ? `#${photos.filter((x) => x.selected).indexOf(p) + 1}` : '—'}
            </div>
            {p.aiScore != null && <div className="photo-badge-ai">AI {p.aiScore}</div>}
            <div className="photo-foot">
              <span className="photo-label">{p.label}</span>
              <span className="drag-handle" style={{ color: 'white' }}>
                <Icon name="grip" size={14} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
