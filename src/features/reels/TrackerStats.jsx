import { useState } from 'react';
import { SocialDot } from '../../shared/SocialDot.jsx';
import { useSocial } from '../../app/providers/TenantProvider.jsx';
import { ctrColor, fmtNum } from '../../lib/utils/format.js';
import { CompactStat } from './CompactStat.jsx';
import { Sparkline } from './Sparkline.jsx';

/**
 * Inline stats card under each reel thumb showing views / clicks / CTR and a
 * 7d/30d clicks sparkline.
 */
export function TrackerStats({ tracker }) {
  const [range, setRange] = useState('7');
  const topNet = useSocial(tracker?.topNet);

  // Render nothing when there is no tracker data. We treat as "no data":
  //   - null / undefined
  //   - empty object (no keys)
  //   - all metrics missing AND no series points
  const hasData =
    tracker &&
    typeof tracker === 'object' &&
    (tracker.views != null ||
      tracker.clicks != null ||
      tracker.ctr != null ||
      (Array.isArray(tracker.clicks7d) && tracker.clicks7d.length > 0) ||
      (Array.isArray(tracker.clicks30d) && tracker.clicks30d.length > 0));

  if (!hasData) {
    return null;
  }

  const series = range === '7' ? (tracker.clicks7d || []) : (tracker.clicks30d || []);
  const rangeTotal = series.reduce((a, b) => a + b, 0);

  return (
    <div className="tracker" onClick={(e) => e.stopPropagation()}>
      <div className="tracker-head">
        <div className="tracker-stats">
          <CompactStat icon="eye" value={fmtNum(tracker.views)} />
          <CompactStat icon="link" value={fmtNum(tracker.clicks)} color="var(--accent)" />
          <CompactStat icon="trending-up" value={`${tracker.ctr}%`} color={ctrColor(tracker.ctr)} />
        </div>
        <SocialDot net={topNet} size={16} />
      </div>

      {series.length > 0 && (
        <div>
          <div className="tracker-chart-head">
            <div className="tracker-chart-label">
              <span className="tracker-chart-total">{fmtNum(rangeTotal)}</span>
              <span className="tracker-chart-meta">clicks · {range}d</span>
            </div>
            <div className="tracker-range">
              {['7', '30'].map((r) => (
                <button
                  key={r}
                  className={`tracker-range-btn ${range === r ? 'active' : ''}`}
                  onClick={() => setRange(r)}
                >
                  {r}d
                </button>
              ))}
            </div>
          </div>
          <Sparkline data={series} height={24} />
        </div>
      )}
    </div>
  );
}
