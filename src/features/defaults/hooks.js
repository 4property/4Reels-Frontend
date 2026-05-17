import { useApi, useMutation } from '../../lib/hooks/useApi.js';
import { useCurrentAgencyId } from '../session/index.js';
import { defaultsApi } from './api.js';

/**
 * Feature 33 — multipart upload of the agency outro clip. The server derives
 * `outro_object_key` and `outro_duration_seconds` from the persisted blob via
 * ffprobe, so the caller only ships the raw file.
 */
export function useOutroUpload() {
  return useMutation(({ agencyId, file }) => {
    if (!agencyId) {
      return Promise.reject(new Error('No agency_id is available.'));
    }
    if (!file) {
      return Promise.reject(new Error('No file selected.'));
    }
    return defaultsApi.outroUpload(agencyId, file);
  });
}

/**
 * Feature 33 — clears the persisted outro. Returns
 * `{ outro_source: 'none', outro_object_key: null }` on success.
 */
export function useOutroDelete() {
  return useMutation(({ agencyId }) => {
    if (!agencyId) {
      return Promise.reject(new Error('No agency_id is available.'));
    }
    return defaultsApi.outroDelete(agencyId);
  });
}

/**
 * Feature 34 — multipart upload of the agency intro clip. Mirrors
 * `useOutroUpload`; the server derives `intro_object_key` and
 * `intro_duration_seconds` from the persisted blob via ffprobe.
 */
export function useIntroUpload() {
  return useMutation(({ agencyId, file }) => {
    if (!agencyId) {
      return Promise.reject(new Error('No agency_id is available.'));
    }
    if (!file) {
      return Promise.reject(new Error('No file selected.'));
    }
    return defaultsApi.introUpload(agencyId, file);
  });
}

/**
 * Feature 34 — clears the persisted intro. Returns
 * `{ intro_source: 'none', intro_object_key: null }` on success.
 */
export function useIntroDelete() {
  return useMutation(({ agencyId }) => {
    if (!agencyId) {
      return Promise.reject(new Error('No agency_id is available.'));
    }
    return defaultsApi.introDelete(agencyId);
  });
}

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
    outro_enabled: Boolean(state.outroEnabled),
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
