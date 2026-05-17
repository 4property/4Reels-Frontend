import { Icon } from './Icon.jsx';
import { useToast } from '../lib/hooks/useToast.js';

/**
 * Feature 39 — global toast renderer.
 *
 * Mounted once in `<Shell>`, renders the queue from the singleton store in
 * `lib/hooks/useToast.js`. Each toast:
 *   - role="status" + aria-live="polite" for success/info.
 *   - role="alert"  + aria-live="assertive" for errors.
 *   - X close button (manual dismiss).
 *
 * Position: bottom-right (fixed). Rationale:
 *   - The editor overlay reserves the top-right area for status badges and
 *     action buttons (`StatusBadge`, `Approve/Reject` chips). A top-right
 *     toast would visually overlap and could be missed.
 *   - The Dashboard's pagination + count chip live in the top section as
 *     well. Bottom-right keeps the toast clear of all interactive zones
 *     while still being in the standard "system notification" quadrant
 *     for desktop UIs.
 *   - On mobile (375px viewport), the toast becomes nearly full-width and
 *     stacks at the bottom-center — same DOM, CSS handles the responsive
 *     reposition.
 *
 * Visual style: matches `.card` (background + border + shadow), tone color
 * borrowed from the design tokens `--success`, `--danger`, `--info`. No
 * external animation library — a single `transform/opacity` transition
 * keyed off mount is enough.
 */
export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="toaster" role="region" aria-label="Notifications" data-testid="toaster">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const isError = toast.kind === 'error';
  const role = isError ? 'alert' : 'status';
  const ariaLive = isError ? 'assertive' : 'polite';
  const iconName =
    toast.kind === 'success' ? 'check' : toast.kind === 'error' ? 'alert' : 'info';
  return (
    <div
      className={`toast toast-${toast.kind}`}
      role={role}
      aria-live={ariaLive}
      data-testid={`toast-${toast.kind}`}
    >
      <span className="toast-icon" aria-hidden="true">
        <Icon name={iconName} size={13} />
      </span>
      <span className="toast-message">{toast.message}</span>
      <button
        type="button"
        className="toast-close"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        data-testid={`toast-dismiss-${toast.id}`}
      >
        <Icon name="close" size={12} />
      </button>
    </div>
  );
}
