/** Switch-style boolean with optional label + sub-label stacked on the left. */
export function Toggle({ on, onChange, label, sub, disabled = false }) {
  return (
    <div className="toggle-row">
      {(label || sub) && (
        <div className="toggle-row-label">
          {label && <div className="toggle-row-title">{label}</div>}
          {sub && <div className="toggle-row-sub">{sub}</div>}
        </div>
      )}
      <button
        className={`toggle ${on ? 'on' : ''}`}
        onClick={() => onChange(!on)}
        aria-pressed={on}
        type="button"
        disabled={disabled}
      />
    </div>
  );
}
