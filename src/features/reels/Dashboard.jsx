import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../shared/Icon.jsx';
import { Segmented } from '../../shared/Segmented.jsx';
import { useReels, useApproveReel, useRejectReel } from './hooks.js';
import { ReelCard } from './ReelCard.jsx';
import { ReelsTable } from './ReelsTable.jsx';
import './reels.css';

/** Main page — filterable list of reels + top metrics. */
export function Dashboard() {
  const navigate = useNavigate();
  const openReel = (reel) =>
    navigate(
      `/reels/${encodeURIComponent(reel.siteId)}/${encodeURIComponent(reel.sourcePropertyId)}`,
    );

  const { reels, loading, agencyId, refetch } = useReels();
  const [approve] = useApproveReel();
  const [reject] = useRejectReel();

  const [view, setView] = useState('grid');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filteredReels = reels.filter((r) => {
    if (filter !== 'all' && r.publishStatus !== filter) return false;
    if (search && !`${r.title} ${r.address}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const countBy = (ps) => reels.filter((r) => r.publishStatus === ps).length;

  const filters = [
    { key: 'all', label: 'All', count: reels.length, icon: 'list' },
    { key: 'needs-approval', label: 'Needs approval', count: countBy('needs-approval'), icon: 'bell' },
    { key: 'published', label: 'Published', count: countBy('published'), icon: 'check' },
    { key: 'rejected', label: 'Rejected', count: countBy('rejected'), icon: 'close' },
  ];

  const metrics = [
    { label: 'Total reels', value: reels.length, delta: '', trend: 'flat' },
    { label: 'Published', value: countBy('published'), delta: '', trend: 'flat' },
    { label: 'Needs approval', value: countBy('needs-approval'), delta: '', trend: 'flat' },
    { label: 'Rejected', value: countBy('rejected'), delta: '', trend: 'flat' },
  ];

  const handleApprove = async (reel) => {
    await approve({
      agencyId,
      siteId: reel.siteId,
      sourcePropertyId: reel.sourcePropertyId,
    });
    refetch();
  };
  const handleReject = async (reel) => {
    await reject({
      agencyId,
      siteId: reel.siteId,
      sourcePropertyId: reel.sourcePropertyId,
    });
    refetch();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Reels
            <span className="count-chip">{reels.length} total</span>
          </h1>
          <p className="page-subtitle">Automatically generated from your listings. Review, edit or let them publish on their own.</p>
        </div>
        <div className="row gap-4">
          <button
            className="btn coming-soon"
            type="button"
            disabled
            title="CSV / spreadsheet export is on the roadmap."
          >
            <Icon name="download" size={14} /> Export
          </button>
          <button
            className="btn primary coming-soon"
            type="button"
            disabled
            title="Manual reel creation is on the roadmap. Reels are auto-created today when a WordPress webhook arrives."
          >
            <Icon name="plus" size={14} /> New reel
          </button>
        </div>
      </div>

      <div className="reels-metrics">
        {metrics.map((m) => (
          <div key={m.label} className="card reels-metric-card">
            <div className="reels-metric-label">{m.label}</div>
            <div className="reels-metric-value-row">
              <div className="reels-metric-value">{m.value}</div>
              <div className={`reels-metric-delta ${m.trend === 'up' ? 'up' : ''}`}>{m.delta}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="subtabs">
        {filters.map((f) => (
          <button
            key={f.key}
            className={`subtab ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            <Icon name={f.icon} size={12} /> {f.label}
            <span className="reels-subtab-count">{f.count}</span>
          </button>
        ))}
      </div>

      <div className="reels-toolbar">
        <div className="row gap-4">
          <div className="search">
            <Icon name="search" size={14} />
            <input placeholder="Search by title or address" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn coming-soon" type="button" disabled>
            <Icon name="filter" size={14} /> Advanced filters
          </button>
          <button className="btn coming-soon" type="button" disabled>
            <Icon name="sort" size={14} /> Sort
          </button>
        </div>
        <Segmented
          options={[{ value: 'grid', label: 'Grid' }, { value: 'list', label: 'List' }]}
          value={view}
          onChange={setView}
        />
      </div>

      {!agencyId && !loading ? (
        <div className="card" style={{ padding: 24 }}>
          <div className="t-medium">No agency selected.</div>
          <div className="t-sm t-muted">
            Open the app from a GoHighLevel sub-account that is linked to an agency, or
            assign one in the admin panel.
          </div>
        </div>
      ) : loading && reels.length === 0 ? (
        <div className="empty">Loading…</div>
      ) : reels.length === 0 ? (
        <div className="empty">
          No reels yet. New reels will appear here as soon as a WordPress webhook is
          processed for this agency.
        </div>
      ) : view === 'grid' ? (
        <div className="reels-grid">
          {filteredReels.map((r) => (
            <ReelCard
              key={r.id}
              reel={r}
              onOpen={() => openReel(r)}
              onApprove={() => handleApprove(r)}
              onReject={() => handleReject(r)}
            />
          ))}
        </div>
      ) : (
        <ReelsTable
          reels={filteredReels}
          onOpen={(reel) => openReel(reel)}
        />
      )}
    </div>
  );
}
