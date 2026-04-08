/**
 * App layout: sidebar (role-based menu), header, outlet.
 * Mobile: sidebar becomes overlay drawer; hamburger toggles menu.
 */
import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from './ConfirmDialog';
import { canAccessPath, getDefaultPath } from '../config/rolePageAccess';

const MENU_ITEMS: { path: string; label: string }[] = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/risk', label: 'Risk' },
  { path: '/corrective-actions', label: 'Corrective Actions' },
  { path: '/findings', label: 'Findings' },
  { path: '/audits', label: 'Audits' },
  { path: '/shipments', label: 'Shipments' },
  { path: '/records', label: 'Records' },
  { path: '/supplier-profile', label: 'Supplier Profile' },
  { path: '/supplier-list', label: 'Approved Supplier List' },
  { path: '/suppliers-map', label: 'Suppliers Map' },
  { path: '/documents', label: 'Command Media' },
  { path: '/internal-management', label: 'Internal Management' },
  { path: '/admin', label: 'Admin' },
];

const GLOBAL_VENDOR_ITEMS: { path: string; label: string }[] = [
  { path: '/global-vendors/farmers', label: 'Farmer Information' },
  { path: '/global-vendors/approved', label: 'Approved Farm List' },
  { path: '/global-vendors/map', label: 'Farms Map' },
  { path: '/global-vendors/relationship', label: 'Relationship & Trust' },
  { path: '/global-vendors/purchase-orders', label: 'Purchase Orders' },
  { path: '/global-vendors/samples', label: 'Samples' },
  { path: '/global-vendors/expenses', label: 'Expenses' },
  { path: '/global-vendors/admin', label: 'Admin' },
];

/** Routes under this prefix use the Global Vendors shell only (sidebar + header). */
export function isGlobalVendorsPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/';
  return p === '/global-vendors' || p.startsWith('/global-vendors' + '/');
}

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const roleNames = user?.roleNames ?? [];
  const pathname = location.pathname;
  const globalVendorsShell = isGlobalVendorsPath(pathname);

  useEffect(() => {
    if (menuOpen) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }
    return () => document.body.classList.remove('sidebar-open');
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  if (user) {
    const allowed = canAccessPath(pathname, roleNames);
    if (!allowed) return <Navigate to={getDefaultPath(roleNames)} replace />;
  }

  const visibleItems = MENU_ITEMS.filter((item) => canAccessPath(item.path, roleNames));
  const visibleGlobalVendor = GLOBAL_VENDOR_ITEMS.filter((item) => canAccessPath(item.path, roleNames));

  return (
    <div className="app-layout">
      <div
        className={`sidebar-overlay ${menuOpen ? 'is-open' : ''}`}
        onClick={closeMenu}
        onKeyDown={(e) => e.key === 'Escape' && closeMenu()}
        role="button"
        tabIndex={-1}
        aria-hidden="true"
      />
      <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand-wrap">
          <div className="sidebar-brand">Sentinel</div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={closeMenu}
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>
        <nav className="sidebar-nav" onClick={closeMenu}>
          {roleNames.includes('Admin') ? (
            // Admin: use Product Hub to switch; sidebar only shows the current area's pages.
            globalVendorsShell ? (
              visibleGlobalVendor.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))
            ) : (
              visibleItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))
            )
          ) : (
            // Non-admin: unified sidebar showing Sentinel + Global Vendors together.
            <>
              {visibleItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
              {visibleGlobalVendor.length > 0 &&
                visibleGlobalVendor.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}
                  >
                    {item.label}
                  </NavLink>
                ))}
            </>
          )}
        </nav>
      </aside>
      <div className="app-main-wrap">
        <header className="app-header">
          <button
            type="button"
            className="header-menu-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
          <span className="app-header-title">Sentinel Supplier Assurance</span>
          <div className="app-header-actions">
            {roleNames.includes('Admin') && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigate('/product-hub')}
              >
                Product hub
              </button>
            )}
            <span className="app-header-user">
              {user?.email}
              {user?.roleNames?.length ? (
                <span style={{ marginLeft: 4, color: 'var(--color-text-subtle)' }}>
                  ({user.roleNames.join(', ')})
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="btn btn-ghost"
            >
              Log out
            </button>
          </div>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
      <ConfirmDialog
        open={showLogoutConfirm}
        title="Log out"
        message="Are you sure you want to log out?"
        confirmLabel="Log out"
        cancelLabel="Cancel"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          logout();
          navigate('/login');
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
