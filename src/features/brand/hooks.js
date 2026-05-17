import { useApi, useMutation } from '../../lib/hooks/useApi.js';
import { useCurrentAgencyId } from '../session/index.js';
import { brandApi } from './api.js';
import { fontsApi } from './fontsApi.js';

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

/**
 * Reads the global admin font catalog (feature 28).
 *
 * The catalog is small (~6 entries) and global, so the page fetches it once
 * on mount with no deps. Mirrors the `useApi` pattern used by
 * `useRenderTemplates`, but without an agency-scoped fetch — `/v1/admin/fonts`
 * has no `agency_id` in the path.
 *
 * Returns `{ items, count, loading, error, refetch }`. `items` is always an
 * array (empty while loading or on error) so callers can `.map()` without
 * guarding.
 */
export function useAvailableFonts() {
  const { data, ...rest } = useApi(() => fontsApi.listAvailableFonts(), []);
  const items = Array.isArray(data?.items) ? data.items : [];
  return {
    items,
    count: Number.isFinite(data?.count) ? data.count : items.length,
    ...rest,
  };
}

/**
 * Multipart upload of the agency logo. Returns the canonical
 * `{object_key, url}` pair from the backend; the caller is responsible for
 * persisting `logo_object_key` via `useSaveBrand`.
 */
export function useLogoUpload() {
  return useMutation(({ agencyId, file }) => {
    if (!agencyId) {
      return Promise.reject(new Error('No agency_id is available.'));
    }
    if (!file) {
      return Promise.reject(new Error('No file selected.'));
    }
    return brandApi.uploadLogo(agencyId, file);
  });
}
