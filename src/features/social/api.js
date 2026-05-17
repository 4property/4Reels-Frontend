import { apiRequest } from '../../lib/api/client.js';

/**
 * Social tab API surface:
 *
 *   - Connected social accounts come from the agency's GHL connection.
 *   - Per-network description templates live on
 *     `extra_settings.social_templates` and are managed by the dedicated
 *     `/social-templates` endpoint pair.
 *
 * `saveSocialTemplates` is passthrough on the per-platform value: each
 * entry in `templates` can be either a plain string (legacy shape, kept for
 * the agency-config drawer's Default descriptions panel — feature 8) or the
 * rich object `{description_template, title_template, hashtags}` introduced
 * by feature 20. The backend accepts both shapes natively (a bare string is
 * normalised to `{description_template: string, title_template: '', hashtags: []}`
 * server-side, see feature 20 back review).
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
