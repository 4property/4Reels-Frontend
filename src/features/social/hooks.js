import { useApi, useMutation } from '../../lib/hooks/useApi.js';
import { useCurrentAgencyId } from '../session/index.js';
import { socialApi } from './api.js';

/**
 * Description templates live under `extra_settings.social_templates`. The
 * dedicated endpoint replaces only that slice, so saves cannot stomp the
 * brand / defaults / automation siblings.
 *
 * Since feature 20 the backend exposes per-platform records with three
 * editable fields — description_template, title_template, hashtags. The
 * legacy `templates: {platform: string}` map in the GET response keeps the
 * description-only view (for the agency-config drawer's Default descriptions
 * panel, feature 8). The rich shape lives in `items[]`, which we pivot here
 * into `richTemplates: {platform: {description_template, title_template, hashtags}}`
 * so the editor can hydrate all three fields without a second request.
 */
export function useSocialTemplates() {
  const agencyId = useCurrentAgencyId();
  const { data, ...rest } = useApi(
    () =>
      agencyId
        ? socialApi.getSocialTemplates(agencyId)
        : Promise.resolve({ templates: {}, items: [] }),
    [agencyId],
  );
  const richTemplates = (data?.items || []).reduce((acc, item) => {
    if (!item || typeof item.platform !== 'string') return acc;
    acc[item.platform] = {
      description_template: typeof item.description_template === 'string' ? item.description_template : '',
      title_template: typeof item.title_template === 'string' ? item.title_template : '',
      hashtags: Array.isArray(item.hashtags) ? item.hashtags.filter((h) => typeof h === 'string') : [],
    };
    return acc;
  }, {});
  return { richTemplates, agencyId, ...rest };
}

export function useSaveSocialTemplates() {
  return useMutation(({ agencyId, templates }) => {
    if (!agencyId) {
      return Promise.reject(new Error('No agency_id is available.'));
    }
    return socialApi.saveSocialTemplates(agencyId, templates);
  });
}
