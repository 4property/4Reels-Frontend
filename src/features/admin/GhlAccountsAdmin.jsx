import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import { Spinner } from '../../shared/Spinner.jsx';
import { MVP_API_URL } from '../../lib/api/client.js';
import { adminApi } from './api.js';

const EMPTY_FORM = {
  location_id: '',
  user_id: 'manual-test',
  access_token: '',
  refresh_token: '',
  expires_at: '',
};

export function GhlAccountsAdmin() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState('');
  const [deleting, setDeleting] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState(null);
  const [lastTrace, setLastTrace] = useState(null);

  const connectedCount = useMemo(
    () => accounts.filter((account) => account.has_access_token).length,
    [accounts],
  );

  const loadAccounts = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await adminApi.listGhlAccounts();
      const items = normalizeAccounts(response);
      setAccounts(items);
      setLastTrace({
        action: 'listGhlAccounts',
        ok: true,
        endpoint: `${trimTrailingSlash(MVP_API_URL)}/mvp/gohighlevel/tokens`,
        count: items.length,
        responseShape: describeShape(response),
        receivedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleAdminError('listGhlAccounts', 'Could not load GHL accounts.', error, setMessage, setLastTrace);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveAccount = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await adminApi.upsertGhlAccount({
        location_id: form.location_id,
        user_id: form.user_id || 'manual-test',
        access_token: form.access_token,
        refresh_token: form.refresh_token,
        expires_at: form.expires_at,
      });
      setForm({ ...EMPTY_FORM, user_id: form.user_id || EMPTY_FORM.user_id });
      setMessage({ tone: 'success', text: 'GHL account saved.' });
      setLastTrace({
        action: 'upsertGhlAccount',
        ok: true,
        locationId: form.location_id,
        receivedAt: new Date().toISOString(),
      });
      await loadAccounts();
    } catch (error) {
      handleAdminError('upsertGhlAccount', 'Could not save the account.', error, setMessage, setLastTrace);
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async (locationId) => {
    if (!window.confirm(`Remove saved token for location ${locationId}?`)) return;
    setDeleting(locationId);
    setMessage(null);
    try {
      await adminApi.deleteGhlAccount(locationId);
      setMessage({ tone: 'success', text: 'GHL account removed.' });
      setLastTrace({
        action: 'deleteGhlAccount',
        ok: true,
        locationId,
        receivedAt: new Date().toISOString(),
      });
      await loadAccounts();
    } catch (error) {
      handleAdminError('deleteGhlAccount', 'Could not remove the account.', error, setMessage, setLastTrace);
    } finally {
      setDeleting('');
    }
  };

  const testAccount = async (locationId) => {
    setTesting(locationId);
    setMessage(null);
    try {
      const response = await adminApi.testGhlAccount(locationId);
      setMessage({
        tone: 'success',
        text: `${response.account_count || 0} social accounts returned for ${locationId}.`,
      });
      setLastTrace({
        action: 'testGhlAccount',
        ok: true,
        locationId,
        accountCount: response.account_count || 0,
        responseShape: describeShape(response),
        receivedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleAdminError('testGhlAccount', 'Connection test failed.', error, setMessage, setLastTrace);
    } finally {
      setTesting('');
    }
  };

  const editAccount = (account) => {
    setForm({
      ...EMPTY_FORM,
      location_id: account.location_id,
      user_id: account.user_id || 'manual-test',
    });
    setMessage({
      tone: 'info',
      text: 'Paste a fresh access token before saving this account.',
    });
  };

  return (
    <section className="card ghl-admin-card">
      <div className="card-header">
        <div>
          <div className="card-title">GoHighLevel MVP accounts</div>
          <div className="card-subtitle">
            Manage the location tokens used by the WordPress webhook and embedded app.
          </div>
        </div>
        <button className="btn sm" onClick={loadAccounts} disabled={loading}>
          {loading ? <Spinner /> : <Icon name="refresh" size={12} />}
          Refresh
        </button>
      </div>

      <div className="ghl-admin-summary">
        <div className="mini-stat">
          <div className="mini-stat-label">Saved locations</div>
          <div className="mini-stat-value">{accounts.length}</div>
        </div>
        <div className="mini-stat">
          <div className="mini-stat-label">With token</div>
          <div className="mini-stat-value">{connectedCount}</div>
        </div>
        <div className="mini-stat">
          <div className="mini-stat-label">Backend</div>
          <div className="mini-stat-value">Live</div>
        </div>
        <div className="mini-stat">
          <div className="mini-stat-label">Endpoint</div>
          <div className="mini-stat-value mono">{MVP_API_URL || '-'}</div>
        </div>
      </div>

      {message && (
        <div className={`ghl-admin-message ${message.tone}`}>
          <Icon name={message.tone === 'danger' ? 'alert' : 'info'} size={13} />
          {message.text}
        </div>
      )}

      <form className="ghl-admin-form" onSubmit={saveAccount}>
        <label className="field">
          <span className="label">Location ID</span>
          <input
            className="input mono"
            value={form.location_id}
            onChange={(event) => updateForm('location_id', event.target.value)}
            placeholder="GHL location id"
            required
          />
        </label>
        <label className="field">
          <span className="label">User ID</span>
          <input
            className="input mono"
            value={form.user_id}
            onChange={(event) => updateForm('user_id', event.target.value)}
            placeholder="manual-test"
            required
          />
        </label>
        <label className="field ghl-admin-token-field">
          <span className="label">Access token</span>
          <input
            className="input mono"
            value={form.access_token}
            onChange={(event) => updateForm('access_token', event.target.value)}
            placeholder="GHL access token"
            required
          />
        </label>
        <label className="field">
          <span className="label">Refresh token</span>
          <input
            className="input mono"
            value={form.refresh_token}
            onChange={(event) => updateForm('refresh_token', event.target.value)}
            placeholder="optional"
          />
        </label>
        <label className="field">
          <span className="label">Expires at</span>
          <input
            className="input mono"
            value={form.expires_at}
            onChange={(event) => updateForm('expires_at', event.target.value)}
            placeholder="optional"
          />
        </label>
        <div className="ghl-admin-form-actions">
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? <Spinner /> : <Icon name="check" size={13} />}
            Save account
          </button>
          <button className="btn" type="button" onClick={() => setForm(EMPTY_FORM)}>
            Clear
          </button>
        </div>
      </form>

      <div className="ghl-admin-table-wrap">
        {loading && accounts.length === 0 ? (
          <div className="empty">Loading...</div>
        ) : accounts.length === 0 ? (
          <div className="empty">No GHL accounts saved yet.</div>
        ) : (
          <table className="tbl tbl-hover">
            <thead>
              <tr>
                <th>Location</th>
                <th>User</th>
                <th>Token</th>
                <th>Refresh</th>
                <th>Updated</th>
                <th style={{ width: 180 }}></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.location_id}>
                  <td className="mono">{account.location_id}</td>
                  <td className="mono">{account.user_id}</td>
                  <td>
                    <span className={`badge ${account.has_access_token ? 'success' : 'warning'}`}>
                      <span className="dot" />
                      {account.has_access_token ? 'Saved' : 'Missing'}
                    </span>
                  </td>
                  <td>{account.has_refresh_token ? 'Yes' : 'No'}</td>
                  <td className="t-sm t-muted">{account.updated_at || '-'}</td>
                  <td>
                    <div className="row gap-3">
                      <button className="btn sm" type="button" onClick={() => editAccount(account)}>
                        <Icon name="edit" size={12} />
                        Edit
                      </button>
                      <button
                        className="btn sm"
                        type="button"
                        onClick={() => testAccount(account.location_id)}
                        disabled={testing === account.location_id}
                      >
                        {testing === account.location_id ? <Spinner /> : <Icon name="zap" size={12} />}
                        Test
                      </button>
                      <button
                        className="btn sm danger"
                        type="button"
                        onClick={() => deleteAccount(account.location_id)}
                        disabled={deleting === account.location_id}
                      >
                        {deleting === account.location_id ? <Spinner /> : <Icon name="trash" size={12} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <TracePanel trace={lastTrace} />
    </section>
  );
}

function normalizeAccounts(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.tokens)) return response.tokens;
  return [];
}

function handleAdminError(action, fallbackMessage, error, setMessage, setLastTrace) {
  const trace = {
    action,
    ok: false,
    message: error?.message || fallbackMessage,
    status: error?.status ?? null,
    body: error?.body ?? null,
    apiTrace: error?.trace ?? null,
    receivedAt: new Date().toISOString(),
  };

  setLastTrace(trace);
  setMessage({
    tone: 'danger',
    text: `${fallbackMessage} ${trace.message ? `(${trace.message})` : ''}`,
  });

  console.error(`[ghl-admin:${action}]`, trace);
}

function TracePanel({ trace }) {
  if (!trace) return null;

  return (
    <details className="ghl-admin-trace">
      <summary>
        <span>Last API trace</span>
        <span className={`badge ${trace.ok ? 'success' : 'danger'}`}>
          {trace.ok ? 'OK' : trace.status || 'Error'}
        </span>
      </summary>
      <pre>{JSON.stringify(trace, null, 2)}</pre>
    </details>
  );
}

function describeShape(value) {
  if (Array.isArray(value)) return 'array';
  if (!value || typeof value !== 'object') return typeof value;
  return Object.keys(value);
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}
