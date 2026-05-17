import { apiRequest } from '../../lib/api/client.js';

/**
 * Agency render-template catalog API surface.
 *
 *   GET /v1/admin/agencies/{id}/render-templates   → list packs + current_template_id
 *   PUT /v1/admin/agencies/{id}/render-template    → select one (body: { template_id })
 *
 * See `modules/configuration/transport/http/render_templates_router.py` in
 * the back for the canonical shape.
 */
export const templatesApi = {
  listRenderTemplates: (agencyId) =>
    apiRequest(
      `/v1/admin/agencies/${encodeURIComponent(agencyId)}/render-templates`,
    ),
  selectRenderTemplate: (agencyId, templateId) =>
    apiRequest(
      `/v1/admin/agencies/${encodeURIComponent(agencyId)}/render-template`,
      {
        method: 'PUT',
        body: { template_id: templateId },
      },
    ),
};

export const listRenderTemplates = (agencyId) =>
  templatesApi.listRenderTemplates(agencyId);

export const selectRenderTemplate = (agencyId, templateId) =>
  templatesApi.selectRenderTemplate(agencyId, templateId);
