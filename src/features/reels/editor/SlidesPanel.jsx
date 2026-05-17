import { useCallback, useMemo, useState } from 'react';
import { toast } from '../../../lib/hooks/useToast.js';
import { Icon } from '../../../shared/Icon.jsx';
import { useReelSlidesOverride } from '../hooks.js';
import { GoogleReviewModal } from './GoogleReviewModal.jsx';
import {
  LockedReelBanner,
  RerenderBadge,
} from './lockedReelHelpers.jsx';
import { SlideRow } from './SlideRow.jsx';
import { useReelDebouncedOverride } from './useReelDebouncedOverride.js';

/**
 * Feature 37 — Slides tab: persisted scene manifest edits (reorder, duration,
 * visibility, kind-specific payloads).
 *
 * Backend contract (back feature 37):
 *   PATCH /v1/admin/agencies/{a}/reels/{s}/{p}/slides
 *   Body: { slides: [{ slide_id: str, position: int,
 *                      duration_seconds: float, kind: str,
 *                      ...kind-specific fields }, ...] | null }
 *     - `null` (or `[]`) clears the override; the next render falls back to
 *       the default scene manifest (agency intro/outro + AI-picked beats).
 *     - The wire shape is a flat list. Replace semantics, not patch.
 *     - Pydantic `extra='forbid'` on the wrapper: only the `slides` key is
 *       accepted on the top-level body.
 *   Response 200: { manifest_override, render_status: 'pending' }
 *     - The back re-enqueues a render job. The panel flips a small
 *       "Re-rendering…" badge until a subsequent reel refetch reports
 *       `render_status: 'done'`.
 *   Errors:
 *     - 409 SLIDES_OVERRIDE_LOCKED → reel approved/published; persistent
 *       banner "Cannot edit a reel that has already been approved" and no
 *       further PATCHes are fired.
 *     - 422 → unknown kind, missing kind-specific fields, or sum of
 *       durations > 1.5x target. The client warns before the user gets
 *       there but lets them persist (back decides).
 *     - other → toast with the back's error message.
 *
 * Save mode: auto-save debounced 500 ms — every edit (reorder, duration,
 * toggle, kind-specific update) collapses with any pending change into one
 * PATCH whose body is the latest snapshot.
 */

const DEBOUNCE_MS = 500;
const DEFAULT_TARGET_DURATION_SECONDS = 30;

const ALLOWED_KINDS = new Set([
  'intro-video',
  'outro-video',
  'google-review',
  'text',
  'photo',
]);

const ADD_OPTIONS = [
  { id: 'intro-video', icon: 'play', label: 'Intro video', sub: 'Custom intro for this reel' },
  { id: 'outro-video', icon: 'film', label: 'Outro video', sub: 'Custom closing frame' },
  { id: 'google-review', icon: 'star', label: 'Google review', sub: 'Paste a review URL' },
  { id: 'text', icon: 'type', label: 'Text slide', sub: 'Plain text on brand colors' },
  { id: 'photo', icon: 'image', label: 'Photo slide', sub: 'Single photo with caption' },
];

const PRESETS = {
  'intro-video': { kind: 'intro-video', label: 'Intro · Custom', duration: 2.5 },
  'outro-video': { kind: 'outro-video', label: 'Outro · Custom', duration: 3 },
  'google-review': {
    kind: 'google-review',
    label: 'Google Review',
    duration: 5,
    url: '',
    status: 'empty',
  },
  text: { kind: 'text', label: 'Text slide', duration: 3, text: 'New price!' },
  photo: { kind: 'photo', label: 'Photo slide', duration: 2.5 },
};

export function SlidesPanel({
  slides,
  setSlides,
  agencyId,
  reel,
  refetchReel,
  targetDurationSeconds,
  onMutate,
}) {
  const [dragIdx, setDragIdx] = useState(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [reviewModal, setReviewModal] = useState(false);
  const [patch, { loading: saving }] = useReelSlidesOverride();

  const target = Number.isFinite(targetDurationSeconds) && targetDurationSeconds > 0
    ? Number(targetDurationSeconds)
    : DEFAULT_TARGET_DURATION_SECONDS;

  const patchFn = useCallback(
    (desired) =>
      patch({
        agencyId,
        siteId: reel?.siteId,
        sourcePropertyId: reel?.sourcePropertyId,
        slides: buildSlidesBody(desired),
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
    latest: slides,
    debounceMs: DEBOUNCE_MS,
    patchFn,
    rollback: setSlides,
    lockedErrorCode: 'SLIDES_OVERRIDE_LOCKED',
    successText: 'Re-rendering with new slide order…',
    fallbackErrorText: 'Failed to save slide changes.',
    onMutated: () => {
      toast.success('Slides saved (re-rendering)', { id: 'reel-slides' });
      onMutate?.();
    },
    onError: (_err, text) => {
      toast.error(text || 'Failed to save slide changes.', { id: 'reel-slides' });
    },
  });

  // Client-side duration validation. Less strict than the back — we never
  // block the PATCH, just surface a warning so the user can correct if they
  // want. The back's 1.5x ceiling is the hard cap (422); below that the
  // worker accepts but the resulting reel may exceed its target.
  const totalDuration = useMemo(
    () =>
      slides.reduce(
        (sum, s) => sum + (Number.isFinite(s.duration) ? Number(s.duration) : 0),
        0,
      ),
    [slides],
  );
  const durationWarning = useMemo(() => {
    if (totalDuration > target * 1.5) {
      return {
        tone: 'danger',
        text: `Slides exceed 1.5× target duration (${totalDuration.toFixed(1)}s vs ${target.toFixed(1)}s); the server will likely reject the save.`,
      };
    }
    if (totalDuration > target) {
      return {
        tone: 'warning',
        text: `Slides exceed target duration (${totalDuration.toFixed(1)}s vs ${target.toFixed(1)}s); this may slow rendering or be rejected by the server.`,
      };
    }
    return null;
  }, [totalDuration, target]);

  // Inline "unknown kind" guard. State should never reach this branch in
  // normal use, but a corrupted override fetched from the back surfaces it.
  const invalidKindIds = useMemo(() => {
    const out = new Set();
    for (const s of slides) {
      if (!ALLOWED_KINDS.has(String(s.kind || ''))) {
        out.add(s.id);
      }
    }
    return out;
  }, [slides]);

  const move = (from, to) => {
    setSlides((prev) => {
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  };

  const toggle = (id) => {
    if (clientLocked) return;
    setSlides((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    );
    schedule();
  };
  const remove = (id) => {
    if (clientLocked) return;
    setSlides((prev) => prev.filter((s) => s.id !== id));
    schedule();
  };
  const update = (id, changes) => {
    if (clientLocked) return;
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)));
    schedule();
  };

  const addSlide = (kind) => {
    if (clientLocked) return;
    const base = { id: `sl${Date.now()}`, enabled: true, locked: false, source: 'custom' };
    setSlides((prev) => [...prev, { ...base, ...PRESETS[kind] }]);
    setShowAddMenu(false);
    schedule();
    if (kind === 'google-review') setReviewModal(true);
  };

  const reviewTarget = slides.find(
    (s) => s.kind === 'google-review' && (reviewModal === true || s.id === reviewModal),
  );

  const handleDragEnd = () => {
    setDragIdx(null);
    if (clientLocked) return;
    schedule();
  };

  return (
    <div className="slides-tab" data-testid="slides-tab">
      {clientLocked && <LockedReelBanner testId="slides-locked-banner" />}

      {rerendering && <RerenderBadge testId="slides-rerender-badge" />}

      {durationWarning && (
        <div
          className={`slides-feedback slides-feedback-${durationWarning.tone}`}
          data-testid="slides-duration-warning"
        >
          <Icon name="alert" size={12} /> {durationWarning.text}
        </div>
      )}

      {feedback && (
        <div
          className={`slides-feedback slides-feedback-${feedback.tone}`}
          data-testid="slides-feedback"
        >
          <Icon
            name={feedback.tone === 'success' ? 'check' : 'alert'}
            size={12}
          />{' '}
          {feedback.text}
        </div>
      )}

      <div className="panel-head">
        <div>
          <div className="panel-title">Extra slides</div>
          <div className="panel-sub">
            Intro/outro, Google reviews and custom slides inserted into this reel.{' '}
            Drag to reorder. Total: {totalDuration.toFixed(1)}s of {target.toFixed(1)}s target
            ({saving ? 'Saving…' : 'auto-saves after each edit'}).
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            className="btn primary"
            onClick={() => setShowAddMenu(!showAddMenu)}
            disabled={clientLocked}
            data-testid="slides-add"
          >
            <Icon name="plus" size={13} /> Add slide
          </button>
          {showAddMenu && !clientLocked && (
            <div className="slide-add-menu">
              {ADD_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  className="slide-add-option"
                  onClick={() => addSlide(opt.id)}
                  data-testid={`slides-add-${opt.id}`}
                >
                  <span className="slide-add-icon">
                    <Icon name={opt.icon} size={13} />
                  </span>
                  <span className="grow">
                    <div className="slide-add-label">{opt.label}</div>
                    <div className="slide-add-sub">{opt.sub}</div>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="stack gap-4" aria-busy={saving ? 'true' : undefined}>
        {slides.map((s, i) => (
          <div key={s.id} data-testid={`slide-row-wrap-${i}`}>
            <SlideRow
              slide={s}
              onToggle={() => toggle(s.id)}
              onRemove={() => remove(s.id)}
              onUpdate={(ch) => {
                update(s.id, ch);
              }}
              onOpenReview={() => setReviewModal(s.id)}
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
              dragging={dragIdx === i}
              disabled={clientLocked}
              dataTestid={`slide-row-${i}`}
            />
            {invalidKindIds.has(s.id) && (
              <div className="slides-row-error" data-testid={`slide-error-${i}`}>
                <Icon name="alert" size={11} /> Unknown slide kind:{' '}
                <code>{String(s.kind)}</code>. Remove this slide to continue.
              </div>
            )}
          </div>
        ))}
      </div>

      {slides.length === 0 && (
        <div className="panel-empty-box" data-testid="slides-empty">
          No extra slides yet. Add an intro, outro or Google review.
        </div>
      )}

      <div className="panel-hint">
        <Icon name="zap" size={14} />
        Defaults come from <span className="t-accent t-medium">Defaults · Intro & outro</span>.
        Changes here only affect this reel.
      </div>

      {reviewModal && (
        <GoogleReviewModal
          slide={reviewTarget}
          onClose={() => setReviewModal(false)}
          onSave={(data) => {
            if (reviewTarget) {
              update(reviewTarget.id, { ...data, status: 'generated' });
            }
            setReviewModal(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * Map the UI's `{id, kind, duration, enabled, label, source, ...}` slide
 * shape to the wire shape `{slide_id, position, duration_seconds, kind,
 * ...kind-specific}` the back expects. Unknown kinds are dropped from the
 * wire payload (the panel surfaces an inline error so the user fixes them
 * before the save lands).
 */
function buildSlidesBody(slides) {
  return slides
    .filter((s) => ALLOWED_KINDS.has(String(s.kind || '')))
    .map((s, index) => {
      const base = {
        slide_id: String(s.id),
        position: index,
        duration_seconds: Number.isFinite(s.duration) ? Number(s.duration) : 0,
        kind: String(s.kind),
        enabled: s.enabled !== false,
        label: typeof s.label === 'string' ? s.label : '',
      };
      if (s.kind === 'google-review') {
        return {
          ...base,
          url: String(s.url || ''),
          status: String(s.status || 'empty'),
          ...(s.rating != null ? { rating: Number(s.rating) } : {}),
          ...(s.author ? { author: String(s.author) } : {}),
        };
      }
      if (s.kind === 'text') {
        return { ...base, text: String(s.text || '') };
      }
      return base;
    });
}
