import { Cover } from '../../shared/Cover.jsx';
import { decodeHtmlEntities } from '../../shared/decodeHtmlEntities.js';
import { Icon } from '../../shared/Icon.jsx';
import { KindBadge } from '../../shared/KindBadge.jsx';
import { SocialDot } from '../../shared/SocialDot.jsx';
import { StatusBadge } from '../../shared/StatusBadge.jsx';
import { useSocials } from '../../app/providers/TenantProvider.jsx';
import { useCan } from '../session/useCan.js';
import { TrackerStats } from './TrackerStats.jsx';

/**
 * Formats reel.price for display in the card.
 * - Returns '' if price is falsy.
 * - Prepends '€' if the string doesn't already start with a known currency symbol.
 * - Appends ' /month' when the listing is a rental (kind contains 'let').
 */
function formatReelPrice(price, kind) {
  const raw = typeof price === 'string' ? price.trim() : '';
  if (!raw) return '';
  const hasCurrency = /^\s*[€$£¥₹]/.test(raw) || /^(EUR|USD|GBP|CA\$|A\$)/i.test(raw);
  const withSymbol = hasCurrency ? raw : `€${raw}`;
  const isRental = typeof kind === 'string' && kind.includes('let');
  return isRental ? `${withSymbol} /month` : withSymbol;
}

/** Grid-view card for one reel. Clicking anywhere opens the editor.
 *
 * `disabled` (feature 39): set while an approve/reject mutation is in flight
 * anywhere on the Dashboard. Greys out the action buttons so the user can't
 * double-submit. `pending` is `'approve' | 'reject' | null` and marks which
 * button on THIS card is the in-flight one (so we can show a spinner only on
 * the active button while greying the sibling).
 */
export function ReelCard({ reel, onOpen, onApprove, onReject, disabled = false, pending = null }) {
  const socials = useSocials();
  const socialMap = new Map(socials.map((s) => [s.id, s]));
  const canPublish = useCan('publish', 'write');
  const title = decodeHtmlEntities(reel.title);
  const priceLabel = formatReelPrice(reel.price, reel.kind);

  return (
    <div className="card reel-card" onClick={onOpen}>
      <div className="reel-card-cover">
        <Cover
          kind={reel.cover || 'default'}
          src={reel.coverUrl}
          ratio="3/4"
          label={title}
        />
        <div className="reel-card-cover-top">
          <StatusBadge status={reel.publishStatus} />
          <div className="chip chip-overlay">
            <Icon name="clock" size={10} /> {reel.duration}
          </div>
        </div>
        <div className="reel-card-cover-bottom">
          <div>
            <KindBadge kind={reel.kind} />
          </div>
          <div className="reel-card-networks">
            {reel.networks.map((id) => (
              <SocialDot key={id} net={socialMap.get(id)} size={24} />
            ))}
          </div>
        </div>
      </div>

      <div className="reel-card-body">
        <div className="reel-card-head">
          <div className="min-w-0 grow">
            <div className="reel-card-title">{title}</div>
            <div className="reel-card-address">{reel.address}</div>
            {priceLabel ? <div className="reel-card-price">{priceLabel}</div> : null}
          </div>
        </div>
        <div className="reel-card-footer">
          {reel.publishStatus === 'needs-approval' ? (
            canPublish ? (
              <div className="row gap-3" onClick={(e) => e.stopPropagation()}>
                <button
                  className="btn primary sm reel-card-btn-sm"
                  onClick={() => onApprove?.(reel.id)}
                  disabled={disabled}
                  aria-busy={pending === 'approve' ? 'true' : undefined}
                  data-testid={`reel-approve-${reel.id}`}
                >
                  <Icon name={pending === 'approve' ? 'clock' : 'check'} size={11} /> Approve
                </button>
                <button
                  className="btn sm reel-card-btn-sm"
                  onClick={() => onReject?.(reel.id)}
                  disabled={disabled}
                  aria-busy={pending === 'reject' ? 'true' : undefined}
                  data-testid={`reel-reject-${reel.id}`}
                >
                  Reject
                </button>
              </div>
            ) : (
              <span className="icon-text t-warning">
                <Icon name="clock" size={11} /> Pending approval
              </span>
            )
          ) : reel.publishStatus === 'rejected' ? (
            <span className="icon-text t-subtle">
              <Icon name="close" size={11} /> Not published
            </span>
          ) : (
            <span className="icon-text t-success">
              <Icon name="check" size={11} /> Live on {reel.networks.length} network{reel.networks.length === 1 ? '' : 's'}
            </span>
          )}
          <span className="reel-card-time">{reel.createdAt.split(' · ')[1]}</span>
        </div>
        <TrackerStats tracker={reel.tracker} />
      </div>
    </div>
  );
}
