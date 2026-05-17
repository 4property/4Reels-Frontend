import { useEffect, useMemo, useState } from 'react';
import { toast } from '../../../lib/hooks/useToast.js';
import { Icon } from '../../../shared/Icon.jsx';
import { Spinner } from '../../../shared/Spinner.jsx';
import { useSocials } from '../../../app/providers/TenantProvider.jsx';
import { isPublishStatusEditable } from '../publishStatus.js';
import { useReelDescriptionsOverride } from '../hooks.js';
import {
  NETWORK_LIMITS,
  findLinksInText,
  getPlatformPolicy,
} from './defaults.js';

/**
 * Feature 21 — Descriptions tab.
 *
 * Editable panel that lets an admin override the auto-generated description
 * the worker would otherwise pull from the agency-level template. One
 * section per platform exposed by `useSocials()`. Each section hydrates
 * from the back-of-truth tuple, in precedence order:
 *
 *   1. `reel.descriptionsOverride[platform]`           — explicit override.
 *   2. `reel.publishDescriptionsSnapshot[platform]`    — fallback snapshot.
 *   3. `''`                                            — empty.
 *
 * Save (per platform / Save all) PATCHes the back's
 * `/reels/{site_id}/{source_property_id}/descriptions` endpoint with
 * **replace** semantics — the full map of overrides we want to persist.
 * Sending `{}` clears the override and falls back to the snapshot.
 *
 * If the reel's raw `publish_status` is outside the back's editable gate
 * (`{needs-approval, pending_review, pending, ''}`), the textareas are
 * rendered read-only and a banner is shown.
 *
 * Error handling mirrors the back contract:
 *   - 409 `REEL_NOT_EDITABLE`        → red banner.
 *   - 422 `PLATFORM_NOT_ENABLED`     → yellow banner naming the platform.
 *   - other                           → red banner with the backend code.
 */
export function DescriptionsPanel({ reel, agencyId, refetchReel, onMutate }) {
  const socials = useSocials();
  const [patch, { loading: saving }] = useReelDescriptionsOverride();

  const editable = isPublishStatusEditable(reel?.rawPublishStatus);

  // Hydrated baseline (override → snapshot → ''). Recomputed when the parent
  // refetches the reel after a successful PATCH so consecutive Saves don't
  // diverge from the persisted state.
  const baseline = useMemo(() => {
    const out = {};
    for (const s of socials) {
      const fromOverride = reel?.descriptionsOverride?.[s.id];
      const fromSnapshot = reel?.publishDescriptionsSnapshot?.[s.id];
      out[s.id] =
        typeof fromOverride === 'string'
          ? fromOverride
          : typeof fromSnapshot === 'string'
            ? fromSnapshot
            : '';
    }
    return out;
  }, [
    socials,
    reel?.descriptionsOverride,
    reel?.publishDescriptionsSnapshot,
  ]);

  const [values, setValues] = useState(baseline);
  const [feedback, setFeedback] = useState(null);

  // Resync the textarea state when the upstream reel re-hydrates (e.g. after
  // a Save → refetch round-trip, or when the route changes to another reel
  // while the panel is open).
  useEffect(() => {
    setValues(baseline);
  }, [baseline]);

  const setOne = (platform, text) =>
    setValues((prev) => ({ ...prev, [platform]: text }));

  const dirtyPlatforms = useMemo(
    () =>
      socials
        .map((s) => s.id)
        .filter((id) => (values[id] || '') !== (baseline[id] || '')),
    [socials, values, baseline],
  );

  const reportError = (err) => {
    const status = err?.status;
    const code = err?.body?.error || err?.body?.code || '';
    const details = err?.body?.details || {};
    let tone = 'danger';
    let text;
    if (status === 409 && code === 'REEL_NOT_EDITABLE') {
      text = 'This reel can no longer be edited.';
    } else if (status === 422 && code === 'PLATFORM_NOT_ENABLED') {
      const platform = details.platform || details.platform_id || 'unknown';
      tone = 'warning';
      text = `Platform "${platform}" is not enabled for this agency.`;
    } else {
      text = code || err?.message || 'Failed to save descriptions.';
    }
    setFeedback({ tone, text });
    toast.error(text, { id: 'reel-descriptions' });
  };

  // Build the payload following replace semantics: send the full override
  // map we want to persist. Keys present in `baseline` only because of the
  // snapshot fallback are NOT sent (otherwise we'd promote the snapshot to
  // a frozen override). Only platforms with a non-empty text the user has
  // touched or that already had an override survive.
  const buildPayload = (subset = null) => {
    const platforms = subset || Object.keys(values);
    const payload = {};
    // Start from the existing overrides so we don't accidentally drop ones
    // that the user did not touch.
    if (reel?.descriptionsOverride) {
      for (const [k, v] of Object.entries(reel.descriptionsOverride)) {
        if (typeof v === 'string') payload[k] = v;
      }
    }
    for (const platform of platforms) {
      const text = values[platform] || '';
      if (text.length === 0) {
        delete payload[platform];
      } else {
        payload[platform] = text;
      }
    }
    return payload;
  };

  const persist = async (payload, successText) => {
    setFeedback(null);
    try {
      await patch({
        agencyId,
        siteId: reel.siteId,
        sourcePropertyId: reel.sourcePropertyId,
        descriptions: payload,
      });
      setFeedback({ tone: 'success', text: successText });
      toast.success('Descriptions saved', { id: 'reel-descriptions' });
      // Feature 39: notify the parent editor that a mutation landed.
      onMutate?.();
      if (typeof refetchReel === 'function') {
        await refetchReel();
      }
    } catch (err) {
      reportError(err);
    }
  };

  const handleSaveOne = (platform) =>
    persist(buildPayload([platform]), `Saved description for ${platform}.`);

  const handleSaveAll = () =>
    persist(buildPayload(), 'Saved descriptions for all platforms.');

  const handleReset = () =>
    persist({}, 'Override cleared. Reel will use the template snapshot.');

  if (!reel) return null;

  return (
    <div className="desc-override-panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Per-reel descriptions</div>
          <div className="panel-sub">
            Override the auto-generated caption for this reel on a per-platform
            basis. Saves replace the stored override entirely.
          </div>
        </div>
        <div className="row gap-4">
          <button
            type="button"
            className="btn sm"
            onClick={handleReset}
            disabled={!editable || saving}
            title="Send an empty override; the worker falls back to the snapshot."
          >
            <Icon name="copy" size={12} /> Reset to template
          </button>
          <button
            type="button"
            className="btn sm primary"
            onClick={handleSaveAll}
            disabled={!editable || saving || dirtyPlatforms.length === 0}
          >
            {saving ? <Spinner /> : <Icon name="check" size={12} />} Save all
            {dirtyPlatforms.length > 0 && (
              <span className="badge" style={{ marginLeft: 6 }}>
                {dirtyPlatforms.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {!editable && (
        <div
          className="desc-readonly-banner"
          data-testid="desc-readonly-banner"
        >
          <Icon name="info" size={13} /> Descriptions are locked once the reel
          is approved or published.
        </div>
      )}

      {feedback && (
        <div
          className={`desc-feedback desc-feedback-${feedback.tone}`}
          data-testid="desc-feedback"
        >
          <Icon
            name={feedback.tone === 'success' ? 'check' : 'alert'}
            size={12}
          />{' '}
          {feedback.text}
        </div>
      )}

      <div className="desc-override-list">
        {socials.map((s) => {
          const text = values[s.id] || '';
          const policy = getPlatformPolicy(s.id);
          const limit = policy.descLimit || NETWORK_LIMITS[s.id] || 2200;
          const over = text.length > limit;
          const platformDirty =
            (values[s.id] || '') !== (baseline[s.id] || '');
          const detectedLinks = findLinksInText(text);
          const linkPolicyWarning =
            !policy.supportsLinks && detectedLinks.length > 0
              ? policy.linkWarning
              : null;
          return (
            <div key={s.id} className="desc-override-row">
              <div className="desc-override-row-head">
                <span
                  className="desc-net-icon"
                  style={{ background: s.color }}
                >
                  <Icon name={s.icon} size={10} />
                </span>
                <span className="desc-override-row-label">{s.name}</span>
                {reel?.descriptionsOverride?.[s.id] !== undefined && (
                  <span
                    className="badge"
                    data-testid={`desc-override-flag-${s.id}`}
                  >
                    override
                  </span>
                )}
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => handleSaveOne(s.id)}
                  disabled={!editable || saving || !platformDirty}
                  data-testid={`desc-save-${s.id}`}
                >
                  Save
                </button>
              </div>
              {policy?.notes && (
                <div
                  className="platform-notes"
                  data-testid={`desc-policy-notes-${s.id}`}
                >
                  <Icon name="info" size={11} /> {policy.notes}
                </div>
              )}
              <textarea
                className="textarea desc-override-textarea"
                value={text}
                onChange={(e) => setOne(s.id, e.target.value)}
                readOnly={!editable}
                aria-label={`Description for ${s.name}`}
                data-testid={`desc-textarea-${s.id}`}
              />
              {linkPolicyWarning && (
                <div
                  className="platform-warning"
                  data-testid={`desc-link-warning-${s.id}`}
                >
                  <Icon name="alert" size={11} /> {linkPolicyWarning}
                </div>
              )}
              <div className="desc-override-meta">
                <div
                  className={`char-count ${over ? 'over' : ''}`}
                  data-testid={`desc-charcount-${s.id}`}
                >
                  {text.length}/{limit}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
