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
 * After backend feature 13 the scheduling toggles (hold window, quiet
 * hours, skip weekends) live entirely under `/automation`. Only the
 * captions / regen-on-update / review-emails toggles still travel via
 * the jsonb `defaults.settings` blob, because the back's automation
 * payload still uses `extra='forbid'` and rejects them.
 *
 * On save we:
 *   1. GET the current /defaults to preserve every other settings key
 *      (the back replaces — not merges — `settings`).
 *   2. PUT /automation with the canonical body (hold / quiet / skip).
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

      // Strip the legacy hold/quiet/skip namespaced keys: they now live in
      // /automation. Anything else any other tab wrote inside settings is
      // preserved verbatim. The literal key names are kept here (not
      // re-imported from AUTOMATION_SETTINGS_KEYS) so this migration logic
      // survives even after the constants are dropped from initialState.
      const sanitisedSettings = { ...existingSettings };
      delete sanitisedSettings['automation.quietHoursEnabled'];
      delete sanitisedSettings['automation.skipWeekends'];
      delete sanitisedSettings['automation.reviewWindowEnabled'];
      delete sanitisedSettings['automation.reviewWindowHours'];

      const mergedSettings = {
        ...sanitisedSettings,
        [AUTOMATION_SETTINGS_KEYS.autoCaptions]: Boolean(automationState.captions),
        [AUTOMATION_SETTINGS_KEYS.regenOnUpdate]: Boolean(
          automationState.regenOnUpdate,
        ),
        // Feature 26: list[str] directly. The back accepts both shapes on
        // ingress (legacy CSV → split server-side); we always send the
        // canonical array form so a round-trip stabilises on the new shape.
        [AUTOMATION_SETTINGS_KEYS.reviewEmails]: Array.isArray(automationState.reviewEmails)
          ? automationState.reviewEmails
          : [],
      };

      const automationBody = buildAutomationBody(automationState);
      const defaultsBody = {
        intro_enabled: existingIntroEnabled,
        duration_seconds: existingDurationSeconds,
        platforms: Array.isArray(platforms) ? platforms : existingPlatforms,
        settings: mergedSettings,
      };

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
