import { useEffect, useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import { Spinner } from '../../shared/Spinner.jsx';
import { adminApi } from './api.js';
import { DefaultDescriptionsPanel } from './DefaultDescriptionsPanel.jsx';

const TABS = [
  { id: 'sources', label: 'WordPress sources', icon: 'link' },
  { id: 'ghl', label: 'GHL connection', icon: 'zap' },
  { id: 'reel', label: 'Reel settings', icon: 'film' },
  { id: 'descriptions', label: 'Descriptions', icon: 'edit' },
  { id: 'agency', label: 'Agency', icon: 'settings' },
];

export function AgencyConfigDrawer({ agency, onClose, onChanged }) {
  const [tab, setTab] = useState('sources');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reloadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.getAgency(agency.agency_id);
      setDetail(response);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agency.agency_id]);

  const ghlConnection = detail?.ghl_connection || agency.ghl_connection || null;
  const reelProfile = detail?.reel_profile || agency.reel_profile || null;
  const sources = detail?.sources || agency.sources || [];

  const reload = async () => {
    await reloadDetail();
    if (onChanged) onChanged();
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="drawer-panel agency-config-drawer"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="agency-drawer-head">
          <div className="agency-drawer-title-row">
            <div className="agency-drawer-name">
              <span className="agency-drawer-name-text">{agency.name}</span>
              <span className={`badge ${agency.status === 'active' ? 'success' : 'warning'}`}>
                <span className="dot" />
                {agency.status}
              </span>
            </div>
            <div className="row gap-3" style={{ marginLeft: 'auto' }}>
              <button className="icon-btn" onClick={onClose}>
                <Icon name="close" />
              </button>
            </div>
          </div>
          <div className="agency-drawer-id mono">{agency.agency_id}</div>

          <div className="tabs agency-drawer-subtabs">
            {TABS.map((option) => (
              <button
                key={option.id}
                className={`tab ${tab === option.id ? 'active' : ''}`}
                type="button"
                onClick={() => setTab(option.id)}
              >
                <Icon name={option.icon} size={12} />
                {option.label}
              </button>
            ))}
          </div>
        </header>

        <section className="agency-drawer-body">
          {loading && !detail ? (
            <div className="empty">Loading…</div>
          ) : error ? (
            <div className="ghl-admin-message danger">
              <Icon name="alert" size={13} />
              {error?.message || 'Failed to load agency detail.'}
            </div>
          ) : (
            <>
              {tab === 'sources' && (
                <SourcesPanel
                  agencyId={agency.agency_id}
                  sources={sources}
                  reload={reload}
                />
              )}
              {tab === 'ghl' && (
                <GhlPanel
                  agencyId={agency.agency_id}
                  connection={ghlConnection}
                  reload={reload}
                />
              )}
              {tab === 'reel' && (
                <ReelPanel
                  agencyId={agency.agency_id}
                  profile={reelProfile}
                  reload={reload}
                />
              )}
              {tab === 'descriptions' && (
                <DefaultDescriptionsPanel agencyId={agency.agency_id} />
              )}
              {tab === 'agency' && (
                <AgencyPanel
                  agency={detail?.agency || agency}
                  reload={reload}
                  onClose={onClose}
                />
              )}
            </>
          )}
        </section>
      </aside>
    </div>
  );
}

// ─── Sources tab ────────────────────────────────────────────────────────
function SourcesPanel({ agencyId, sources, reload }) {
  const [form, setForm] = useState({
    site_id: '',
    name: '',
    site_url: '',
  });
  const [editingId, setEditingId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [message, setMessage] = useState(null);

  const resetForm = () => {
    setForm({ site_id: '', name: '', site_url: '' });
    setEditingId('');
  };

  const startEdit = (source) => {
    setForm({
      site_id: source.site_id,
      name: source.name,
      site_url: source.site_url || '',
    });
    setEditingId(source.wordpress_source_id);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.site_id.trim() || !form.name.trim()) {
      setMessage({ tone: 'danger', text: 'site_id and name are required.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      if (editingId) {
        await adminApi.reconfigureAgencySource(agencyId, editingId, {
          name: form.name.trim(),
          site_url: form.site_url.trim() || undefined,
        });
      } else {
        await adminApi.upsertAgencySource(agencyId, {
          site_id: form.site_id.trim().toLowerCase(),
          name: form.name.trim(),
          site_url: form.site_url.trim() || undefined,
          status: 'active',
        });
      }
      setMessage({ tone: 'success', text: 'Source saved.' });
      resetForm();
      await reload();
    } catch (err) {
      setMessage({
        tone: 'danger',
        text: err?.body?.error || err?.message || 'Failed to save source.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (source) => {
    if (!window.confirm(`Remove source ${source.site_id}?`)) return;
    setDeletingId(source.wordpress_source_id);
    setMessage(null);
    try {
      await adminApi.deleteAgencySource(agencyId, source.wordpress_source_id);
      setMessage({ tone: 'success', text: 'Source removed.' });
      await reload();
    } catch (err) {
      setMessage({
        tone: 'danger',
        text: err?.body?.error || err?.message || 'Failed to remove source.',
      });
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="card source-card">
      <div className="source-head">
        <div className="source-logo">
          <Icon name="link" />
        </div>
        <div>
          <div className="source-title-row">
            <span className="source-title">WordPress sources</span>
            <span className="badge status-pill-sm">{sources.length}</span>
          </div>
          <div className="source-sub">
            Each source is the <code>rest_domain</code> sent by the WordPress webhook.
          </div>
        </div>
      </div>

      <div className="source-body">
        {message && (
          <div className={`ghl-admin-message ${message.tone}`}>
            <Icon name={message.tone === 'danger' ? 'alert' : 'info'} size={13} />
            {message.text}
          </div>
        )}

        <form
          className="ghl-admin-form"
          style={{ padding: 0, gridTemplateColumns: 'minmax(160px,1fr) minmax(160px,1fr) minmax(160px,1fr)' }}
          onSubmit={submit}
        >
          <label className="field">
            <span className="label">site_id (rest_domain)</span>
            <input
              className="input mono"
              value={form.site_id}
              onChange={(event) => setForm((curr) => ({ ...curr, site_id: event.target.value }))}
              placeholder="janetcarroll.ie"
              required
              disabled={Boolean(editingId)}
            />
          </label>
          <label className="field">
            <span className="label">Display name</span>
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm((curr) => ({ ...curr, name: event.target.value }))}
              placeholder="Janet Carroll"
              required
            />
          </label>
          <label className="field">
            <span className="label">Site URL (optional)</span>
            <input
              className="input mono"
              value={form.site_url}
              onChange={(event) => setForm((curr) => ({ ...curr, site_url: event.target.value }))}
              placeholder="https://janetcarroll.ie"
            />
          </label>
          <div className="ghl-admin-form-actions" style={{ gridColumn: '1 / -1' }}>
            <button className="btn primary" type="submit" disabled={submitting}>
              {submitting ? <Spinner /> : <Icon name="check" size={13} />}
              {editingId ? 'Update source' : 'Add source'}
            </button>
            {editingId && (
              <button className="btn" type="button" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="ghl-admin-table-wrap" style={{ marginTop: 16 }}>
          {sources.length === 0 ? (
            <div className="empty">No WordPress sources yet for this agency.</div>
          ) : (
            <table className="tbl tbl-hover">
              <thead>
                <tr>
                  <th>site_id</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Last event</th>
                  <th style={{ width: 160 }}></th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.wordpress_source_id}>
                    <td className="mono">{source.site_id}</td>
                    <td>{source.name}</td>
                    <td>
                      <span
                        className={`badge ${source.status === 'active' ? 'success' : 'warning'}`}
                      >
                        <span className="dot" />
                        {source.status}
                      </span>
                    </td>
                    <td className="t-sm t-muted">{source.last_event_at || '—'}</td>
                    <td>
                      <div className="row gap-3">
                        <button
                          className="btn sm"
                          type="button"
                          onClick={() => startEdit(source)}
                        >
                          <Icon name="edit" size={12} />
                        </button>
                        <button
                          className="btn sm danger"
                          type="button"
                          onClick={() => remove(source)}
                          disabled={deletingId === source.wordpress_source_id}
                        >
                          {deletingId === source.wordpress_source_id ? (
                            <Spinner />
                          ) : (
                            <Icon name="trash" size={12} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── GHL connection tab ────────────────────────────────────────────────
function GhlPanel({ agencyId, connection, reload }) {
  const [form, setForm] = useState({
    location_id: connection?.location_id || '',
    user_id: connection?.user_id || 'manual',
    access_token: '',
    refresh_token: '',
    expires_at: connection?.expires_at || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setForm({
      location_id: connection?.location_id || '',
      user_id: connection?.user_id || 'manual',
      access_token: '',
      refresh_token: '',
      expires_at: connection?.expires_at || '',
    });
  }, [connection?.location_id, connection?.user_id, connection?.expires_at]);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.location_id.trim() || !form.access_token.trim()) {
      setMessage({
        tone: 'danger',
        text: 'location_id and access_token are required.',
      });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await adminApi.upsertAgencyGhlConnection(agencyId, {
        location_id: form.location_id.trim(),
        user_id: form.user_id.trim() || 'manual',
        access_token: form.access_token.trim(),
        refresh_token: form.refresh_token.trim() || undefined,
        expires_at: form.expires_at.trim() || undefined,
      });
      setMessage({ tone: 'success', text: 'GHL connection saved.' });
      setForm((curr) => ({ ...curr, access_token: '', refresh_token: '' }));
      await reload();
    } catch (err) {
      setMessage({
        tone: 'danger',
        text: err?.body?.error || err?.message || 'Failed to save GHL connection.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const response = await adminApi.testAgencyGhlConnection(agencyId);
      setMessage({
        tone: 'success',
        text: `Connection OK. ${response?.account_count ?? 0} social accounts available.`,
      });
    } catch (err) {
      setMessage({
        tone: 'danger',
        text: err?.body?.error || err?.message || 'Test failed.',
      });
    } finally {
      setTesting(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Remove the GHL connection for this agency?')) return;
    setDeleting(true);
    setMessage(null);
    try {
      await adminApi.deleteAgencyGhlConnection(agencyId);
      setMessage({ tone: 'success', text: 'GHL connection removed.' });
      await reload();
    } catch (err) {
      setMessage({
        tone: 'danger',
        text: err?.body?.error || err?.message || 'Failed to remove connection.',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="card source-card">
      <div className="source-head">
        <div className="source-logo">
          <Icon name="zap" />
        </div>
        <div>
          <div className="source-title-row">
            <span className="source-title">GoHighLevel connection</span>
            {connection ? (
              <span className="badge success status-pill-sm mono">
                <span className="dot" />
                {connection.location_id}
              </span>
            ) : (
              <span className="badge warning status-pill-sm">
                <Icon name="close" size={9} />
                Not connected
              </span>
            )}
          </div>
          <div className="source-sub">
            One location and one access token per agency. The webhook resolves these
            from the agency, not from the WordPress payload.
          </div>
        </div>
      </div>

      <div className="source-body">
        {message && (
          <div className={`ghl-admin-message ${message.tone}`}>
            <Icon name={message.tone === 'danger' ? 'alert' : 'info'} size={13} />
            {message.text}
          </div>
        )}

        <form className="ghl-admin-form" style={{ padding: 0 }} onSubmit={submit}>
          <label className="field">
            <span className="label">Location ID</span>
            <input
              className="input mono"
              value={form.location_id}
              onChange={(event) => setForm((curr) => ({ ...curr, location_id: event.target.value }))}
              placeholder="GHL sub-account location id"
              required
            />
          </label>
          <label className="field">
            <span className="label">User ID</span>
            <input
              className="input mono"
              value={form.user_id}
              onChange={(event) => setForm((curr) => ({ ...curr, user_id: event.target.value }))}
              placeholder="manual"
            />
          </label>
          <label className="field ghl-admin-token-field">
            <span className="label">
              Access token{' '}
              {connection?.has_access_token && (
                <span className="t-xs t-muted">(already saved — paste a new one to replace)</span>
              )}
            </span>
            <input
              className="input mono"
              value={form.access_token}
              onChange={(event) => setForm((curr) => ({ ...curr, access_token: event.target.value }))}
              placeholder="GHL access token"
              required={!connection?.has_access_token}
            />
          </label>
          <label className="field">
            <span className="label">Refresh token (optional)</span>
            <input
              className="input mono"
              value={form.refresh_token}
              onChange={(event) => setForm((curr) => ({ ...curr, refresh_token: event.target.value }))}
              placeholder="optional"
            />
          </label>
          <label className="field">
            <span className="label">Expires at</span>
            <input
              className="input mono"
              value={form.expires_at}
              onChange={(event) => setForm((curr) => ({ ...curr, expires_at: event.target.value }))}
              placeholder="optional"
            />
          </label>
          <div className="ghl-admin-form-actions" style={{ gridColumn: '1 / -1' }}>
            <button className="btn primary" type="submit" disabled={submitting}>
              {submitting ? <Spinner /> : <Icon name="check" size={13} />}
              Save connection
            </button>
            <button
              className="btn"
              type="button"
              onClick={test}
              disabled={testing || !connection?.has_access_token}
            >
              {testing ? <Spinner /> : <Icon name="zap" size={12} />}
              Test connection
            </button>
            {connection && (
              <button
                className="btn sm danger"
                type="button"
                onClick={remove}
                disabled={deleting}
                style={{ marginLeft: 'auto' }}
              >
                {deleting ? <Spinner /> : <Icon name="trash" size={12} />}
                Remove
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reel settings tab ────────────────────────────────────────────────
const ALL_PLATFORMS = [
  'tiktok',
  'instagram',
  'linkedin',
  'youtube',
  'facebook',
  'gbp',
  'pinterest',
];
const LOGO_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

function ReelPanel({ agencyId, profile, reload }) {
  const [form, setForm] = useState(() => buildReelFormState(profile));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [extraJsonError, setExtraJsonError] = useState(null);

  useEffect(() => {
    setForm(buildReelFormState(profile));
  }, [profile]);

  const togglePlatform = (platform) => {
    setForm((curr) => ({
      ...curr,
      platforms: curr.platforms.includes(platform)
        ? curr.platforms.filter((value) => value !== platform)
        : [...curr.platforms, platform],
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    let parsedExtra = {};
    if (form.extraSettingsText.trim()) {
      try {
        parsedExtra = JSON.parse(form.extraSettingsText);
        if (typeof parsedExtra !== 'object' || Array.isArray(parsedExtra)) {
          throw new Error('Extra settings must be a JSON object.');
        }
      } catch (err) {
        setExtraJsonError(err.message);
        return;
      }
    }
    setExtraJsonError(null);
    setSubmitting(true);
    setMessage(null);
    try {
      await adminApi.upsertAgencyReelProfile(agencyId, {
        name: form.name || undefined,
        platforms: form.platforms,
        duration_seconds: Number(form.durationSeconds) || undefined,
        music_id: form.musicId || undefined,
        intro_enabled: form.introEnabled,
        logo_position: form.logoPosition,
        brand_primary_color: form.primaryColor,
        brand_secondary_color: form.secondaryColor,
        caption_template: form.captionTemplate || undefined,
        approval_required: form.approvalRequired,
        extra_settings: parsedExtra,
      });
      setMessage({ tone: 'success', text: 'Reel settings saved.' });
      await reload();
    } catch (err) {
      setMessage({
        tone: 'danger',
        text: err?.body?.error || err?.message || 'Failed to save reel settings.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card source-card">
      <div className="source-head">
        <div className="source-logo">
          <Icon name="film" />
        </div>
        <div>
          <div className="source-title-row">
            <span className="source-title">Reel generation settings</span>
            {profile ? (
              <span className="badge success status-pill-sm">
                <span className="dot" />
                Customized
              </span>
            ) : (
              <span className="badge status-pill-sm">Defaults</span>
            )}
          </div>
          <div className="source-sub">
            These settings drive how the agency&apos;s reels are generated and published.
          </div>
        </div>
      </div>

      <div className="source-body">
        {message && (
          <div className={`ghl-admin-message ${message.tone}`}>
            <Icon name={message.tone === 'danger' ? 'alert' : 'info'} size={13} />
            {message.text}
          </div>
        )}

        <form onSubmit={submit}>
          <div
            className="ghl-admin-form"
            style={{
              padding: 0,
              gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))',
            }}
          >
            <label className="field">
              <span className="label">Profile name</span>
              <input
                className="input"
                value={form.name}
                onChange={(event) => setForm((curr) => ({ ...curr, name: event.target.value }))}
                placeholder="Default"
              />
            </label>
            <label className="field">
              <span className="label">Duration (seconds)</span>
              <input
                className="input"
                type="number"
                min="5"
                max="120"
                value={form.durationSeconds}
                onChange={(event) =>
                  setForm((curr) => ({ ...curr, durationSeconds: event.target.value }))
                }
              />
            </label>

            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span className="label">Platforms</span>
              <div className="row gap-3" style={{ flexWrap: 'wrap' }}>
                {ALL_PLATFORMS.map((platform) => (
                  <label
                    key={platform}
                    className={`badge ${
                      form.platforms.includes(platform) ? 'accent' : ''
                    } status-pill-sm`}
                    style={{ cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      style={{ marginRight: 4 }}
                      checked={form.platforms.includes(platform)}
                      onChange={() => togglePlatform(platform)}
                    />
                    {platform}
                  </label>
                ))}
              </div>
            </label>

            <label className="field">
              <span className="label">Music ID</span>
              <input
                className="input mono"
                value={form.musicId}
                onChange={(event) => setForm((curr) => ({ ...curr, musicId: event.target.value }))}
                placeholder="e.g. uplifting-corporate-1"
              />
            </label>
            <label className="field">
              <span className="label">Logo position</span>
              <select
                className="input"
                value={form.logoPosition}
                onChange={(event) =>
                  setForm((curr) => ({ ...curr, logoPosition: event.target.value }))
                }
              >
                {LOGO_POSITIONS.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="label">Brand primary color</span>
              <input
                className="input mono"
                type="color"
                value={form.primaryColor}
                onChange={(event) =>
                  setForm((curr) => ({ ...curr, primaryColor: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span className="label">Brand secondary color</span>
              <input
                className="input mono"
                type="color"
                value={form.secondaryColor}
                onChange={(event) =>
                  setForm((curr) => ({ ...curr, secondaryColor: event.target.value }))
                }
              />
            </label>

            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span className="label">Caption template</span>
              <textarea
                className="input"
                rows={3}
                value={form.captionTemplate}
                onChange={(event) =>
                  setForm((curr) => ({ ...curr, captionTemplate: event.target.value }))
                }
                placeholder="Use {{title}}, {{price}}, {{location}} placeholders…"
              />
            </label>

            <label className="invite-checkbox-row" style={{ gridColumn: '1 / -1' }}>
              <input
                type="checkbox"
                checked={form.introEnabled}
                onChange={(event) =>
                  setForm((curr) => ({ ...curr, introEnabled: event.target.checked }))
                }
              />
              <span className="t-medium">Enable intro slide</span>
              <span className="t-sm t-muted" style={{ marginLeft: 'auto' }}>
                Adds a branded intro frame at the start of every reel.
              </span>
            </label>

            <label className="invite-checkbox-row" style={{ gridColumn: '1 / -1' }}>
              <input
                type="checkbox"
                checked={form.approvalRequired}
                onChange={(event) =>
                  setForm((curr) => ({ ...curr, approvalRequired: event.target.checked }))
                }
              />
              <span className="t-medium">Require approval before publishing</span>
              <span className="t-sm t-muted" style={{ marginLeft: 'auto' }}>
                Reels stop at <code>pending_review</code> until manually approved.
              </span>
            </label>

            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span className="label">Extra settings (JSON)</span>
              <textarea
                className="input mono"
                rows={4}
                value={form.extraSettingsText}
                onChange={(event) =>
                  setForm((curr) => ({ ...curr, extraSettingsText: event.target.value }))
                }
                placeholder='{"watermark": true}'
              />
              {extraJsonError && (
                <div className="t-sm" style={{ color: 'var(--danger)' }}>
                  {extraJsonError}
                </div>
              )}
            </label>
          </div>

          <div className="ghl-admin-form-actions" style={{ marginTop: 16 }}>
            <button className="btn primary" type="submit" disabled={submitting}>
              {submitting ? <Spinner /> : <Icon name="check" size={13} />}
              Save reel settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function buildReelFormState(profile) {
  return {
    name: profile?.name || 'Default',
    platforms: Array.isArray(profile?.platforms) && profile.platforms.length > 0
      ? profile.platforms
      : ['tiktok', 'instagram', 'linkedin', 'youtube', 'facebook', 'gbp', 'pinterest'],
    durationSeconds: profile?.duration_seconds ?? 30,
    musicId: profile?.music_id || '',
    introEnabled: profile?.intro_enabled ?? true,
    logoPosition: profile?.logo_position || 'top-right',
    primaryColor: profile?.brand_primary_color || '#0F172A',
    secondaryColor: profile?.brand_secondary_color || '#FFFFFF',
    captionTemplate: profile?.caption_template || '',
    approvalRequired: profile?.approval_required ?? false,
    extraSettingsText: profile?.extra_settings
      ? JSON.stringify(profile.extra_settings, null, 2)
      : '{}',
  };
}

// ─── Agency tab ────────────────────────────────────────────────
function AgencyPanel({ agency, reload, onClose }) {
  const [form, setForm] = useState({
    name: agency?.name || '',
    slug: agency?.slug || '',
    timezone: agency?.timezone || 'Europe/Dublin',
    status: agency?.status || 'active',
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setForm({
      name: agency?.name || '',
      slug: agency?.slug || '',
      timezone: agency?.timezone || 'Europe/Dublin',
      status: agency?.status || 'active',
    });
  }, [
    agency?.agency_id,
    agency?.name,
    agency?.slug,
    agency?.status,
    agency?.timezone,
    agency?.updated_at,
  ]);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await adminApi.updateAgency(agency.agency_id, {
        name: form.name,
        slug: form.slug || undefined,
        timezone: form.timezone,
        status: form.status,
      });
      setMessage({ tone: 'success', text: 'Agency updated.' });
      await reload();
    } catch (err) {
      setMessage({
        tone: 'danger',
        text: err?.body?.error || err?.message || 'Failed to update agency.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (
      !window.confirm(
        `Delete agency ${agency.name}? This also removes its sources, GHL connection, and reel settings.`,
      )
    )
      return;
    setDeleting(true);
    setMessage(null);
    try {
      await adminApi.deleteAgency(agency.agency_id);
      onClose();
      await reload();
    } catch (err) {
      setMessage({
        tone: 'danger',
        text: err?.body?.error || err?.message || 'Failed to delete agency.',
      });
      setDeleting(false);
    }
  };

  return (
    <div className="card source-card">
      <div className="source-head">
        <div className="source-logo">
          <Icon name="settings" />
        </div>
        <div>
          <div className="source-title-row">
            <span className="source-title">Agency settings</span>
          </div>
          <div className="source-sub mono">{agency?.agency_id}</div>
        </div>
      </div>
      <div className="source-body">
        {message && (
          <div className={`ghl-admin-message ${message.tone}`}>
            <Icon name={message.tone === 'danger' ? 'alert' : 'info'} size={13} />
            {message.text}
          </div>
        )}

        <form className="ghl-admin-form" style={{ padding: 0 }} onSubmit={submit}>
          <label className="field">
            <span className="label">Name</span>
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm((curr) => ({ ...curr, name: event.target.value }))}
              required
            />
          </label>
          <label className="field">
            <span className="label">Slug</span>
            <input
              className="input mono"
              value={form.slug}
              onChange={(event) => setForm((curr) => ({ ...curr, slug: event.target.value }))}
              placeholder="auto if blank"
            />
          </label>
          <label className="field">
            <span className="label">Timezone</span>
            <input
              className="input"
              value={form.timezone}
              onChange={(event) => setForm((curr) => ({ ...curr, timezone: event.target.value }))}
            />
          </label>
          <label className="field">
            <span className="label">Status</span>
            <select
              className="input"
              value={form.status}
              onChange={(event) => setForm((curr) => ({ ...curr, status: event.target.value }))}
            >
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="archived">archived</option>
            </select>
          </label>
          <div className="ghl-admin-form-actions" style={{ gridColumn: '1 / -1' }}>
            <button className="btn primary" type="submit" disabled={submitting}>
              {submitting ? <Spinner /> : <Icon name="check" size={13} />}
              Save agency
            </button>
            <button
              className="btn sm danger"
              type="button"
              onClick={remove}
              disabled={deleting}
              style={{ marginLeft: 'auto' }}
            >
              {deleting ? <Spinner /> : <Icon name="trash" size={12} />}
              Delete agency
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
