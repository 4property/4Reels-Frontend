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
 * Build the canonical PUT /automation body. After back feature 13 the
 * AutomationRulesUpsertPayload accepts:
 *   approval_required, trigger_on_status,
 *   hold_window_seconds, quiet_hours_enabled, skip_weekends,
 *   publish_window_start?, publish_window_end?, publish_days?
 *
 * Mapping notes:
 *   - `publishMode` is UI-only and maps to `approval_required`.
 *   - The UI captures "quiet hours" as the *silent* range
 *     (e.g. 22:00 → 07:00). The backend stores the *allowed* range in
 *     publish_window_start / publish_window_end, so we invert them.
 *   - `publish_days` reflects skip_weekends so the back can defer
 *     Saturday/Sunday approvals to Monday at publish_window_start.
 */
export function buildAutomationBody(state) {
  const body = {
    approval_required: state.publishMode === 'review',
  };
  if (state.triggerOnStatus !== undefined && state.triggerOnStatus !== null) {
    body.trigger_on_status = state.triggerOnStatus;
  }

  body.hold_window_seconds = state.holdWindowEnabled
    ? Math.max(0, Math.round((Number(state.holdWindowHours) || 0) * 3600))
    : 0;

  body.quiet_hours_enabled = Boolean(state.quietHoursEnabled);
  if (state.quietHoursEnabled) {
    body.publish_window_start = state.quietHoursEnd;
    body.publish_window_end = state.quietHoursStart;
  }

  body.skip_weekends = Boolean(state.skipWeekends);
  body.publish_days = state.skipWeekends
    ? ['mon', 'tue', 'wed', 'thu', 'fri']
    : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

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
