import { apiRequest } from '../../lib/api/client.js';

/**
 * Publishing automation rules API surface.
 *
 *   GET  /v1/admin/agencies/{id}/automation  -> returns the automation slice
 *                                              (approval_required +
 *                                              publish_window_*, publish_days,
 *                                              trigger_on_status).
 *   PUT  /v1/admin/agencies/{id}/automation  -> replaces only that slice.
 *
 * Note: `platforms` and the legacy quiet/skip/captions/regen/review toggles
 * live under /defaults (see useAutomationSave + buildDefaultsBody). The
 * back's AutomationRulesUpsertPayload uses extra='forbid' and rejects
 * any other key.
 */
export const automationApi = {
  getAutomation: (agencyId) =>
    apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}/automation`),
  saveAutomation: (agencyId, body) =>
    apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}/automation`, {
      method: 'PUT',
      body,
    }),
};
