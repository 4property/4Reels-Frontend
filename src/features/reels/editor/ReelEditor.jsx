/**
 * Reel editor â€” full-screen overlay opened from a Dashboard card.
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
 * buttonâ€¦) is rendered for design continuity but disabled.
 */
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../shared/Icon.jsx';
import { Spinner } from '../../../shared/Spinner.jsx';
import { StatusBadge } from '../../../shared/StatusBadge.jsx';
import { useSocials } from '../../../app/providers/TenantProvider.jsx';
import {
  reelVideoUrl,
  useApproveReel,
  useReel,
  useReelImages,
  useRejectReel,
} from '../hooks.js';
import { DescriptionsPanel } from './DescriptionsPanel.jsx';
import { PhotosPanel } from './PhotosPanel.jsx';
import { SlidesPanel } from './SlidesPanel.jsx';
import { SubtitlesPanel } from './SubtitlesPanel.jsx';
import { VoiceoverPanel } from './VoiceoverPanel.jsx';
import {
  CRANFORD_SUBTITLES,
  DEFAULT_DESCRIPTION,
  DEFAULT_SLIDES,
  DEFAULT_TAKE,
} from './defaults.js';
import './editor.css';

const TABS = [
  { id: 'photos', icon: 'image', label: 'Photos' },
  { id: 'subtitles', icon: 'type', label: 'Subtitles', stub: true },
  { id: 'descriptions', icon: 'share', label: 'Descriptions' },
  { id: 'slides', icon: 'film', label: 'Slides', stub: true },
  { id: 'voiceover', icon: 'mic', label: 'Voiceover', stub: true },
];

export function ReelEditor({ siteId, sourcePropertyId, onClose }) {
  const { reel, agencyId, loading, error, refetch } = useReel(siteId, sourcePropertyId);

  if (loading && !reel) {
    return (
      <div className="editor-overlay">
        <div className="editor-loading">
          <Spinner /> Loading reelâ€¦
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
  const socials = useSocials();
  const { images, loading: imagesLoading } = useReelImages(
    agencyId,
    reel.siteId,
    reel.sourcePropertyId,
  );
  const [approve, { loading: approving }] = useApproveReel();
  const [reject, { loading: rejecting }] = useRejectReel();

  const [tab, setTab] = useState('photos');
  const [statusMessage, setStatusMessage] = useState(null);

  const livePhotos = useMemo(
    () =>
      images.map((image, index) => ({
        id: `live-${image.position}`,
        position: image.position,
        url: image.url,
        label: `IMAGE ${String(image.position + 1).padStart(2, '0')}`,
        aiScore: null,
        selected: index < 8,
      })),
    [images],
  );
  const [photos, setPhotos] = useState([]);
  useEffect(() => {
    setPhotos(livePhotos);
  }, [livePhotos]);

  // Subtitles / slides / voiceover use the seed data that ships with the
  // editor â€” the backend doesn't expose any of these yet, so we surface
  // them inside `feature-stub` containers to keep the design continuity.
  const [subtitles, setSubtitles] = useState(CRANFORD_SUBTITLES);

  const [descs, setDescs] = useState(() => {
    const out = {};
    for (const s of socials) {
      out[s.id] = { enabled: false, text: DEFAULT_DESCRIPTION };
    }
    return out;
  });
  const [activeNet, setActiveNet] = useState(socials[0]?.id || 'instagram');

  const [slides, setSlides] = useState(DEFAULT_SLIDES);

  const [voTakes, setVoTakes] = useState([DEFAULT_TAKE]);
  const [voMode, setVoMode] = useState('record');
  const [voDucking, setVoDucking] = useState(60);
  const [voMusicVol, setVoMusicVol] = useState(35);
  const [voVoiceVol, setVoVoiceVol] = useState(90);
  const [voAiVoice, setVoAiVoice] = useState('emma-ie');
  const [voAiScript, setVoAiScript] = useState(subtitles.map((s) => s.text).join(' '));

  const handleApprove = async () => {
    setStatusMessage(null);
    try {
      await approve({
        agencyId,
        siteId: reel.siteId,
        sourcePropertyId: reel.sourcePropertyId,
      });
      setStatusMessage({ tone: 'success', text: 'Reel approved.' });
      await refetch();
    } catch (err) {
      setStatusMessage({
        tone: 'danger',
        text: err?.body?.error || err?.message || 'Approval failed.',
      });
    }
  };

  const handleReject = async () => {
    setStatusMessage(null);
    try {
      await reject({
        agencyId,
        siteId: reel.siteId,
        sourcePropertyId: reel.sourcePropertyId,
      });
      setStatusMessage({ tone: 'success', text: 'Reel rejected.' });
      await refetch();
    } catch (err) {
      setStatusMessage({
        tone: 'danger',
        text: err?.body?.error || err?.message || 'Rejection failed.',
      });
    }
  };

  const videoSrc = reel.hasVideo
    ? reelVideoUrl(agencyId, reel.siteId, reel.sourcePropertyId)
    : null;

  return (
    <div className="editor-overlay">
      <EditorHeader
        reel={reel}
        onClose={onClose}
        onApprove={handleApprove}
        onReject={handleReject}
        approving={approving}
        rejecting={rejecting}
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

      <div className="editor-body">
        <PreviewColumn reel={reel} videoSrc={videoSrc} />

        <div className="editor-panels">
          <EditorTabs
            tab={tab}
            setTab={setTab}
            counts={{
              photos: imagesLoading
                ? 'â€¦'
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
              />
            )}
            {tab === 'subtitles' && (
              <div className="feature-stub" aria-disabled="true">
                <SubtitlesPanel
                  subtitles={subtitles}
                  setSubtitles={setSubtitles}
                  currentScene={0}
                  setCurrentScene={() => {}}
                />
              </div>
            )}
            {tab === 'descriptions' && (
              <DescriptionsPanel
                descs={descs}
                setDescs={setDescs}
                activeNet={activeNet}
                setActiveNet={setActiveNet}
              />
            )}
            {tab === 'slides' && (
              <div className="feature-stub" aria-disabled="true">
                <SlidesPanel slides={slides} setSlides={setSlides} />
              </div>
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

function EditorHeader({ reel, onClose, onApprove, onReject, approving, rejecting }) {
  const canApproveOrReject = reel.publishStatus === 'needs-approval';
  return (
    <div className="editor-header">
      <button className="btn ghost" type="button" onClick={onClose}>
        <Icon name="chevron-left" size={16} /> Back to reels
      </button>
      <div className="editor-header-sep" />
      <div className="editor-header-meta">
        <div className="editor-header-title">{reel.title}</div>
        <div className="editor-header-sub">
          <span className="mono">
            {reel.siteId}#{reel.sourcePropertyId}
          </span>
          {reel.address && <> Â· {reel.address}</>}
        </div>
      </div>
      <StatusBadge status={reel.status} />
      {reel.publishStatus && <StatusBadge status={reel.publishStatus} />}
      <div className="editor-header-sep" />
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
      {canApproveOrReject ? (
        <>
          <button
            className="btn primary"
            type="button"
            onClick={onApprove}
            disabled={approving || rejecting}
          >
            {approving ? <Spinner /> : <Icon name="check" size={14} />} Approve
          </button>
          <button
            className="btn"
            type="button"
            onClick={onReject}
            disabled={approving || rejecting}
          >
            {rejecting ? <Spinner /> : <Icon name="close" size={14} />} Reject
          </button>
        </>
      ) : (
        <button
          className="btn primary coming-soon"
          type="button"
          disabled
          title="Manual publishing from the editor is on the roadmap. Today the pipeline auto-publishes (or holds for review) based on the agency's automation settings."
        >
          <Icon name="send" size={14} /> Publish
        </button>
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
          <Icon name="webhook" size={11} /> Render: {reel.renderStatus || 'â€”'}
        </span>
        <span>
          <Icon name="zap" size={11} /> Workflow: {reel.workflowState || 'â€”'}
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
          title={t.stub ? 'Roadmap â€” UI shown as a design preview, not yet live.' : undefined}
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
function LivePhotosPanel({ photos, setPhotos, loading }) {
  if (loading && photos.length === 0) {
    return <div className="empty">Loading property imagesâ€¦</div>;
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
            Drag to reorder, click to include / exclude. The order here drives the
            scene order at re-render time (re-render is on the roadmap).
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
      <PhotosPanel photos={photos} setPhotos={setPhotos} />
    </div>
  );
}
