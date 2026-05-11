import { useApi, useMutation } from '../../lib/hooks/useApi.js';
import { useCurrentAgencyId } from '../session/index.js';
import { brandApi } from './api.js';

/**
 * Reads / saves only the brand slice of the agency reel profile.
 * The endpoint guarantees the rest of `extra_settings` stays intact, so the
 * Brand tab never has to know about other tabs' state.
 */
export function useBrand() {
  const agencyId = useCurrentAgencyId();
  const { data, ...rest } = useApi(
    () => (agencyId ? brandApi.getBrand(agencyId) : Promise.resolve({ brand: null })),
    [agencyId],
  );
  return { brand: data?.brand || null, agencyId, ...rest };
}

export function useSaveBrand() {
  return useMutation(({ agencyId, body }) => {
    if (!agencyId) {
      return Promise.reject(new Error('No agency_id is available.'));
    }
    return brandApi.saveBrand(agencyId, body);
  });
}
