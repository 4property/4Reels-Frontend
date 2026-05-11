import { apiRequest } from '../../lib/api/client.js';

/**
 * Reel rendering defaults API surface.
 *
 *   GET  /v1/admin/agencies/{id}/defaults  â†’ returns the defaults slice
 *                                         (intro/duration + the full
 *                                         INITIAL_DEFAULTS-shaped object
 *                                         under `settings`).
 *   PUT  /v1/admin/agencies/{id}/defaults  â†’ replaces only that slice; the
 *                                         brand/automation/social siblings
 *                                         under extra_settings are preserved.
 */
export const defaultsApi = {
  getDefaults: (agencyId) =>
    apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}/defaults`),
  saveDefaults: (agencyId, body) =>
    apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}/defaults`, {
      method: 'PUT',
      body,
    }),
};
