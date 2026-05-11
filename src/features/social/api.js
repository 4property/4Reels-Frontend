import { apiRequest } from '../../lib/api/client.js';

/**
 * Social tab API surface:
 *
 *   - Connected social accounts come from the agency's GHL connection.
 *   - Per-network description templates live on
 *     `extra_settings.social_templates` and are managed by the dedicated
 *     `/social-templates` endpoint pair.
 */
export const socialApi = {
  listConnectedAccounts: (agencyId) =>
    apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}/social-accounts`),
  getSocialTemplates: (agencyId) =>
    apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}/social-templates`),
  saveSocialTemplates: (agencyId, templates) =>
    apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}/social-templates`, {
      method: 'PUT',
      body: { templates },
    }),
};
