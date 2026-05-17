/**
 * Feature 39 — Global toast queue.
 *
 * Tiny singleton store + React hook. Designed so any code path (component
 * handler, async catch block, top-level effect) can fire a toast without
 * being wrapped in a Provider — the `toast` object is just a module export
 * with `success`, `error`, `info` and `dismiss` functions.
 *
 * Why singleton instead of Context+Provider?
 *   - Toasts are global by nature. Splitting them into nested providers gives
 *     no benefit and forces every emitter (including non-React modules like
 *     `lib/api/client.js` error mappers) to find a hook.
 *   - The Provider+Context pattern doesn't bring testability advantages here
 *     because the toast list is rendered by a single `<Toaster>` component
 *     mounted once near the root.
 *   - Imperative ergonomics: `toast.success('Saved')` reads cleaner than
 *     `useToast().success('Saved')` in event handlers.
 *
 * The hook `useToast()` subscribes to the queue and returns `{toasts, dismiss}`
 * for the `<Toaster>` to render. It is the only consumer of the hook; feature
 * code uses the imperative `toast.*` API.
 *
 * Auto-dismiss durations:
 *   - success/info: 4000 ms.
 *   - error:        6000 ms (more time to read the failure detail).
 *   - `opts.duration` lets callers override.
 *   - `opts.id` lets callers dedupe: a toast with an existing id REPLACES the
 *     previous one (also resets the dismiss timer).
 */
import { useEffect, useState } from 'react';

let queue = [];
let listeners = new Set();
let nextId = 1;
const timers = new Map(); // id → setTimeout handle

const DEFAULT_DURATION = {
  success: 4000,
  info: 4000,
  error: 6000,
};

function emit() {
  for (const listener of listeners) {
    listener(queue);
  }
}

function scheduleDismiss(id, duration) {
  if (timers.has(id)) {
    clearTimeout(timers.get(id));
    timers.delete(id);
  }
  if (duration > 0) {
    const handle = setTimeout(() => {
      dismiss(id);
    }, duration);
    timers.set(id, handle);
  }
}

function push(kind, message, opts = {}) {
  const id = opts.id != null ? String(opts.id) : `t-${nextId++}`;
  const duration =
    typeof opts.duration === 'number' && opts.duration >= 0
      ? opts.duration
      : DEFAULT_DURATION[kind] ?? 4000;
  const next = {
    id,
    kind,
    message: String(message ?? ''),
    createdAt: Date.now(),
  };
  // Dedupe by id: replace the existing toast in place so the array order
  // doesn't churn and the visual replaces cleanly.
  const idx = queue.findIndex((t) => t.id === id);
  if (idx >= 0) {
    queue = queue.map((t) => (t.id === id ? next : t));
  } else {
    queue = [...queue, next];
  }
  scheduleDismiss(id, duration);
  emit();
  return id;
}

export function dismiss(id) {
  const before = queue.length;
  queue = queue.filter((t) => t.id !== id);
  if (timers.has(id)) {
    clearTimeout(timers.get(id));
    timers.delete(id);
  }
  if (queue.length !== before) emit();
}

export const toast = {
  success: (message, opts) => push('success', message, opts),
  error: (message, opts) => push('error', message, opts),
  info: (message, opts) => push('info', message, opts),
  dismiss,
};

/** React hook the `<Toaster>` uses to subscribe to the queue. */
export function useToast() {
  const [toasts, setToasts] = useState(queue);
  useEffect(() => {
    const listener = (next) => setToasts(next);
    listeners.add(listener);
    // Re-sync once on mount in case the queue mutated between render and
    // effect (e.g. an early `toast.error('init failed')` fired before the
    // Toaster subscribed).
    setToasts(queue);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return { toasts, dismiss };
}

// Test helper — NOT exported in the package's public surface. Used by unit
// tests (none today, but documented for the next session). Listed here so
// reviewers know the singleton is intentional, not accidental.
export function __resetToastsForTests() {
  for (const handle of timers.values()) clearTimeout(handle);
  timers.clear();
  queue = [];
  emit();
}
