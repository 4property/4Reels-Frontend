import { useEffect, useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import { Spinner } from '../../shared/Spinner.jsx';
import { Toggle } from '../../shared/Toggle.jsx';
import { AutoPublishDetails } from './AutoPublishDetails.jsx';
import { ModeCard } from './ModeCard.jsx';
import { ReviewModeDetails } from './ReviewModeDetails.jsx';
import { useAutomationRules } from './hooks.js';
import { useAutomationSave } from './useAutomationSave.js';
import { useReelDefaults } from '../defaults/hooks.js';
import {
  AUTOMATION_SETTINGS_KEYS,
  DEFAULT_PLATFORMS,
} from '../defaults/initialState.js';
import { normaliseEmail } from '../../lib/utils/email.js';
import './automation.css';

/**
 * Back accepts `defaults.settings.automation.reviewEmails` as either
 * `string[]` (canonical, feature 26) or as a legacy CSV string. Tolerate
 * both shapes on hydration; we always serialise back as `string[]`.
 */
function parseReviewEmails(raw) {
  if (Array.isArray(raw)) return raw.map(normaliseEmail).filter(Boolean);
  if (typeof raw === 'string') {
    return raw.split(',').map(normaliseEmail).filter(Boolean);
  }
  return [];
}

const DEFAULT_QUIET_HOURS_START = '22:00';
const DEFAULT_QUIET_HOURS_END = '07:00';

/** Automation page — the core "auto vs review-first" decision for publishing. */
export function AutomationConfig() {
  const { automation, agencyId, loading, refetch } = useAutomationRules();
  const { defaults, loading: defaultsLoading, refetch: refetchDefaults } =
    useReelDefaults();
  const [save, { loading: saving }] = useAutomationSave();

  const [publishMode, setPublishMode] = useState('auto');
  const [holdWindowEnabled, setHoldWindowEnabled] = useState(true);
  const [holdWindowHours, setHoldWindowHours] = useState(1);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);
  const [quietHoursStart, setQuietHoursStart] = useState(DEFAULT_QUIET_HOURS_START);
  const [quietHoursEnd, setQuietHoursEnd] = useState(DEFAULT_QUIET_HOURS_END);
  const [skipWeekends, setSkipWeekends] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [regenOnUpdate, setRegenOnUpdate] = useState(false);
  const [reviewEmails, setReviewEmails] = useState([]);
  const [autoIncludeNetworks, setAutoIncludeNetworks] = useState(DEFAULT_PLATFORMS);
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    if (!automation) return;
    // Publish-mode toggle.
    const approvalRequired =
      typeof automation.approval_required === 'boolean'
        ? automation.approval_required
        : false;
    setPublishMode(approvalRequired ? 'review' : 'auto');

    // Hold window — hold_window_seconds is the canonical owner.
    const holdSeconds = Number(automation.hold_window_seconds) || 0;
    setHoldWindowEnabled(holdSeconds > 0);
    if (holdSeconds > 0) setHoldWindowHours(holdSeconds / 3600);

    // Quiet hours — invert publish_window_* (allowed) back into the silent range.
    setQuietHoursEnabled(Boolean(automation.quiet_hours_enabled));
    if (automation.publish_window_start && automation.publish_window_end) {
      setQuietHoursStart(automation.publish_window_end);
      setQuietHoursEnd(automation.publish_window_start);
    }

    // Skip weekends — canonical owner is now /automation.
    setSkipWeekends(Boolean(automation.skip_weekends));
  }, [automation]);

  useEffect(() => {
    // Hydrate platforms + the remaining defaults-owned automation toggles.
    if (!defaults) return;
    const settings = (defaults.settings && typeof defaults.settings === 'object')
      ? defaults.settings
      : {};
    if (Array.isArray(defaults.platforms) && defaults.platforms.length > 0) {
      setAutoIncludeNetworks(defaults.platforms);
    }
    setCaptions(settings[AUTOMATION_SETTINGS_KEYS.autoCaptions] ?? true);
    setRegenOnUpdate(
      Boolean(settings[AUTOMATION_SETTINGS_KEYS.regenOnUpdate]),
    );
    setReviewEmails(parseReviewEmails(settings[AUTOMATION_SETTINGS_KEYS.reviewEmails]));
  }, [defaults]);

  const toggleNet = (id) =>
    setAutoIncludeNetworks((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id],
    );

  const handleSave = async () => {
    if (!agencyId) return;
    setStatusMessage(null);
    try {
      await save({
        agencyId,
        automationState: {
          publishMode,
          holdWindowEnabled,
          holdWindowHours,
          quietHoursEnabled,
          quietHoursStart,
          quietHoursEnd,
          skipWeekends,
          captions,
          regenOnUpdate,
          reviewEmails,
        },
        platforms: autoIncludeNetworks,
      });
      setStatusMessage({ tone: 'success', text: 'Automation saved.' });
      await Promise.all([refetch(), refetchDefaults()]);
    } catch (err) {
      setStatusMessage({
        tone: 'danger',
        text: err?.body?.error || err?.message || 'Failed to save automation.',
      });
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Automation</h1>
          <p className="page-subtitle">
            What happens when a new property lands via webhook, WordPress or CRM.
          </p>
        </div>
        <button
          className="btn primary"
          type="button"
          onClick={handleSave}
          disabled={saving || loading || defaultsLoading || !agencyId}
        >
          {saving ? <Spinner /> : <Icon name="check" size={14} />} Save
        </button>
      </div>

      {!agencyId && !loading && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="t-medium">No agency selected.</div>
          <div className="t-sm t-muted">
            Open the app from a GoHighLevel sub-account that is linked to an agency.
          </div>
        </div>
      )}

      {statusMessage && (
        <div
          className={`card ${statusMessage.tone === 'danger' ? 'card-danger' : ''}`}
          style={{ padding: 12, marginBottom: 16 }}
        >
          <Icon name={statusMessage.tone === 'danger' ? 'alert' : 'info'} size={13} />{' '}
          {statusMessage.text}
        </div>
      )}

      <ModePicker publishMode={publishMode} setPublishMode={setPublishMode} />

      <div className="stack gap-8">
        {publishMode === 'auto' ? (
          <AutoPublishDetails
            reviewWindow={holdWindowEnabled}
            setReviewWindow={setHoldWindowEnabled}
            reviewWindowHours={holdWindowHours}
            setReviewWindowHours={setHoldWindowHours}
            quietHours={quietHoursEnabled}
            setQuietHours={setQuietHoursEnabled}
            quietHoursStart={quietHoursStart}
            setQuietHoursStart={setQuietHoursStart}
            quietHoursEnd={quietHoursEnd}
            setQuietHoursEnd={setQuietHoursEnd}
            skipWeekends={skipWeekends}
            setSkipWeekends={setSkipWeekends}
            autoIncludeNetworks={autoIncludeNetworks}
            toggleNet={toggleNet}
          />
        ) : (
          <ReviewModeDetails
            reviewEmails={reviewEmails}
            setReviewEmails={setReviewEmails}
            quietHours={quietHoursEnabled}
            setQuietHours={setQuietHoursEnabled}
          />
        )}

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Rendering defaults</div>
              <div className="card-subtitle">Applied to every render.</div>
            </div>
          </div>
          <div className="card-body stack" style={{ gap: 18 }}>
            <Toggle
              on={captions}
              onChange={setCaptions}
              label="Auto-generate subtitles"
              sub="AI-generated subtitles, editable before publish."
            />
            <hr className="sep" style={{ margin: 0 }} />
            <Toggle
              on={regenOnUpdate}
              onChange={setRegenOnUpdate}
              label="Re-render when property data changes"
              sub="If price or photos update upstream, regenerate the reel automatically."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ModePicker({ publishMode, setPublishMode }) {
  return (
    <div className="auto-mode-banner">
      <div className="auto-mode-banner-inner">
        <div className="auto-mode-label">
          <span className="badge accent t-semibold">
            <Icon name="zap" size={10} /> Core setting
          </span>
          <span className="t-sm t-muted">Applied to every new property from now on</span>
        </div>
        <h2 className="auto-mode-title">How should 4reels handle new reels?</h2>
        <p className="auto-mode-sub">Pick one. You can always override per-reel from the editor.</p>

        <div className="auto-mode-options">
          <ModeCard
            selected={publishMode === 'auto'}
            onClick={() => setPublishMode('auto')}
            icon="zap"
            tone="accent"
            title="Publish automatically"
            tagline="Hands-off · fastest time to post"
            points={[
              'Reel is published to connected networks as soon as it finishes rendering',
              'No human action required',
              'Best for agencies with high listing volume',
            ]}
          />
          <ModeCard
            selected={publishMode === 'review'}
            onClick={() => setPublishMode('review')}
            icon="bell"
            tone="warning"
            title="Send email before publishing"
            tagline="Review-first · always a human in the loop"
            points={[
              'Every new reel waits in "Needs review"',
              'You get an email with a 1-click approve or edit link',
              'Nothing is posted until someone confirms',
            ]}
          />
        </div>
      </div>
    </div>
  );
}
