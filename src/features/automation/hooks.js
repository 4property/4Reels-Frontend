import { useApi, useMutation } from '../../lib/hooks/useApi.js';
import { useCurrentAgencyId } from '../session/index.js';
import { automationApi } from './api.js';

export function useAutomationRules() {
  const agencyId = useCurrentAgencyId();
  const { data, ...rest } = useApi(
    () =>
      agencyId
        ? automationApi.getAutomation(agencyId)
        : Promise.resolve({ automation: null }),
    [agencyId],
  );
  return { automation: data?.automation || null, agencyId, ...rest };
}

/**
 * Build the canonical PUT /automation body. The back's
 * AutomationRulesUpsertPayload only accepts:
 *   approval_required, trigger_on_status, publish_window_start?,
 *   publish_window_end?, publish_days?
 *
 * `publishMode` is a UI-only concept that maps to `approval_required`.
 */
export function buildAutomationBody(state) {
  const body = {
    approval_required: state.publishMode === 'review',
  };
  if (state.triggerOnStatus !== undefined && state.triggerOnStatus !== null) {
    body.trigger_on_status = state.triggerOnStatus;
  }
  if (state.publishWindowStart) body.publish_window_start = state.publishWindowStart;
  if (state.publishWindowEnd) body.publish_window_end = state.publishWindowEnd;
  if (Array.isArray(state.publishDays)) body.publish_days = state.publishDays;
  return body;
}

export function useSaveAutomationRules() {
  return useMutation(({ agencyId, state }) => {
    if (!agencyId) {
      return Promise.reject(new Error('No agency_id is available.'));
    }
    return automationApi.saveAutomation(agencyId, buildAutomationBody(state));
  });
}
