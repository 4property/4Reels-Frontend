import { Checkbox } from '../../shared/Checkbox.jsx';
import { Cover } from '../../shared/Cover.jsx';
import { Icon } from '../../shared/Icon.jsx';
import { SocialDot } from '../../shared/SocialDot.jsx';
import { StatusBadge } from '../../shared/StatusBadge.jsx';
import { useSocials } from '../../app/providers/TenantProvider.jsx';
import { ctrColor, fmtNum } from '../../lib/utils/format.js';

/** List-view table of reels. */
export function ReelsTable({ reels, onOpen }) {
  const socials = useSocials();
  const socialMap = new Map(socials.map((s) => [s.id, s]));

  return (
    <div className="card reels-table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 36 }}><Checkbox checked={false} onChange={() => {}} /></th>
            <th>Property</th>
            <th>Status</th>
            <th>Networks</th>
            <th>Duration</th>
            <th style={{ textAlign: 'right' }}>Views</th>
            <th style={{ textAlign: 'right' }}>Clicks</th>
            <th style={{ textAlign: 'right' }}>CTR</th>
            <th>Created</th>
            <th style={{ width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {reels.map((r) => (
            <tr key={r.id} className="reels-table-row" onClick={() => onOpen(r.id)}>
              <td onClick={(e) => e.stopPropagation()}>
                <Checkbox checked={false} onChange={() => {}} />
              </td>
              <td>
                <div className="row gap-5">
                  <div className="reels-table-thumb">
                    <Cover kind={r.cover} ratio="3/4" video="hover" />
                  </div>
                  <div>
                    <div className="reels-table-title">{r.title}</div>
                    <div className="reels-table-subtitle">{r.address}</div>
                  </div>
                </div>
              </td>
              <td><StatusBadge status={r.publishStatus} /></td>
              <td>
                <div className="row reels-table-networks">
                  {r.networks.slice(0, 5).map((id) => (
                    <SocialDot key={id} net={socialMap.get(id)} />
                  ))}
                  {r.networks.length === 0 && <span className="subtle t-sm">—</span>}
                </div>
              </td>
              <td className="num">{r.duration}</td>
              <td className="num" style={{ color: r.tracker ? 'var(--text)' : 'var(--text-subtle)' }}>
                {r.tracker ? fmtNum(r.tracker.views) : '—'}
              </td>
              <td className="num" style={{ color: r.tracker ? 'var(--accent)' : 'var(--text-subtle)', fontWeight: r.tracker ? 600 : 400 }}>
                {r.tracker ? fmtNum(r.tracker.clicks) : '—'}
              </td>
              <td className="num" style={{ color: r.tracker ? ctrColor(r.tracker.ctr) : 'var(--text-subtle)' }}>
                {r.tracker ? `${r.tracker.ctr}%` : '—'}
              </td>
              <td className="reels-table-created">{r.createdAt}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <button className="icon-btn"><Icon name="more" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
