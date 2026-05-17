import { useCallback, useRef, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AdminView } from '../features/admin/index.js';
import { AutomationConfig } from '../features/automation/index.js';
import { BrandConfig } from '../features/brand/index.js';
import { ReelDefaultsConfig } from '../features/defaults/index.js';
import { MusicConfig } from '../features/music/index.js';
import { NotificationSettings } from '../features/notifications/index.js';
import { DashboardRefetchContext } from '../features/reels/DashboardRefetchContext.js';
import { Dashboard, ReelEditorRoute } from '../features/reels/index.js';
import { RequirePermission, usePermissions } from '../features/session/index.js';
import { can } from '../features/session/permissions.js';
import { SocialConfig } from '../features/social/index.js';
import { TemplatesPage } from '../features/templates/index.js';
import { Toaster } from '../shared/Toaster.jsx';
import { PAGES } from './pages.js';
import { Topbar } from './Topbar.jsx';
import { TweaksPanel } from './TweaksPanel.jsx';
import { useEmbeddedEditMode } from './useEmbeddedEditMode.js';

/** App shell — topbar + route outlet + global modals. */
export function Shell() {
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const permissions = usePermissions();

  useEmbeddedEditMode(setTweaksOpen);

  // First page the current user can actually open. Used as the catch-all
  // landing target so super-admins land on /v1/admin and agency users on /reels.
  const landingPath = pickLandingPath(permissions);

  return (
    <div>
      <Topbar onOpenNotifications={() => setNotifOpen(true)} />

      <PageContainer>
        <Routes>
          <Route path="/" element={<Navigate to={landingPath} replace />} />
          <Route
            path="/reels"
            element={
              <RequirePermission module="reels" redirectTo={landingPath}>
                <ReelsRoute />
              </RequirePermission>
            }
          >
            <Route
              path=":siteId/:sourcePropertyId"
              element={<ReelEditorRoute />}
            />
          </Route>
          <Route
            path="/music"
            element={
              <RequirePermission module="music" redirectTo={landingPath}>
                <MusicConfig />
              </RequirePermission>
            }
          />
          <Route
            path="/social"
            element={
              <RequirePermission module="publish" redirectTo={landingPath}>
                <SocialConfig />
              </RequirePermission>
            }
          />
          <Route
            path="/brand"
            element={
              <RequirePermission module="brand" redirectTo={landingPath}>
                <BrandConfig />
              </RequirePermission>
            }
          />
          <Route
            path="/defaults"
            element={
              <RequirePermission module="reels" redirectTo={landingPath}>
                <ReelDefaultsConfig />
              </RequirePermission>
            }
          />
          <Route
            path="/templates"
            element={
              <RequirePermission module="brand" redirectTo={landingPath}>
                <TemplatesPage />
              </RequirePermission>
            }
          />
          <Route
            path="/automation"
            element={
              <RequirePermission module="automation" redirectTo={landingPath}>
                <AutomationConfig />
              </RequirePermission>
            }
          />
          <Route
            path="/v1/admin"
            element={
              <RequirePermission module="admin" redirectTo={landingPath}>
                <AdminView />
              </RequirePermission>
            }
          />
          <Route path="*" element={<Navigate to={landingPath} replace />} />
        </Routes>
      </PageContainer>

      {tweaksOpen && <TweaksPanel onClose={() => setTweaksOpen(false)} />}
      {notifOpen && <NotificationSettings onClose={() => setNotifOpen(false)} />}

      {/* Feature 39: global toast queue, mounted once so any route can emit. */}
      <Toaster />
    </div>
  );
}

function pickLandingPath(permissions) {
  for (const page of PAGES) {
    if (!page.requires?.module) return page.path;
    if (can(permissions, page.requires.module, page.requires.level)) {
      return page.path;
    }
  }
  return '/reels';
}

/**
 * `/reels` always renders the Dashboard. The <Outlet/> renders the nested
 * `/reels/:id` route on top of it as a full-screen overlay when present.
 *
 * Feature 39: we lift the Dashboard's `refetch` callback out via a ref so
 * the editor (rendered inside the Outlet) can ask the Dashboard to re-pull
 * the list after a mutation. A `ref` is enough — we never want re-renders
 * triggered by the refetch identity changing.
 */
function ReelsRoute() {
  const refetchRef = useRef(null);
  const registerRefetch = useCallback((fn) => {
    refetchRef.current = typeof fn === 'function' ? fn : null;
  }, []);
  // Stable wrapper: the editor consumes this from context. It can be safely
  // invoked even if the Dashboard hasn't registered its refetch yet (no-op).
  const dashboardRefetch = useCallback(() => {
    if (typeof refetchRef.current === 'function') {
      refetchRef.current();
    }
  }, []);
  return (
    <>
      <Dashboard onRegisterRefetch={registerRefetch} />
      <DashboardRefetchContext.Provider value={dashboardRefetch}>
        <Outlet />
      </DashboardRefetchContext.Provider>
    </>
  );
}

/** Wraps each route with the `.page` chrome and the screen-label badge
 *  derived from the active tab. */
function PageContainer({ children }) {
  const { pathname } = useLocation();
  const activeLabel = PAGES.find((p) => pathname.startsWith(p.path))?.label || '';
  return (
    <div className="page" data-screen-label={`Page · ${activeLabel}`}>
      {children}
    </div>
  );
}
