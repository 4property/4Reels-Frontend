import { useApi, useMutation } from '../../lib/hooks/useApi.js';
import { useCurrentAgencyId } from '../session/index.js';
import { defaultsApi } from './api.js';

/**
 * Reads / saves only the defaults slice. The full INITIAL_DEFAULTS object
 * lives under `settings`; `intro_enabled` and `duration_seconds` are
 * mirrored to top-level reel-profile columns by the backend.
 *
 * Owner of `platforms` is /defaults (per back `defaults.py:8-77`); the
 * UI in Automation reads/writes through this hook + `useSaveAutomation`.
 */
export function useReelDefaults() {
  const agencyId = useCurrentAgencyId();
  const { data, ...rest } = useApi(
    () =>
      agencyId ? defaultsApi.getDefaults(agencyId) : Promise.resolve({ defaults: null }),
    [agencyId],
  );
  return { defaults: data?.defaults || null, agencyId, ...rest };
}

export function useSaveReelDefaults() {
  return useMutation(({ agencyId, state }) => {
    if (!agencyId) {
      return Promise.reject(new Error('No agency_id is available.'));
    }
    return defaultsApi.saveDefaults(agencyId, buildDefaultsBody(state));
  });
}

/**
 * Build the canonical PUT /defaults body from a flat state object.
 * Used by both the Defaults page and the composed Automation save hook.
 */
export function buildDefaultsBody(state) {
  const body = {
    intro_enabled: Boolean(state.introEnabled),
    duration_seconds:
      state.duration === 'auto'
        ? Number(state.maxDuration || 30)
        : Number(state.maxDuration || state.minDuration || 30),
    settings: state,
  };
  if (Array.isArray(state.platforms)) {
    body.platforms = state.platforms;
  }
  return body;
}
