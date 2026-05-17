/**
 * Reel editor — full-screen overlay opened from a Dashboard card.
 *
 * The frontend docs describe the eventual editor: 5 tabs (Photos, Subtitles,
 * Descriptions, Slides, Voiceover), a 3:4 live preview with a scene scrubber,
 * and three header actions (Regenerate with AI, Export, Publish). We keep
 * that exact shape as the visual roadmap, but every control whose backend
 * counterpart is not yet implemented is marked as a `coming-soon` stub so
 * the user can never confuse aspirational UI with live behaviour.
 *
 * What is wired to live data today:
 *   - The video preview (lazy-loaded via `<video preload="metadata">`).
 *   - The Approve / Reject actions (POST `/v1/admin/agencies/{id}/reels/.../{approve|reject}`).
 *   - Photos panel uses the agency's property images endpoint when available.
 *
 * Everything else (slides timing, voiceover, AI regenerate, export, publish
 * button…) is rendered for design continuity but disabled.
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '../../../lib/hooks/useToast.js';
import { decodeHtmlEntities } from '../../../shared/decodeHtmlEntities.js';
import { formatScheduledAt } from '../../../shared/formatScheduledAt.js';
import { Icon } from '../../../shared/Icon.jsx';
import { Spinner } from '../../../shared/Spinner.jsx';
import { StatusBadge } from '../../../shared/StatusBadge.jsx';
import { DashboardRefetchContext } from '../DashboardRefetchContext.js';
import {
  reelVideoUrl,
  useApproveReel,
  useReel,
  useReelImages,
  useRejectReel,
} from '../hooks.js';
import { DescriptionsPanel } from './DescriptionsPanel.jsx';
import { MusicOverridePanel } from './MusicOverridePanel.jsx';
import { PhotosPanel } from './PhotosPanel.jsx';
import { RegenerateReelButton } from './RegenerateReelButton.jsx';
import { SlidesPanel } from './SlidesPanel.jsx';
import { SubtitlesPanel } from './SubtitlesPanel.jsx';
import { VoiceoverPanel } from './VoiceoverPanel.jsx';
import {
  CRANFORD_SUBTITLES,
  DEFAULT_SLIDES,
  DEFAULT_TAKE,
} from './defaults.js';
import './editor.css';

const TABS = [
  { id: 'photos', icon: 'image', label: 'Photos' },
  { id: 'subtitles', icon: 'type', label: 'Subtitles' },
  { id: 'descriptions', icon: 'share', label: 'Descriptions' },
  { id: 'slides', icon: 'film', label: 'Slides' },
  { id: 'voiceover', icon: 'mic', label: 'Voiceover', stub: true },
];

export function ReelEditor({ siteId, sourcePropertyId, onClose }) {
  const { reel, agencyId, loading, error, refetch } = useReel(siteId, sourcePropertyId);

  if (loading && !reel) {
    return (
      <div className="editor-overlay">
        <div className="editor-loading">
          <Spinner /> Loading reel…
        </div>
      </div>
    );
  }

  if (error || !reel) {
    return (
      <div className="editor-overlay">
        <div className="editor-loading">
          <div className="t-medium">Reel not found.</div>
          <div className="t-sm t-muted" style={{ marginTop: 4 }}>
            {error?.message || 'No reel matches this URL for the active agency.'}
          </div>
          <button className="btn" type="button" onClick={onClose} style={{ marginTop: 12 }}>
            <Icon name="chevron-left" size={14} /> Back to reels
          </button>
        </div>
      </div>
    );
  }

  return (
    <ReelEditorInner
      reel={reel}
      agencyId={agencyId}
      onClose={onClose}
      refetch={refetch}
    />
  );
}

function ReelEditorInner({ reel, agencyId, onClose, refetch }) {
  const { images, loading: imagesLoading } = useReelImages(
    agencyId,
    reel.siteId,
    reel.sourcePropertyId,
  );
  const [approve, { loading: approving }] = useApproveReel();
  const [reject, { loading: rejecting }] = useRejectReel();

  const [tab, setTab] = useState('subtitles');
  const [statusMessage, setStatusMessage] = useState(null);
  // Covers the full POST + refetch cycle so a double-click can't fire
  // two approves: `approving` clears as soon as the POST returns 200,
  // but the refetch stays in flight for several seconds.
  const [submitting, setSubmitting] = useState(false);

  // Feature 39: track whether anything in this editor session has been
  // mutated (any successful PATCH from a panel, or an approve / reject).
  // When the editor closes after at least one mutation, we ask the
  // Dashboard to refetch so the modified reel rises to the top (the back
  // already serves by `updated_at DESC`).
  //
  // We keep a ref so the close handler always observes the latest value
  // without re-renders, even if the user closes the editor immediately
  // after a debounced PATCH lands.
  const dashboardRefetch = useContext(DashboardRefetchContext);
  const hasMutatedRef = useRef(false);
  const markMutated = useCallback(() => {
    hasMutatedRef.current = true;
  }, []);
  const handleClose = useCallback(() => {
    if (hasMutatedRef.current && typeof dashboardRefetch === 'function') {
      // Trigger the refetch BEFORE navigating: the Dashboard is still
      // mounted underneath the overlay, so its `useReels` will pick up the
      // refresh. The fetch happens in parallel with the navigation so the
      // user doesn't wait for the round-trip.
      try {
        dashboardRefetch();
      } catch {
        // Defensive: a Dashboard refetch failure must never break the close.
      }
    }
    onClose();
  }, [dashboardRefetch, onClose]);

  // Feature 35: hydrate the per-tile `selected` flag from the back's
  // `photos_override` when present. The override is an array of
  // `{position, selected}` items keyed by the ingested `position`; missing
  // entries fall back to the legacy heuristic (first 8 selected by default).
  const overrideByPosition = useMemo(() => {
    const map = new Map();
    if (Array.isArray(reel?.photosOverride)) {
      for (const item of reel.photosOverride) {
        if (item && typeof item.position === 'number') {
          map.set(item.position, Boolean(item.selected));
        }
      }
    }
    return map;
  }, [reel?.photosOverride]);

  const livePhotos = useMemo(
    () =>
      images.map((image, index) => ({
        id: `live-${image.position}`,
        position: image.position,
        url: image.url,
        label: `IMAGE ${String(image.position + 1).padStart(2, '0')}`,
        aiScore: null,
        selected: overrideByPosition.has(image.position)
          ? overrideByPosition.get(image.position)
          : index < 8,
      })),
    [images, overrideByPosition],
  );
  const [photos, setPhotos] = useState([]);
  useEffect(() => {
    setPhotos(livePhotos);
  }, [livePhotos]);

  // Feature 36: hydrate subtitles from the per-reel override first, then
  // from the worker's last serialized snapshot, then fall back to the seed
  // data that ships with the editor. The Subtitles panel persists every
  // edit via PATCH /reels/.../subtitles.
  // Re-run only when the persisted override or snapshot changes — the
  // other reel fields don't influence what the panel renders here.
  const liveSubtitles = useMemo(
    () => hydrateSubtitles(reel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reel?.subtitlesOverride, reel?.publishSubtitlesSnapshot],
  );
  const [subtitles, setSubtitles] = useState(liveSubtitles);
  useEffect(() => {
    setSubtitles(liveSubtitles);
  }, [liveSubtitles]);

  // Feature 37: hydrate slides from the per-reel manifest override. When no
  // override is set the editor seeds from `DEFAULT_SLIDES` so the panel has
  // something tangible (intro + outro) on a fresh reel. The Slides panel
  // persists every edit via PATCH /reels/.../slides.
  const liveSlides = useMemo(
    () => hydrateSlides(reel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reel?.manifestOverride],
  );
  const [slides, setSlides] = useState(liveSlides);
  useEffect(() => {
    setSlides(liveSlides);
  }, [liveSlides]);

  const [voTakes, setVoTakes] = useState([DEFAULT_TAKE]);
  const [voMode, setVoMode] = useState('record');
  const [voDucking, setVoDucking] = useState(60);
  const [voMusicVol, setVoMusicVol] = useState(35);
  const [voVoiceVol, setVoVoiceVol] = useState(90);
  const [voAiVoice, setVoAiVoice] = useState('emma-ie');
  const [voAiScript, setVoAiScript] = useState(
    subtitles.map((s) => s.text).join(' '),
  );

  const handleApprove = async () => {
    if (submitting) return;
    setStatusMessage(null);
    setSubmitting(true);
    try {
      const result = await approve({
        agencyId,
        siteId: reel.siteId,
        sourcePropertyId: reel.sourcePropertyId,
      });
      const replay = Boolean(result?.idempotent_replay);
      const scheduledLabel = formatScheduledAt(result?.scheduled_at);
      let text;
      if (scheduledLabel) {
        // The backend chose a future publish slot (publish_window /
        // skip_weekends rules pushed the approve out of the live window).
        // Override the legacy copy so the user knows when it will land.
        text = `Publicará el ${scheduledLabel}.`;
      } else if (replay) {
        text = 'Reel already approved, publish in progress.';
      } else {
        text = 'Reel approved.';
      }
      setStatusMessage({ tone: 'success', text });
      toast.success(text);
      markMutated();
      await refetch();
    } catch (err) {
      const text = err?.body?.error || err?.message || 'Approval failed.';
      setStatusMessage({ tone: 'danger', text });
      toast.error(text);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (submitting) return;
    setStatusMessage(null);
    setSubmitting(true);
    try {
      await reject({
        agencyId,
        siteId: reel.siteId,
        sourcePropertyId: reel.sourcePropertyId,
      });
      setStatusMessage({ tone: 'success', text: 'Reel rejected.' });
      toast.success('Reel rejected.');
      markMutated();
      await refetch();
    } catch (err) {
      const text = err?.body?.error || err?.message || 'Rejection failed.';
      setStatusMessage({ tone: 'danger', text });
      toast.error(text);
    } finally {
      setSubmitting(false);
    }
  };

  const videoSrc = reel.hasVideo
    ? reelVideoUrl(agencyId, reel.siteId, reel.sourcePropertyId)
    : null;

  return (
    <div className="editor-overlay">
      <EditorHeader
        reel={reel}
        agencyId={agencyId}
        refetchReel={refetch}
        onClose={handleClose}
        onApprove={handleApprove}
        onReject={handleReject}
        approving={approving}
        rejecting={rejecting}
        submitting={submitting}
        onMutate={markMutated}
      />

      {statusMessage && (
        <div
          className={`card ${statusMessage.tone === 'danger' ? 'card-danger' : ''}`}
          style={{ margin: '8px 18px', padding: 10 }}
        >
          <Icon name={statusMessage.tone === 'danger' ? 'alert' : 'info'} size={13} />{' '}
          {statusMessage.text}
        </div>
      )}

      <MusicOverridePanel
        reel={reel}
        agencyId={agencyId}
        refetchReel={refetch}
        onMutate={markMutated}
      />

      <div className="editor-body">
        <PreviewColumn reel={reel} videoSrc={videoSrc} />

        <div className="editor-panels">
          <EditorTabs
            tab={tab}
            setTab={setTab}
            counts={{
              photos: imagesLoading
                ? '…'
                : `${photos.filter((p) => p.selected).length}/${photos.length}`,
              subtitles: subtitles.length,
              slides: slides.filter((s) => s.enabled).length,
            }}
          />

          <div className="editor-panels-body scroll">
            {tab === 'photos' && (
              <LivePhotosPanel
                photos={photos}
                setPhotos={setPhotos}
                loading={imagesLoading}
                agencyId={agencyId}
                reel={reel}
                refetchReel={refetch}
                onMutate={markMutated}
              />
            )}
            {tab === 'subtitles' && (
              <SubtitlesPanel
                subtitles={subtitles}
                setSubtitles={setSubtitles}
                agencyId={agencyId}
                reel={reel}
                refetchReel={refetch}
                currentScene={0}
                setCurrentScene={() => {}}
                onMutate={markMutated}
              />
            )}
            {tab === 'descriptions' && (
              <DescriptionsPanel
                reel={reel}
                agencyId={agencyId}
                refetchReel={refetch}
                onMutate={markMutated}
              />
            )}
            {tab === 'slides' && (
              <SlidesPanel
                slides={slides}
                setSlides={setSlides}
                agencyId={agencyId}
                reel={reel}
                refetchReel={refetch}
                targetDurationSeconds={reel.targetDurationSeconds}
                onMutate={markMutated}
              />
            )}
            {tab === 'voiceover' && (
              <div className="feature-stub" aria-disabled="true">
                <VoiceoverPanel
                  takes={voTakes}
                  setTakes={setVoTakes}
                  mode={voMode}
                  setMode={setVoMode}
                  ducking={voDucking}
                  setDucking={setVoDucking}
                  musicVol={voMusicVol}
                  setMusicVol={setVoMusicVol}
                  voiceVol={voVoiceVol}
                  setVoiceVol={setVoVoiceVol}
                  aiVoice={voAiVoice}
                  setAiVoice={setVoAiVoice}
                  aiScript={voAiScript}
                  setAiScript={setVoAiScript}
                  reelDuration="0:36"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditorHeader({
  reel,
  agencyId,
  refetchReel,
  onClose,
  onApprove,
  onReject,
  approving,
  rejecting,
  submitting,
  onMutate,
}) {
  const canApproveOrReject = reel.publishStatus === 'needs-approval';
  return (
    <div className="editor-header">
      <button className="btn ghost" type="button" onClick={onClose}>
        <Icon name="chevron-left" size={16} /> Back to reels
      </button>
      <div className="editor-header-sep" />
      <div className="editor-header-meta">
        <div className="editor-header-title">{decodeHtmlEntities(reel.title)}</div>
        <div className="editor-header-sub">
          <span className="mono">
            {reel.siteId}#{reel.sourcePropertyId}
          </span>
          {reel.address && <> · {reel.address}</>}
        </div>
      </div>
      <StatusBadge status={reel.status} />
      {reel.publishStatus && <StatusBadge status={reel.publishStatus} />}
      <div className="editor-header-sep" />
      <RegenerateReelButton
        reel={reel}
        agencyId={agencyId}
        refetchReel={refetchReel}
        onMutate={onMutate}
      />
      <button
        className="btn coming-soon"
        type="button"
        disabled
        title="Re-rendering from the editor is on the roadmap; the backend already re-renders when WordPress sends an updated property."
      >
        <Icon name="zap" size={14} /> Regenerate with AI
      </button>
      <button
        className="btn coming-soon"
        type="button"
        disabled
        title="Direct download is on the roadmap. Until then, the rendered MP4 is streamed by the preview player."
      >
        <Icon name="download" size={14} /> Export
      </button>
      {canApproveOrReject && (
        <>
          <button
            className="btn primary"
            type="button"
            onClick={onApprove}
            disabled={approving || rejecting || submitting}
          >
            {approving ? <Spinner /> : <Icon name="check" size={14} />} Approve & Publish
          </button>
          <button
            className="btn"
            type="button"
            onClick={onReject}
            disabled={approving || rejecting || submitting}
          >
            {rejecting ? <Spinner /> : <Icon name="close" size={14} />} Reject
          </button>
        </>
      )}
    </div>
  );
}

function PreviewColumn({ reel, videoSrc }) {
  return (
    <div className="editor-preview-col scroll">
      <div className="editor-preview-phone">
        {videoSrc ? (
          <video
            className="editor-video-player"
            src={videoSrc}
            poster={reel.coverUrl || undefined}
            controls
            playsInline
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        ) : reel.coverUrl ? (
          <img className="editor-video-poster" src={reel.coverUrl} alt={reel.title} />
        ) : (
          <div className="editor-video-empty">
            <Icon name="film" size={28} />
            <div className="t-sm t-muted" style={{ marginTop: 8 }}>
              No rendered video yet.
            </div>
          </div>
        )}
      </div>

      <div className="editor-preview-meta">
        <span>
          <Icon name="webhook" size={11} /> Render: {reel.renderStatus || '—'}
        </span>
        <span>
          <Icon name="zap" size={11} /> Workflow: {reel.workflowState || '—'}
        </span>
      </div>
    </div>
  );
}

function EditorTabs({ tab, setTab, counts }) {
  return (
    <div className="editor-tabs">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`subtab ${tab === t.id ? 'active' : ''} ${t.stub ? 'tab-stub' : ''}`}
          onClick={() => setTab(t.id)}
          title={t.stub ? 'Roadmap — UI shown as a design preview, not yet live.' : undefined}
        >
          <Icon name={t.icon} size={12} /> {t.label}
          {counts[t.id] !== undefined && <span className="badge">{counts[t.id]}</span>}
          {t.stub && <span className="badge t-subtle" style={{ marginLeft: 4 }}>preview</span>}
        </button>
      ))}
    </div>
  );
}

/**
 * Photos panel powered by live data when available. Falls back to an empty
 * state if the agency hasn't ingested any property images yet.
 */
function LivePhotosPanel({
  photos,
  setPhotos,
  loading,
  agencyId,
  reel,
  refetchReel,
  onMutate,
}) {
  if (loading && photos.length === 0) {
    return <div className="empty">Loading property images…</div>;
  }
  if (photos.length === 0) {
    return (
      <div className="empty">
        <div className="t-medium">No property images for this reel.</div>
        <div className="t-sm t-muted">
          Images appear here once the WordPress webhook payload is processed.
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="panel-head">
        <div>
          <div className="panel-title">Property photos</div>
          <div className="panel-sub">
            Drag to reorder, click to include / exclude. Changes are saved
            automatically and trigger a re-render of the reel.
          </div>
        </div>
        <div className="row gap-4">
          <button className="btn sm coming-soon" type="button" disabled>
            <Icon name="zap" size={12} /> Re-run AI selection
          </button>
          <button className="btn sm coming-soon" type="button" disabled>
            <Icon name="upload" size={12} /> Upload
          </button>
        </div>
      </div>
      <PhotosPanel
        photos={photos}
        setPhotos={setPhotos}
        agencyId={agencyId}
        reel={reel}
        refetchReel={refetchReel}
        onMutate={onMutate}
      />
    </div>
  );
}

/**
 * Feature 36: pick the best source for the editor's working subtitles
 * state. Precedence mirrors the backend's render-time precedence:
 *   1. `reel.subtitlesOverride` — the persisted PATCH-driven override.
 *   2. `reel.publishSubtitlesSnapshot` — last serialized worker snapshot
 *      (what the renderer would use if no override existed).
 *   3. `CRANFORD_SUBTITLES` — in-app design seed, used when neither the
 *      override nor the snapshot is available (e.g. fresh reel before the
 *      worker has run).
 *
 * The wire shape is `{ index, text, in_seconds, out_seconds }`; the editor
 * keeps a UI-friendly `{ id, text, inSeconds, outSeconds }` so React keys
 * are stable across re-orders.
 */
function hydrateSubtitles(reel) {
  const override = reel?.subtitlesOverride;
  if (Array.isArray(override) && override.length > 0) {
    return override.map((cue, i) => ({
      id: `o-${cue.index ?? i}`,
      text: String(cue.text || ''),
      inSeconds: Number(cue.in_seconds) || 0,
      outSeconds: Number(cue.out_seconds) || 0,
    }));
  }
  const snapshot = reel?.publishSubtitlesSnapshot;
  if (Array.isArray(snapshot) && snapshot.length > 0) {
    return snapshot.map((cue, i) => ({
      id: `snap-${cue.index ?? i}`,
      text: String(cue.text || ''),
      inSeconds: Number(cue.in_seconds) || 0,
      outSeconds: Number(cue.out_seconds) || 0,
    }));
  }
  return CRANFORD_SUBTITLES.map((cue) => ({ ...cue }));
}

/**
 * Feature 37: pick the best source for the editor's working slides state.
 *   1. `reel.manifestOverride` — the persisted PATCH-driven slide manifest.
 *   2. `DEFAULT_SLIDES` — in-app seed (agency intro + outro) used when no
 *      override is set yet (the back has no equivalent slides snapshot to
 *      surface today; future iterations may add one).
 *
 * The wire shape is `{slide_id, position, duration_seconds, kind,
 * ...kind-specific}`; the editor keeps a UI-friendly
 * `{id, kind, duration, enabled, label, source, ...}` so React keys are
 * stable across re-orders and the existing `SlideRow` component keeps
 * working without churn.
 */
function hydrateSlides(reel) {
  const override = reel?.manifestOverride;
  if (Array.isArray(override) && override.length > 0) {
    return override.map((slide, i) => ({
      id: String(slide.slide_id || `o-${i}`),
      kind: String(slide.kind || 'text'),
      duration: Number(slide.duration_seconds) || 0,
      enabled: slide.enabled !== false,
      locked: false,
      source: slide.source ? String(slide.source) : 'custom',
      label: typeof slide.label === 'string' ? slide.label : '',
      ...(slide.text != null ? { text: String(slide.text) } : {}),
      ...(slide.url != null ? { url: String(slide.url) } : {}),
      ...(slide.status != null ? { status: String(slide.status) } : {}),
      ...(slide.rating != null ? { rating: Number(slide.rating) } : {}),
      ...(slide.author != null ? { author: String(slide.author) } : {}),
    }));
  }
  return DEFAULT_SLIDES.map((slide) => ({ ...slide }));
}
