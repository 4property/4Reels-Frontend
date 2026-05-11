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

export const reelsApi = {
  list: (agencyId) =>
    apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}/reels`),
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
