import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi, useMutation } from '../../lib/hooks/useApi.js';
import { useCurrentAgencyId } from '../session/index.js';
import { reelsApi } from './api.js';
import { mapPublishStatus } from './publishStatus.js';

/**
 * Feature 32 — paginated, filtered reel list.
 *
 * Caller passes server-side pagination + filter params; the hook forwards them
 * to `reelsApi.list` and exposes the back's response shape adapted for the UI:
 *   { reels, countTotal, page, pageSize, hasMore, loading, error, refetch,
 *     agencyId }
 *
 * The legacy `reels` array is `items.map(adaptReelSummary)`; `countTotal` is
 * the back's `count_total` (global total for the current filter); `count` is
 * NOT exposed because it's a legacy alias for `len(items)` only kept on the
 * wire for backcompat.
 *
 * `useReels()` (no args) keeps the pre-32 ergonomics for callers that just
 * want "the first page of everything"; new callers should pass an options
 * object. The hook deliberately doesn't memo the array — `useApi` already
 * gives a stable reference until the next fetch resolves, which is enough
 * for our consumers (no fine-grained reconciliation needed).
 */
export function useReels(params = {}) {
  const agencyId = useCurrentAgencyId();
  const {
    page,
    pageSize,
    workflowState,
    publishStatus,
    q,
  } = params || {};

  const fetcher = () =>
    agencyId
      ? reelsApi.list({
          agencyId,
          page,
          pageSize,
          workflowState,
          publishStatus,
          q,
        })
      : Promise.resolve({
          items: [],
          count_total: 0,
          page: page || 1,
          page_size: pageSize || 0,
          has_more: false,
        });

  const { data, ...rest } = useApi(fetcher, [
    agencyId,
    page,
    pageSize,
    normaliseDep(workflowState),
    normaliseDep(publishStatus),
    q,
  ]);

  const items = Array.isArray(data?.items) ? data.items : [];
  return {
    reels: items.map(adaptReelSummary),
    countTotal: Number.isFinite(data?.count_total)
      ? data.count_total
      : items.length,
    page: Number.isFinite(data?.page) ? data.page : page || 1,
    pageSize: Number.isFinite(data?.page_size)
      ? data.page_size
      : pageSize || items.length,
    hasMore: Boolean(data?.has_more),
    agencyId,
    ...rest,
  };
}

function normaliseDep(value) {
  if (Array.isArray(value)) return value.join(',');
  return value || '';
}

export function useReel(siteId, sourcePropertyId) {
  const agencyId = useCurrentAgencyId();
  const enabled = Boolean(agencyId && siteId && sourcePropertyId);
  const { data, ...rest } = useApi(
    () =>
      enabled
        ? reelsApi.get(agencyId, siteId, sourcePropertyId)
        : Promise.resolve({ reel: null }),
    [agencyId, siteId, sourcePropertyId],
  );
  const raw = data?.reel || null;
  const adapted = raw
    ? {
        ...adaptReelSummary(raw),
        hasVideo: Boolean(raw.has_video),
        // Feature 21: expose the per-platform description override + the
        // snapshot the worker would use as a fallback. The DescriptionsPanel
        // mirrors the backend precedence (override → snapshot → '').
        descriptionsOverride:
          raw.descriptions_override && typeof raw.descriptions_override === 'object'
            ? raw.descriptions_override
            : null,
        publishDescriptionsSnapshot:
          (raw.publish_target_snapshot &&
            raw.publish_target_snapshot.descriptions_by_platform &&
            typeof raw.publish_target_snapshot.descriptions_by_platform === 'object'
            ? raw.publish_target_snapshot.descriptions_by_platform
            : null) || null,
        // Feature 25: per-reel music override. The back surfaces both
        //   - `music_track_id` (the override, when set), and
        //   - an optional denormalised `music` object `{music_id, display_name, ...}`
        //     so we can show the human-readable label without a second roundtrip.
        // If the back didn't include either field, fall back to `null`; the
        // music dropdown will then represent the "agency default pool" state.
        musicId:
          typeof raw.music_track_id === 'string' && raw.music_track_id
            ? raw.music_track_id
            : null,
        music:
          raw.music && typeof raw.music === 'object'
            ? {
                music_id: raw.music.music_id || raw.music_track_id || '',
                display_name:
                  typeof raw.music.display_name === 'string'
                    ? raw.music.display_name
                    : '',
              }
            : null,
        // Feature 35: per-reel photos override. The back surfaces
        // `photos_override` as either an array of `{position, selected}` or
        // null when no override is set. The editor's Photos panel reads it
        // to seed `selected` flags on the per-position image grid.
        photosOverride:
          Array.isArray(raw.photos_override) ? raw.photos_override : null,
        // Feature 36: per-reel subtitles override. The back surfaces
        // `subtitles_override` as either an array of
        //   `{index, text, in_seconds, out_seconds}`
        // or `null` when no override is set. The Subtitles panel seeds its
        // editor from the override first, then falls back to the auto-
        // generated cues snapshot (feature 41) before reaching the in-app
        // default seed.
        subtitlesOverride:
          Array.isArray(raw.subtitles_override) ? raw.subtitles_override : null,
        // Feature 41: the back now exposes `publish_subtitles_snapshot` as a
        // TOP-LEVEL field of `AgencyReelItemPayload`, persisted in the
        // `reels.auto_subtitles_snapshot` column. It carries the Gemini-
        // generated cues the worker produced (or last serialized) for this
        // reel; the Subtitles panel uses it as the starting point for a new
        // `subtitles_override` when the override column is null. Pre-41 the
        // editor looked at `publish_target_snapshot.subtitles`, but that
        // nested field was never populated end-to-end — keep this purely
        // reading the new top-level field.
        publishSubtitlesSnapshot:
          Array.isArray(raw.publish_subtitles_snapshot)
            ? raw.publish_subtitles_snapshot
            : null,
        // Feature 37: per-reel slides manifest override. The back surfaces
        // `manifest_override` as either an array of
        //   `{slide_id, position, duration_seconds, kind, ...kind-specific}`
        // or `null` when no override is set. The Slides panel seeds its
        // editor from the override first, then falls back to the seed
        // manifest that ships with the editor (no equivalent snapshot
        // surfaces today). `target_duration_seconds` is the reel-level
        // budget the worker tries to honour — the panel uses it to surface
        // the "exceeds target" warning, and it falls back to agency
        // defaults when the reel itself doesn't expose one.
        manifestOverride:
          Array.isArray(raw.manifest_override) ? raw.manifest_override : null,
        targetDurationSeconds: Number.isFinite(raw.target_duration_seconds)
          ? Number(raw.target_duration_seconds)
          : null,
        // The publishStatus mapped value collapses several backend states
        // into one badge bucket; the override editor needs the raw string
        // so it can decide whether the reel is editable per the back's
        // gate `{needs-approval, pending_review, pending, ''}`.
        rawPublishStatus: String(raw.publish_status || ''),
        // Raw workflow_state too — the back feature 35 gate for /photos
        // edits checks `workflow_state ∈ {approved, published}` and returns
        // 409 `PHOTOS_OVERRIDE_LOCKED`. The Photos panel mirrors that gate
        // on the client to skip the round-trip and show the banner upfront.
        rawWorkflowState: String(raw.workflow_state || ''),
      }
    : null;
  return { reel: adapted, agencyId, ...rest };
}

export function useApproveReel() {
  return useMutation(({ agencyId, siteId, sourcePropertyId }) =>
    reelsApi.approve(agencyId, siteId, sourcePropertyId),
  );
}

export function useRejectReel() {
  return useMutation(({ agencyId, siteId, sourcePropertyId }) =>
    reelsApi.reject(agencyId, siteId, sourcePropertyId),
  );
}

/**
 * Feature 21: patch the per-reel `descriptions_override` JSON column.
 *
 * Pattern mirrors `useApproveReel` / `useRejectReel` — caller supplies the
 * tuple identifying the reel plus the `descriptions` map. An empty `{}`
 * map clears the override (back collapses to SQL NULL).
 */
export function useReelDescriptionsOverride() {
  return useMutation(({ agencyId, siteId, sourcePropertyId, descriptions }) =>
    reelsApi.patchReelDescriptions(
      agencyId,
      siteId,
      sourcePropertyId,
      descriptions || {},
    ),
  );
}

/**
 * Feature 25: patch the per-reel music-track override.
 *
 * Caller passes `{ agencyId, siteId, sourcePropertyId, musicId }` where
 * `musicId` is either a music_id string or `null` (clears the override).
 * The back re-enqueues a render with the override baked into the publish
 * context; the worker uses the override instead of the agency music pool.
 */
export function useReelMusicOverride() {
  return useMutation(({ agencyId, siteId, sourcePropertyId, musicId }) =>
    reelsApi.patchReelMusic(
      agencyId,
      siteId,
      sourcePropertyId,
      musicId == null ? null : musicId,
    ),
  );
}

/**
 * Feature 35: patch the per-reel photos override (reorder + per-position
 * selected). The caller supplies the tuple identifying the reel plus the
 * full `photos` array; passing `null` or `[]` clears the override and
 * the next render falls back to the AI-picked ingested order.
 *
 * The PATCH returns `{ photos_override, render_status: 'pending' }`; the
 * editor consumes both values to refresh the panel state and to flip the
 * "Re-rendering..." badge on until a subsequent reel refetch reports
 * `render_status: 'done'`.
 */
export function useReelPhotosOverride() {
  return useMutation(({ agencyId, siteId, sourcePropertyId, photos }) =>
    reelsApi.patchReelPhotos(
      agencyId,
      siteId,
      sourcePropertyId,
      photos == null ? null : photos,
    ),
  );
}

/**
 * Feature 36: patch the per-reel subtitles override (cue text + timings).
 *
 * Caller supplies the tuple identifying the reel plus the full `cues` array
 * (`{index, text, in_seconds, out_seconds}`). Passing `null` or `[]` clears
 * the override and the next render falls back to the AI-generated snapshot.
 *
 * The PATCH returns `{ subtitles_override, render_status: 'pending' }`; the
 * editor consumes both values to refresh the panel state and to flip the
 * "Re-rendering..." badge on until a subsequent reel refetch reports
 * `render_status: 'done'`.
 */
export function useReelSubtitlesOverride() {
  return useMutation(({ agencyId, siteId, sourcePropertyId, cues }) =>
    reelsApi.patchReelSubtitles(
      agencyId,
      siteId,
      sourcePropertyId,
      cues == null ? null : cues,
    ),
  );
}

/**
 * Feature 37: patch the per-reel slides manifest override.
 *
 * Caller supplies the tuple identifying the reel plus the full `slides`
 * array (`{slide_id, position, duration_seconds, kind, ...kind-specific}`).
 * Passing `null` or `[]` clears the override and the next render falls back
 * to the default scene manifest.
 *
 * The PATCH returns `{ manifest_override, render_status: 'pending' }`; the
 * editor consumes both values to refresh the panel state and to flip the
 * "Re-rendering..." badge on until a subsequent reel refetch reports
 * `render_status: 'done'`.
 */
export function useReelSlidesOverride() {
  return useMutation(({ agencyId, siteId, sourcePropertyId, slides }) =>
    reelsApi.patchReelSlides(
      agencyId,
      siteId,
      sourcePropertyId,
      slides == null ? null : slides,
    ),
  );
}

/**
 * Feature 40: manual re-render trigger.
 *
 * Fires `POST /reels/.../regenerate` and, on success, polls the reel until the
 * worker flips `render_status` out of `'pending'`. The 409 codes the back
 * surfaces (`REGENERATE_PUBLISHED_FORBIDDEN` / `REGENERATE_ALREADY_IN_FLIGHT`)
 * are exposed through `errorCode` so the consumer can render the matching
 * toast copy. The hook also exposes `rerendering`, a boolean that the consumer
 * uses to render the shared `<RerenderBadge />` while the worker is busy.
 *
 * The poll mirrors `useReelDebouncedOverride`'s render-status loop (1.5 s
 * cadence, stops as soon as `renderStatus` leaves `'pending'`) but is kept
 * inline here because this hook does not share the rest of that helper's
 * debounce/snapshot/rollback machinery — a fire+poll cycle is all it needs.
 *
 * Params:
 *   - `reel`         — current reel object (uses `siteId`, `sourcePropertyId`,
 *                      `renderStatus`).
 *   - `agencyId`     — current agency id (from the editor's session context).
 *   - `refetchReel`  — `() => Promise` returned by `useReel`; the poll cycle
 *                      invokes it on each tick so the badge clears as soon as
 *                      the back reports `render_status: 'done'`.
 */
export function useRegenerateReel({ reel, agencyId, refetchReel }) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [errorCode, setErrorCode] = useState(null);

  const renderStatus = String(reel?.renderStatus || '');
  const rerendering = renderStatus === 'pending';

  // Poll the reel while a re-render is in flight. The mock flips
  // `render_status` to `'done'` shortly after the POST; in production the
  // worker flips it once the new render lands. Stop polling as soon as the
  // upstream value leaves the `'pending'` bucket.
  useEffect(() => {
    if (!rerendering) return undefined;
    if (typeof refetchReel !== 'function') return undefined;
    const id = setInterval(() => {
      refetchReel();
    }, 1500);
    return () => clearInterval(id);
  }, [rerendering, refetchReel]);

  const triggerRegenerate = useCallback(
    async (reason) => {
      if (!agencyId || !reel?.siteId || !reel?.sourcePropertyId) return null;
      setIsRegenerating(true);
      setErrorCode(null);
      try {
        const result = await reelsApi.regenerateReel(
          agencyId,
          reel.siteId,
          reel.sourcePropertyId,
          reason,
        );
        if (typeof refetchReel === 'function') {
          await refetchReel();
        }
        return result;
      } catch (err) {
        const status = err?.status;
        const code = err?.body?.error || err?.body?.code || '';
        if (status === 409 && code) {
          setErrorCode(code);
        } else {
          setErrorCode(code || 'REGENERATE_FAILED');
        }
        throw err;
      } finally {
        setIsRegenerating(false);
      }
    },
    [agencyId, reel?.siteId, reel?.sourcePropertyId, refetchReel],
  );

  return { triggerRegenerate, isRegenerating, errorCode, rerendering };
}

export function reelVideoUrl(agencyId, siteId, sourcePropertyId) {
  return reelsApi.videoUrl(agencyId, siteId, sourcePropertyId);
}

/**
 * Lists the property images that fed the reel. Each item exposes both the
 * original WordPress URL and (when available) a backend-served URL for the
 * locally cached file. The Photos panel prefers the local URL because it
 * works even when the WordPress site is down.
 */
export function useReelImages(agencyId, siteId, sourcePropertyId) {
  const enabled = Boolean(agencyId && siteId && sourcePropertyId);
  const { data, ...rest } = useApi(
    () =>
      enabled
        ? reelsApi.listImages(agencyId, siteId, sourcePropertyId)
        : Promise.resolve({ items: [] }),
    [agencyId, siteId, sourcePropertyId],
  );
  // Memoise the adapted `images` array so its reference is stable across
  // renders that didn't touch `data`. Without this, the consuming editor's
  // `useEffect([livePhotos])` resets the per-tile `selected` state on every
  // render and the Photos panel's optimistic toggles get clobbered.
  const images = useMemo(() => {
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.map((item) => ({
      position: item.position,
      url:
        (item.has_local_file &&
          reelsApi.imageFileUrl(agencyId, siteId, sourcePropertyId, item.position)) ||
        item.image_url ||
        '',
    }));
  }, [data, agencyId, siteId, sourcePropertyId]);
  return { images, ...rest };
}

function adaptReelSummary(item) {
  // Map backend AgencyReelSummary → the shape Dashboard / ReelCard / ReelsTable
  // expect. The composite `id` is convenient for keys; the explicit
  // `siteId` / `sourcePropertyId` are what the editor route uses.
  const siteId = item.site_id || '';
  const sourcePropertyId = item.source_property_id;
  const id = sourcePropertyId
    ? `${siteId}:${sourcePropertyId}`
    : `${siteId}:${item.slug || ''}`;
  const networks = parseNetworksFromPipeline(item.workflow_state, item.publish_status);
  return {
    id,
    siteId,
    sourcePropertyId,
    title: item.title || item.slug || `Property #${sourcePropertyId}`,
    address: [item.property_area_label, item.property_county_label]
      .filter(Boolean)
      .join(', '),
    price: item.price || '',
    status: item.render_status || item.workflow_state || 'pending',
    publishStatus: mapPublishStatus(item.publish_status, item.workflow_state),
    cover: item.featured_image_url || '',
    coverUrl: item.featured_image_url || '',
    createdAt: item.pipeline_created_at || item.fetched_at || '',
    updatedAt: item.pipeline_updated_at || '',
    duration: '',
    scenes: 0,
    kind: classifyKind(item.property_status),
    type: '',
    networks,
    workflowState: item.workflow_state || '',
    renderStatus: item.render_status || '',
    revisionId: item.current_revision_id || '',
    revisionMediaPath: item.revision_media_path || '',
    locationId: item.last_published_location_id || '',
    tracker: null,
  };
}

function parseNetworksFromPipeline(workflowState, publishStatus) {
  if (publishStatus === 'published') return ['instagram', 'tiktok', 'facebook', 'linkedin'];
  return [];
}

function classifyKind(propertyStatus) {
  const value = String(propertyStatus || '').toLowerCase().trim();
  if (!value) return '';
  if (value.includes('let')) return value.includes('agreed') ? 'let-agreed' : 'to-let';
  if (value.includes('sale agreed') || value === 'sale_agreed') return 'sale-agreed';
  if (value === 'sold') return 'sold';
  if (value.includes('rent') || value === 'to_let') return 'to-let';
  return 'for-sale';
}
