import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import { Spinner } from '../../shared/Spinner.jsx';
import { adminApi } from './api.js';
import { AgencyConfigDrawer } from './AgencyConfigDrawer.jsx';
import { CreateAgencyModal } from './CreateAgencyModal.jsx';
import './admin.css';

/** Live admin: agencies, their WordPress sources, GHL connection, reel settings. */
export function AdminView() {
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openAgencyId, setOpenAgencyId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.listAgencies();
      setAgencies(Array.isArray(response?.items) ? response.items : []);
    } catch (err) {
      setError(err);
      console.error('[admin:listAgencies]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const openAgency = useMemo(
    () => agencies.find((agency) => agency.agency_id === openAgencyId) || null,
    [agencies, openAgencyId],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return agencies;
    return agencies.filter((agency) => {
      const haystack = [
        agency.name,
        agency.slug,
        agency.agency_id,
        ...(agency.sources || []).map((source) => source.site_id),
        agency.ghl_connection?.location_id || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [agencies, search]);

  const totalAgencies = agencies.length;
  const totalSources = agencies.reduce(
    (acc, agency) => acc + (agency.source_count || 0),
    0,
  );
  const totalGhlConnected = agencies.filter(
    (agency) => agency.ghl_connection?.has_access_token,
  ).length;
  const totalCustomized = agencies.filter((agency) => agency.reel_profile).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin</h1>
          <p className="page-subtitle">
            Manage agencies, their WordPress sources, GoHighLevel connections, and
            reel-generation settings.
          </p>
        </div>
        <div className="row gap-4">
          <button className="btn sm" onClick={reload} disabled={loading}>
            {loading ? <Spinner /> : <Icon name="refresh" size={12} />}
            Refresh
          </button>
          <button className="btn primary sm" onClick={() => setCreating(true)}>
            <Icon name="plus" size={12} />
            New agency
          </button>
        </div>
      </div>

      <div className="agencies-metrics">
        <MetricCard label="Agencies" value={totalAgencies} />
        <MetricCard label="WordPress sources" value={totalSources} />
        <MetricCard label="GHL connected" value={totalGhlConnected} />
        <MetricCard label="Reel settings configured" value={totalCustomized} />
      </div>

      {error && (
        <div className="ghl-admin-message danger" style={{ margin: '0 0 16px' }}>
          <Icon name="alert" size={13} />
          Failed to load agencies. {error?.message || ''}
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-header">
          <div className="card-title">Agencies</div>
          <div className="search" style={{ minWidth: 260 }}>
            <Icon name="search" size={14} />
            <input
              placeholder="Search by name, slug, site or location id"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading && agencies.length === 0 ? (
            <div className="empty">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              No agencies yet. Create one to wire a WordPress site to a GHL location.
            </div>
          ) : (
            <table className="tbl tbl-hover">
              <thead>
                <tr>
                  <th>Agency</th>
                  <th>Sites</th>
                  <th>GHL</th>
                  <th>Reel settings</th>
                  <th>Status</th>
                  <th style={{ width: 120 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((agency) => (
                  <tr
                    key={agency.agency_id}
                    onClick={() => setOpenAgencyId(agency.agency_id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div className="t-medium">{agency.name}</div>
                      <div className="mono t-xs t-muted">{agency.slug}</div>
                    </td>
                    <td>
                      {(agency.sources || []).length === 0 ? (
                        <span className="badge warning status-pill-sm">
                          <Icon name="close" size={9} />
                          None
                        </span>
                      ) : (
                        <div className="agencies-status-pills">
                          {(agency.sources || []).slice(0, 2).map((source) => (
                            <span
                              key={source.wordpress_source_id}
                              className="badge success status-pill-sm mono"
                            >
                              <span className="dot" />
                              {source.site_id}
                            </span>
                          ))}
                          {(agency.sources || []).length > 2 && (
                            <span className="badge status-pill-sm">
                              +{(agency.sources || []).length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <GhlPill connection={agency.ghl_connection} />
                    </td>
                    <td>
                      {agency.reel_profile ? (
                        <span className="badge success status-pill-sm">
                          <span className="dot" />
                          Custom
                        </span>
                      ) : (
                        <span className="badge status-pill-sm">Default</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          agency.status === 'active' ? 'success' : 'warning'
                        }`}
                      >
                        <span className="dot" />
                        {agency.status || 'unknown'}
                      </span>
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <button
                        className="btn sm"
                        type="button"
                        onClick={() => setOpenAgencyId(agency.agency_id)}
                      >
                        <Icon name="settings" size={12} />
                        Configure
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {openAgency && (
        <AgencyConfigDrawer
          agency={openAgency}
          onClose={() => setOpenAgencyId(null)}
          onChanged={reload}
        />
      )}

      {creating && (
        <CreateAgencyModal
          onClose={() => setCreating(false)}
          onCreated={async (agencyId) => {
            setCreating(false);
            await reload();
            setOpenAgencyId(agencyId);
          }}
        />
      )}
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="card agencies-metric-card">
      <div className="agencies-metric-label">{label}</div>
      <div className="agencies-metric-value">{value}</div>
    </div>
  );
}

function GhlPill({ connection }) {
  if (!connection) {
    return (
      <span className="badge warning status-pill-sm">
        <Icon name="close" size={9} />
        Not connected
      </span>
    );
  }
  if (!connection.has_access_token) {
    return (
      <span className="badge danger status-pill-sm">
        <Icon name="alert" size={9} />
        Token missing
      </span>
    );
  }
  return (
    <span className="badge success status-pill-sm mono">
      <span className="dot" />
      {connection.location_id}
    </span>
  );
}
