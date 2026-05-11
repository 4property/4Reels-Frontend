import { apiRequest } from '../../lib/api/client.js';

/**
 * Brand identity API surface.
 *
 *   GET  /v1/admin/agencies/{id}/brand   â†’ returns the brand slice
 *   PUT  /v1/admin/agencies/{id}/brand   â†’ replaces only that slice; never
 *                                      touches defaults/automation/social
 *                                      siblings under extra_settings.
 */
export const brandApi = {
  getBrand: (agencyId) =>
    apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}/brand`),
  saveBrand: (agencyId, body) =>
    apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}/brand`, {
      method: 'PUT',
      body,
    }),
};
