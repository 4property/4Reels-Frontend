import { useApi, useMutation } from '../../lib/hooks/useApi.js';
import { templatesApi } from './api.js';

/**
 * Reads the agency's render-template catalog (+ current selection).
 * Pattern mirrors `useBrand` / `useReelDefaults`: agency-scoped fetch with
 * an explicit `agencyId` arg so the caller can defer until session resolves.
 */
export function useRenderTemplates(agencyId) {
  const { data, ...rest } = useApi(
    () =>
      agencyId
        ? templatesApi.listRenderTemplates(agencyId)
        : Promise.resolve({ agency_id: null, current_template_id: null, items: [] }),
    [agencyId],
  );
  return {
    agencyId: data?.agency_id || agencyId || null,
    currentTemplateId: data?.current_template_id || null,
    items: data?.items || [],
    ...rest,
  };
}

export function useSelectRenderTemplate(agencyId) {
  return useMutation((templateId) => {
    if (!agencyId) {
      return Promise.reject(new Error('No agency_id is available.'));
    }
    if (!templateId) {
      return Promise.reject(new Error('No template_id provided.'));
    }
    return templatesApi.selectRenderTemplate(agencyId, templateId);
  });
}
