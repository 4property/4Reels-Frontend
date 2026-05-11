import { useState } from 'react';
import {
  AUTOMATION_SETTINGS_KEYS,
  INITIAL_DEFAULTS,
} from '../defaults/initialState.js';
import { defaultsApi } from '../defaults/api.js';
import { automationApi } from './api.js';
import { buildAutomationBody } from './hooks.js';

/**
 * Composed save hook for the Automation page.
 *
 * The visible UI keeps the historical 7 toggles + the platform slider,
 * but the back contract splits the persistence:
 *   - `/automation` only accepts approval_required / trigger_on_status /
 *     publish_window_* / publish_days (extra='forbid').
 *   - `platforms` and the legacy quiet/skip/captions/regen/review toggles
 *     live in `/defaults` (`platforms` as top-level array; the toggles as
 *     namespaced keys inside the jsonb `settings` blob).
 *
 * On save we:
 *   1. GET the current /defaults to read its `settings` blob (the back
 *      replaces — not merges — `settings`, so we have to round-trip
 *      everything in there to avoid losing keys other tabs wrote).
 *   2. PUT /automation with the canonical body.
 *   3. PUT /defaults with `platforms` + merged `settings`.
 */
export function useAutomationSave() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const save = async ({ agencyId, automationState, platforms }) => {
    if (!agencyId) {
      const err = new Error('No agency_id is available.');
      setError(err);
      throw err;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. Read the current defaults so we preserve every other settings key.
      let existingSettings = {};
      let existingPlatforms = INITIAL_DEFAULTS.platforms;
      let existingIntroEnabled = true;
      let existingDurationSeconds = 30;
      try {
        const current = await defaultsApi.getDefaults(agencyId);
        const defaults = (current && current.defaults) || {};
        if (defaults && defaults.settings && typeof defaults.settings === 'object') {
          existingSettings = defaults.settings;
        }
        if (Array.isArray(defaults?.platforms)) {
          existingPlatforms = defaults.platforms;
        }
        if (typeof defaults?.intro_enabled === 'boolean') {
          existingIntroEnabled = defaults.intro_enabled;
        }
        if (typeof defaults?.duration_seconds === 'number') {
          existingDurationSeconds = defaults.duration_seconds;
        }
      } catch (readErr) {
        // First-time agencies may 404; fall through with defaults.
        if (readErr?.status && readErr.status !== 404) throw readErr;
      }

      const mergedSettings = {
        ...existingSettings,
        [AUTOMATION_SETTINGS_KEYS.quietHoursEnabled]: Boolean(
          automationState.quietHours,
        ),
        [AUTOMATION_SETTINGS_KEYS.skipWeekends]: Boolean(automationState.skipWeekends),
        [AUTOMATION_SETTINGS_KEYS.autoCaptions]: Boolean(automationState.captions),
        [AUTOMATION_SETTINGS_KEYS.regenOnUpdate]: Boolean(
          automationState.regenOnUpdate,
        ),
        [AUTOMATION_SETTINGS_KEYS.reviewEmails]: automationState.reviewEmails || '',
        [AUTOMATION_SETTINGS_KEYS.reviewWindowEnabled]: Boolean(
          automationState.reviewWindow,
        ),
        [AUTOMATION_SETTINGS_KEYS.reviewWindowHours]:
          Number(automationState.reviewWindowHours) || 0,
      };

      const automationBody = buildAutomationBody(automationState);
      const defaultsBody = {
        intro_enabled: existingIntroEnabled,
        duration_seconds: existingDurationSeconds,
        platforms: Array.isArray(platforms) ? platforms : existingPlatforms,
        settings: mergedSettings,
      };

      // 2 + 3. Persist both slices.
      await automationApi.saveAutomation(agencyId, automationBody);
      await defaultsApi.saveDefaults(agencyId, defaultsBody);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return [save, { loading, error }];
}
