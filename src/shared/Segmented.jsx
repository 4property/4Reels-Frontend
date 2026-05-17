export function Segmented({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={`${value === o.value ? 'active' : ''}${o.disabled ? ' is-disabled' : ''}`}
          onClick={() => {
            if (o.disabled) return;
            onChange(o.value);
          }}
          disabled={Boolean(o.disabled)}
          aria-disabled={o.disabled ? 'true' : undefined}
          title={o.title || undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
