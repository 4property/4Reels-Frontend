import { useApi, useMutation } from '../../lib/hooks/useApi.js';
import { useCurrentAgencyId } from '../session/index.js';
import { reelsApi } from './api.js';

export function useReels() {
  const agencyId = useCurrentAgencyId();
  const { data, ...rest } = useApi(
    () => (agencyId ? reelsApi.list(agencyId) : Promise.resolve({ items: [] })),
    [agencyId],
  );
  const items = Array.isArray(data?.items) ? data.items : [];
  return { reels: items.map(adaptReelSummary), agencyId, ...rest };
}

export function useReel(siteId, sourcePropertyId) {
  const agencyId = useCurrentAgencyId();
  const enabled = Boolean(agencyId && siteId && sourcePropertyId);
  const { data, ...rest } = useApi(
    () =>
      enabled
        ? reelsApi.get(agencyId, siteId, sourcePropertyId)
        : Promise.resolve({ reel: null }),
    [agencyId, siteId, sourcePropertyId],
  );
  const raw = data?.reel || null;
  const adapted = raw ? { ...adaptReelSummary(raw), hasVideo: Boolean(raw.has_video) } : null;
  return { reel: adapted, agencyId, ...rest };
}

export function useApproveReel() {
  return useMutation(({ agencyId, siteId, sourcePropertyId }) =>
    reelsApi.approve(agencyId, siteId, sourcePropertyId),
  );
}

export function useRejectReel() {
  return useMutation(({ agencyId, siteId, sourcePropertyId }) =>
    reelsApi.reject(agencyId, siteId, sourcePropertyId),
  );
}

export function reelVideoUrl(agencyId, siteId, sourcePropertyId) {
  return reelsApi.videoUrl(agencyId, siteId, sourcePropertyId);
}

/**
 * Lists the property images that fed the reel. Each item exposes both the
 * original WordPress URL and (when available) a backend-served URL for the
 * locally cached file. The Photos panel prefers the local URL because it
 * works even when the WordPress site is down.
 */
export function useReelImages(agencyId, siteId, sourcePropertyId) {
  const enabled = Boolean(agencyId && siteId && sourcePropertyId);
  const { data, ...rest } = useApi(
    () =>
      enabled
        ? reelsApi.listImages(agencyId, siteId, sourcePropertyId)
        : Promise.resolve({ items: [] }),
    [agencyId, siteId, sourcePropertyId],
  );
  const items = Array.isArray(data?.items) ? data.items : [];
  const images = items.map((item) => ({
    position: item.position,
    url:
      (item.has_local_file &&
        reelsApi.imageFileUrl(agencyId, siteId, sourcePropertyId, item.position)) ||
      item.image_url ||
      '',
  }));
  return { images, ...rest };
}

function adaptReelSummary(item) {
  // Map backend AgencyReelSummary → the shape Dashboard / ReelCard / ReelsTable
  // expect. The composite `id` is convenient for keys; the explicit
  // `siteId` / `sourcePropertyId` are what the editor route uses.
  const siteId = item.site_id || '';
  const sourcePropertyId = item.source_property_id;
  const id = sourcePropertyId
    ? `${siteId}:${sourcePropertyId}`
    : `${siteId}:${item.slug || ''}`;
  const networks = parseNetworksFromPipeline(item.workflow_state, item.publish_status);
  return {
    id,
    siteId,
    sourcePropertyId,
    title: item.title || item.slug || `Property #${sourcePropertyId}`,
    address: [item.property_area_label, item.property_county_label]
      .filter(Boolean)
      .join(', '),
    price: item.price || '',
    status: item.render_status || item.workflow_state || 'pending',
    publishStatus: mapPublishStatus(item.publish_status, item.workflow_state),
    cover: item.featured_image_url || '',
    coverUrl: item.featured_image_url || '',
    createdAt: item.pipeline_created_at || item.fetched_at || '',
    updatedAt: item.pipeline_updated_at || '',
    duration: '',
    scenes: 0,
    music: '',
    kind: classifyKind(item.property_status),
    type: '',
    networks,
    workflowState: item.workflow_state || '',
    renderStatus: item.render_status || '',
    revisionId: item.current_revision_id || '',
    revisionMediaPath: item.revision_media_path || '',
    locationId: item.last_published_location_id || '',
    tracker: null,
  };
}

function parseNetworksFromPipeline(workflowState, publishStatus) {
  if (publishStatus === 'published') return ['instagram', 'tiktok', 'facebook'];
  return [];
}

function mapPublishStatus(publishStatus, workflowState) {
  const status = String(publishStatus || workflowState || '').toLowerCase();
  if (status === 'published' || status === 'approved') return 'published';
  if (status === 'failed' || status === 'rejected') return 'rejected';
  if (status === 'awaiting_review' || status === 'partial') return 'needs-approval';
  return status || 'pending';
}

function classifyKind(propertyStatus) {
  const value = String(propertyStatus || '').toLowerCase().trim();
  if (!value) return '';
  if (value.includes('let')) return value.includes('agreed') ? 'let-agreed' : 'to-let';
  if (value.includes('sale agreed') || value === 'sale_agreed') return 'sale-agreed';
  if (value === 'sold') return 'sold';
  if (value.includes('rent') || value === 'to_let') return 'to-let';
  return 'for-sale';
}
