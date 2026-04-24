import { Cover } from '../../shared/Cover.jsx';
import { Icon } from '../../shared/Icon.jsx';
import { KindBadge } from '../../shared/KindBadge.jsx';
import { SocialDot } from '../../shared/SocialDot.jsx';
import { StatusBadge } from '../../shared/StatusBadge.jsx';
import { useSocials } from '../../app/providers/TenantProvider.jsx';
import { useCan } from '../session/useCan.js';
import { TrackerStats } from './TrackerStats.jsx';

/** Grid-view card for one reel. Clicking anywhere opens the editor. */
export function ReelCard({ reel, onOpen, onApprove, onReject }) {
  const socials = useSocials();
  const socialMap = new Map(socials.map((s) => [s.id, s]));
  const canPublish = useCan('publish', 'write');

  return (
    <div className="card reel-card" onClick={onOpen}>
      <div className="reel-card-cover">
        <Cover kind={reel.cover} ratio="3/4" label={reel.title} video="hover" />
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
            <div className="reel-card-title">{reel.title}</div>
            <div className="reel-card-address">{reel.address}</div>
          </div>
          <div className="reel-card-price">{reel.price}</div>
        </div>
        <div className="reel-card-footer">
          {reel.publishStatus === 'needs-approval' ? (
            canPublish ? (
              <div className="row gap-3" onClick={(e) => e.stopPropagation()}>
                <button className="btn primary sm reel-card-btn-sm" onClick={() => onApprove?.(reel.id)}>
                  <Icon name="check" size={11} /> Approve
                </button>
                <button className="btn sm reel-card-btn-sm" onClick={() => onReject?.(reel.id)}>
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
