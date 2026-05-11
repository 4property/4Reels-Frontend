import { apiRequest } from '../../lib/api/client.js';

const musicPath = (agencyId, musicId = '') => {
  const base = `/v1/admin/agencies/${encodeURIComponent(agencyId)}/music`;
  return musicId ? `${base}/${encodeURIComponent(musicId)}` : base;
};

export const musicApi = {
  registerTrack: (agencyId, body) =>
    apiRequest(musicPath(agencyId), {
      method: 'POST',
      body,
    }),
  listTracks: (agencyId) => apiRequest(musicPath(agencyId)),
  inspectTrack: (agencyId, musicId) => apiRequest(musicPath(agencyId, musicId)),
  reconfigureTrack: (agencyId, musicId, body) =>
    apiRequest(musicPath(agencyId, musicId), {
      method: 'PUT',
      body,
    }),
  decommissionTrack: (agencyId, musicId) =>
    apiRequest(musicPath(agencyId, musicId), {
      method: 'DELETE',
    }),
};
