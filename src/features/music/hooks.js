import { useApi, useMutation } from '../../lib/hooks/useApi.js';
import { useCurrentAgencyId } from '../session/index.js';
import { musicApi } from './api.js';

export function useTracks() {
  const agencyId = useCurrentAgencyId();
  const { data, ...rest } = useApi(
    () =>
      agencyId
        ? musicApi.listTracks(agencyId)
        : Promise.resolve({ agency_id: null, items: [], count: 0 }),
    [agencyId],
  );
  const tracks = Array.isArray(data?.items) ? data.items : [];
  return {
    tracks,
    count: Number.isFinite(data?.count) ? data.count : tracks.length,
    agencyId,
    ...rest,
  };
}

export function useRegisterTrack() {
  return useMutation(({ agencyId, body }) => {
    if (!agencyId) return Promise.reject(new Error('No agency_id is available.'));
    return musicApi.registerTrack(agencyId, body);
  });
}

export function useInspectTrack() {
  return useMutation(({ agencyId, musicId }) => {
    if (!agencyId) return Promise.reject(new Error('No agency_id is available.'));
    return musicApi.inspectTrack(agencyId, musicId);
  });
}

export function useReconfigureTrack() {
  return useMutation(({ agencyId, musicId, body }) => {
    if (!agencyId) return Promise.reject(new Error('No agency_id is available.'));
    return musicApi.reconfigureTrack(agencyId, musicId, body);
  });
}

export function useDecommissionTrack() {
  return useMutation(({ agencyId, musicId }) => {
    if (!agencyId) return Promise.reject(new Error('No agency_id is available.'));
    return musicApi.decommissionTrack(agencyId, musicId);
  });
}
