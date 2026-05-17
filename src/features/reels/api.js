import { apiRequest, MVP_API_URL } from '../../lib/api/client.js';

/**
 * Reels are agency-scoped. The list and detail endpoints return the joined
 * `properties` + `property_pipeline_state` + latest `media_revisions` row.
 *
 * The video URL is intentionally a plain `<video src>` URL (the backend
 * supports `Range` requests so the player only buffers what is being viewed).
 * The HTTP client is bypassed for it because it must hit the live backend
 * directly; we still build the absolute URL through `MVP_API_URL`.
 */
function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function reelPath(agencyId, siteId, sourcePropertyId, suffix = '') {
  return `/v1/admin/agencies/${encodeURIComponent(agencyId)}/reels/${encodeURIComponent(
    siteId,
  )}/${encodeURIComponent(sourcePropertyId)}${suffix}`;
}

/**
 * Feature 32 helper — build the `?page=&page_size=&workflow_state=...` query
 * string for `GET /v1/admin/agencies/{id}/reels`. Only params with a defined,
 * non-empty value are forwarded; that mirrors the back's Pydantic schema
 * (optional fields, missing == default). Arrays are comma-joined per the
 * back contract (multi-select for workflow_state / publish_status).
 */
function buildListQuery({ page, pageSize, workflowState, publishStatus, q }) {
  const query = {};
  if (Number.isFinite(page) && page > 0) query.page = page;
  if (Number.isFinite(pageSize) && pageSize > 0) query.page_size = pageSize;
  const wf = normaliseMulti(workflowState);
  if (wf) query.workflow_state = wf;
  const ps = normaliseMulti(publishStatus);
  if (ps) query.publish_status = ps;
  if (typeof q === 'string' && q.trim() !== '') query.q = q.trim();
  return query;
}

function normaliseMulti(value) {
  if (Array.isArray(value)) {
    const cleaned = value.map((v) => String(v || '').trim()).filter(Boolean);
    return cleaned.length ? cleaned.join(',') : '';
  }
  if (typeof value === 'string') return value.trim();
  return '';
}

export const reelsApi = {
  // Feature 32: paginated + filtered list.
  // GET /v1/admin/agencies/{id}/reels
  //   ?page=&page_size=&workflow_state=&publish_status=&q=
  // Response: { items, count_total, page, page_size, has_more, count }.
  // `count = len(items)` is a legacy alias preserved for backcompat with the
  // previous shape `{ items, count }`.
  list: (
    agencyIdOrParams,
    legacyPage,
    legacyPageSize,
    legacyWorkflowState,
    legacyPublishStatus,
    legacyQ,
  ) => {
    const params =
      agencyIdOrParams && typeof agencyIdOrParams === 'object'
        ? agencyIdOrParams
        : {
            agencyId: agencyIdOrParams,
            page: legacyPage,
            pageSize: legacyPageSize,
            workflowState: legacyWorkflowState,
            publishStatus: legacyPublishStatus,
            q: legacyQ,
          };
    const { agencyId } = params;
    const query = buildListQuery(params);
    return apiRequest(
      `/v1/admin/agencies/${encodeURIComponent(agencyId)}/reels`,
      { method: 'GET', query },
    );
  },
  get: (agencyId, siteId, sourcePropertyId) =>
    apiRequest(reelPath(agencyId, siteId, sourcePropertyId)),
  listImages: (agencyId, siteId, sourcePropertyId) =>
    apiRequest(reelPath(agencyId, siteId, sourcePropertyId, '/images')),
  getManifest: (agencyId, siteId, sourcePropertyId) =>
    apiRequest(reelPath(agencyId, siteId, sourcePropertyId, '/manifest')),
  approve: (agencyId, siteId, sourcePropertyId) =>
    apiRequest(reelPath(agencyId, siteId, sourcePropertyId, '/approve'), {
      method: 'POST',
    }),
  reject: (agencyId, siteId, sourcePropertyId) =>
    apiRequest(reelPath(agencyId, siteId, sourcePropertyId, '/reject'), {
      method: 'POST',
    }),
  // Feature 21: per-reel description override.
  // PATCH /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/descriptions
  // Body: { descriptions_by_platform: {<platform>: <text>} } — replace semantics.
  // An empty map clears the override (back persists NULL in reels.descriptions_override).
  patchReelDescriptions: (agencyId, siteId, sourcePropertyId, descriptionsByPlatform) =>
    apiRequest(reelPath(agencyId, siteId, sourcePropertyId, '/descriptions'), {
      method: 'PATCH',
      body: { descriptions_by_platform: descriptionsByPlatform || {} },
    }),
  // Feature 25: per-reel music-track override.
  // PATCH /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/music
  // Body: { music_id: <string|null> } — `null` clears the override and the
  // next render falls back to the agency-wide music pool.
  //
  // The back is Pydantic `extra='forbid'`, so the body must contain exactly
  // that one key (no `agency_id` / `site_id` echoes).
  patchReelMusic: (agencyId, siteId, sourcePropertyId, musicId) =>
    apiRequest(reelPath(agencyId, siteId, sourcePropertyId, '/music'), {
      method: 'PATCH',
      body: { music_id: musicId || null },
    }),
  // Feature 35: per-reel photos override (reorder + per-position selected).
  // PATCH /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/photos
  // Body: { photos: [{ position: int, selected: bool }, ...] | null }
  //   - `null` (or `[]`) clears the override; the next render falls back to
  //     the ingested order + AI-picked selection.
  //   - The list is the FULL desired order; the back stores
  //     `reel.photos_override` verbatim and re-enqueues the render.
  //   - Pydantic `extra='forbid'` on the wrapper: only the `photos` key is
  //     accepted on the top-level body. We don't strip falsy values silently
  //     — the caller decides between `null`, `[]` and an array.
  //
  // Responses (back feature 35):
  //   200 → { photos_override, render_status: 'pending' }
  //   422 → invalid body shape.
  //   409 `PHOTOS_OVERRIDE_LOCKED` → reel is approved/published; the editor
  //        shows a persistent banner and stops firing PATCHes.
  //   404 → reel tuple unknown.
  patchReelPhotos: (agencyId, siteId, sourcePropertyId, photos) =>
    apiRequest(reelPath(agencyId, siteId, sourcePropertyId, '/photos'), {
      method: 'PATCH',
      body: { photos: photos == null ? null : photos },
    }),
  // Feature 36: per-reel subtitles override (edit text + cue timings).
  // PATCH /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/subtitles
  // Body: { cues: [{ index: int, text: str, in_seconds: float,
  //                  out_seconds: float }, ...] | null }
  //   - `null` (or `[]`) clears the override; the next render falls back to
  //     the AI-generated subtitles snapshot.
  //   - The back is Pydantic `extra='forbid'` on the wrapper: only `cues`.
  //   - The full list is the desired state — replace semantics, not patch.
  //
  // Responses (back feature 36):
  //   200 → { subtitles_override, render_status: 'pending' }
  //   422 → invalid body shape (negative times, in >= out, overlap, text
  //         length, duplicate/non-monotonic indices).
  //   409 `SUBTITLES_OVERRIDE_LOCKED` → reel approved/published; the editor
  //        shows a persistent banner and stops firing PATCHes.
  //   404 → reel tuple unknown.
  patchReelSubtitles: (agencyId, siteId, sourcePropertyId, cues) =>
    apiRequest(reelPath(agencyId, siteId, sourcePropertyId, '/subtitles'), {
      method: 'PATCH',
      body: { cues: cues == null ? null : cues },
    }),
  // Feature 37: per-reel slides override (reorder + per-slide duration + kind).
  // PATCH /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/slides
  // Body: { slides: [{ slide_id: str, position: int, duration_seconds: float,
  //                    kind: str, ...kind-specific fields }, ...] | null }
  //   - `null` (or `[]`) clears the override; the next render falls back to
  //     the default scene manifest (agency intro/outro + AI-picked beats).
  //   - The list is the FULL desired manifest — replace semantics, not patch.
  //   - Pydantic `extra='forbid'` on the wrapper: only the `slides` key is
  //     accepted on the top-level body.
  //   - `kind` is a discriminated union: each kind has its own optional
  //     payload (e.g. `google-review` → {url, status, rating?, author?},
  //     `text` → {text}, `photo`/`intro-video`/`outro-video` → no extras).
  //
  // Responses (back feature 37):
  //   200 → { manifest_override, render_status: 'pending' }
  //   422 → invalid body shape (unknown kind, missing kind-specific fields,
  //         sum of durations > 1.5x target).
  //   409 `SLIDES_OVERRIDE_LOCKED` → reel approved/published; the editor
  //        shows a persistent banner and stops firing PATCHes.
  //   404 → reel tuple unknown.
  patchReelSlides: (agencyId, siteId, sourcePropertyId, slides) =>
    apiRequest(reelPath(agencyId, siteId, sourcePropertyId, '/slides'), {
      method: 'PATCH',
      body: { slides: slides == null ? null : slides },
    }),
  // Feature 40: manual re-render trigger.
  // POST /v1/admin/agencies/{agency_id}/reels/{site_id}/{source_property_id}/regenerate
  // Body: `{}` when `reason` is undefined; `{ reason }` when caller wants to
  // tag the audit trail. The back's request schema is Pydantic
  // `extra='forbid'`, so the wrapper is strict about which keys we send.
  //
  // Responses (back feature 40):
  //   200 → { render_status: 'pending', job_id: string, queued_at: ISO8601 }
  //   409 `REGENERATE_PUBLISHED_FORBIDDEN`   → reel.publish_status === 'published'.
  //   409 `REGENERATE_ALREADY_IN_FLIGHT`     → a render is already pending.
  //   404 `ADMIN_REEL_NOT_FOUND`             → reel tuple unknown.
  regenerateReel: (agencyId, siteId, sourcePropertyId, reason) => {
    const body = reason === undefined ? {} : { reason };
    return apiRequest(reelPath(agencyId, siteId, sourcePropertyId, '/regenerate'), {
      method: 'POST',
      body,
    });
  },
  videoUrl: (agencyId, siteId, sourcePropertyId) =>
    `${trimTrailingSlash(MVP_API_URL)}${reelPath(
      agencyId,
      siteId,
      sourcePropertyId,
      '/video',
    )}`,
  imageFileUrl: (agencyId, siteId, sourcePropertyId, position) =>
    `${trimTrailingSlash(MVP_API_URL)}${reelPath(
      agencyId,
      siteId,
      sourcePropertyId,
      `/images/${encodeURIComponent(position)}/file`,
    )}`,
};
