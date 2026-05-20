import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '../../lib/hooks/useToast.js';
import { decodeHtmlEntities } from '../../shared/decodeHtmlEntities.js';
import { Icon } from '../../shared/Icon.jsx';
import { Segmented } from '../../shared/Segmented.jsx';
import { useReels, useApproveReel, useRejectReel } from './hooks.js';
import { ReelCard } from './ReelCard.jsx';
import { ReelsTable } from './ReelsTable.jsx';
import './reels.css';

/**
 * Feature 32 — paginated, filtered reel list.
 *
 * URL state (read on every render, written on every user input):
 *   ?page=2&page_size=10&workflow_state=needs_approval,approved
 *   &publish_status=...&q=cranford
 *
 * The search input is debounced 300ms in local state before it lands in the
 * URL (and triggers the fetch). All other filters land immediately. Changing
 * any filter / page_size / q resets `page` back to 1; only the pagination
 * buttons mutate `page`.
 */

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const DEFAULT_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const WORKFLOW_STATE_OPTIONS = [
  { value: '', label: 'Any workflow state' },
  { value: 'pending', label: 'Pending' },
  { value: 'needs_approval', label: 'Needs approval' },
  { value: 'awaiting_review', label: 'Awaiting review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
];

const PUBLISH_STATUS_OPTIONS = [
  { value: '', label: 'Any publish status' },
  { value: 'pending', label: 'Pending' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'pending_publish', label: 'Pending publish' },
  { value: 'published', label: 'Published' },
  { value: 'partial', label: 'Partial' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'failed', label: 'Failed' },
  { value: 'skipped', label: 'Skipped' },
];

/** Shortcut tabs over the publish_status filter. Active = current URL state. */
const SHORTCUT_TABS = [
  { key: '', label: 'All', icon: 'list', publishStatus: '' },
  {
    key: 'needs-approval',
    label: 'Needs approval',
    icon: 'bell',
    publishStatus: 'pending_review',
  },
  {
    key: 'published',
    label: 'Published',
    icon: 'check',
    publishStatus: 'published',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    icon: 'close',
    publishStatus: 'rejected',
  },
];

/** Main page — paginated + filtered list of reels.
 *
 * `onRegisterRefetch` (feature 39): when provided by the parent `ReelsRoute`,
 * the Dashboard publishes its `refetch` callback so the editor overlay can
 * ask for a list re-pull after a mutation. The prop is optional — when the
 * Dashboard mounts outside the `/reels` shell (e.g. a future standalone
 * page), the callback is simply never registered.
 */
export function Dashboard({ onRegisterRefetch } = {}) {
  const navigate = useNavigate();
  const openReel = (reel) =>
    navigate(
      `/reels/${encodeURIComponent(reel.siteId)}/${encodeURIComponent(reel.sourcePropertyId)}`,
    );

  const [searchParams, setSearchParams] = useSearchParams();
  const urlState = readUrlState(searchParams);

  // Local mirror of the search input so the keystrokes feel snappy. The URL
  // (and the fetch) only update once the user has stopped typing for 300ms.
  const [searchInput, setSearchInput] = useState(urlState.q);
  const searchInputRef = useRef(urlState.q);

  // Sync local state when the URL changes from elsewhere (e.g. shortcut tab
  // or back/forward). Avoid clobbering an active typing session.
  useEffect(() => {
    if (urlState.q !== searchInputRef.current) {
      setSearchInput(urlState.q);
      searchInputRef.current = urlState.q;
    }
  }, [urlState.q]);

  // Debounce search input → URL. Reset page to 1 on every q change.
  useEffect(() => {
    if (searchInput === urlState.q) return undefined;
    const handle = setTimeout(() => {
      searchInputRef.current = searchInput;
      updateSearchParams(setSearchParams, searchParams, {
        q: searchInput,
        page: 1,
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput, urlState.q, searchParams, setSearchParams]);

  const { reels, countTotal, page, pageSize, hasMore, loading, agencyId, refetch } =
    useReels({
      page: urlState.page,
      pageSize: urlState.pageSize,
      workflowState: urlState.workflowState,
      publishStatus: urlState.publishStatus,
      q: urlState.q,
    });

  // Track the last non-null countTotal so the metric chip doesn't blank to "0"
  // mid-fetch. The chip flashes the new number only once the fetch resolves.
  const [stableTotal, setStableTotal] = useState(null);
  useEffect(() => {
    if (!loading) setStableTotal(countTotal);
  }, [loading, countTotal]);
  const displayedTotal = stableTotal == null ? countTotal : stableTotal;

  const [approve, { loading: approving }] = useApproveReel();
  const [reject, { loading: rejecting }] = useRejectReel();
  const [view, setView] = useState('grid');
  const [pendingAction, setPendingAction] = useState(null); // { id, kind: 'approve'|'reject' }

  // Feature 39: surface the list refetch up to the parent so the editor can
  // ask for a refresh after a mutation. The Dashboard owns the `useReels`
  // call, so it owns the refetch — we just publish it via the registration
  // callback that ReelsRoute passes in.
  useEffect(() => {
    if (typeof onRegisterRefetch !== 'function') return undefined;
    onRegisterRefetch(refetch);
    return () => onRegisterRefetch(null);
  }, [onRegisterRefetch, refetch]);

  const showingFrom = countTotal === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = countTotal === 0 ? 0 : Math.min(countTotal, showingFrom + reels.length - 1);

  const reelLabel = (reel) =>
    decodeHtmlEntities(reel?.title || reel?.slug || `#${reel?.sourcePropertyId || '?'}`);

  const handleApprove = async (reel) => {
    setPendingAction({ id: reel.id, kind: 'approve' });
    try {
      await approve({
        agencyId,
        siteId: reel.siteId,
        sourcePropertyId: reel.sourcePropertyId,
      });
      toast.success(`Reel approved: ${reelLabel(reel)}`);
      refetch();
    } catch (err) {
      toast.error(
        err?.body?.error || err?.message || 'Failed to approve reel.',
      );
    } finally {
      setPendingAction(null);
    }
  };
  const handleReject = async (reel) => {
    setPendingAction({ id: reel.id, kind: 'reject' });
    try {
      await reject({
        agencyId,
        siteId: reel.siteId,
        sourcePropertyId: reel.sourcePropertyId,
      });
      toast.success(`Reel rejected: ${reelLabel(reel)}`);
      refetch();
    } catch (err) {
      toast.error(
        err?.body?.error || err?.message || 'Failed to reject reel.',
      );
    } finally {
      setPendingAction(null);
    }
  };

  // Disable both buttons globally while any approve/reject is in flight to
  // avoid double-clicks racing the refetch.
  const actionInFlight = Boolean(pendingAction) || approving || rejecting;

  const setFilter = (next) => {
    updateSearchParams(setSearchParams, searchParams, { ...next, page: 1 });
  };

  const goToPage = (nextPage) => {
    updateSearchParams(setSearchParams, searchParams, { page: nextPage });
  };

  const activeShortcut = useMemo(() => {
    const match = SHORTCUT_TABS.find(
      (tab) => tab.publishStatus === urlState.publishStatus,
    );
    return match ? match.key : urlState.publishStatus ? '' : '';
  }, [urlState.publishStatus]);

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(countTotal / pageSize)) : 1;
  const canPrev = page > 1;
  const canNext = hasMore || page < totalPages;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Reels
            <span className="count-chip" data-testid="reels-count-chip">
              {displayedTotal} total
            </span>
          </h1>
          <p className="page-subtitle">
            Automatically generated from your listings. Review, edit or let them publish on their own.
          </p>
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
        <div className="card reels-metric-card">
          <div className="reels-metric-label">Total reels (current view)</div>
          <div className="reels-metric-value-row">
            <div className="reels-metric-value" data-testid="reels-metric-total">
              {displayedTotal}
            </div>
            <div className="reels-metric-delta">{loading ? '…' : ''}</div>
          </div>
        </div>
      </div>

      <div className="subtabs" role="tablist" aria-label="Publish status quick filter">
        {SHORTCUT_TABS.map((tab) => (
          <button
            key={tab.key || 'all'}
            type="button"
            role="tab"
            aria-selected={activeShortcut === tab.key}
            className={`subtab ${activeShortcut === tab.key ? 'active' : ''}`}
            onClick={() => setFilter({ publish_status: tab.publishStatus })}
          >
            <Icon name={tab.icon} size={12} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="reels-toolbar">
        <div className="row gap-4 reels-toolbar-filters">
          <div className="search">
            <Icon name="search" size={14} />
            <input
              type="search"
              aria-label="Search reels"
              placeholder="Search by title, slug or property reference"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <label className="reels-filter">
            <span className="reels-filter-label">Workflow</span>
            <select
              className="select"
              aria-label="Filter by workflow state"
              value={urlState.workflowState}
              onChange={(e) => setFilter({ workflow_state: e.target.value })}
            >
              {WORKFLOW_STATE_OPTIONS.map((opt) => (
                <option key={opt.value || 'any'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="reels-filter">
            <span className="reels-filter-label">Publish</span>
            <select
              className="select"
              aria-label="Filter by publish status"
              value={urlState.publishStatus}
              onChange={(e) => setFilter({ publish_status: e.target.value })}
            >
              {PUBLISH_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || 'any'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Segmented
          options={[
            { value: 'grid', label: 'Grid' },
            { value: 'list', label: 'List' },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      <ReelsResults
        agencyId={agencyId}
        loading={loading}
        countTotal={countTotal}
        reels={reels}
        view={view}
        hasActiveFilters={Boolean(
          urlState.workflowState || urlState.publishStatus || urlState.q,
        )}
        onOpen={openReel}
        onApprove={handleApprove}
        onReject={handleReject}
        actionInFlight={actionInFlight}
        pendingAction={pendingAction}
      />

      <PaginationControls
        page={page}
        pageSize={pageSize}
        countTotal={countTotal}
        showingFrom={showingFrom}
        showingTo={showingTo}
        canPrev={canPrev}
        canNext={canNext}
        onPrev={() => canPrev && goToPage(page - 1)}
        onNext={() => canNext && goToPage(page + 1)}
        onPageSizeChange={(next) =>
          updateSearchParams(setSearchParams, searchParams, {
            page_size: next,
            page: 1,
          })
        }
      />
    </div>
  );
}

/** Inner results region — only the body flips between skeleton, empty, and
 *  loaded states; the toolbar and metrics above never flicker. */
function ReelsResults({
  agencyId,
  loading,
  countTotal,
  reels,
  view,
  hasActiveFilters,
  onOpen,
  onApprove,
  onReject,
  actionInFlight,
  pendingAction,
}) {
  if (!agencyId && !loading) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <div className="t-medium">No agency selected.</div>
        <div className="t-sm t-muted">
          Open the app from a GoHighLevel sub-account that is linked to an agency, or
          assign one in the admin panel.
        </div>
      </div>
    );
  }
  if (loading) {
    return <ReelsSkeleton view={view} />;
  }
  if (countTotal === 0) {
    return (
      <div className="empty reels-empty" data-testid="reels-empty">
        {hasActiveFilters
          ? 'No reels match the current filters. Adjust the search or filters above, or clear them to see every reel for this agency.'
          : 'No reels yet. New reels will appear here as soon as a WordPress webhook is processed for this agency.'}
      </div>
    );
  }
  if (view === 'grid') {
    return (
      <div className="reels-grid">
        {reels.map((r) => (
          <ReelCard
            key={r.id}
            reel={r}
            onOpen={() => onOpen(r)}
            onApprove={() => onApprove(r)}
            onReject={() => onReject(r)}
            disabled={Boolean(actionInFlight)}
            pending={pendingAction && pendingAction.id === r.id ? pendingAction.kind : null}
          />
        ))}
      </div>
    );
  }
  return <ReelsTable reels={reels} onOpen={onOpen} />;
}

function ReelsSkeleton({ view }) {
  const slots = Array.from({ length: 6 });
  if (view === 'list') {
    return (
      <div className="card reels-skeleton-table" data-testid="reels-skeleton">
        {slots.map((_, idx) => (
          <div key={idx} className="reels-skeleton-row" aria-hidden="true" />
        ))}
      </div>
    );
  }
  return (
    <div className="reels-grid reels-skeleton-grid" data-testid="reels-skeleton">
      {slots.map((_, idx) => (
        <div key={idx} className="reels-skeleton-card" aria-hidden="true" />
      ))}
    </div>
  );
}

function PaginationControls({
  page,
  pageSize,
  countTotal,
  showingFrom,
  showingTo,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onPageSizeChange,
}) {
  return (
    <div className="reels-pagination" data-testid="reels-pagination">
      <label className="reels-pagination-size">
        <span>Rows per page</span>
        <select
          className="select"
          aria-label="Rows per page"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <div className="reels-pagination-nav">
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous page"
          disabled={!canPrev}
          onClick={onPrev}
        >
          <Icon name="chevron-left" size={14} />
        </button>
        <span className="reels-pagination-summary" data-testid="reels-pagination-summary">
          {countTotal === 0
            ? 'Showing 0 of 0'
            : `Showing ${showingFrom}–${showingTo} of ${countTotal}`}
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Next page"
          disabled={!canNext}
          onClick={onNext}
          data-testid="reels-pagination-next"
        >
          <Icon name="chevron-right" size={14} />
        </button>
        <span className="reels-pagination-page t-sm t-muted">
          Page {page}
        </span>
      </div>
    </div>
  );
}

/** Read pagination + filter state from URL search params with safe defaults. */
function readUrlState(params) {
  const page = clampInt(params.get('page'), 1, 1, 9999);
  const pageSize = clampSize(params.get('page_size'));
  return {
    page,
    pageSize,
    workflowState: (params.get('workflow_state') || '').trim(),
    publishStatus: (params.get('publish_status') || '').trim(),
    q: params.get('q') || '',
  };
}

function clampInt(raw, fallback, min, max) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function clampSize(raw) {
  const n = Number.parseInt(raw, 10);
  if (PAGE_SIZE_OPTIONS.includes(n)) return n;
  return DEFAULT_PAGE_SIZE;
}

/**
 * Merge a patch into the current search params, then push to the URL. Keys set
 * to '' (or undefined) are removed so the URL stays clean. Internally always
 * coerces numbers to strings — `URLSearchParams` only stores strings.
 */
function updateSearchParams(setter, current, patch) {
  const next = new URLSearchParams(current);
  for (const [rawKey, rawValue] of Object.entries(patch)) {
    const key = camelToSnake(rawKey);
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      next.delete(key);
    } else {
      next.set(key, String(rawValue));
    }
  }
  // Drop default values so a fresh URL stays minimal.
  if (next.get('page') === '1') next.delete('page');
  if (next.get('page_size') === String(DEFAULT_PAGE_SIZE)) next.delete('page_size');
  setter(next, { replace: false });
}

function camelToSnake(value) {
  return value.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}
