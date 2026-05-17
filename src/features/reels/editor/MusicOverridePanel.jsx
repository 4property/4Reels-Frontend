import { useEffect, useState } from 'react';
import { toast } from '../../../lib/hooks/useToast.js';
import { Icon } from '../../../shared/Icon.jsx';
import { Spinner } from '../../../shared/Spinner.jsx';
import { useTracks } from '../../music/hooks.js';
import { useReelMusicOverride } from '../hooks.js';
import { isPublishStatusEditable } from '../publishStatus.js';

/**
 * Feature 25 — per-reel music-track override.
 *
 * Inline panel rendered just below the editor header. Lets the admin pick
 * a specific track from the agency music library to override the agency
 * default pool for this reel. Selecting "Agency default pool" (the empty
 * option) clears the override and the next render goes back to the pool.
 *
 * Contract (back feature 25):
 *   PATCH /v1/admin/agencies/{a}/reels/{s}/{p}/music
 *   Body: { music_id: <string> | null }   (Pydantic extra='forbid')
 *
 *   200  → { status: 'saved', reel_id, music_id }      happy
 *   404  → ADMIN_REEL_NOT_FOUND                        reel tuple unknown
 *   404  → ADMIN_MUSIC_TRACK_NOT_FOUND                 music_id not in agency
 *                                                      (cross-agency collapses
 *                                                      here too)
 *   409  → REEL_NOT_EDITABLE                           publish_status outside
 *                                                      {needs-approval,
 *                                                       pending_review,
 *                                                       pending, ''}
 *
 * The back re-enqueues a render job with the override baked into the
 * publish context; the worker substitutes the pool with the single track.
 */
export function MusicOverridePanel({ reel, agencyId, refetchReel, onMutate }) {
  const { tracks, loading: tracksLoading, error: tracksError } = useTracks();
  const [patch, { loading: saving }] = useReelMusicOverride();

  const editable = isPublishStatusEditable(reel?.rawPublishStatus);

  // The select holds the currently selected music_id (or '' for "Agency
  // default pool"). We resync from the upstream reel whenever the parent
  // refetches after a successful PATCH so consecutive changes don't drift.
  const initial = reel?.musicId || '';
  const [value, setValue] = useState(initial);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setValue(reel?.musicId || '');
  }, [reel?.musicId]);

  const reportError = (err) => {
    const status = err?.status;
    const code = err?.body?.error || err?.body?.code || '';
    let text;
    if (status === 409 && code === 'REEL_NOT_EDITABLE') {
      text = 'This reel can no longer be edited.';
    } else if (status === 404 && code === 'ADMIN_MUSIC_TRACK_NOT_FOUND') {
      text = 'Track not available for this agency.';
    } else if (status === 404 && code === 'ADMIN_REEL_NOT_FOUND') {
      text = 'Reel not found.';
    } else {
      text = code || err?.message || 'Failed to save music override.';
    }
    setFeedback({ tone: 'danger', text });
    toast.error(text, { id: 'reel-music' });
  };

  const handleChange = async (nextValue) => {
    const previous = value;
    setValue(nextValue);
    setFeedback(null);
    try {
      await patch({
        agencyId,
        siteId: reel.siteId,
        sourcePropertyId: reel.sourcePropertyId,
        musicId: nextValue || null,
      });
      const successText = nextValue
        ? 'Re-rendering with new track…'
        : 'Override cleared. Re-rendering with the agency default pool…';
      setFeedback({ tone: 'success', text: successText });
      toast.success('Music override saved', { id: 'reel-music' });
      // Feature 39: notify the parent editor that a mutation landed; the
      // close handler will use that signal to trigger the Dashboard refetch.
      onMutate?.();
      if (typeof refetchReel === 'function') {
        await refetchReel();
      }
    } catch (err) {
      // Roll the dropdown back so it keeps reflecting the persisted state.
      setValue(previous);
      reportError(err);
    }
  };

  if (!reel) return null;

  const disabled = !editable || saving || tracksLoading;
  const disabledReason = !editable
    ? "The track can't be changed after approve/publish."
    : undefined;

  return (
    <div className="music-override-panel" data-testid="music-override-panel">
      <div className="music-override-row">
        <label
          htmlFor="music-override-select"
          className="music-override-label"
        >
          <Icon name="music" size={12} /> Music track
        </label>
        <div className="music-override-control">
          <select
            id="music-override-select"
            data-testid="music-override-select"
            className="input music-override-select"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
            title={disabledReason}
          >
            <option value="">Agency default pool</option>
            {tracks.map((track) => (
              <option key={track.music_id} value={track.music_id}>
                {track.display_name}
              </option>
            ))}
          </select>
          {(saving || tracksLoading) && (
            <span
              className="music-override-status"
              data-testid="music-override-spinner"
            >
              <Spinner />{' '}
              {tracksLoading ? 'Loading tracks…' : 'Saving…'}
            </span>
          )}
        </div>
      </div>
      {!editable && (
        <div
          className="music-override-readonly"
          data-testid="music-override-readonly"
        >
          <Icon name="info" size={11} /> The track can't be changed after
          approve/publish.
        </div>
      )}
      {tracksError && !tracksLoading && (
        <div
          className="music-override-feedback music-override-feedback-danger"
          data-testid="music-override-tracks-error"
        >
          <Icon name="alert" size={11} /> Could not load the agency tracks.
        </div>
      )}
      {feedback && (
        <div
          className={`music-override-feedback music-override-feedback-${feedback.tone}`}
          data-testid="music-override-feedback"
        >
          <Icon
            name={feedback.tone === 'success' ? 'check' : 'alert'}
            size={11}
          />{' '}
          {feedback.text}
        </div>
      )}
    </div>
  );
}
