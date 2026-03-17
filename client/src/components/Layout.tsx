/**
 * App layout: sidebar (role-based menu), header, outlet.
 * Mobile: sidebar becomes overlay drawer; hamburger toggles menu.
 */
import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccessPath, getDefaultPath, SUPPLIER_PATHS } from '../config/rolePageAccess';

const MENU_ITEMS: { path: string; label: string }[] = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/risk', label: 'Risk' },
  { path: '/corrective-actions', label: 'Corrective Actions' },
  { path: '/car-record', label: 'CAR Record' },
  { path: '/findings', label: 'Findings' },
  { path: '/findings-record', label: 'Findings Record' },
  { path: '/audits', label: 'Audits' },
  { path: '/supplier-profile', label: 'Supplier Profile' },
  { path: '/supplier-list', label: 'Supplier List' },
  { path: '/suppliers-map', label: 'Suppliers Map' },
  { path: '/records', label: 'Records' },
  { path: '/shipments', label: 'Shipments' },
  { path: '/documents', label: 'Documents' },
  { path: '/internal-management', label: 'Internal Management' },
  { path: '/admin', label: 'Admin' },
];

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
  const roleNames = user?.roleNames ?? [];
  const isSupplier = roleNames.includes('Supplier');
  const pathname = location.pathname;

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
    if (isSupplier) {
      const allowed = SUPPLIER_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
      if (!allowed) return <Navigate to="/supplier-profile" replace />;
    } else {
      const allowed = canAccessPath(pathname, roleNames);
      if (!allowed) return <Navigate to={getDefaultPath(roleNames)} replace />;
    }
  }

  const canCreateFinding = roleNames.some((r) => ['Admin', 'QualityEngineer', 'Auditor'].includes(r));

  const visibleItems = MENU_ITEMS.filter((item) => {
    if (isSupplier) {
      return ['/supplier-profile', '/records', '/shipments'].includes(item.path);
    }
    if (!canAccessPath(item.path, roleNames)) return false;
    // Viewer/Buyer: hide "Findings Record" in sidebar — they open records only from the Findings list
    if (item.path === '/findings-record' && !canCreateFinding) return false;
    return true;
  });

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
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
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
          <span className="app-header-title">Supplier Assurance Platform</span>
          <div className="app-header-actions">
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
              onClick={() => {
                logout();
                navigate('/login');
              }}
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
    </div>
  );
}
