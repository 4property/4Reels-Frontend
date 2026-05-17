import { Cover } from '../../../shared/Cover.jsx';
import { Icon } from '../../../shared/Icon.jsx';
import { Toggle } from '../../../shared/Toggle.jsx';

const META = {
  'intro-video': { icon: 'play', color: 'var(--accent)', tag: 'INTRO' },
  'outro-video': { icon: 'film', color: 'var(--info)', tag: 'OUTRO' },
  'google-review': { icon: 'star-fill', color: '#fbbf24', tag: 'REVIEW' },
  text: { icon: 'type', color: 'var(--text-muted)', tag: 'TEXT' },
  photo: { icon: 'image', color: 'var(--success)', tag: 'PHOTO' },
};

const FALLBACK_META = { icon: 'film', color: 'var(--text-muted)', tag: 'SLIDE' };

export function SlideRow({
  slide, onToggle, onRemove, onUpdate, onOpenReview,
  onDragStart, onDragOver, onDragEnd, dragging,
  disabled = false, dataTestid,
}) {
  const meta = META[slide.kind] || FALLBACK_META;

  return (
    <div
      className={`slide-row ${dragging ? 'dragging' : ''} ${!slide.enabled ? 'disabled' : ''} ${disabled ? 'slide-row-locked' : ''}`}
      draggable={!disabled}
      onDragStart={disabled ? undefined : onDragStart}
      onDragOver={disabled ? undefined : onDragOver}
      onDragEnd={disabled ? undefined : onDragEnd}
      data-testid={dataTestid}
      aria-disabled={disabled ? 'true' : undefined}
    >
      <span className="drag-handle">
        <Icon name="grip" size={14} />
      </span>

      <div className="slide-thumb">
        <SlideThumb slide={slide} />
        <div
          className={`slide-thumb-tag ${slide.kind === 'google-review' ? 'review' : ''}`}
          style={{ background: meta.color }}
        >
          {meta.tag}
        </div>
      </div>

      <div className="min-w-0">
        <div className="slide-head">
          <Icon name={meta.icon} size={13} style={{ color: meta.color }} />
          <input
            className="input slide-title-input"
            value={slide.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            disabled={disabled}
            data-testid={dataTestid ? `${dataTestid}-label` : undefined}
          />
          {slide.source === 'default' && <span className="badge">From defaults</span>}
        </div>

        {slide.kind === 'google-review' ? (
          slide.status === 'generated' ? (
            <div className="slide-review-meta">
              <span className="slide-review-stars">{'★'.repeat(slide.rating || 5)}</span>
              <span style={{ color: 'var(--text)' }}>{slide.author || 'Aoife M.'}</span>
              <span>· {slide.duration}s</span>
              <button
                className="btn sm ghost slide-review-edit"
                onClick={onOpenReview}
                disabled={disabled}
              >
                <Icon name="edit" size={10} /> Edit
              </button>
            </div>
          ) : (
            <button
              className="btn sm slide-review-cta"
              onClick={onOpenReview}
              disabled={disabled}
            >
              <Icon name="link" size={11} /> Paste Google review URL
            </button>
          )
        ) : (
          <div className="slide-meta">
            <span className="mono">{(slide.duration || 0).toFixed(1)}s</span>
            <input
              className="slide-meta-range"
              type="range" min="1" max="8" step="0.5" value={slide.duration || 0}
              onChange={(e) => onUpdate({ duration: +e.target.value })}
              disabled={disabled}
              data-testid={dataTestid ? `${dataTestid}-duration` : undefined}
            />
          </div>
        )}
      </div>

      <div className="row gap-2">
        <Toggle on={slide.enabled} onChange={onToggle} disabled={disabled} />
        <button
          className="icon-btn"
          onClick={onRemove}
          title="Remove"
          disabled={disabled}
          data-testid={dataTestid ? `${dataTestid}-remove` : undefined}
        >
          <Icon name="trash" size={13} />
        </button>
      </div>
    </div>
  );
}

function SlideThumb({ slide }) {
  if (slide.kind === 'google-review' && slide.status !== 'generated') {
    return (
      <div className="slide-thumb-review-empty">
        <Icon name="star" size={22} />
      </div>
    );
  }
  if (slide.kind === 'google-review') {
    return (
      <div className="slide-thumb-review-filled">
        <div className="slide-thumb-review-stars">★★★★★</div>
        <div className="slide-thumb-review-author">Aoife M.</div>
        <div className="slide-thumb-review-quote">Excellent service, fast and…</div>
      </div>
    );
  }
  if (slide.kind === 'text') {
    return (
      <div className="slide-thumb-text">
        {slide.text || 'Text'}
      </div>
    );
  }
  if (slide.kind === 'photo') {
    return <Cover kind="cranford-living" ratio="3/4" style={{ borderRadius: 0 }} />;
  }
  return (
    <video
      className="cover-media"
      src="/assets/property/reel.mp4"
      autoPlay muted loop playsInline
    />
  );
}
