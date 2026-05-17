import { useEffect, useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import { Spinner } from '../../shared/Spinner.jsx';
import { socialApi } from '../social/api.js';

/**
 * Per-platform description templates editor for the agency-config drawer.
 *
 * Reads/writes `/v1/admin/agencies/{id}/social-templates` directly through
 * the existing `socialApi` (cross-feature import — same precedent as
 * `automation/useAutomationSave.js -> defaults/api.js`). The drawer panels
 * use an imperative useState + useEffect pattern instead of the feature
 * hooks because the agency id arrives via prop, not the session.
 */
const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok', icon: 'tiktok' },
  { id: 'instagram', label: 'Instagram', icon: 'instagram' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'linkedin' },
  { id: 'youtube', label: 'YouTube', icon: 'youtube' },
  { id: 'facebook', label: 'Facebook', icon: 'facebook' },
  { id: 'gbp', label: 'Google Business', icon: 'google-business' },
  { id: 'pinterest', label: 'Pinterest', icon: 'pinterest' },
];

const ALLOWED_VARIABLES = [
  'property_title',
  'price',
  'bedrooms',
  'bathrooms',
  'size_m2',
  'property_type',
  'city',
  'neighborhood',
  'eircode',
  'short_description',
  'agent_name',
  'agent_phone',
  'booking_link',
];

const PLATFORM_PLACEHOLDERS = {
  tiktok: 'Just listed in {{neighborhood}} — {{property_title}}\n{{price}} · {{bedrooms}} bed',
  instagram: '{{property_title}} · {{price}}\n{{short_description}}\n👉 {{booking_link}}',
  linkedin: 'New listing: {{property_title}} in {{city}}.\n{{short_description}}\nDetails: {{booking_link}}',
  youtube: '{{property_title}} — {{price}} | {{bedrooms}} bed in {{neighborhood}}, {{city}}.',
  facebook: '{{property_title}}\n{{short_description}}\nMore info: {{booking_link}}',
  gbp: '{{property_title}} · {{price}} · {{bedrooms}} bed in {{neighborhood}}.',
  pinterest: '{{property_title}} | {{price}} | {{city}} — {{short_description}}',
};

export function DefaultDescriptionsPanel({ agencyId }) {
  const [templates, setTemplates] = useState(emptyTemplates);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    socialApi
      .getSocialTemplates(agencyId)
      .then((response) => {
        if (cancelled) return;
        setTemplates(mergeTemplates(response?.templates));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agencyId]);

  const updateTemplate = (platform, value) => {
    setTemplates((curr) => ({ ...curr, [platform]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const trimmed = Object.fromEntries(
        Object.entries(templates).filter(([, value]) => String(value || '').trim().length > 0),
      );
      await socialApi.saveSocialTemplates(agencyId, trimmed);
      setMessage({ tone: 'success', text: 'Default descriptions saved.' });
    } catch (err) {
      setMessage({
        tone: 'danger',
        text: err?.body?.error || err?.message || 'Failed to save descriptions.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card source-card">
      <div className="source-head">
        <div className="source-logo">
          <Icon name="edit" />
        </div>
        <div>
          <div className="source-title-row">
            <span className="source-title">Default descriptions</span>
            <span className="badge status-pill-sm">{PLATFORMS.length} platforms</span>
          </div>
          <div className="source-sub">
            Per-platform description used at publish time. Use{' '}
            <code>{'{{property_title}}'}</code>, <code>{'{{price}}'}</code>,{' '}
            <code>{'{{neighborhood}}'}</code>… Variables are replaced when 4reels
            renders the caption.
          </div>
        </div>
      </div>

      <div className="source-body">
        {error && (
          <div className="ghl-admin-message danger">
            <Icon name="alert" size={13} />
            {error?.message || 'Failed to load default descriptions.'}
          </div>
        )}
        {message && (
          <div className={`ghl-admin-message ${message.tone}`}>
            <Icon name={message.tone === 'danger' ? 'alert' : 'info'} size={13} />
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="empty">Loading default descriptions…</div>
        ) : (
          <form className="default-descriptions-form" onSubmit={submit}>
            <div className="default-descriptions-grid">
              {PLATFORMS.map((platform) => (
                <label key={platform.id} className="field default-description-field">
                  <span className="label">
                    <Icon name={platform.icon} size={13} /> {platform.label}
                  </span>
                  <textarea
                    className="input default-description-textarea"
                    rows={4}
                    value={templates[platform.id] || ''}
                    placeholder={PLATFORM_PLACEHOLDERS[platform.id] || ''}
                    onChange={(event) => updateTemplate(platform.id, event.target.value)}
                    data-testid={`default-description-${platform.id}`}
                  />
                </label>
              ))}
            </div>

            <div className="default-descriptions-help">
              <span className="t-sm t-muted">Allowed variables:</span>
              <div className="row gap-2 row-wrap">
                {ALLOWED_VARIABLES.map((key) => (
                  <code key={key} className="default-description-var">
                    {`{{${key}}}`}
                  </code>
                ))}
              </div>
            </div>

            <div className="ghl-admin-form-actions" style={{ marginTop: 16 }}>
              <button
                className="btn primary"
                type="submit"
                disabled={submitting}
                data-testid="save-default-descriptions"
              >
                {submitting ? <Spinner /> : <Icon name="check" size={13} />}
                Save default descriptions
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function emptyTemplates() {
  const base = {};
  for (const platform of PLATFORMS) base[platform.id] = '';
  return base;
}

function mergeTemplates(incoming) {
  const base = emptyTemplates();
  if (!incoming || typeof incoming !== 'object') return base;
  for (const [key, value] of Object.entries(incoming)) {
    if (typeof value !== 'string') continue;
    base[key] = value;
  }
  return base;
}
