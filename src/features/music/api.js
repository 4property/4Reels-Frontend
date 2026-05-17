import { apiRequest } from '../../lib/api/client.js';

const musicPath = (agencyId, musicId = '') => {
  const base = `/v1/admin/agencies/${encodeURIComponent(agencyId)}/music`;
  return musicId ? `${base}/${encodeURIComponent(musicId)}` : base;
};

const musicUploadPath = (agencyId) =>
  `/v1/admin/agencies/${encodeURIComponent(agencyId)}/music/upload`;

/**
 * Music CRUD surface.
 *
 *   GET    /v1/admin/agencies/{id}/music                → list tracks
 *   POST   /v1/admin/agencies/{id}/music/upload         → multipart upload
 *                                                        (file + display_name +
 *                                                         is_default).
 *                                                        Server derives
 *                                                        object_key and
 *                                                        duration_seconds via
 *                                                        ffprobe.
 *   GET    /v1/admin/agencies/{id}/music/{music_id}     → inspect single track
 *   PUT    /v1/admin/agencies/{id}/music/{music_id}     → reconfigure (only
 *                                                        display_name +
 *                                                        is_default; object_key
 *                                                        is server-owned).
 *   DELETE /v1/admin/agencies/{id}/music/{music_id}     → decommission
 *
 * The legacy metadata-only POST /music (no /upload suffix) is retired in
 * feature 22 of the back: the upload endpoint is the only way to create a
 * track now.
 */
export const musicApi = {
  uploadTrack: (agencyId, formData) =>
    apiRequest(musicUploadPath(agencyId), {
      method: 'POST',
      body: formData,
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
