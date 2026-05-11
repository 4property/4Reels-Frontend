import { useEffect, useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import { Spinner } from '../../shared/Spinner.jsx';
import { INITIAL_DEFAULTS } from './initialState.js';
import { LivePreview } from './LivePreview.jsx';
import { AudioTab } from './tabs/AudioTab.jsx';
import { CaptionsTab } from './tabs/CaptionsTab.jsx';
import { FormatTab } from './tabs/FormatTab.jsx';
import { IntroOutroTab } from './tabs/IntroOutroTab.jsx';
import { SubtitlesTab } from './tabs/SubtitlesTab.jsx';
import { VideoTab } from './tabs/VideoTab.jsx';
import { useReelDefaults, useSaveReelDefaults } from './hooks.js';
import './defaults.css';

const TABS = [
  { id: 'format', label: 'Format & locale', icon: 'building' },
  { id: 'subtitles', label: 'Subtitles', icon: 'type' },
  { id: 'video', label: 'Video & timing', icon: 'film' },
  { id: 'intro-outro', label: 'Intro & outro', icon: 'play' },
  { id: 'audio', label: 'Audio', icon: 'music' },
  { id: 'captions', label: 'Caption generation', icon: 'zap' },
];

/** Reel defaults page — left sidebar picks the tab, right column previews. */
export function ReelDefaultsConfig() {
  const [tab, setTab] = useState('format');
  const [state, setState] = useState(INITIAL_DEFAULTS);
  const [statusMessage, setStatusMessage] = useState(null);

  const { defaults, agencyId, loading, refetch } = useReelDefaults();
  const [save, { loading: saving }] = useSaveReelDefaults();

  useEffect(() => {
    const persisted = defaults?.settings || null;
    if (persisted && typeof persisted === 'object') {
      setState({
        ...INITIAL_DEFAULTS,
        ...persisted,
        // Mirror top-level columns into the form so the toggle and the
        // duration field match what is actually persisted.
        introEnabled: defaults?.intro_enabled ?? persisted.introEnabled ?? true,
        platforms: Array.isArray(defaults?.platforms)
          ? defaults.platforms
          : persisted.platforms || INITIAL_DEFAULTS.platforms,
      });
    } else if (defaults) {
      setState((current) => ({
        ...current,
        introEnabled: defaults.intro_enabled ?? current.introEnabled,
        platforms: Array.isArray(defaults.platforms)
          ? defaults.platforms
          : current.platforms,
      }));
    }
  }, [defaults]);

  const set = (patch) => setState((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    if (!agencyId) return;
    setStatusMessage(null);
    try {
      await save({ agencyId, state });
      setStatusMessage({ tone: 'success', text: 'Defaults saved.' });
      await refetch();
    } catch (err) {
      setStatusMessage({
        tone: 'danger',
        text: err?.body?.error || err?.message || 'Failed to save defaults.',
      });
    }
  };

  const reset = () => {
    setState(INITIAL_DEFAULTS);
    setStatusMessage({ tone: 'info', text: 'Reset to system defaults — click Save to persist.' });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Defaults</h1>
          <p className="page-subtitle">
            Global settings applied to every reel. Individual reels can override these in the editor.
          </p>
        </div>
        <div className="row gap-4">
          <button className="btn" type="button" onClick={reset} disabled={saving}>
            <Icon name="refresh" size={14} /> Reset to system defaults
          </button>
          <button
            className="btn primary"
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !agencyId}
          >
            {saving ? <Spinner /> : <Icon name="check" size={14} />} Save defaults
          </button>
        </div>
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

      <div className="defaults-layout">
        <SideNav tab={tab} setTab={setTab} />

        <div className="defaults-content">
          <div className="stack gap-8">
            {tab === 'format' && <FormatTab state={state} set={set} />}
            {tab === 'subtitles' && <SubtitlesTab state={state} set={set} />}
            {tab === 'video' && <VideoTab state={state} set={set} />}
            {tab === 'intro-outro' && <IntroOutroTab state={state} set={set} />}
            {tab === 'audio' && <AudioTab state={state} set={set} />}
            {tab === 'captions' && <CaptionsTab state={state} set={set} />}
          </div>

          <LivePreview state={state} />
        </div>
      </div>
    </div>
  );
}

function SideNav({ tab, setTab }) {
  return (
    <div className="card defaults-sidenav">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`defaults-nav-btn ${tab === t.id ? 'active' : ''}`}
          onClick={() => setTab(t.id)}
        >
          <Icon name={t.icon} size={14} />
          {t.label}
        </button>
      ))}
    </div>
  );
}
