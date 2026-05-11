import { Icon } from '../../shared/Icon.jsx';

/** Big tappable selector card used for the "auto vs review" publish-mode picker. */
export function ModeCard({ selected, onClick, icon, tone, title, tagline, points }) {
  const cls = `mode-card ${selected ? 'selected' : ''} tone-${tone}`;

  return (
    <button className={cls} type="button" onClick={onClick}>
      <div className="mode-card-head">
        <span className="mode-card-icon">
          <Icon name={icon} size={16} />
        </span>
        <div className="grow min-w-0">
          <div className="mode-card-title">{title}</div>
          <div className="mode-card-tagline">{tagline}</div>
        </div>
        <span className="mode-card-radio">
          {selected && <Icon name="check" size={10} />}
        </span>
      </div>
      <ul className="mode-card-points">
        {points.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </button>
  );
}
