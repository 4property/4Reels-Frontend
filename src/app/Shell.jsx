import { useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AdminView } from '../features/admin/index.js';
import { AutomationConfig } from '../features/automation/index.js';
import { BrandConfig } from '../features/brand/index.js';
import { ReelDefaultsConfig } from '../features/defaults/index.js';
import { MusicConfig } from '../features/music/index.js';
import { NotificationSettings } from '../features/notifications/index.js';
import { Dashboard, ReelEditorRoute } from '../features/reels/index.js';
import { GhlMvpStatus } from '../features/session/GhlMvpStatus.jsx';
import { RequirePermission } from '../features/session/index.js';
import { SocialConfig } from '../features/social/index.js';
import { PAGES } from './pages.js';
import { Topbar } from './Topbar.jsx';
import { TweaksPanel } from './TweaksPanel.jsx';
import { useEmbeddedEditMode } from './useEmbeddedEditMode.js';

/** App shell — topbar + route outlet + global modals. */
export function Shell() {
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  useEmbeddedEditMode(setTweaksOpen);

  return (
    <div>
      <Topbar onOpenNotifications={() => setNotifOpen(true)} />
      <GhlMvpStatus />

      <PageContainer>
        <Routes>
          <Route path="/" element={<Navigate to="/reels" replace />} />
          <Route path="/reels" element={<ReelsRoute />}>
            <Route path=":id" element={<ReelEditorRoute />} />
          </Route>
          <Route path="/music" element={<MusicConfig />} />
          <Route path="/social" element={<SocialConfig />} />
          <Route path="/brand" element={<BrandConfig />} />
          <Route path="/defaults" element={<ReelDefaultsConfig />} />
          <Route path="/automation" element={<AutomationConfig />} />
          <Route
            path="/admin"
            element={
              <RequirePermission module="admin">
                <AdminView />
              </RequirePermission>
            }
          />
          <Route path="*" element={<Navigate to="/reels" replace />} />
        </Routes>
      </PageContainer>

      {tweaksOpen && <TweaksPanel onClose={() => setTweaksOpen(false)} />}
      {notifOpen && <NotificationSettings onClose={() => setNotifOpen(false)} />}
    </div>
  );
}

/**
 * `/reels` always renders the Dashboard. The <Outlet/> renders the nested
 * `/reels/:id` route on top of it as a full-screen overlay when present.
 */
function ReelsRoute() {
  return (
    <>
      <Dashboard />
      <Outlet />
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
