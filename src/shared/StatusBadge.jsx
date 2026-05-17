const MAP = {
  ready: { cls: 'success', label: 'Ready' },
  rendering: { cls: 'info', label: 'Rendering' },
  'needs-review': { cls: 'warning', label: 'Needs approval' },
  'needs-approval': { cls: 'warning', label: 'Needs approval' },
  failed: { cls: 'danger', label: 'Failed' },
  published: { cls: 'success', label: 'Published' },
  scheduled: { cls: 'accent', label: 'Scheduled' },
  rejected: { cls: 'danger', label: 'Rejected' },
  draft: { cls: '', label: 'Draft' },
  publishing: { cls: 'info', label: 'Publishing…' },
  skipped: { cls: '', label: 'Skipped' },
};

export function StatusBadge({ status }) {
  const m = MAP[status] || { cls: '', label: status };
  return (
    <span className={`badge ${m.cls}`}>
      <span className="dot" />
      {m.label}
    </span>
  );
}
