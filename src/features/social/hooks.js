import { useApi, useMutation } from '../../lib/hooks/useApi.js';
import { useCurrentAgencyId } from '../session/index.js';
import { socialApi } from './api.js';

/**
 * Description templates live under `extra_settings.social_templates`. The
 * dedicated endpoint replaces only that slice, so saves cannot stomp the
 * brand / defaults / automation siblings.
 */
export function useSocialTemplates() {
  const agencyId = useCurrentAgencyId();
  const { data, ...rest } = useApi(
    () =>
      agencyId
        ? socialApi.getSocialTemplates(agencyId)
        : Promise.resolve({ templates: {} }),
    [agencyId],
  );
  const templates = data?.templates || {};
  return { templates, agencyId, ...rest };
}

export function useSaveSocialTemplates() {
  return useMutation(({ agencyId, templates }) => {
    if (!agencyId) {
      return Promise.reject(new Error('No agency_id is available.'));
    }
    return socialApi.saveSocialTemplates(agencyId, templates);
  });
}
