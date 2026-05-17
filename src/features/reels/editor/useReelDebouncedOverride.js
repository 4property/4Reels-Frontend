import { useCallback, useEffect, useRef, useState } from 'react';
import { isReelClientLocked, LOCKED_COPY } from './lockedReelHelpers.jsx';

/**
 * Shared optimistic + debounce + rollback + render-status poll loop used by
 * the per-reel override panels (`PhotosPanel`, `SubtitlesPanel`, `SlidesPanel`).
 *
 * Each panel calls `schedule()` after every local-state edit. The hook collapses
 * any edits inside the `debounceMs` window into a single PATCH built from the
 * latest state (passed in as `latest`). On failure it invokes `rollback(before)`
 * with the snapshot captured BEFORE the first edit of the current cycle.
 *
 * The hook also surfaces the locked-banner state (`clientLocked`,
 * `serverLocked`) and a `rerendering` flag that drives the `RerenderBadge`
 * while the back's worker is busy. The 1.5 s poll mirrors what `PhotosPanel`
 * and `SubtitlesPanel` did inline pre-extraction.
 *
 * Params:
 *   - `reel`               — full reel object (provides `renderStatus`,
 *                            `rawWorkflowState`, `siteId`, `sourcePropertyId`).
 *   - `refetchReel`        — `() => Promise` from `useReel`; called after a
 *                            successful PATCH and on the rerender poll tick.
 *   - `latest`             — the latest editor state (array of items). The
 *                            hook keeps a ref to this so the deferred flush
 *                            sends the freshest snapshot, not whatever the
 *                            React closure captured at schedule time.
 *   - `debounceMs`         — debounce window (500 ms for photos/slides,
 *                            1000 ms for subtitles).
 *   - `pollMs`             — render-status poll interval (default 1500 ms).
 *   - `patchFn`            — `(latest) => Promise<unknown>`; the hook invokes
 *                            this with the latest snapshot at flush time.
 *   - `rollback`           — `(snapshot) => void`; called with the snapshot
 *                            captured BEFORE the cycle's first edit on PATCH
 *                            failure (mirrors how each panel's old `flush`
 *                            restored its local state).
 *   - `validateLatest`     — optional `(latest) => boolean`. Return `false` to
 *                            skip the PATCH (e.g. subtitles validation found
 *                            an in>=out / overlap). The snapshot is consumed
 *                            either way; the next edit re-snapshots.
 *   - `lockedErrorCode`    — back's 409 error code (`'PHOTOS_OVERRIDE_LOCKED'`,
 *                            `'SUBTITLES_OVERRIDE_LOCKED'`,
 *                            `'SLIDES_OVERRIDE_LOCKED'`). When the PATCH
 *                            returns that code we flip `serverLocked` so the
 *                            banner shows even though the client gate let
 *                            the request through.
 *   - `successText`        — feedback text shown on successful PATCH (e.g.
 *                            `'Re-rendering with new photo order…'`).
 *   - `fallbackErrorText`  — feedback text shown when the back's response
 *                            doesn't carry a `message` or `error` field.
 *
 * Returns:
 *   - `schedule()`         — call after every local edit; debounces a flush.
 *   - `flushNow()`         — fire the PATCH immediately (used on unmount or
 *                            explicit "save" affordance; current consumers
 *                            don't expose this but it's available).
 *   - `feedback`, `setFeedback` — `{tone, text}` displayed inside the panel.
 *   - `clientLocked`, `serverLocked`, `setServerLocked` — gate states.
 *   - `rerendering`        — `true` while `reel.renderStatus === 'pending'`.
 *   - `saving`             — wired from the consumer's `useMutation` flag.
 */
export function useReelDebouncedOverride({
  reel,
  refetchReel,
  latest,
  debounceMs,
  pollMs = 1500,
  patchFn,
  rollback,
  validateLatest,
  lockedErrorCode,
  successText,
  fallbackErrorText,
  // Feature 39: fires after a successful PATCH so the editor can mark the
  // session as "mutated" → trigger the Dashboard list refetch on close. We
  // also use a sibling `onError` slot for consumers that want to surface a
  // toast for the failure (the inline `feedback` card stays as before).
  onMutated,
  onError,
}) {
  const [feedback, setFeedback] = useState(null);
  const [serverLocked, setServerLocked] = useState(false);

  const snapshotRef = useRef(null);
  const timerRef = useRef(null);
  const latestRef = useRef(latest);
  useEffect(() => {
    latestRef.current = latest;
  }, [latest]);

  const renderStatus = String(reel?.renderStatus || '');
  const clientLocked = isReelClientLocked(reel) || serverLocked;

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flush = useCallback(async () => {
    timerRef.current = null;
    const before = snapshotRef.current;
    snapshotRef.current = null;
    const desired = latestRef.current;
    if (!agencyAware(reel) || !Array.isArray(desired)) return;
    if (typeof validateLatest === 'function' && !validateLatest(desired)) {
      // Skip the PATCH; the consumer's per-row validation already surfaces
      // the error. The snapshot was consumed so the next edit re-snapshots.
      return;
    }
    try {
      await patchFn(desired);
      if (successText) {
        setFeedback({ tone: 'success', text: successText });
      } else {
        setFeedback(null);
      }
      if (typeof onMutated === 'function') {
        // Fire BEFORE the refetch — the refetch is fire-and-forget for the
        // caller, but the `markMutated` semantic must be set the moment the
        // PATCH lands so a near-simultaneous editor close still triggers
        // the Dashboard refresh.
        try {
          onMutated();
        } catch {
          // Defensive: a notification side-effect must never break the loop.
        }
      }
      if (typeof refetchReel === 'function') {
        await refetchReel();
      }
    } catch (err) {
      if (before && typeof rollback === 'function') {
        rollback(before);
      }
      const status = err?.status;
      const code = err?.body?.error || err?.body?.code || '';
      const detail = err?.body?.message || err?.message || '';
      if (status === 409 && code === lockedErrorCode) {
        setServerLocked(true);
        setFeedback({ tone: 'danger', text: LOCKED_COPY });
        if (typeof onError === 'function') {
          try { onError(err, LOCKED_COPY); } catch { /* noop */ }
        }
        return;
      }
      const text =
        detail || code || fallbackErrorText || 'Failed to save changes.';
      setFeedback({ tone: 'danger', text });
      if (typeof onError === 'function') {
        try { onError(err, text); } catch { /* noop */ }
      }
    }
  }, [
    reel,
    patchFn,
    refetchReel,
    rollback,
    validateLatest,
    lockedErrorCode,
    successText,
    fallbackErrorText,
    onMutated,
    onError,
  ]);

  const schedule = useCallback(() => {
    if (clientLocked) return;
    if (snapshotRef.current === null) {
      // First edit of this debounce cycle — remember the current state so
      // we can roll back if the flush fails.
      snapshotRef.current = latestRef.current;
    }
    cancelTimer();
    timerRef.current = setTimeout(() => {
      flush();
    }, debounceMs);
    setFeedback(null);
  }, [clientLocked, cancelTimer, flush, debounceMs]);

  const flushNow = useCallback(() => {
    cancelTimer();
    return flush();
  }, [cancelTimer, flush]);

  useEffect(() => {
    return () => cancelTimer();
  }, [cancelTimer]);

  // Poll the reel while a re-render is in progress. The mock flips
  // `render_status` to 'done' shortly after a PATCH; in production the
  // worker flips it once the new render lands. Stop polling as soon as the
  // upstream value leaves the 'pending' bucket.
  useEffect(() => {
    if (renderStatus !== 'pending') return undefined;
    if (typeof refetchReel !== 'function') return undefined;
    const id = setInterval(() => {
      refetchReel();
    }, pollMs);
    return () => clearInterval(id);
  }, [renderStatus, refetchReel, pollMs]);

  return {
    schedule,
    flushNow,
    feedback,
    setFeedback,
    clientLocked,
    serverLocked,
    setServerLocked,
    rerendering: renderStatus === 'pending',
  };
}

function agencyAware(reel) {
  return Boolean(reel && reel.siteId && reel.sourcePropertyId);
}
