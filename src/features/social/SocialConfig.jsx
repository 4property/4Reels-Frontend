import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import { Spinner } from '../../shared/Spinner.jsx';
import { useSocials, useVariables } from '../../app/providers/TenantProvider.jsx';
import { renderTemplate, splitTemplate } from '../../lib/utils/template.js';
import { defaultsApi } from '../defaults/api.js';
import { useReelDefaults } from '../defaults/hooks.js';
import { DEFAULT_PLATFORMS } from '../defaults/initialState.js';
import {
  NETWORK_LIMITS,
  findLinksInText,
  getPlatformPolicy,
} from '../reels/editor/defaults.js';

/** Template variable keys that resolve to a URL at publish time. */
const LINK_VARIABLE_KEYS = new Set(['property_url', 'booking_link']);
import { SocialPreviewCard } from './SocialPreviewCard.jsx';
import { HASHTAG_PATTERN, MAX_HASHTAGS_PER_PLATFORM } from './constants.js';
import { useSaveSocialTemplates, useSocialTemplates } from './hooks.js';
import './styles.css';

/** Default empty entry for a platform that has no record yet on the back. */
const EMPTY_ENTRY = Object.freeze({
  description_template: '',
  title_template: '',
  hashtags: [],
});

const TITLE_PLACEHOLDERS = {
  instagram: 'Catchy hook (optional)',
  tiktok: 'Hook for the first second (optional)',
  linkedin: 'Headline for the post (optional)',
  youtube: 'Video title (optional)',
  facebook: 'Post headline (optional)',
  gbp: 'Update title (optional)',
  pinterest: 'Pin title (optional)',
};

/** Social page — per-network description template editor. */
export function SocialConfig() {
  const socials = useSocials();
  const variables = useVariables();
  const { richTemplates: initialTemplates, agencyId, loading, refetch } = useSocialTemplates();
  const [save, { loading: saving }] = useSaveSocialTemplates();

  // Feature 30 — per-platform publish toggle. The canonical owner of the
  // `platforms` array is `/v1/admin/agencies/{id}/defaults` (back feature 6 +
  // 19). We hydrate the Set from `useReelDefaults` and PUT updates inline via
  // `defaultsApi.saveDefaults` so the toggle UX stays optimistic.
  const {
    defaults: reelDefaults,
    refetch: refetchDefaults,
  } = useReelDefaults();
  const [enabledPlatforms, setEnabledPlatforms] = useState(
    () => new Set(DEFAULT_PLATFORMS),
  );
  const [savingPlatforms, setSavingPlatforms] = useState(false);

  const [activeNet, setActiveNet] = useState('instagram');
  // Per-platform rich entry: { description_template, title_template, hashtags[] }.
  const [templates, setTemplates] = useState({});
  const [hydrated, setHydrated] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [hashtagError, setHashtagError] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!loading && !hydrated) {
      setTemplates(cloneRich(initialTemplates));
      setHydrated(true);
    }
  }, [loading, initialTemplates, hydrated]);

  // Hydrate the enabled-platforms Set from `/defaults.platforms` once the
  // response lands. Until then we keep the canonical DEFAULT_PLATFORMS so
  // the UI is never blank — same fallback the Automation page uses. The
  // back ships a default-7 array on agency provisioning (feature 19); an
  // empty array surfaced here means the row hasn't been touched yet, so
  // we keep showing DEFAULT_PLATFORMS to match the live back behaviour.
  useEffect(() => {
    if (!reelDefaults) return;
    if (
      Array.isArray(reelDefaults.platforms) &&
      reelDefaults.platforms.length > 0
    ) {
      setEnabledPlatforms(new Set(reelDefaults.platforms));
    }
  }, [reelDefaults]);

  const togglePublish = async (platformId) => {
    if (!agencyId) return;
    const social = socials.find((s) => s.id === platformId);
    if (!social || !social.connected) return; // defensive — UI also disables
    if (savingPlatforms) return;

    const previous = enabledPlatforms;
    const next = new Set(previous);
    if (next.has(platformId)) next.delete(platformId);
    else next.add(platformId);

    setEnabledPlatforms(next);
    setSavingPlatforms(true);
    try {
      await defaultsApi.saveDefaults(
        agencyId,
        buildPlatformsOnlyDefaultsBody(reelDefaults, Array.from(next)),
      );
      await refetchDefaults();
    } catch (err) {
      setEnabledPlatforms(previous);
      setStatusMessage({
        tone: 'danger',
        text:
          err?.body?.error ||
          err?.message ||
          'Could not update publish networks.',
      });
    } finally {
      setSavingPlatforms(false);
    }
  };

  const entry = templates[activeNet] || EMPTY_ENTRY;

  const setEntryField = (field, value) => {
    setTemplates((curr) => {
      const prev = curr[activeNet] || EMPTY_ENTRY;
      return { ...curr, [activeNet]: { ...prev, [field]: value } };
    });
  };

  const handleSave = async () => {
    if (!agencyId) return;
    setStatusMessage(null);
    try {
      // Always send the rich shape; the back accepts both but the new editor
      // owns 3 fields per platform so there is no point downgrading entries
      // that happen to have empty title/hashtags. See feature 20 review.
      const payload = buildRichPayload(templates);
      await save({ agencyId, templates: payload });
      setStatusMessage({ tone: 'success', text: 'Templates saved.' });
      await refetch();
      // After a refetch, useApi yields fresh data; the effect below re-hydrates.
      setHydrated(false);
    } catch (err) {
      setStatusMessage({
        tone: 'danger',
        text: err?.body?.error || err?.message || 'Could not save templates.',
      });
    }
  };

  const handleReset = () => {
    setTemplates(cloneRich(initialTemplates));
    setStatusMessage({ tone: 'info', text: 'Templates reset to last saved values.' });
  };

  const text = entry.description_template || '';
  const setText = (t) => setEntryField('description_template', t);

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
  const policy = getPlatformPolicy(activeNet);
  const detectedLinks = findLinksInText(text);
  const linkPolicyWarning =
    !policy.supportsLinks && detectedLinks.length > 0
      ? policy.linkWarning
      : null;

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

      <PublishingStrip
        socials={socials}
        enabledPlatforms={enabledPlatforms}
        onToggle={togglePublish}
        disabled={savingPlatforms || !agencyId}
      />

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
                [activeNet]: cloneEntry((initialTemplates && initialTemplates[activeNet]) || EMPTY_ENTRY),
              })
            }
          >
            <Icon name="copy" size={12} /> Reset this network
          </button>
        </div>

        <div className="template-net-tabs">
          {socials.map((s) => {
            const isPublishing = enabledPlatforms.has(s.id);
            return (
              <button
                key={s.id}
                className={`subtab ${activeNet === s.id ? 'active' : ''} ${
                  isPublishing ? '' : 'disabled-publish'
                }`}
                onClick={() => setActiveNet(s.id)}
                data-testid={`social-subtab-${s.id}`}
                title={
                  isPublishing
                    ? `Publishing on ${s.name}`
                    : `${s.name} publishing is off — edit template anyway`
                }
              >
                <span className="template-net-icon" style={{ background: s.color }}>
                  <Icon name={s.icon} size={10} />
                </span>
                {s.name}
                {!isPublishing && (
                  <span className="subtab-off-badge" aria-label="publishing off">
                    Off
                  </span>
                )}
              </button>
            );
          })}
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
            titleValue={entry.title_template || ''}
            onTitleChange={(value) => setEntryField('title_template', value)}
            titlePlaceholder={TITLE_PLACEHOLDERS[activeNet] || 'Title (optional)'}
            hashtags={entry.hashtags || []}
            onHashtagsChange={(next) => setEntryField('hashtags', next)}
            hashtagError={hashtagError}
            setHashtagError={setHashtagError}
            policy={policy}
            linkPolicyWarning={linkPolicyWarning}
          />
          <TemplatePreview activeNetObj={activeNetObj} text={text} previewText={previewText} />
        </div>
      </div>
    </div>
  );
}

/**
 * Hashtag normaliser used both for user-typed chips and for hydrated values.
 * Rules:
 *   - Trim whitespace.
 *   - Lowercase (Instagram/TikTok/LinkedIn collapse case anyway and storing a
 *     canonical form avoids `#Dublin` and `#dublin` being treated as two
 *     distinct chips). Documented as a UX decision in the impl report.
 *   - Prefix `#` when missing so `dublin` and `#dublin` both end up as
 *     `#dublin`.
 * Returns the normalised string (which the caller still has to validate via
 * `HASHTAG_PATTERN`).
 */
function normaliseHashtag(raw) {
  let value = String(raw || '').trim().toLowerCase();
  if (!value) return '';
  if (!value.startsWith('#')) value = `#${value}`;
  return value;
}

/** Deep clone of a `{platform: {description_template, title_template, hashtags[]}}` map. */
function cloneRich(rich) {
  const out = {};
  if (!rich || typeof rich !== 'object') return out;
  for (const [platform, value] of Object.entries(rich)) {
    out[platform] = cloneEntry(value);
  }
  return out;
}

function cloneEntry(value) {
  if (!value || typeof value !== 'object') return { ...EMPTY_ENTRY };
  return {
    description_template: typeof value.description_template === 'string' ? value.description_template : '',
    title_template: typeof value.title_template === 'string' ? value.title_template : '',
    hashtags: Array.isArray(value.hashtags) ? [...value.hashtags] : [],
  };
}

/**
 * Build the PUT payload for `socialApi.saveSocialTemplates`. Always emits the
 * rich shape per platform — strings are reserved for the legacy
 * DefaultDescriptionsPanel which has its own callsite. Empty platforms
 * (description, title and hashtags all blank) are dropped so the back's
 * "explicit empty wins" semantics don't reset entries the user hasn't touched.
 */
function buildRichPayload(templates) {
  const payload = {};
  for (const [platform, entry] of Object.entries(templates || {})) {
    if (!entry || typeof entry !== 'object') continue;
    const description = String(entry.description_template || '');
    const title = String(entry.title_template || '');
    const hashtags = Array.isArray(entry.hashtags) ? entry.hashtags : [];
    if (!description && !title && hashtags.length === 0) continue;
    payload[platform] = {
      description_template: description,
      title_template: title,
      hashtags: [...hashtags],
    };
  }
  return payload;
}

/**
 * Per-platform publish toggle strip (feature 30). Each card shows the
 * network identity + a Switch that flips the platform's presence on the
 * canonical `/defaults.platforms` array. A disconnected social account
 * forces the toggle into a disabled state with a tooltip — the user has
 * to connect the network from /agency before they can publish to it.
 */
function PublishingStrip({ socials, enabledPlatforms, onToggle, disabled }) {
  const connected = socials.filter((s) => s.connected).length;
  const publishingCount = socials.filter((s) => enabledPlatforms.has(s.id)).length;
  return (
    <div className="card publishing-strip" data-testid="publishing-strip">
      <div className="publishing-strip-head">
        <div className="publishing-icon">
          <Icon name="share" size={14} />
        </div>
        <div className="grow min-w-0">
          <div className="publishing-title">Publishing networks</div>
          <div className="publishing-sub">
            {publishingCount} active · {connected} of {socials.length} networks connected.
            Toggle off to skip a network at publish time; templates stay editable.
          </div>
        </div>
      </div>
      <div className="publishing-grid">
        {socials.map((s) => {
          const on = enabledPlatforms.has(s.id);
          const isDisabled = disabled || !s.connected;
          const tooltip = !s.connected
            ? 'Connect this network first'
            : on
              ? `Stop publishing to ${s.name}`
              : `Start publishing to ${s.name}`;
          return (
            <div
              key={s.id}
              className={`publishing-card ${on ? 'on' : ''} ${s.connected ? '' : 'disconnected'}`}
              data-testid={`publishing-card-${s.id}`}
            >
              <span className="publishing-card-icon" style={{ background: s.color }}>
                <Icon name={s.icon} size={12} />
              </span>
              <div className="publishing-card-text">
                <div className="publishing-card-name">{s.name}</div>
                <div className="publishing-card-status">
                  {s.connected ? (on ? 'Publishing' : 'Off') : 'Not connected'}
                </div>
              </div>
              <button
                type="button"
                className={`toggle ${on ? 'on' : ''}`}
                onClick={() => onToggle(s.id)}
                disabled={isDisabled}
                aria-pressed={on}
                aria-label={`${on ? 'Disable' : 'Enable'} publishing on ${s.name}`}
                title={tooltip}
                data-testid={`publishing-toggle-${s.id}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Build the PUT /v1/admin/agencies/{id}/defaults body that toggles a
 * platform on/off while preserving every other persisted defaults field.
 * The back's `update_reel_defaults` shallow-merges `settings` (see mock
 * backend `defaults` PUT handler comments) but replaces top-level keys,
 * so we have to echo `intro_enabled`, `duration_seconds` and `settings`.
 */
function buildPlatformsOnlyDefaultsBody(reelDefaults, platforms) {
  const safeDefaults = reelDefaults && typeof reelDefaults === 'object'
    ? reelDefaults
    : {};
  const body = {
    intro_enabled:
      typeof safeDefaults.intro_enabled === 'boolean'
        ? safeDefaults.intro_enabled
        : true,
    duration_seconds:
      typeof safeDefaults.duration_seconds === 'number'
        ? safeDefaults.duration_seconds
        : 30,
    platforms,
  };
  if (safeDefaults.settings && typeof safeDefaults.settings === 'object') {
    body.settings = safeDefaults.settings;
  }
  return body;
}

function TemplateEditor({
  activeNetObj,
  text,
  setText,
  charCount,
  limit,
  variables,
  textareaRef,
  onInsertTag,
  titleValue,
  onTitleChange,
  titlePlaceholder,
  hashtags,
  onHashtagsChange,
  hashtagError,
  setHashtagError,
  policy,
  linkPolicyWarning,
}) {
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

      {policy?.notes && (
        <div className="platform-notes" data-testid="social-template-policy-notes">
          <Icon name="info" size={12} /> {policy.notes}
        </div>
      )}

      <div className="template-section-label">
        Title (optional)
        {policy?.titleLimit > 0 ? (
          <span className="template-section-hint mono">
            {' '}
            · max {policy.titleLimit}
          </span>
        ) : (
          <span className="template-section-hint">
            {' '}
            · {activeNetObj?.name || 'this network'} doesn't surface a separate
            title — saved but ignored at publish time
          </span>
        )}
      </div>
      <input
        type="text"
        className="template-title-input"
        value={titleValue}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder={titlePlaceholder}
        spellCheck={false}
        maxLength={policy?.titleLimit > 0 ? policy.titleLimit : undefined}
        data-testid="social-template-title"
      />

      <div className="template-section-label" style={{ marginTop: 14 }}>Description</div>
      <div className="desc-editor-wrap">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          placeholder="Write your description... Use tags like {{property_title}} for dynamic content."
          data-testid="social-template-textarea"
        />
      </div>

      {linkPolicyWarning && (
        <div
          className="platform-warning"
          data-testid="social-template-link-warning"
        >
          <Icon name="alert" size={12} /> {linkPolicyWarning}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <div className="template-section-label">Insert a tag</div>
        <div className="row gap-3 row-wrap">
          {variables.map((v) => {
            const isLink = LINK_VARIABLE_KEYS.has(v.key);
            const dim = isLink && policy && !policy.supportsLinks;
            const tooltip = dim
              ? `${activeNetObj?.name || 'This network'} does not render URLs as clickable links.`
              : `Sample: ${v.sample}`;
            return (
              <button
                key={v.key}
                className={`tag-chip ${dim ? 'tag-chip-dim' : ''}`}
                onClick={() => onInsertTag(v.key)}
                title={tooltip}
                data-testid={`social-tag-${v.key}`}
              >
                <span className="chip-plus">+</span>
                {`{{${v.key}}}`}
              </button>
            );
          })}
        </div>
      </div>

      {policy?.supportsHashtags === false ? (
        <div className="platform-notes" style={{ marginTop: 14 }}>
          <Icon name="info" size={12} /> {policy.hashtagsNote}
        </div>
      ) : (
        <>
          <HashtagsEditor
            hashtags={hashtags}
            onChange={onHashtagsChange}
            errorMessage={hashtagError}
            setErrorMessage={setHashtagError}
          />
          {policy?.hashtagsNote && (
            <div className="template-section-hint" style={{ marginTop: 6 }}>
              <Icon name="info" size={11} /> {policy.hashtagsNote}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Inline chip editor for `hashtags`. Composition rules — chosen here to match
 * common Twitter/Instagram input UX:
 *   - Enter, comma or space submit the current input as a new chip.
 *   - Backspace on an empty input deletes the last chip (saves a click).
 *   - Each new chip is normalised (`normaliseHashtag`) and then validated
 *     against `HASHTAG_PATTERN`. Invalid → shown as an inline danger banner
 *     and dropped (not added to the array). The banner clears on the next
 *     successful add or when the input is cleared.
 *   - Duplicate chips (after normalisation) are silently de-duped — adding
 *     the same hashtag twice is almost certainly a user mistake.
 *   - Past `MAX_HASHTAGS_PER_PLATFORM` the input is disabled and shows a
 *     small explanatory note so the user knows why.
 */
function HashtagsEditor({ hashtags, onChange, errorMessage, setErrorMessage }) {
  const [draft, setDraft] = useState('');
  const atCap = (hashtags?.length || 0) >= MAX_HASHTAGS_PER_PLATFORM;

  const commit = (value) => {
    if (atCap) return;
    const normalised = normaliseHashtag(value);
    if (!normalised) return;
    if (!HASHTAG_PATTERN.test(normalised)) {
      setErrorMessage(`"${value.trim()}" is not a valid hashtag. Use letters, numbers, hyphen or underscore (max 50 chars).`);
      return;
    }
    if ((hashtags || []).includes(normalised)) {
      setDraft('');
      setErrorMessage(null);
      return;
    }
    onChange([...(hashtags || []), normalised]);
    setDraft('');
    setErrorMessage(null);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === ' ' && draft.trim().length > 0) {
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === 'Backspace' && draft === '' && (hashtags?.length || 0) > 0) {
      event.preventDefault();
      const next = hashtags.slice(0, -1);
      onChange(next);
    }
  };

  const handleChange = (event) => {
    const value = event.target.value;
    // Commit on inline comma typed via paste or IME, but keep space-as-commit
    // only on `keydown` so trailing whitespace during composition doesn't
    // pre-empt the user.
    if (value.includes(',')) {
      const parts = value.split(',');
      const tail = parts.pop();
      parts.forEach((part) => commit(part));
      setDraft(tail);
      return;
    }
    setDraft(value);
  };

  const removeAt = (index) => {
    const next = hashtags.slice();
    next.splice(index, 1);
    onChange(next);
    setErrorMessage(null);
  };

  return (
    <div className="template-hashtags" style={{ marginTop: 14 }}>
      <div className="template-section-label">
        Hashtags ({(hashtags?.length || 0)}/{MAX_HASHTAGS_PER_PLATFORM})
      </div>
      <div className="hashtag-editor" data-testid="social-template-hashtags">
        {(hashtags || []).map((tag, idx) => (
          <span key={`${tag}-${idx}`} className="hashtag-chip" data-testid="social-template-hashtag-chip">
            <span className="hashtag-chip-label">{tag}</span>
            <button
              type="button"
              className="hashtag-chip-remove"
              aria-label={`Remove ${tag}`}
              onClick={() => removeAt(idx)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          className="hashtag-input"
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (draft.trim()) commit(draft); }}
          disabled={atCap}
          placeholder={atCap ? `Max ${MAX_HASHTAGS_PER_PLATFORM} hashtags reached` : 'Add hashtag, e.g. #dublin'}
          data-testid="social-template-hashtag-input"
        />
      </div>
      {errorMessage && (
        <div className="card card-danger hashtag-error" data-testid="social-template-hashtag-error">
          <Icon name="alert" size={12} /> {errorMessage}
        </div>
      )}
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
