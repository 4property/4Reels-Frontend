import { apiRequest } from '../../lib/api/client.js';

export const adminApi = {
  // Live agency administration (backend /admin/agencies)
  listAgencies: () => apiRequest('/admin/agencies'),
  getAgency: (agencyId) =>
    apiRequest(`/admin/agencies/${encodeURIComponent(agencyId)}`),
  createAgency: (body) =>
    apiRequest('/admin/agencies', { method: 'POST', body }),
  updateAgency: (agencyId, body) =>
    apiRequest(`/admin/agencies/${encodeURIComponent(agencyId)}`, {
      method: 'PATCH',
      body,
    }),
  deleteAgency: (agencyId) =>
    apiRequest(`/admin/agencies/${encodeURIComponent(agencyId)}`, {
      method: 'DELETE',
    }),

  upsertAgencySource: (agencyId, body) =>
    apiRequest(`/admin/agencies/${encodeURIComponent(agencyId)}/sources`, {
      method: 'POST',
      body,
    }),
  deleteAgencySource: (agencyId, wordpressSourceId) =>
    apiRequest(
      `/admin/agencies/${encodeURIComponent(agencyId)}/sources/${encodeURIComponent(
        wordpressSourceId,
      )}`,
      { method: 'DELETE' },
    ),

  upsertAgencyGhlConnection: (agencyId, body) =>
    apiRequest(
      `/admin/agencies/${encodeURIComponent(agencyId)}/ghl-connection`,
      { method: 'PUT', body },
    ),
  deleteAgencyGhlConnection: (agencyId) =>
    apiRequest(
      `/admin/agencies/${encodeURIComponent(agencyId)}/ghl-connection`,
      { method: 'DELETE' },
    ),
  testAgencyGhlConnection: (agencyId) =>
    apiRequest(
      `/admin/agencies/${encodeURIComponent(agencyId)}/ghl-connection/test`,
      { method: 'POST' },
    ),

  getAgencyReelProfile: (agencyId) =>
    apiRequest(
      `/admin/agencies/${encodeURIComponent(agencyId)}/reel-profile`,
    ),
  upsertAgencyReelProfile: (agencyId, body) =>
    apiRequest(
      `/admin/agencies/${encodeURIComponent(agencyId)}/reel-profile`,
      { method: 'PUT', body },
    ),

  // Mocked tenant + team flows kept for legacy widgets that still depend on them.
  listTenants: () => apiRequest('/admin/tenants'),
  createTenant: (body) => apiRequest('/admin/tenants', { method: 'POST', body }),
  listTeam: () => apiRequest('/team'),
  invite: (body) => apiRequest('/team', { method: 'POST', body }),
  updateMember: (id, patch) => apiRequest(`/team/${id}`, { method: 'PATCH', body: patch }),
  removeMember: (id) => apiRequest(`/team/${id}`, { method: 'DELETE' }),
  listRoles: () => apiRequest('/team/roles'),
};
