import { apiRequest } from '../../lib/api/client.js';

/**
 * Live admin API. Every call hits the backend `/v1/admin/agencies/...` surface
 * directly; there is no mock layer behind these paths.
 */
export const adminApi = {
  // Agencies (super-admin)
  listAgencies: () => apiRequest('/v1/admin/agencies'),
  getAgency: (agencyId) =>
    apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}`),
  createAgency: (body) =>
    apiRequest('/v1/admin/agencies', { method: 'POST', body }),
  updateAgency: (agencyId, body) =>
    apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}`, {
      method: 'PATCH',
      body,
    }),
  deleteAgency: (agencyId) =>
    apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}`, {
      method: 'DELETE',
    }),

  // WordPress sources scoped to an agency
  upsertAgencySource: (agencyId, body) =>
    apiRequest(`/v1/admin/agencies/${encodeURIComponent(agencyId)}/sources`, {
      method: 'POST',
      body,
    }),
  reconfigureAgencySource: (agencyId, ingestionSourceId, body) =>
    apiRequest(
      `/v1/admin/agencies/${encodeURIComponent(agencyId)}/sources/${encodeURIComponent(
        ingestionSourceId,
      )}`,
      { method: 'PUT', body },
    ),
  deleteAgencySource: (agencyId, wordpressSourceId) =>
    apiRequest(
      `/v1/admin/agencies/${encodeURIComponent(agencyId)}/sources/${encodeURIComponent(
        wordpressSourceId,
      )}`,
      { method: 'DELETE' },
    ),

  // GoHighLevel connection per agency
  upsertAgencyGhlConnection: (agencyId, body) =>
    apiRequest(
      `/v1/admin/agencies/${encodeURIComponent(agencyId)}/ghl-connection`,
      { method: 'POST', body },
    ),
  deleteAgencyGhlConnection: (agencyId) =>
    apiRequest(
      `/v1/admin/agencies/${encodeURIComponent(agencyId)}/ghl-connection`,
      { method: 'DELETE' },
    ),
  testAgencyGhlConnection: (agencyId) =>
    apiRequest(
      `/v1/admin/agencies/${encodeURIComponent(agencyId)}/ghl-connection/test`,
      { method: 'POST' },
    ),

  // Reel profile (raw view used by the admin drawer's Reel settings tab)
  getAgencyReelProfile: (agencyId) =>
    apiRequest(
      `/v1/admin/agencies/${encodeURIComponent(agencyId)}/reel-profile`,
    ),
  upsertAgencyReelProfile: (agencyId, body) =>
    apiRequest(
      `/v1/admin/agencies/${encodeURIComponent(agencyId)}/reel-profile`,
      { method: 'PUT', body },
    ),
};
