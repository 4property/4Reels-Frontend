import { apiFetchBlob, apiRequest, MVP_API_URL, BASE_URL } from '../../lib/api/client.js';

/**
 * Reel rendering defaults API surface.
 *
 *   GET    /v1/admin/agencies/{id}/defaults       → returns the defaults slice
 *                                         (intro/duration + the full
 *                                         INITIAL_DEFAULTS-shaped object
 *                                         under `settings`). After feature 33
 *                                         the payload also carries
 *                                         `outro_object_key`,
 *                                         `outro_duration_seconds` and
 *                                         `outro_source`. Feature 34 mirrors
 *                                         the same trio for intro
 *                                         (`intro_object_key`,
 *                                         `intro_duration_seconds`,
 *                                         `intro_source`) so the Intro&Outro
 *                                         card can render both persisted
 *                                         chips without a second roundtrip.
 *   PUT    /v1/admin/agencies/{id}/defaults       → replaces only that slice; the
 *                                         brand/automation/social siblings
 *                                         under extra_settings are preserved.
 *   POST   /v1/admin/agencies/{id}/{kind}/upload  → multipart form-data with
 *                                         a single `file` part (MP4/MOV ≤50MB,
 *                                         1–10s server-side). Returns
 *                                         `{ {kind}_object_key,
 *                                         {kind}_duration_seconds, {kind}_source }`
 *                                         where `{kind}` is `intro` (feature 34)
 *                                         or `outro` (feature 33).
 *   GET    /v1/admin/agencies/{id}/{kind}/file    → bytes of the persisted
 *                                         clip (Content-Type: video/mp4 or
 *                                         the original mime). Requires the
 *                                         admin bearer, so a plain `<video src>`
 *                                         only works against the Playwright
 *                                         mock; production callers must fetch
 *                                         via `{kind}Download` (blob + object
 *                                         URL).
 *   DELETE /v1/admin/agencies/{id}/{kind}         → clears the persisted file
 *                                         and returns
 *                                         `{ {kind}_source: 'none',
 *                                         {kind}_object_key: null }`.
 */
export const defaultsApi = {
  getDefaults: (agencyId) =>
    apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}/defaults`),
  saveDefaults: (agencyId, body) =>
    apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}/defaults`, {
      method: 'PUT',
      body,
    }),
  outroUpload: (agencyId, file) => uploadVideo(agencyId, 'outro', file),
  outroDelete: (agencyId) => deleteVideo(agencyId, 'outro'),
  outroFileUrl: (agencyId) => fileUrl(agencyId, 'outro'),
  outroDownload: (agencyId, options = {}) => downloadVideo(agencyId, 'outro', options),
  introUpload: (agencyId, file) => uploadVideo(agencyId, 'intro', file),
  introDelete: (agencyId) => deleteVideo(agencyId, 'intro'),
  introFileUrl: (agencyId) => fileUrl(agencyId, 'intro'),
  introDownload: (agencyId, options = {}) => downloadVideo(agencyId, 'intro', options),
};

function uploadVideo(agencyId, kind, file) {
  const form = new FormData();
  form.append('file', file, file?.name || `${kind}.mp4`);
  return apiRequest(
    `/v1/admin/agencies/${encodeURIComponent(agencyId)}/${kind}/upload`,
    { method: 'POST', body: form },
  );
}

function deleteVideo(agencyId, kind) {
  return apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}/${kind}`, {
    method: 'DELETE',
  });
}

function fileUrl(agencyId, kind) {
  const base = trimSlashes(MVP_API_URL || BASE_URL || '');
  return `${base}/v1/admin/agencies/${encodeURIComponent(agencyId)}/${kind}/file`;
}

function downloadVideo(agencyId, kind, options) {
  return apiFetchBlob(
    `/v1/admin/agencies/${encodeURIComponent(agencyId)}/${kind}/file`,
    options,
  );
}

function trimSlashes(value) {
  return String(value || '').replace(/\/+$/, '');
}
