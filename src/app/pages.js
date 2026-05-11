/**
 * The app's top-level navigation. A plain data map â€” adding a new page is a
 * single entry here plus wiring it into <Shell>.
 *
 * Each entry's `path` is the route base; `requires` is the permission needed
 * to see/access the tab. The Topbar hides tabs the user lacks permission for
 * and <Shell> redirects them if they type the URL directly.
 *
 * Today there are two user kinds (see ghlMvpContext.js):
 *   - GHL agency user â†’ admin: 'none', everything else 'rw'.
 *   - Platform super-admin (?admin=1) â†’ admin: 'rw', everything else 'none'.
 *
 * That gives the admin tab to the platform owner only, and keeps the
 * configuration tabs scoped to agency users.
 */
export const PAGES = [
  { id: 'dashboard', path: '/reels', label: 'Reels', icon: 'film', requires: { module: 'reels' } },
  { id: 'music', path: '/music', label: 'Music', icon: 'music', requires: { module: 'music' } },
  { id: 'social', path: '/social', label: 'Social', icon: 'share', requires: { module: 'publish' } },
  { id: 'brand', path: '/brand', label: 'Brand', icon: 'palette', requires: { module: 'brand' } },
  { id: 'defaults', path: '/defaults', label: 'Defaults', icon: 'settings', requires: { module: 'reels' } },
  { id: 'automation', path: '/automation', label: 'Automation', icon: 'zap', requires: { module: 'automation' } },
  { id: 'admin', path: '/v1/admin', label: 'Admin', icon: 'shield', requires: { module: 'admin' } },
];
