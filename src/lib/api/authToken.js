/**
 * Plain auth-token store consumed by `apiRequest` to attach
 * `Authorization: Bearer <token>` to every backend call.
 *
 * Lives in `lib/api/` so it can be imported by `client.js` without
 * pulling in React. Persistence is `sessionStorage` (key
 * `4reels.adminBearer`): scoped to the tab, survives reloads, and
 * disappears when the tab closes — the smallest blast radius that
 * still avoids a race between `setAuthToken` and the first
 * `/v1/admin/*` call after a hot reload.
 *
 * Subscribers can listen for `unauthorized` (a 401 returned by any
 * `/v1/admin/*` route). The SessionProvider uses it to drop the
 * cached token and bounce the user back to the connect screen.
 */

const STORAGE_KEY = '4reels.adminBearer';

let current = null;
const subs = new Set();

try {
  current = window.sessionStorage.getItem(STORAGE_KEY) || null;
} catch {
  current = null;
}

export function getAuthToken() {
  return current;
}

export function setAuthToken(token) {
  current = token || null;
  try {
    if (token) {
      window.sessionStorage.setItem(STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* sessionStorage unavailable (SSR, partitioned iframe). In-memory copy still works. */
  }
}

export function clearAuthToken() {
  setAuthToken(null);
}

export function subscribeUnauthorized(cb) {
  subs.add(cb);
  return () => subs.delete(cb);
}

export function notifyUnauthorized() {
  for (const cb of subs) {
    try {
      cb();
    } catch {
      /* listener errors must not break the apiRequest caller */
    }
  }
}
