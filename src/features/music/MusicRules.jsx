import { useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import { Spinner } from '../../shared/Spinner.jsx';
import { Toggle } from '../../shared/Toggle.jsx';
import { defaultsApi } from '../defaults/api.js';
import { useReelDefaults } from '../defaults/hooks.js';
import { INITIAL_DEFAULTS } from '../defaults/initialState.js';

/**
 * Music selection rules tab.
 *
 * Feature 24 (cross-repo with backend feature 24): the "Fall back to full
 * library" toggle is hydrated from `defaults.settings.music.selection_rules.
 * fallback_to_full_library` and persisted via PUT /v1/admin/agencies/{id}/
 * defaults.
 *
 * Merge contract (load-bearing):
 *   The backend shallow-merges incoming `settings` with the previously
 *   stored object at the **top level** of `settings.*`
 *   (update_reel_defaults.py:67 — `{**existing, **incoming}`). It does
 *   NOT recurse into `settings.music`. So if the front PUTs only
 *   `settings: {music: {selection_rules: {fallback_to_full_library: x}}}`,
 *   any other future key under `settings.music.*` would be wiped.
 *
 *   We therefore deep-merge the `music` sub-document on the client:
 *
 *     settings.music = {
 *       ...(existing.settings.music || {}),         // preserve siblings
 *       selection_rules: {                          // overwrite this leaf
 *         ...(existing.settings.music?.selection_rules || {}),
 *         fallback_to_full_library: nextValue,
 *       },
 *     }
 *
 *   The other `settings.*` siblings (Format, Subtitles, Audio, …) are
 *   spread from `existing.settings` so a save from this tab does not
 *   drop work done in the Defaults page. This mirrors the same pattern
 *   used by `useAutomationSave.js` for the captions / regen / review
 *   keys.
 */
export function MusicRules({ tracks }) {
  const { defaults, agencyId, loading } = useReelDefaults();
  const [overrideValue, setOverrideValue] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const persistedRule =
    defaults?.settings?.music?.selection_rules?.fallback_to_full_library;
  // Default `true` when the GET returns no settings yet (e.g. fresh agency,
  // or while `loading=true`). The back surfaces this default itself on
  // GET, but we keep the fallback so the Toggle never renders with
  // `on={undefined}`.
  const baseValue = typeof persistedRule === 'boolean' ? persistedRule : true;
  const fallbackOn = overrideValue !== null ? overrideValue : baseValue;
  const disabled = !agencyId || loading || saving;

  const defaultTracks = tracks.filter((track) => track.is_default);
  const libraryTracks = tracks.filter((track) => !track.is_default);

  const handleToggle = async (nextValue) => {
    if (disabled) return;
    setError(null);
    setOverrideValue(nextValue);
    setSaving(true);
    try {
      const existingSettings =
        defaults?.settings && typeof defaults.settings === 'object'
          ? defaults.settings
          : {};
      const existingMusic =
        existingSettings.music && typeof existingSettings.music === 'object'
          ? existingSettings.music
          : {};
      const existingRules =
        existingMusic.selection_rules &&
        typeof existingMusic.selection_rules === 'object'
          ? existingMusic.selection_rules
          : {};

      const mergedSettings = {
        ...existingSettings,
        music: {
          ...existingMusic,
          selection_rules: {
            ...existingRules,
            fallback_to_full_library: nextValue,
          },
        },
      };

      // Mirror top-level columns the back also reads (intro_enabled /
      // duration_seconds / platforms). The Defaults page does the same
      // so a save from this tab does not regress those when defaults.*
      // is already persisted for this agency.
      const introEnabled =
        typeof defaults?.intro_enabled === 'boolean'
          ? defaults.intro_enabled
          : Boolean(INITIAL_DEFAULTS.introEnabled);
      const durationSeconds =
        typeof defaults?.duration_seconds === 'number'
          ? defaults.duration_seconds
          : 30;
      const platforms = Array.isArray(defaults?.platforms)
        ? defaults.platforms
        : INITIAL_DEFAULTS.platforms;

      await defaultsApi.saveDefaults(agencyId, {
        intro_enabled: introEnabled,
        duration_seconds: durationSeconds,
        platforms,
        settings: mergedSettings,
      });
    } catch (err) {
      setError(err);
      // Revert optimistic value so the toggle reflects the persisted state.
      setOverrideValue(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack gap-8">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Default pool</div>
            <div className="card-subtitle">
              Tracks marked as default are eligible for automatic reel selection.
            </div>
          </div>
        </div>
        <TrackChipList tracks={defaultTracks} empty="No default tracks selected." />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Library-only tracks</div>
            <div className="card-subtitle">
              These tracks stay available for manual assignment.
            </div>
          </div>
        </div>
        <TrackChipList tracks={libraryTracks} empty="All tracks are in the default pool." />
      </div>

      <div
        className="card"
        data-testid="music-rules-fallback-card"
        aria-busy={saving ? 'true' : 'false'}
      >
        <div className="card-body">
          <Toggle
            on={fallbackOn}
            onChange={(value) => {
              if (disabled) return;
              handleToggle(Boolean(value));
            }}
            label="Fall back to full library if no default track exists"
            sub="The renderer can pick any registered track when the default pool is empty."
          />
          {saving && (
            <div
              className="t-sm t-muted row gap-4"
              style={{ marginTop: 8 }}
              data-testid="music-rules-saving"
            >
              <Spinner /> Saving…
            </div>
          )}
          {!agencyId && !loading && (
            <div className="t-sm t-muted" style={{ marginTop: 8 }}>
              Select an agency to edit selection rules.
            </div>
          )}
          {error && (
            <div
              className="t-sm"
              style={{ marginTop: 8, color: 'var(--danger, #c43c3c)' }}
              data-testid="music-rules-error"
            >
              <Icon name="alert" size={12} /> {humanizeRuleError(error)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function humanizeRuleError(err) {
  if (!err) return 'Failed to save selection rules.';
  const body = err.body || {};
  if (body?.detail && Array.isArray(body.detail) && body.detail[0]?.msg) {
    return body.detail[0].msg;
  }
  return body?.message || body?.error || err.message || 'Failed to save selection rules.';
}

function TrackChipList({ tracks, empty }) {
  if (tracks.length === 0) {
    return <div className="empty">{empty}</div>;
  }
  return (
    <div className="music-rule-chip-list">
      {tracks.map((track) => (
        <Chip key={track.music_id} title={track.display_name} />
      ))}
    </div>
  );
}

function Chip({ title }) {
  return (
    <span className="music-chip">
      <Icon name="music" size={10} /> {title}
    </span>
  );
}
