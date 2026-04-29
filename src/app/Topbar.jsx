import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Avatar } from '../shared/Avatar.jsx';
import { Icon } from '../shared/Icon.jsx';
import { useAgency } from './providers/TenantProvider.jsx';
import { useTheme } from './providers/ThemeProvider.jsx';
import { useCurrentUser, useGhlMvp, usePermissions } from '../features/session/index.js';
import { can } from '../features/session/permissions.js';
import { MobileNav } from './MobileNav.jsx';
import { PAGES } from './pages.js';
import './app.css';

/** Sticky top nav. Tabs are filtered by the current user's permissions so a
 *  Viewer never sees Admin, etc. Active tab is derived from the URL.
 *
 *  On tablet / mobile (≤900px) the inline tabs collapse into a hamburguesa
 *  menu (<MobileNav/>). Desktop layout is unchanged. */
export function Topbar({ onOpenNotifications }) {
  const { theme, toggle: toggleTheme } = useTheme();
  const agency = useAgency();
  const user = useCurrentUser();
  const ghlMvp = useGhlMvp();
  const permissions = usePermissions();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const visiblePages = PAGES.filter(
    (p) => !p.requires || can(permissions, p.requires.module, p.requires.level),
  );
  const activeLabel = visiblePages.find((p) => pathname.startsWith(p.path))?.label || '';

  return (
    <>
      <div className="topbar" data-screen-label={`Nav · ${activeLabel}`}>
        <button
          className="icon-btn topbar-burger"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation"
        >
          <Icon name="menu" size={18} />
        </button>

        <div className="topbar-brand">
          <span className="topbar-brand-mark">4</span>
          <span className="topbar-brand-text">4Reels</span>
          {agency && (
            <>
              <span className="topbar-brand-sep" />
              <img className="topbar-agency-logo" src={agency.logo} alt={agency.name} />
              <span className="topbar-agency-name">{agency.name}</span>
            </>
          )}
        </div>

        <div className="tabs">
          {visiblePages.map((p) => (
            <NavLink
              key={p.id}
              to={p.path}
              className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}
            >
              {p.label}
            </NavLink>
          ))}
          <button className="icon-btn topbar-settings-btn" title="Settings">
            <Icon name="settings" size={15} />
          </button>
        </div>

        <div className="topbar-right">
          <div className="search topbar-search">
            <Icon name="search" size={14} />
            <input placeholder="Search reels, properties…" />
            <span className="kbd">⌘K</span>
          </div>
          <button className="icon-btn topbar-mobile-search" title="Search">
            <Icon name="search" size={15} />
          </button>
          <button className="icon-btn topbar-desktop-only" title="Theme" onClick={toggleTheme}>
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={15} />
          </button>
          <button className="icon-btn topbar-desktop-only" title="Notification settings" onClick={onOpenNotifications}>
            <Icon name="bell" size={15} />
          </button>
          <button className="icon-btn topbar-desktop-only" title="Help">
            <Icon name="help" size={15} />
          </button>
          <UserMenu user={user} ghlMvp={ghlMvp} />
        </div>
      </div>

      <MobileNav
        pages={visiblePages}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenNotifications={onOpenNotifications}
      />
    </>
  );
}

function UserMenu({ user, ghlMvp }) {
  const [open, setOpen] = useState(false);
  const locationId = ghlMvp?.locationId || 'Not set';
  const userId = ghlMvp?.userId || user.id || 'Not set';
  const tokenState = ghlMvp?.connected ? 'Saved' : 'Missing';

  return (
    <div className="topbar-user-menu">
      <button
        className="topbar-user-button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Open user context"
      >
        <Avatar name={user.name} color={`hsl(${user.avatarHue ?? 215}, 55%, 55%)`} />
      </button>

      {open && (
        <div className="topbar-user-popover">
          <div className="topbar-user-popover-head">
            <Avatar name={user.name} color={`hsl(${user.avatarHue ?? 215}, 55%, 55%)`} />
            <div className="min-w-0">
              <div className="topbar-user-popover-name">{user.name}</div>
              <div className="topbar-user-popover-role">{user.role}</div>
            </div>
          </div>

          <div className="topbar-user-context-grid">
            <ContextRow label="Mode" value={ghlMvp?.adminMode ? 'Direct admin' : 'GHL location'} />
            <ContextRow label="Location ID" value={locationId} mono />
            <ContextRow label="User ID" value={userId} mono />
            <ContextRow label="Token" value={tokenState} tone={ghlMvp?.connected ? 'success' : 'warning'} />
            <ContextRow label="Source" value={ghlMvp?.source || 'app session'} />
          </div>

          <div className="topbar-user-popover-actions">
            <NavLink className="btn sm" to="/admin" onClick={() => setOpen(false)}>
              <Icon name="shield" size={12} />
              Admin
            </NavLink>
            <button className="btn sm ghost" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ContextRow({ label, value, mono = false, tone = '' }) {
  return (
    <div className="topbar-context-row">
      <span className="topbar-context-label">{label}</span>
      <span className={`topbar-context-value ${mono ? 'mono' : ''} ${tone}`}>
        {value}
      </span>
    </div>
  );
}
