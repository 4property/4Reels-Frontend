import { useCallback, useMemo } from 'react';
import { toast } from '../../../lib/hooks/useToast.js';
import { Icon } from '../../../shared/Icon.jsx';
import { useReelSubtitlesOverride } from '../hooks.js';
import {
  LockedReelBanner,
  RerenderBadge,
} from './lockedReelHelpers.jsx';
import { useReelDebouncedOverride } from './useReelDebouncedOverride.js';

/**
 * Feature 36 — Subtitles tab: persisted cue edits (text + timings).
 *
 * Backend contract (back feature 36):
 *   PATCH /v1/admin/agencies/{a}/reels/{s}/{p}/subtitles
 *   Body: { cues: [{ index: int, text: str, in_seconds: float,
 *                    out_seconds: float }, ...] | null }
 *     - `null` (or `[]`) clears the override; the next render falls back to
 *       the AI-generated subtitles snapshot.
 *   Response 200: { subtitles_override, render_status: 'pending' }
 *     - The back re-enqueues a render job. The Subtitles tab flips a small
 *       "Re-rendering…" badge until a subsequent reel refetch reports
 *       `render_status: 'done'`.
 *   Errors:
 *     - 409 SUBTITLES_OVERRIDE_LOCKED → reel approved/published; persistent
 *       banner "Cannot edit a reel that has already been approved" and no
 *       further PATCHes are fired. The client mirrors the same gate up-front.
 *     - 422 → invalid body shape (mirrors the rules below — never reached
 *       in normal use because the client validates first).
 *     - other → toast with the back's error message.
 *
 * Leader-binding validation (mirrors back's strict rules):
 *   - `in_seconds >= 0`.
 *   - `out_seconds > in_seconds`.
 *   - No overlap between consecutive cues: cues[i].out <= cues[i+1].in.
 *   - `text` length 1..200.
 *   - Indices unique AND monotonically increasing (= position in array).
 *
 * On any violation the offending row shows an inline ERROR (red, not a
 * yellow warning) and the PATCH is NOT fired until every cue is valid.
 *
 * Save mode: auto-save debounced 1 s — every edit (text, in, out, add,
 * delete, reorder) collapses with any pending change into one PATCH whose
 * body is the latest snapshot.
 *
 * The optimistic + debounce + rollback loop lives in
 * `useReelDebouncedOverride`. This panel still owns the strict per-row
 * validation (rendered as inline red errors) and gates the flush via the
 * shared hook's `validateLatest` callback.
 */

const DEBOUNCE_MS = 1000;
const MAX_TEXT_LEN = 200;

export function SubtitlesPanel({
  subtitles,
  setSubtitles,
  agencyId,
  reel,
  refetchReel,
  currentScene = 0,
  setCurrentScene = () => {},
  onMutate,
}) {
  const [patch, { loading: saving }] = useReelSubtitlesOverride();

  // Per-row validation: returns a map { id → string|null } so each row can
  // render its own inline error. The form-wide flag `hasErrors` drives the
  // PATCH-fire gate.
  const rowErrors = useMemo(
    () => validateCues(subtitles),
    [subtitles],
  );
  const hasErrors = useMemo(
    () => Object.values(rowErrors).some((msg) => msg !== null),
    [rowErrors],
  );

  const patchFn = useCallback(
    (desired) =>
      patch({
        agencyId,
        siteId: reel?.siteId,
        sourcePropertyId: reel?.sourcePropertyId,
        cues: desired.map((cue, index) => ({
          index,
          text: String(cue.text || ''),
          in_seconds: Number(cue.inSeconds),
          out_seconds: Number(cue.outSeconds),
        })),
      }),
    [patch, agencyId, reel?.siteId, reel?.sourcePropertyId],
  );

  // Re-validate at flush time too — the snapshot may have shifted between
  // schedule and flush.
  const validateLatest = useCallback((desired) => {
    const errs = validateCues(desired);
    return !Object.values(errs).some((msg) => msg !== null);
  }, []);

  const {
    schedule,
    feedback,
    clientLocked,
    rerendering,
  } = useReelDebouncedOverride({
    reel,
    refetchReel,
    latest: subtitles,
    debounceMs: DEBOUNCE_MS,
    patchFn,
    rollback: setSubtitles,
    validateLatest,
    lockedErrorCode: 'SUBTITLES_OVERRIDE_LOCKED',
    successText: 'Re-rendering with new subtitles…',
    fallbackErrorText: 'Failed to save subtitle changes.',
    onMutated: () => {
      toast.success('Subtitles saved (re-rendering)', { id: 'reel-subtitles' });
      onMutate?.();
    },
    onError: (_err, text) => {
      toast.error(text || 'Failed to save subtitle changes.', { id: 'reel-subtitles' });
    },
  });

  const update = (id, changes) => {
    if (clientLocked) return;
    setSubtitles(subtitles.map((s) => (s.id === id ? { ...s, ...changes } : s)));
    schedule();
  };
  const del = (id) => {
    if (clientLocked) return;
    setSubtitles(subtitles.filter((s) => s.id !== id));
    schedule();
  };
  const add = () => {
    if (clientLocked) return;
    const last = subtitles[subtitles.length - 1];
    const inSeconds = last ? Number(last.outSeconds) || 0 : 0;
    setSubtitles([
      ...subtitles,
      {
        id: `s${Date.now()}`,
        text: 'New subtitle',
        inSeconds,
        outSeconds: inSeconds + 2,
      },
    ]);
    schedule();
  };

  const headerHint = hasErrors
    ? 'Fix the highlighted rows before saving.'
    : saving
    ? 'Saving…'
    : 'Auto-saves 1 s after the last edit.';

  return (
    <div className="subtitles-tab" data-testid="subtitles-tab">
      {clientLocked && <LockedReelBanner testId="subtitles-locked-banner" />}

      {rerendering && <RerenderBadge testId="subtitles-rerender-badge" />}

      {feedback && (
        <div
          className={`subtitles-feedback subtitles-feedback-${feedback.tone}`}
          data-testid="subtitles-feedback"
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
          <div className="panel-title">Subtitles</div>
          <div className="panel-sub">{headerHint}</div>
        </div>
        <div className="row gap-4">
          <button
            className="btn sm coming-soon"
            type="button"
            disabled
            title="Regenerate via AI is on the roadmap."
          >
            <Icon name="zap" size={12} /> Regenerate
          </button>
          <button
            className="btn sm"
            type="button"
            onClick={add}
            disabled={clientLocked}
            data-testid="subtitles-add"
          >
            <Icon name="plus" size={12} /> Add line
          </button>
        </div>
      </div>

      <div className="stack gap-4">
        {subtitles.map((s, i) => {
          const err = rowErrors[s.id];
          return (
            <div
              key={s.id}
              className={`subtitle-row ${currentScene === i ? 'active' : ''} ${
                err ? 'subtitle-row-invalid' : ''
              } ${clientLocked ? 'subtitle-row-locked' : ''}`}
              data-testid={`subtitle-row-${i}`}
              onClick={() => setCurrentScene(i)}
            >
              <span className="subtitle-index">#{i + 1}</span>
              <div className="row gap-2">
                <input
                  className="input mono subtitle-time"
                  type="number"
                  step="0.1"
                  min="0"
                  value={String(s.inSeconds ?? '')}
                  onChange={(e) =>
                    update(s.id, { inSeconds: parseSeconds(e.target.value) })
                  }
                  onClick={(e) => e.stopPropagation()}
                  disabled={clientLocked}
                  data-testid={`subtitle-in-${i}`}
                  aria-label={`Cue ${i + 1} start (seconds)`}
                />
                <span className="subtle">→</span>
                <input
                  className="input mono subtitle-time"
                  type="number"
                  step="0.1"
                  min="0"
                  value={String(s.outSeconds ?? '')}
                  onChange={(e) =>
                    update(s.id, { outSeconds: parseSeconds(e.target.value) })
                  }
                  onClick={(e) => e.stopPropagation()}
                  disabled={clientLocked}
                  data-testid={`subtitle-out-${i}`}
                  aria-label={`Cue ${i + 1} end (seconds)`}
                />
              </div>
              <input
                className="input subtitle-text"
                value={s.text || ''}
                onChange={(e) => update(s.id, { text: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                disabled={clientLocked}
                maxLength={MAX_TEXT_LEN}
                data-testid={`subtitle-text-${i}`}
              />
              <button
                className="icon-btn"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  del(s.id);
                }}
                disabled={clientLocked}
                data-testid={`subtitle-delete-${i}`}
                aria-label={`Delete cue ${i + 1}`}
              >
                <Icon name="trash" size={13} />
              </button>
              {err && (
                <div
                  className="subtitle-row-error"
                  data-testid={`subtitle-error-${i}`}
                >
                  <Icon name="alert" size={11} /> {err}
                </div>
              )}
            </div>
          );
        })}
        {subtitles.length === 0 && (
          <div className="empty" data-testid="subtitles-empty">
            <div className="t-medium">No subtitles yet.</div>
            <div className="t-sm t-muted">
              Click <span className="t-accent">Add line</span> to create one.
            </div>
          </div>
        )}
      </div>

      <div className="panel-hint">
        <Icon name="type" size={14} />
        Subtitle style inherits from your brand font. Change it in{' '}
        <span className="t-accent t-medium">Brand</span>.
      </div>
    </div>
  );
}

/**
 * Mirror of the back's strict rules. Returns a `{ id → string|null }` map
 * so the panel can show one error per offending row. The "monotonic index"
 * rule is enforced by always re-emitting `index = position` on the wire, so
 * we only need to validate the timing + text constraints here.
 */
function validateCues(cues) {
  const errors = {};
  if (!Array.isArray(cues)) return errors;
  for (let i = 0; i < cues.length; i += 1) {
    const cue = cues[i];
    errors[cue.id] = null;
    const text = String(cue.text || '');
    const inS = Number(cue.inSeconds);
    const outS = Number(cue.outSeconds);
    if (!Number.isFinite(inS) || inS < 0) {
      errors[cue.id] = 'Start must be ≥ 0 seconds.';
      continue;
    }
    if (!Number.isFinite(outS) || outS <= inS) {
      errors[cue.id] = 'End must be greater than start.';
      continue;
    }
    if (text.length < 1) {
      errors[cue.id] = 'Text cannot be empty.';
      continue;
    }
    if (text.length > MAX_TEXT_LEN) {
      errors[cue.id] = `Text must be ≤ ${MAX_TEXT_LEN} characters.`;
      continue;
    }
    if (i > 0) {
      const prev = cues[i - 1];
      const prevOut = Number(prev?.outSeconds);
      if (Number.isFinite(prevOut) && inS < prevOut) {
        errors[cue.id] = `Overlaps with cue #${i} (ends at ${prevOut}s).`;
        continue;
      }
    }
  }
  return errors;
}

function parseSeconds(raw) {
  if (raw === '' || raw === null || raw === undefined) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
