import { apiFetchBlob, apiRequest } from '../../lib/api/client.js';

/**
 * Brand identity API surface.
 *
 *   GET  /v1/admin/agencies/{id}/brand                          → brand slice
 *   PUT  /v1/admin/agencies/{id}/brand                          → replaces only
 *                                       that slice; never touches
 *                                       defaults/automation/social siblings.
 *   POST /v1/admin/agencies/{id}/brand/logo                     → multipart
 *                                       upload (field `file`) → `{object_key, url}`.
 *                                       Pair with PUT /brand to persist
 *                                       `logo_object_key`.
 *   GET  /v1/admin/agencies/{id}/brand/logo/file/{filename}     → binary stream
 *                                       of a previously-uploaded logo. Requires
 *                                       the same bearer as the rest of /v1/admin/*,
 *                                       so the in-app preview must fetch it as a
 *                                       blob (a plain <img src> can't attach the
 *                                       Authorization header).
 */
export const brandApi = {
  getBrand: (agencyId) =>
    apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}/brand`),
  saveBrand: (agencyId, body) =>
    apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}/brand`, {
      method: 'PUT',
      body,
    }),
  uploadLogo: (agencyId, file) => {
    const form = new FormData();
    form.append('file', file, file?.name || 'logo');
    return apiRequest(
      `/v1/admin/agencies/${encodeURIComponent(agencyId)}/brand/logo`,
      { method: 'POST', body: form },
    );
  },
  downloadLogo: (agencyId, objectKey, options = {}) => {
    const filename = extractLogoFilename(objectKey);
    if (!filename) {
      return Promise.reject(new Error('Invalid logo object key.'));
    }
    return apiFetchBlob(
      `/v1/admin/agencies/${encodeURIComponent(agencyId)}/brand/logo/file/${encodeURIComponent(filename)}`,
      options,
    );
  },
};

/**
 * The persisted `logo_object_key` follows the shape
 * `agencies/{safe_agency}/{filename}`. The stream endpoint takes only the
 * trailing filename, so we strip the prefix here.
 */
function extractLogoFilename(objectKey) {
  if (!objectKey || typeof objectKey !== 'string') return '';
  const slash = objectKey.lastIndexOf('/');
  return slash >= 0 ? objectKey.slice(slash + 1) : objectKey;
}
