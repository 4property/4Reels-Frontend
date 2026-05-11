/**
 * Catalog of routes the smoke suite walks. Keep in sync with
 * `src/app/pages.js`.
 *
 * `mode` flags whether the route is reachable for an agency-session user, a
 * super-admin (`?admin=1`), or both. The session provider hides product
 * tabs from the super-admin and the Admin tab from agency users, so the
 * smoke suite iterates each subset under the right session.
 */
export const ROUTES = [
  { name: 'reels', path: '/reels', mode: 'agency' },
  { name: 'music', path: '/music', mode: 'agency' },
  { name: 'social', path: '/social', mode: 'agency' },
  { name: 'brand', path: '/brand', mode: 'agency' },
  { name: 'defaults', path: '/defaults', mode: 'agency' },
  { name: 'automation', path: '/automation', mode: 'agency' },
  { name: 'admin', path: '/v1/admin?admin=1', mode: 'admin' },
];
