import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import { Spinner } from '../../shared/Spinner.jsx';
import { useSocials, useVariables } from '../../app/providers/TenantProvider.jsx';
import { renderTemplate, splitTemplate } from '../../lib/utils/template.js';
import { NETWORK_LIMITS } from '../reels/editor/defaults.js';
import { SocialPreviewCard } from './SocialPreviewCard.jsx';
import { useSaveSocialTemplates, useSocialTemplates } from './hooks.js';
import './styles.css';

/** Social page — per-network description template editor. */
export function SocialConfig() {
  const socials = useSocials();
  const variables = useVariables();
  const { templates: initialTemplates, agencyId, loading, refetch } = useSocialTemplates();
  const [save, { loading: saving }] = useSaveSocialTemplates();

  const [activeNet, setActiveNet] = useState('instagram');
  const [templates, setTemplates] = useState({});
  const [hydrated, setHydrated] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!loading && !hydrated) {
      setTemplates({ ...(initialTemplates || {}) });
      setHydrated(true);
    }
  }, [loading, initialTemplates, hydrated]);

  const handleSave = async () => {
    if (!agencyId) return;
    setStatusMessage(null);
    try {
      await save({ agencyId, templates });
      setStatusMessage({ tone: 'success', text: 'Templates saved.' });
      await refetch();
    } catch (err) {
      setStatusMessage({
        tone: 'danger',
        text: err?.body?.error || err?.message || 'Could not save templates.',
      });
    }
  };

  const handleReset = () => {
    setTemplates({ ...(initialTemplates || {}) });
    setStatusMessage({ tone: 'info', text: 'Templates reset to last saved values.' });
  };

  const text = templates[activeNet] || '';
  const setText = (t) => setTemplates({ ...templates, [activeNet]: t });

  const insertTag = (key) => {
    const ta = textareaRef.current;
    const token = `{{${key}}}`;
    if (!ta) { setText(text + token); return; }
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    const next = text.slice(0, start) + token + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const previewText = renderTemplate(text, variables);
  const activeNetObj = socials.find((s) => s.id === activeNet);
  const limit = NETWORK_LIMITS[activeNet] || 2200;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Social networks</h1>
          <p className="page-subtitle">Connect your channels and edit the description template for each network.</p>
        </div>
        <div className="row gap-4">
          <button className="btn" type="button" onClick={handleReset} disabled={saving || loading}>
            <Icon name="refresh" size={14} /> Reset
          </button>
          <button
            className="btn primary"
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !agencyId}
          >
            {saving ? <Spinner /> : <Icon name="check" size={14} />} Save changes
          </button>
        </div>
      </div>

      {!agencyId && !loading && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="t-medium">No agency in this session.</div>
          <div className="t-sm t-muted">
            Open the app from a GoHighLevel sub-account that is linked to an agency, or
            assign one in the admin panel.
          </div>
        </div>
      )}

      {statusMessage && (
        <div
          className={`card ${statusMessage.tone === 'danger' ? 'card-danger' : ''}`}
          style={{ padding: 12, marginBottom: 16 }}
        >
          <Icon
            name={statusMessage.tone === 'danger' ? 'alert' : 'info'}
            size={13}
          />{' '}
          {statusMessage.text}
        </div>
      )}

      <ConnectionsStrip socials={socials} />

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Description templates</div>
            <div className="card-subtitle">Plain text per network. Click a tag to insert it — tags get replaced with real property data when publishing.</div>
          </div>
          <button
            className="btn sm"
            type="button"
            onClick={() =>
              setTemplates({
                ...templates,
                [activeNet]: (initialTemplates && initialTemplates[activeNet]) || '',
              })
            }
          >
            <Icon name="copy" size={12} /> Reset this network
          </button>
        </div>

        <div className="template-net-tabs">
          {socials.map((s) => (
            <button
              key={s.id}
              className={`subtab ${activeNet === s.id ? 'active' : ''}`}
              onClick={() => setActiveNet(s.id)}
            >
              <span className="template-net-icon" style={{ background: s.color }}>
                <Icon name={s.icon} size={10} />
              </span>
              {s.name}
            </button>
          ))}
        </div>

        <div className="template-grid">
          <TemplateEditor
            activeNetObj={activeNetObj}
            text={text}
            setText={setText}
            charCount={text.length}
            limit={limit}
            variables={variables}
            textareaRef={textareaRef}
            onInsertTag={insertTag}
          />
          <TemplatePreview activeNetObj={activeNetObj} text={text} previewText={previewText} />
        </div>
      </div>
    </div>
  );
}

function ConnectionsStrip({ socials }) {
  const connected = socials.filter((s) => s.connected).length;
  return (
    <div className="card connections-strip">
      <div className="connections-icon">
        <Icon name="link" size={14} />
      </div>
      <div className="grow min-w-0">
        <div className="connections-title">{connected} of {socials.length} networks connected</div>
        <div className="connections-sub">
          Templates below are applied when 4reels publishes to each connected network.
        </div>
      </div>
      <div className="row gap-2">
        {socials.map((s) => (
          <span
            key={s.id}
            title={`${s.name} · ${s.connected ? s.handle : 'Not connected'}`}
            className={`connections-dot ${s.connected ? '' : 'off'}`}
            style={s.connected ? { background: s.color } : undefined}
          >
            <Icon name={s.icon} size={13} />
          </span>
        ))}
      </div>
    </div>
  );
}

function TemplateEditor({ activeNetObj, text, setText, charCount, limit, variables, textareaRef, onInsertTag }) {
  return (
    <div className="template-editor-col">
      <div className="template-editor-head">
        <div className="t-sm t-muted">
          Template for <span className="t-medium" style={{ color: 'var(--text)' }}>{activeNetObj?.name}</span>
        </div>
        <div className={`mono template-char-count ${charCount > limit ? 'over' : ''}`}>
          {charCount}/{limit}
        </div>
      </div>

      <div className="desc-editor-wrap">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          placeholder="Write your description... Use tags like {{property_title}} for dynamic content."
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="template-section-label">Insert a tag</div>
        <div className="row gap-3 row-wrap">
          {variables.map((v) => (
            <button
              key={v.key}
              className="tag-chip"
              onClick={() => onInsertTag(v.key)}
              title={`Sample: ${v.sample}`}
            >
              <span className="chip-plus">+</span>
              {`{{${v.key}}}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplatePreview({ activeNetObj, text, previewText }) {
  return (
    <div className="template-preview-col">
      <div className="template-preview-head">
        <span>Live preview · <span className="t-medium" style={{ color: 'var(--text)' }}>{activeNetObj?.name}</span></span>
      </div>

      <SocialPreviewCard net={activeNetObj} text={previewText} />

      <div className="template-compare">
        <div>
          <div className="template-section-label">Raw template</div>
          <div className="template-compare-box raw">
            <HighlightedTemplate raw={text} />
          </div>
        </div>
        <div>
          <div className="template-section-label">With sample data</div>
          <div className="template-compare-box">{previewText}</div>
        </div>
      </div>
    </div>
  );
}

function HighlightedTemplate({ raw }) {
  return splitTemplate(raw).map((part, i) =>
    part.kind === 'tag' ? (
      <span key={i} className="tag-chip-inline">{part.text}</span>
    ) : (
      <span key={i}>{part.text}</span>
    ),
  );
}
