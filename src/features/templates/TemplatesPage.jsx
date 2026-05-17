import { useState } from 'react';
import { Icon } from '../../shared/Icon.jsx';
import { Spinner } from '../../shared/Spinner.jsx';
import { MVP_API_URL, BASE_URL } from '../../lib/api/client.js';
import { useCurrentAgencyId } from '../session/index.js';
import { useRenderTemplates, useSelectRenderTemplate } from './hooks.js';
import '../../styles/templates.css';

// Backend serves render-template preview artwork from a public static mount
// (`/assets/render-templates/...`) and returns the path as a root-relative
// URL. Without a base prefix the browser resolves it against the frontend
// host (Vite dev or production CDN) where the file does not exist, so the
// <img> renders broken. Prefix root-relative URLs with the configured API
// base so they hit the backend.
const RENDER_TEMPLATE_API_BASE = MVP_API_URL || BASE_URL || '';

function resolvePreviewUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  if (/^(?:https?:)?\/\//.test(rawUrl) || rawUrl.startsWith('data:')) {
    return rawUrl;
  }
  if (rawUrl.startsWith('/') && RENDER_TEMPLATE_API_BASE) {
    return `${RENDER_TEMPLATE_API_BASE.replace(/\/$/, '')}${rawUrl}`;
  }
  return rawUrl;
}

/**
 * Templates page — gallery of render-template packs available to the
 * agency. The user picks one and a PUT persists the selection. Cards show
 * the canonical {display_name, description, preview_images[]} shape; the
 * actual artwork is shipped by the backend catalog, not by this UI.
 */
export function TemplatesPage() {
  const agencyId = useCurrentAgencyId();
  const { items, currentTemplateId, loading, error, refetch } =
    useRenderTemplates(agencyId);
  const [select, { loading: selecting }] = useSelectRenderTemplate(agencyId);
  const [pendingId, setPendingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const handleSelect = async (templateId) => {
    if (!agencyId || !templateId) return;
    setPendingId(templateId);
    setStatusMessage(null);
    try {
      await select(templateId);
      setStatusMessage({ tone: 'success', text: 'Template selected.' });
      await refetch();
    } catch (err) {
      setStatusMessage({
        tone: 'danger',
        text: err?.body?.error || err?.message || 'Failed to select template.',
      });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Templates</h1>
          <p className="page-subtitle">
            Pick the render template pack applied to every reel this agency generates.
          </p>
        </div>
      </div>

      {!agencyId && !loading && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="t-medium">No agency selected.</div>
          <div className="t-sm t-muted">
            Open the app from a GoHighLevel sub-account that is linked to an agency,
            or assign one in the admin panel.
          </div>
        </div>
      )}

      {statusMessage && (
        <div
          className={`card ${statusMessage.tone === 'danger' ? 'card-danger' : ''}`}
          style={{ padding: 12, marginBottom: 16 }}
        >
          <Icon name={statusMessage.tone === 'danger' ? 'alert' : 'info'} size={13} />{' '}
          {statusMessage.text}
        </div>
      )}

      {loading && (
        <div className="templates-loading">
          <Spinner /> Loading templates…
        </div>
      )}

      {error && !loading && (
        <div className="card card-danger" style={{ padding: 12 }}>
          <Icon name="alert" size={13} />{' '}
          {error?.body?.error || error?.message || 'Failed to load templates.'}
        </div>
      )}

      {!loading && !error && items.length === 0 && agencyId && (
        <div className="card" style={{ padding: 16 }}>
          <div className="t-medium">No templates available yet.</div>
          <div className="t-sm t-muted">
            The backend catalog has not been published yet. Check back soon.
          </div>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="templates-grid" data-testid="templates-grid">
          {items.map((tpl) => (
            <TemplateCard
              key={tpl.template_id}
              template={tpl}
              isCurrent={tpl.template_id === currentTemplateId || tpl.selected}
              isPending={pendingId === tpl.template_id}
              disabled={selecting || !agencyId}
              onSelect={() => handleSelect(tpl.template_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template, isCurrent, isPending, disabled, onSelect }) {
  const cover = pickCover(template.preview_images);

  return (
    <article
      className={`template-card ${isCurrent ? 'template-card--selected' : ''}`}
      data-testid={`template-card-${template.template_id}`}
      data-selected={isCurrent ? 'true' : 'false'}
    >
      <div className="template-card__media">
        {cover ? (
          <img src={resolvePreviewUrl(cover.image_url)} alt={cover.alt || template.display_name} />
        ) : (
          <div className="template-card__placeholder">
            <Icon name="image" size={20} />
          </div>
        )}
        {isCurrent && (
          <span className="template-card__badge" data-testid="template-selected-badge">
            <Icon name="check" size={11} /> Selected
          </span>
        )}
      </div>
      <div className="template-card__body">
        <div className="template-card__title">{template.display_name}</div>
        {template.description && (
          <div className="template-card__description">{template.description}</div>
        )}
        <button
          type="button"
          className={`btn ${isCurrent ? '' : 'primary'}`}
          onClick={onSelect}
          disabled={isCurrent || isPending || disabled}
          data-testid={`use-template-${template.template_id}`}
        >
          {isPending ? <Spinner /> : null}
          {isCurrent ? 'Current template' : 'Use this template'}
        </button>
      </div>
    </article>
  );
}

function pickCover(previewImages) {
  if (!Array.isArray(previewImages) || previewImages.length === 0) return null;
  const preferred = previewImages.find((image) => image?.kind === 'cover');
  return preferred || previewImages[0];
}
