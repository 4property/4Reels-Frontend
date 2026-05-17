/**
 * Feature 39 — bridge from the editor overlay back to the parent Dashboard.
 *
 * The `/reels` route renders `<Dashboard />` underneath an optional editor
 * `<Outlet />`. When the editor mutates the reel (photos, music, subtitles,
 * slides, descriptions) and is then closed, we want the Dashboard's list to
 * refetch so the modified reel — which the backend now serves at the top of
 * `updated_at DESC` — bubbles up without a manual reload.
 *
 * The Dashboard publishes its `refetch` function to this Context; the editor
 * consumes it with `useContext(DashboardRefetchContext)`. The value is `null`
 * when no Dashboard is mounted (e.g. someone deep-links straight into the
 * editor route).
 */
import { createContext } from 'react';

export const DashboardRefetchContext = createContext(null);
